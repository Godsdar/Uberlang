import { historyTarget, historyLanguages } from '../../../src/shared/etymology.ts'
import type { Family, FamilyNode, Token } from './graphs'

export interface LexiconRequest {
  documentId: string
  language: 'en'
  word: string
  selection: { start: number; end: number }
}
export interface LexicalSense { id: string; pos: string; definition: string; source: string; etymologyId: string }
export interface SourcedFamily extends Family { id: string; label: string; direction: 'sources' }
export interface LexicalProvenance { engine: string; version: string; live: true; source: string; license: string }
export interface LexicalResult {
  request: LexiconRequest
  senses: LexicalSense[]
  families: SourcedFamily[]
  definitionsNote: string
  etymologyNote: string
  definitionsReason: string
  etymologyReason: string
  provenance: LexicalProvenance | null
  warnings: string[]
}
const object = (x: unknown): x is Record<string, unknown> => Boolean(x) && typeof x === 'object' && !Array.isArray(x)
const text = (x: unknown, max = 5000): x is string => typeof x === 'string' && x.length <= max
const required = (x: unknown, max = 5000): x is string => text(x, max) && x.trim().length > 0
const invalid = () => new Error('The dictionary returned an invalid result. Please retry the lookup.')
const source = (x: unknown): x is string => {
  if (!text(x, 2000)) return false
  try { const url = new URL(x); return url.protocol === 'https:' && ['en.wiktionary.org', 'ru.wiktionary.org'].includes(url.hostname) && !url.username && !url.password && (url.pathname.startsWith('/wiki/') || (url.pathname === '/w/index.php' && /^\d+$/.test(url.searchParams.get('oldid') ?? ''))) } catch { return false }
}

