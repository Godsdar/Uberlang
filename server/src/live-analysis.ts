import { analysisWarnings } from '../../src/shared/analysis-policy.ts'
import { conceptData } from '../../src/data/reading-fixtures.mjs'
import { analyzeSelection, type AnalysisInput } from './analysis.ts'
import { explainSentence } from './sentence-meaning.ts'
import { ServiceError } from './errors.ts'

export interface ParsedToken {
  id: number; text: string; start: number; end: number; lemma: string; pos: string
  features: Record<string, string>; head: number; relation: string; explanation: string
}
export interface ParsedSentence {
  language: string; tokens: ParsedToken[]; engine: string; model: string; version: string; warnings: string[]
  modelVersion?: string; dependencyScheme?: string; license?: string; source?: string
}
export type Parse = (text: string, signal: AbortSignal, language: string) => Promise<unknown>
const invalid = () => new ServiceError(502, 'INVALID_ANALYSIS', 'The language engine returned an invalid analysis')
const object = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

/** Validate external model output before it reaches graphs or reports. */
export function validateParse(value: unknown, text: string, language = 'en'): ParsedSentence {
  if (!object(value) || value.language !== language || !Array.isArray(value.tokens) || value.tokens.length < 1 || value.tokens.length > 150) throw invalid()
  for (const key of ['engine', 'model', 'version']) if (typeof value[key] !== 'string' || !value[key] || (value[key] as string).length > 100) throw invalid()
  const count = value.tokens.length
  let previous = 0
  const tokens = value.tokens.map((t: unknown, index: number) => {
    if (!object(t) || t.id !== index + 1 || !Number.isInteger(t.start) || !Number.isInteger(t.end) ||
      typeof t.start !== 'number' || typeof t.end !== 'number' || t.start < previous || t.end <= t.start || t.end > text.length ||
      typeof t.text !== 'string' || text.slice(t.start, t.end) !== t.text || text.slice(previous, t.start).trim() ||
      !Number.isInteger(t.head) || typeof t.head !== 'number' || t.head < 0 || t.head > count || t.head === index + 1 ||
      !object(t.features) || Object.values(t.features).some(v => typeof v !== 'string')) throw invalid()
    for (const key of ['lemma', 'pos', 'relation']) if (typeof t[key] !== 'string' || !t[key] || (t[key] as string).length > 500) throw invalid()
    previous = t.end
    return { ...t, explanation: typeof t.explanation === 'string' ? t.explanation.slice(0, 1000) : '' } as unknown as ParsedToken
  })
  if (text.slice(previous).trim() || tokens.filter(t => t.head === 0).length !== 1) throw invalid()
  for (const token of tokens) {
    const seen = new Set<number>(); let id = token.id
    while (id) { if (seen.has(id)) throw invalid(); seen.add(id); id = tokens[id - 1].head }
  }
  if (!Array.isArray(value.warnings) || value.warnings.length > 10 || value.warnings.some(w => typeof w !== 'string' || w.length > 1000)) throw invalid()
  const details: Record<string, string> = {}
  for (const key of ['modelVersion', 'dependencyScheme', 'license', 'source']) if (typeof value[key] === 'string' && (value[key] as string).length < 300) details[key] = value[key] as string
  return { ...details, language, tokens, engine: value.engine as string, model: value.model as string, version: value.version as string, warnings: value.warnings }
}

export function liveResult(input: AnalysisInput, raw: unknown) {
  const prepared = analyzeSelection(input)
  const parsed = validateParse(raw, input.text, input.language)
  const selected = parsed.tokens.find(t => t.start === input.selection.start && t.end === input.selection.end)
  const family = selected ? (conceptData.families as Record<string, unknown>)[selected.lemma.toLowerCase()] : undefined
  const provenance = { language: parsed.language, engine: parsed.engine, model: parsed.model, version: parsed.version, modelVersion: parsed.modelVersion, dependencyScheme: parsed.dependencyScheme, license: parsed.license, source: parsed.source, live: true }
  return { ...prepared, warnings: [...analysisWarnings, ...parsed.warnings], layers: {
    ...prepared.layers,
    meaning: prepared.layers.meaning.status === 'prepared' ? prepared.layers.meaning : { status: 'live', provenance: { ...provenance, engine: 'grammar-reading' }, data: explainSentence(parsed.tokens) },
    grammar: { status: 'live', provenance, data: { scope: 'sentence', tokens: parsed.tokens.map(t => ({ ...t, start: input.contextStart + t.start, end: input.contextStart + t.end })) } },
    etymology: family ? { status: 'prepared', provenance: { engine: 'curated-word-families', version: '2026-10-11', live: false }, data: family } : { status: 'unavailable', reason: 'No sourced word family is available for this selection.' }
  } }
}

export function httpParser(url: string, key: string, bypass?: string): Parse {
  return async (text, signal, language) => {
    const response = await fetch(url, { method: 'POST', redirect: 'error', signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}`, ...(bypass ? { 'x-vercel-protection-bypass': bypass } : {}) },
      body: JSON.stringify({ text, language }) })
    if (response.status === 422) throw new ServiceError(422, 'SENTENCE_REQUIRED', 'Select one sentence for analysis')
    if (!response.ok) {
      console.warn(JSON.stringify({ event: 'engine_http_failure', status: response.status }))
      throw new ServiceError(503, 'ENGINE_UNAVAILABLE', 'Language analysis is temporarily unavailable', 10)
    }
    // Bound even a misconfigured upstream before JSON decoding.
    const reader = response.body?.getReader(); if (!reader) throw invalid()
    let size = 0; const chunks: Uint8Array[] = []
    try {
      while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > 131072) throw invalid(); chunks.push(value) }
    } finally { await reader.cancel() }
    try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch { throw invalid() }
  }
}
