import { analysisCapabilities, analysisLimits } from '../../src/shared/analysis-policy.ts'
import type { HistoryTarget } from '../../src/shared/etymology.ts'
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto'
import Fastify, { LogController } from 'fastify'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import swagger from '@fastify/swagger'
import { translate } from '../../src/core/providers.ts'
import type { TranslateRequest } from '../../src/shared/types.ts'
import { analyzeSelection, validateText, type AnalysisInput } from './analysis.ts'
import { httpParser, liveResult, type Parse } from './live-analysis.ts'
import { createLexiconLookup, createHistoryLookup, createPageCache, type LexiconInput, type LookupPages } from './lexicon.ts'
import { ProviderGuard } from './resilience.ts'
import { ServiceError } from './errors.ts'
import type { Config } from './config.ts'
import { analysisSchema, translationSchema, analysisResponse, translationResponse, errors, lexiconSchema, historySchema } from './schemas.ts'

export async function buildApp(config: Config, dependencies: {
  parse?: Parse
  lookupPages?: LookupPages
  translate?: typeof translate
  logger?: boolean | { stream: NodeJS.WritableStream }
} = {}) {
  const app = Fastify({
    logger: dependencies.logger ?? false,
    logController: new LogController({ disableRequestLogging: true }),
    genReqId: () => randomUUID(), requestIdHeader: false, trustProxy: false,
    bodyLimit: 16384, requestTimeout: 10000, connectionTimeout: 15000, keepAliveTimeout: 5000,
    ajv: { customOptions: { removeAdditional: false, coerceTypes: false, useDefaults: false } }
  })
  const parse = dependencies.parse ?? (config.engineUrl && config.apiKey ? httpParser(config.engineUrl, config.apiKey, process.env.VERCEL_AUTOMATION_BYPASS_SECRET) : undefined)
  const parsing = new ProviderGuard({ concurrency: 2, deadlineMs: 20000, service: 'Language analysis' })
  const pages = createPageCache(dependencies.lookupPages)
  const lexical = createLexiconLookup(dependencies.lookupPages, pages)
  const history = createHistoryLookup(pages)
  const lexicalGuard = new ProviderGuard({ concurrency: 2, deadlineMs: 7000, service: 'Dictionary lookup' })
  const shutdown = new AbortController()
  let draining = false
  const guard = new ProviderGuard({ concurrency: config.concurrency, deadlineMs: config.deadlineMs })
  const digest = (value: string) => createHash('sha256').update(value).digest()
  const expectedKey = config.apiKey ? digest(`Bearer ${config.apiKey}`) : null
  const cancellations = new WeakMap<object, AbortController>()
  const apiSecurity = [{ bearerAuth: [] }]

  await app.register(helmet)
  await app.register(swagger, { openapi: { info: { title: 'Uberlang API', version: '1.0.0', description: 'English language analysis and opt-in live translation. Capabilities identify the configured engine.' }, components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer' } } } } })
  await app.register(rateLimit, { max: config.rateMax, timeWindow: 60000, cache: 5000 })
  app.addHook('onRequest', async (request, reply) => {
    reply.header('X-Request-Id', request.id).header('Cache-Control', 'no-store')
    if (request.url.split('?')[0].startsWith('/health/')) return
    if (draining) throw new ServiceError(503, 'DRAINING', 'Server is restarting', 1)
    if (expectedKey && !timingSafeEqual(digest(request.headers.authorization ?? ''), expectedKey)) throw new ServiceError(401, 'UNAUTHORIZED', 'Valid API credentials required')
  })
  app.addHook('onResponse', async (request, reply) => {
    app.log.info({ requestId: request.id, route: request.routeOptions.url ?? 'unmatched', status: reply.statusCode, durationMs: reply.elapsedTime }, 'request completed')
  })
  app.addHook('preHandler', async (request, reply) => {
    const cancelled = new AbortController()
    cancellations.set(request, cancelled)
    const abort = () => cancelled.abort()
    request.raw.once('aborted', abort)
    reply.raw.once('close', () => {
      request.raw.removeListener('aborted', abort)
      if (!reply.raw.writableFinished) abort()
    })
  })
  app.setErrorHandler((error, request, reply) => {
    const known = error instanceof ServiceError
    const status = known ? error.status : typeof error === 'object' && error !== null && 'statusCode' in error && typeof error.statusCode === 'number' && error.statusCode >= 400 && error.statusCode < 500 ? error.statusCode : 500
    const codes: Record<number, string> = { 400: 'INVALID_REQUEST', 401: 'UNAUTHORIZED', 413: 'BODY_TOO_LARGE', 415: 'UNSUPPORTED_MEDIA_TYPE', 429: 'RATE_LIMITED' }
    if (known && error.retryAfter) reply.header('Retry-After', error.retryAfter)
    if (status === 401) reply.header('WWW-Authenticate', 'Bearer')
    reply.status(status).send({ requestId: request.id, error: { code: known ? error.code : codes[status] ?? 'INTERNAL_ERROR', message: known ? error.message : status < 500 ? 'Request rejected' : 'Request could not be completed' } })
  })
  app.setNotFoundHandler((request, reply) => reply.code(404).send({ requestId: request.id, error: { code: 'NOT_FOUND', message: 'Route not found' } }))
  app.get('/health/live', { config: { rateLimit: false }, schema: { hide: true } }, async () => ({ status: 'ok' }))
  app.get('/health/ready', { config: { rateLimit: false }, schema: { hide: true } }, async (_request, reply) => reply.code(draining ? 503 : 200).send({ status: draining ? 'draining' : 'ready' }))
  app.get('/v1/capabilities', { schema: { security: apiSecurity } }, async () => ({ version: 1, analysis: analysisCapabilities(Boolean(parse)), translation: { enabled: config.translationEnabled, sendsTextToProvider: true }, limits: analysisLimits, persistence: false }))
  app.get('/v1/openapi.json', { schema: { hide: true } }, async () => app.swagger())
  app.post<{ Body: AnalysisInput }>('/v1/analysis', { schema: { security: apiSecurity, body: analysisSchema, response: { 200: analysisResponse, ...errors } } }, async request => {
    const prepared = analyzeSelection(request.body)
    if (!parse) return { requestId: request.id, ...prepared }
    const parent = AbortSignal.any([shutdown.signal, cancellations.get(request)!.signal])
    const raw = await parsing.run(signal => parse(request.body.text, signal, request.body.language), parent)
    return { requestId: request.id, ...liveResult(request.body, raw) }
  })
  app.post<{ Body: LexiconInput }>('/v1/lexicon', { schema: { security: apiSecurity, body: lexiconSchema } }, async request => {
    const parent = AbortSignal.any([shutdown.signal, cancellations.get(request)!.signal])
    const result = await lexicalGuard.run(signal => lexical(request.body, signal), parent)
    return { requestId: request.id, ...result }
  })
  app.post<{ Body: HistoryTarget }>('/v1/etymology', { schema: { security: apiSecurity, body: historySchema } }, async request => {
    const parent = AbortSignal.any([shutdown.signal, cancellations.get(request)!.signal])
    const result = await lexicalGuard.run(signal => history(request.body, signal), parent)
    return { requestId: request.id, ...result }
  })
  app.post<{ Body: TranslateRequest }>('/v1/translation', { schema: { security: apiSecurity, body: translationSchema, response: { 200: translationResponse, ...errors } } }, async request => {
    validateText(request.body.text)
    if (!config.translationEnabled) throw new ServiceError(503, 'TRANSLATION_DISABLED', 'Live translation is not enabled')
    const parent = AbortSignal.any([shutdown.signal, cancellations.get(request)!.signal])
    const result = await guard.run(signal => (dependencies.translate ?? translate)(request.body.text, request.body.from, request.body.to, signal), parent)
    return { requestId: request.id, ...result }
  })
  const drain = () => { draining = true; shutdown.abort() }
  app.addHook('preClose', async () => { drain() })
  return { app, drain }
}
