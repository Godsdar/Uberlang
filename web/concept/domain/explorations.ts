import { familyHierarchy, type Family } from './graphs.ts'
import { historyKey, historyLanguages, historyTarget } from '../../../src/shared/etymology.ts'
import { isWiktionarySource } from './lexicon.ts'

export interface ExplorerView {
  selectedId: string; endpoints: string[]; pathOnly: boolean; zoom: number
  scrollLeft: number; scrollTop: number
  visited?: string[]; cursor?: number
}
export interface Discovery {
  id: string; word: string; language: string; family: Family; view?: ExplorerView
  note: string; marks: Record<string, 'known' | 'curious'>; updatedAt: string
  context?: string
}
export interface DiscoveryLibrary {
  version: 1; activeId: string | null; languages: string[]; discoveries: Discovery[]
}
export const DISCOVERY_KEY = 'uberlang.explorations.v1'
export const MAX_BACKUP = 2_000_000
export const emptyLibrary = (): DiscoveryLibrary => ({ version: 1, activeId: null, languages: [], discoveries: [] })
const object = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x)
const string = (x: unknown, max: number): x is string => typeof x === 'string' && x.length <= max
const bad = () => new Error('This exploration file is invalid or unsupported. Your saved discoveries were not changed.')

/** Saved graphs can contain continuations; the network parser intentionally accepts only immediate sources. */
export function validateFamily(value: unknown): Family {
  if (!object(value) || !Array.isArray(value.nodes) || !value.nodes.length || value.nodes.length > 64 ||
    !string(value.note, 5000) || !string(value.attribution, 1000) || !string(value.verifiedOn, 100) ||
    (value.id !== undefined && !string(value.id, 100)) || (value.label !== undefined && !string(value.label, 200)) ||
    (value.direction !== undefined && value.direction !== 'sources')) throw bad()
  for (const n of value.nodes) {
    if (!object(n) || !string(n.id, 200) || !n.id || !(n.parent === null || string(n.parent, 200)) ||
      !string(n.label, 200) || !n.label || !string(n.lang, 100) || !isWiktionarySource(n.source) ||
      (n.edgeSource !== undefined && !isWiktionarySource(n.edgeSource)) ||
      !Array.isArray(n.skipped) || n.skipped.length > 20 || n.skipped.some(x => !string(x, 200)) ||
      (n.gloss !== undefined && !string(n.gloss, 5000)) || (n.historyNote !== undefined && !string(n.historyNote, 5000)) ||
      (n.reconstructed !== undefined && typeof n.reconstructed !== 'boolean') ||
      (n.condensed !== undefined && typeof n.condensed !== 'boolean') ||
      (n.historyState !== undefined && !['expanded', 'unavailable', 'cycle'].includes(String(n.historyState))) ||
      (n.relation !== undefined && !['inherited', 'borrowed', 'derived', 'component', 'form-of'].includes(String(n.relation))) ||
      (value.direction === 'sources' && n.parent !== null && (!n.relation || !n.edgeSource))) throw bad()
    if (n.lookup !== undefined) {
      if (!object(n.lookup) || typeof n.lookup.language !== 'string' || typeof n.lookup.term !== 'string' ||
        !historyTarget(n.lookup.language, n.lookup.term) || historyLanguages[n.lookup.language] !== n.lang) throw bad()
    }
    if (n.historyChoice !== undefined && (!object(n.historyChoice) || !string(n.historyChoice.id, 100) ||
      !isWiktionarySource(n.historyChoice.source) || typeof n.historyChoice.readerSelected !== 'boolean')) throw bad()
  }
  const family = structuredClone(value) as unknown as Family
  try { familyHierarchy(family.nodes) } catch { throw bad() }
  return family
}

