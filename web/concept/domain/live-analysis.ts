import { languageIssue, textIssue } from '../../../src/shared/analysis-policy.ts'
import type { Token } from './graphs'
import type { Sentence } from './selection'

export interface AnalysisRequest {
  documentId: string
  language: string
  text: string
  contextStart: number
  selection: { start: number; end: number }
}
export interface LiveContext {
  request: AnalysisRequest
  example: Sentence
  offset: number
  status: 'live' | 'prepared'
  provenance: { language?: string; engine: string; model?: string; version: string; live: boolean }
  warnings: string[]
  meaning?: { kind: 'structure'; explanation: string; caveat: string }
}

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const boundary = (text: string, index: number) =>
  !(/[\uD800-\uDBFF]/.test(text[index - 1] ?? '') && /[\uDC00-\uDFFF]/.test(text[index] ?? ''))

/** Send one complete sentence, never silently truncate a long document or selection. */
export function sentenceRequest(documentId: string, document: string, start: number, end: number, language: string): AnalysisRequest {
  if (!document.trim() || !Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || end > document.length || !boundary(document, start) || !boundary(document, end)) {
    throw new Error('Select a word or place the cursor in an English sentence.')
  }
  const point = start === end && start === document.length ? Math.max(0, start - 1) : start
  const segmenter = new Intl.Segmenter('en', { granularity: 'sentence' })
  for (const segment of segmenter.segment(document)) {
    const rawEnd = segment.index + segment.segment.length
    if (point < segment.index || point >= rawEnd) continue
    const text = segment.segment.trim()
    const contextStart = segment.index + segment.segment.indexOf(text)
    const contextEnd = contextStart + text.length
    if (start !== end && (start < contextStart || end > contextEnd)) throw new Error('Select words within one sentence. Analyze other sentences separately.')
    const issue = textIssue(text) ?? languageIssue(language, text)
    if (issue) throw new Error(`${issue.message} Your text has not been sent.`)
    return { documentId, language, text, contextStart,
      selection: start === end ? { start: 0, end: text.length } : { start: start - contextStart, end: end - contextStart } }
  }
  throw new Error('Place the cursor inside a sentence to analyze it.')
}