/** A lookup is tied to one occurrence; its model lemma never changes the source text. */
export function selectedLexicalWord(document: string, start: number, end: number, token?: Token | null): string | null {
  if (start < 0 || end <= start || end > document.length) return null
  const selected = document.slice(start, end)
  if (!/^[\p{L}]+(?:['’\-][\p{L}]+)*$/u.test(selected)) return null
  const lemma = (token?.lemma || selected).trim().toLowerCase()
  return lemma.length <= 80 && /^[\p{L}]+(?:['’\- ][\p{L}]+)*$/u.test(lemma) ? lemma : null
}

export function lexicalMatches(result: LexicalResult | null, request: LexiconRequest): boolean {
  return Boolean(result && result.request.documentId === request.documentId && result.request.word === request.word && result.request.selection.start === request.selection.start && result.request.selection.end === request.selection.end)
}

function provenance(value: unknown): LexicalProvenance {
  if (!object(value) || !required(value.engine, 100) || !required(value.version, 100) || value.live !== true || !source(value.source) || value.license !== 'CC BY-SA 4.0') throw invalid()
  return { engine: value.engine, version: value.version, live: true, source: value.source, license: value.license }
}

export function parseSourcedFamily(value: unknown): SourcedFamily {
  if (!object(value) || !required(value.id, 100) || !required(value.label, 200) || value.direction !== 'sources' || !text(value.note) || (value.historyText !== undefined && !text(value.historyText, 3000)) || !required(value.attribution, 1000) || !required(value.verifiedOn, 100) || !Array.isArray(value.nodes) || !value.nodes.length || value.nodes.length > 40) throw invalid()
  const nodes: FamilyNode[] = value.nodes.map((n: unknown) => {
    if (!object(n) || !required(n.id, 200) || !(n.parent === null || required(n.parent, 200)) || !required(n.label, 200) || !required(n.lang, 100) || !source(n.source) || (n.edgeSource !== undefined && !source(n.edgeSource)) || !Array.isArray(n.skipped) || n.skipped.length > 20 || n.skipped.some(v => !text(v, 200)) || (n.reconstructed !== undefined && typeof n.reconstructed !== 'boolean') || (n.condensed !== undefined && typeof n.condensed !== 'boolean') || (n.gloss !== undefined && !text(n.gloss)) || (n.parent !== null && !['inherited', 'borrowed', 'derived', 'component', 'form-of', 'cognate', 'descendant', 'descendant-borrowed', 'related', 'derivative'].includes(String(n.relation)))) throw invalid()
    const lookup = n.lookup === undefined ? undefined : object(n.lookup) && typeof n.lookup.language === 'string' && typeof n.lookup.term === 'string' ? historyTarget(n.lookup.language, n.lookup.term) : undefined
    if (n.lookup !== undefined && (!lookup || historyLanguages[lookup.language] !== n.lang)) throw invalid()
    if ((n.historyState !== undefined && n.historyState !== 'unavailable') || (n.historyNote !== undefined && !text(n.historyNote))) throw invalid()
    return { lookup, historyState: n.historyState as 'unavailable' | undefined, historyNote: n.historyNote as string | undefined, id: n.id, parent: n.parent, label: n.label, lang: n.lang, source: n.source, edgeSource: n.edgeSource as string | undefined, reconstructed: n.reconstructed as boolean | undefined, condensed: n.condensed as boolean | undefined, skipped: n.skipped as string[], gloss: n.gloss as string | undefined, relation: n.relation as FamilyNode['relation'] }
  })
  if (new Set(nodes.map(n => n.id)).size !== nodes.length || nodes.filter(n => n.parent === null).length !== 1) throw invalid()
  const byId = new Map(nodes.map(n => [n.id, n]))
  for (const node of nodes) {
    const seen = new Set<string>(); let current: FamilyNode | undefined = node
    while (current) {
      if (seen.has(current.id)) throw invalid()
      seen.add(current.id)
      if (current.parent !== null && !byId.has(current.parent)) throw invalid()
      current = current.parent ? byId.get(current.parent) : undefined
    }
  }
  return { id: value.id, label: value.label, direction: 'sources', nodes, note: value.note, ...(typeof value.historyText === 'string' && { historyText: value.historyText }), attribution: value.attribution, verifiedOn: value.verifiedOn }
}

export function parseLexicon(value: unknown, request: LexiconRequest): LexicalResult {
  if (!object(value) || value.schemaVersion !== 1 || value.documentId !== request.documentId || value.word !== request.word || !object(value.selection) || value.selection.start !== request.selection.start || value.selection.end !== request.selection.end || !object(value.layers) || !object(value.layers.definitions) || !object(value.layers.etymology)) throw invalid()
  const definitions = value.layers.definitions, etymology = value.layers.etymology
  const result: LexicalResult = { request, senses: [], families: [], definitionsNote: '', etymologyNote: '', definitionsReason: '', etymologyReason: '', provenance: null, warnings: [] }
  if (definitions.status === 'sourced') {
    result.provenance = provenance(definitions.provenance)
    if (!object(definitions.data) || !Array.isArray(definitions.data.senses) || definitions.data.senses.length > 30 || !text(definitions.data.note)) throw invalid()
    result.definitionsNote = definitions.data.note
    result.senses = definitions.data.senses.map((s: unknown) => {
      if (!object(s) || !required(s.id, 100) || !required(s.pos, 100) || !required(s.definition) || !source(s.source) || !required(s.etymologyId, 100)) throw invalid()
      return { id: s.id, pos: s.pos, definition: s.definition, source: s.source, etymologyId: s.etymologyId }
    })
  } else if (definitions.status === 'unavailable' && text(definitions.reason)) result.definitionsReason = definitions.reason
  else throw invalid()
  if (etymology.status === 'sourced') {
    const evidence = provenance(etymology.provenance); result.provenance ??= evidence
    if (!object(etymology.data) || !Array.isArray(etymology.data.families) || etymology.data.families.length > 12 || !text(etymology.data.note)) throw invalid()
    result.etymologyNote = etymology.data.note
    result.families = etymology.data.families.map(parseSourcedFamily)
    if (new Set(result.families.map(f => f.id)).size !== result.families.length) throw invalid()
  } else if (etymology.status === 'unavailable' && text(etymology.reason)) result.etymologyReason = etymology.reason
  else throw invalid()
  if (Array.isArray(value.warnings)) {
    if (value.warnings.length > 10 || value.warnings.some(w => !text(w, 2000))) throw invalid()
    result.warnings = value.warnings as string[]
  }
  return result
}

export const isWiktionarySource = source