export function validateDiscovery(value: unknown): Discovery {
  if (!object(value) || !string(value.id, 100) || !value.id || !string(value.word, 200) || !value.word ||
    !string(value.language, 30) || !Object.hasOwn(historyLanguages, value.language) ||
    !string(value.note, 4000) || !string(value.updatedAt, 40) || !Number.isFinite(Date.parse(value.updatedAt)) ||
    !object(value.marks) || (value.context !== undefined && !string(value.context, 6000))) throw bad()
  const family = validateFamily(value.family), ids = new Set(family.nodes.map(n => n.id))
  if (Object.entries(value.marks).some(([id, mark]) => !ids.has(id) || !['known', 'curious'].includes(String(mark)))) throw bad()
  if (value.view !== undefined) {
    const v = value.view
    if (!object(v) || !string(v.selectedId, 200) || !ids.has(v.selectedId) || !Array.isArray(v.endpoints) ||
      v.endpoints.length > 64 || v.endpoints.some(id => typeof id !== 'string' || !ids.has(id)) ||
      (v.visited !== undefined && (!Array.isArray(v.visited) || !v.visited.length || v.visited.length > 100 || v.visited.some(id => typeof id !== 'string' || !ids.has(id)) || !Number.isInteger(v.cursor) || Number(v.cursor) < 0 || Number(v.cursor) >= v.visited.length || v.visited[Number(v.cursor)] !== v.selectedId)) ||
      typeof v.pathOnly !== 'boolean' || typeof v.zoom !== 'number' || ![.75, 1, 1.25, 1.5].includes(v.zoom) ||
      ![v.scrollLeft, v.scrollTop].every(n => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 100000)) throw bad()
  }
  return { ...structuredClone(value), family } as unknown as Discovery
}

export function parseLibrary(raw: string): DiscoveryLibrary {
  if (raw.length > MAX_BACKUP) throw bad()
  let value: unknown
  try { value = JSON.parse(raw) } catch { throw bad() }
  if (!object(value) || value.version !== 1 || !Array.isArray(value.discoveries) || value.discoveries.length > 30 ||
    !Array.isArray(value.languages) || value.languages.length > 40 || value.languages.some(l => typeof l !== 'string' || !Object.hasOwn(historyLanguages, l)) ||
    !(value.activeId === null || string(value.activeId, 100))) throw bad()
  const discoveries = value.discoveries.map(validateDiscovery)
  if (new Set(discoveries.map(d => d.id)).size !== discoveries.length ||
    (value.activeId !== null && !discoveries.some(d => d.id === value.activeId))) throw bad()
  return { version: 1, discoveries, activeId: value.activeId, languages: [...new Set(value.languages as string[])] }
}

/** A stale tab must not silently replace newer discoveries. A failed write leaves the old payload intact. */
export function writeLibrary(storage: Pick<Storage, 'getItem' | 'setItem'>, library: DiscoveryLibrary, expected: string | null): string {
  if (storage.getItem(DISCOVERY_KEY) !== expected) throw new Error('Discoveries changed in another tab. Download your current work, then reload the saved library.')
  const raw = JSON.stringify(library)
  if (raw.length > MAX_BACKUP || library.discoveries.length > 30) throw new Error('The local library is full. Download a backup and remove an older discovery before saving.')
  parseLibrary(raw)
  try { storage.setItem(DISCOVERY_KEY, raw) }
  catch { throw new Error('This browser could not save your discovery. Download a backup now; your current tree is still open.') }
  return raw
}

export function saveDiscovery(library: DiscoveryLibrary, discovery: Discovery): DiscoveryLibrary {
  const clean = validateDiscovery(discovery)
  return { ...library, activeId: clean.id, discoveries: [clean, ...library.discoveries.filter(d => d.id !== clean.id)] }
}

/** Shared dictionary targets are candidates for comparison, never proof of a common ancestor or sense. */
export function sharedForms(left: Family, right: Family) {
  const identity = (n: Family['nodes'][number]) => n.lookup ? historyKey(n.lookup) : `${n.lang}:${n.label.normalize('NFC')}`
  return left.nodes.flatMap(a => right.nodes.filter(b => identity(a) === identity(b)).map(b => ({ left: a, right: b })))
}

/** A card follows the selected form's language, not the language of the starting word. */
export function discoveryCard(discovery: Discovery) {
  const node = discovery.family.nodes.find(n => n.id === discovery.view?.selectedId) ?? discovery.family.nodes.find(n => n.parent === null)!
  const language = node.lookup?.language ?? Object.entries(historyLanguages).find(([, name]) => name === node.lang)?.[0]
  if (!language) throw new Error('Choose the language of this historical form before making a card.')
  return {
    document: node.label,
    note: { language, selectedText: node.label, start: 0, end: node.label.length,
      context: discovery.context || node.label, documentId: discovery.id,
      provenance: discovery.family.direction === 'sources' ? 'Sourced history · partial' : 'Prepared sourced family',
      origin: discovery.family }
  }
}