/** Reject foreign/stale envelopes and malformed graphs before any SVG traversal. */
export function parseAnalysis(value: unknown, request: AnalysisRequest): LiveContext {
  const invalid = () => new Error('The analysis service returned an invalid result. Please try again.')
  if (!record(value) || value.schemaVersion !== 1 || value.language !== request.language || value.documentId !== request.documentId || value.contextStart !== request.contextStart || value.coordinateSystem !== 'UTF-16, end-exclusive' || !record(value.selection) || value.selection.start !== request.selection.start || value.selection.end !== request.selection.end || value.selection.absoluteStart !== request.contextStart + request.selection.start || value.selection.absoluteEnd !== request.contextStart + request.selection.end || value.selection.text !== request.text.slice(request.selection.start, request.selection.end) || !record(value.layers) || !record(value.layers.grammar)) throw invalid()
  const grammar = value.layers.grammar
  if (grammar.status !== 'live' && grammar.status !== 'prepared') throw new Error('Grammar is unavailable for this sentence on this deployment. Only exact prepared examples work offline; a live engine is required for new text.')
  if (!record(grammar.provenance) || (grammar.status === 'live' && grammar.provenance.language !== request.language) || typeof grammar.provenance.engine !== 'string' || !grammar.provenance.engine || typeof grammar.provenance.version !== 'string' || typeof grammar.provenance.live !== 'boolean' || grammar.provenance.live !== (grammar.status === 'live') || (grammar.provenance.model !== undefined && typeof grammar.provenance.model !== 'string') || !record(grammar.data) || grammar.data.scope !== 'sentence' || !Array.isArray(grammar.data.tokens) || grammar.data.tokens.length < 1 || grammar.data.tokens.length > 200) throw invalid()
  let previousEnd = 0
  const tokens: Token[] = grammar.data.tokens.map((item: unknown, index: number) => {
    if (!record(item) || item.id !== index + 1 || typeof item.text !== 'string' || !item.text || !Number.isInteger(item.start) || !Number.isInteger(item.end) || !Number.isInteger(item.head) || typeof item.lemma !== 'string' || typeof item.pos !== 'string' || typeof item.relation !== 'string' || !record(item.features) || Object.values(item.features).some(v => typeof v !== 'string') || (item.explanation !== undefined && typeof item.explanation !== 'string')) throw invalid()
    const start = (item.start as number) - request.contextStart, end = (item.end as number) - request.contextStart
    if (request.text.slice(previousEnd, start).trim() || start < previousEnd || end <= start || end > request.text.length || !boundary(request.text, start) || !boundary(request.text, end) || request.text.slice(start, end) !== item.text) throw invalid()
    previousEnd = end
    return { text: item.text, start, end, lemma: item.lemma, pos: item.pos, head: item.head as number, relation: item.relation, features: item.features as Record<string, string>, explanation: typeof item.explanation === 'string' ? item.explanation : '' }
  })
  if (request.text.slice(previousEnd).trim() || tokens.filter(t => t.head === 0).length !== 1) throw invalid()
  tokens.forEach((token, index) => {
    if (token.head < 0 || token.head > tokens.length || token.head === index + 1) throw invalid()
    const seen = new Set<number>([index + 1])
    let head = token.head
    while (head) {
      if (seen.has(head) || !tokens[head - 1]) throw invalid()
      seen.add(head); head = tokens[head - 1].head
    }
  })
  const provenance = grammar.provenance as LiveContext['provenance']
  const warnings = Array.isArray(value.warnings) ? value.warnings.filter((w): w is string => typeof w === 'string') : []
  if (Array.isArray(grammar.warnings)) warnings.push(...grammar.warnings.filter((w): w is string => typeof w === 'string'))
  let meaning: LiveContext['meaning']
  const meaningLayer = value.layers.meaning
  if (record(meaningLayer) && meaningLayer.status === 'live' && record(meaningLayer.data) && meaningLayer.data.kind === 'structure') {
    if (typeof meaningLayer.data.explanation !== 'string' || typeof meaningLayer.data.caveat !== 'string' || meaningLayer.data.scope !== 'sentence') throw invalid()
    meaning = { kind: 'structure', explanation: meaningLayer.data.explanation, caveat: meaningLayer.data.caveat }
  }
  return { request, offset: request.contextStart, status: grammar.status, provenance, warnings, meaning,
    example: { id: `analysis-${request.documentId}-${request.contextStart}`, text: request.text, tokens, phrases: [], explanation: '', translation: '' } }
}

/** An invalidated request cannot publish even if an upstream ignores cancellation. */
export class AnalysisRequestGate {
  private version = 0
  private controller: AbortController | null = null
  invalidate() { this.version++; this.controller?.abort(); this.controller = null }
  begin() {
    this.invalidate()
    const version = this.version
    const controller = new AbortController()
    this.controller = controller
    return { signal: controller.signal, current: () => version === this.version && !controller.signal.aborted }
  }
}

/** Parser token boundaries take precedence inside its context (including contractions). */
export function readingRanges(document: string, context?: { example: Sentence; offset: number } | null) {
  const words = [...document.matchAll(/[\p{L}\p{M}\p{N}]+(?:['’][\p{L}\p{M}\p{N}]+)*/gu)]
    .map(match => ({ start: match.index, end: match.index + match[0].length, text: match[0] }))
  if (!context) return words
  const from = context.offset, to = from + context.example.text.length
  return words.filter(word => word.end <= from || word.start >= to).concat(context.example.tokens.map(token => ({
    start: from + token.start, end: from + token.end, text: token.text
  }))).sort((a, b) => a.start - b.start)
}
