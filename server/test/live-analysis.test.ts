import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildApp } from '../src/app.ts'
import { readConfig } from '../src/config.ts'
import { validateParse, liveResult, httpParser } from '../src/live-analysis.ts'
import { publicOriginAllowed, clientAddress } from '../src/public-gateway.ts'
import type { IncomingMessage } from 'node:http'

const text = 'Birds sing.'
const parsed = { language: 'en', engine: 'spaCy', model: 'en_core_web_sm', version: '3.8.7', warnings: ['Statistical analysis can be wrong.'], tokens: [
  { id: 1, text: 'Birds', start: 0, end: 5, lemma: 'bird', pos: 'NOUN', features: { Number: 'Plur' }, head: 2, relation: 'nsubj' },
  { id: 2, text: 'sing', start: 6, end: 10, lemma: 'sing', pos: 'VERB', features: { Tense: 'Pres' }, head: 0, relation: 'root' },
  { id: 3, text: '.', start: 10, end: 11, lemma: '.', pos: 'PUNCT', features: {}, head: 2, relation: 'punct' }
] }
const input = { documentId: 'version-1', language: 'en' as const, text, contextStart: 20, selection: { start: 0, end: 5 } }

test('live API handles unseen sentences with structure reading and independently unavailable etymology', async t => {
  const { app } = await buildApp(readConfig({}), { parse: async actual => { assert.equal(actual, text); return parsed } }); t.after(() => app.close())
  const response = await app.inject({ method: 'POST', url: '/v1/analysis', payload: input })
  assert.equal(response.statusCode, 200)
  const data = response.json()
  assert.equal(data.layers.grammar.status, 'live')
  assert.equal(data.layers.grammar.data.tokens[0].start, 20)
  assert.equal(data.layers.meaning.status, 'live')
  assert.equal(data.layers.meaning.provenance.engine, 'grammar-reading')
  assert.equal(data.layers.meaning.data.kind, 'structure')
  assert.match(data.layers.meaning.data.caveat, /does not resolve word senses/)
  assert.equal(data.layers.etymology.status, 'unavailable')
  assert.ok(data.warnings.includes(parsed.warnings[0]))
  assert.equal((await app.inject('/v1/capabilities')).json().analysis.liveGrammar, true)
})
test('model boundaries reject cycles, wrong slices, missing tokens and forged ranges', () => {
  for (const edit of [
    (p: typeof parsed) => { p.tokens[0].head = 3; p.tokens[2].head = 1 },
    (p: typeof parsed) => { p.tokens[0].start = 1 },
    (p: typeof parsed) => { p.tokens.pop() },
    (p: typeof parsed) => { p.tokens[0].text = 'cat' },
    (p: typeof parsed) => { p.tokens[2].head = 100 }
  ]) { const changed = structuredClone(parsed); edit(changed); assert.throws(() => validateParse(changed, text)) }
  assert.equal(liveResult(input, parsed).selection.absoluteStart, 20)
})
test('public gateway trusts exact origins and platform IP only in Vercel', () => {
  const env = { VERCEL: '1', VERCEL_URL: 'build.vercel.app', LINGUA_PUBLIC_ORIGIN: 'https://uberlang.vercel.app', LINGUA_PREVIOUS_PUBLIC_ORIGIN: 'https://lingua-lac.vercel.app' }
  assert.equal(publicOriginAllowed('https://uberlang.vercel.app', env), true)
  assert.equal(publicOriginAllowed('https://lingua-lac.vercel.app', env), true)
  assert.equal(publicOriginAllowed('https://uberlang.vercel.app.evil.test', env), false)
  assert.equal(publicOriginAllowed('http://uberlang.vercel.app', env), false)
  assert.equal(publicOriginAllowed('https://build.vercel.app', env), true)
  assert.equal(publicOriginAllowed('https://lingua-lac.vercel.app.evil.test', env), false)
  assert.equal(publicOriginAllowed(undefined, env), false)
  const request = { headers: { 'x-forwarded-for': '198.51.100.1' }, socket: { remoteAddress: '127.0.0.1' } } as unknown as IncomingMessage
  assert.equal(clientAddress(request, {}), '127.0.0.1')
  assert.equal(clientAddress(request, env), '198.51.100.1')
})
test('private parser rejects oversized payloads and never forwards raw model errors', async t => {
  const original = globalThis.fetch; t.after(() => { globalThis.fetch = original })
  globalThis.fetch = async () => new Response('secret model error', { status: 500 })
  await assert.rejects(httpParser('https://test.invalid', 'test')(text, new AbortController().signal, 'en'), /temporarily unavailable/)
  globalThis.fetch = async () => new Response('x'.repeat(131073))
  await assert.rejects(httpParser('https://test.invalid', 'test')(text, new AbortController().signal, 'en'), /invalid analysis/)
})

test('language and script boundaries reject the shared corpus before calling a configured engine', async t => {
  const { readFileSync } = await import('node:fs')
  const corpus = JSON.parse(readFileSync(new URL('../../src/data/analysis-corpus.json', import.meta.url), 'utf8'))
  let calls = 0
  const { app } = await buildApp(readConfig({ LINGUA_RATE_MAX: '1000' }), { parse: async () => { calls++; return parsed } }); t.after(() => app.close())
  for (const item of corpus.filter((item: { expected: string }) => item.expected !== 'accepted')) {
    const response = await app.inject({method:'POST',url:'/v1/analysis',payload:{...input,language:item.language,text:item.text,selection:{start:0,end:item.text.length}}})
    assert.equal(response.statusCode,422,item.id)
    assert.equal(response.json().error.code,item.expected,item.id)
  }
  assert.equal(calls,0)
  const caps=(await app.inject('/v1/capabilities')).json()
  assert.deepEqual(caps.analysis.languages,['en'])
  assert.equal(caps.analysis.languageDetection,false)
  assert.equal(caps.analysis.readiness,'configuration-only')
  assert.equal(caps.limits.sentences,1)
})
test('declared language reaches the private worker and a wrong-language response is rejected', async t => {
  const original=globalThis.fetch; t.after(()=>{globalThis.fetch=original})
  globalThis.fetch=async (_url, options)=>{
    assert.deepEqual(JSON.parse(String(options?.body)),{text,language:'en'})
    return Response.json(parsed)
  }
  assert.equal(validateParse(await httpParser('https://test.invalid','test')(text,new AbortController().signal,'en'),text).language,'en')
  assert.throws(()=>validateParse({...parsed,language:'ru'},text),/invalid analysis/)
})
