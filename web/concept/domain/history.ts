import { historyKey, type HistoryTarget } from '../../../src/shared/etymology.ts'
import { ancestorIds, familyHierarchy, type Family } from './graphs.ts'
import { isWiktionarySource, parseSourcedFamily, type SourcedFamily } from './lexicon.ts'

export interface HistoryChoice extends SourcedFamily { summary: string; reason: string }
export interface HistoryResult { target: HistoryTarget; choices: HistoryChoice[]; reason: string; source: string | null }
const record = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x)
const text = (x: unknown): x is string => typeof x === 'string' && x.length <= 5000
export function parseHistory(value: unknown, target: HistoryTarget): HistoryResult {
  const invalid = () => new Error('The source returned an invalid history. Nothing was added.')
  if (!record(value) || value.schemaVersion !== 1 || !record(value.target) || value.target.language !== target.language || value.target.term !== target.term || !Array.isArray(value.choices) || value.choices.length > 8 || !text(value.reason) || !(value.source === null || isWiktionarySource(value.source))) throw invalid()
  if (value.source !== null && !/^\d+$/.test(new URL(value.source).searchParams.get('oldid') ?? '')) throw invalid()
  const choices = value.choices.map(raw => {
    const family = parseSourcedFamily(raw)
    const root = family.nodes.find(n => n.parent === null)!
    if (!record(raw) || !text(raw.summary) || !text(raw.reason) || !root.lookup || historyKey(root.lookup) !== historyKey(target) || root.source !== value.source || family.nodes.some(n => n.parent !== null && (!isWiktionarySource(n.edgeSource) || !/^\d+$/.test(new URL(n.edgeSource).searchParams.get('oldid') ?? '')))) throw invalid()
    return { ...family, summary: raw.summary, reason: raw.reason }
  })
  if (new Set(choices.map(c => c.id)).size !== choices.length) throw invalid()
  return { target, choices, reason: value.reason, source: value.source }
}

export const HISTORY_NODE_LIMIT = 64
export const HISTORY_DEPTH_LIMIT = 8
export function historyLimit(family: Family, nodeId: string): string | null {
  if (family.nodes.length >= HISTORY_NODE_LIMIT) return 'This exploration has reached 64 forms. Save your notes and start another word.'
  if (ancestorIds(family.nodes, nodeId).size > HISTORY_DEPTH_LIMIT) return 'This path has reached eight steps. Continue in the linked dictionary entry.'
  return null
}

/** Attach one chosen, revision-backed history. Never merge alternatives. */
export function extendHistory(family: Family, nodeId: string, result: HistoryResult, choiceId?: string): Family {
  const node = family.nodes.find(n => n.id === nodeId)
  if (family.direction !== 'sources' || !node?.lookup || historyKey(node.lookup) !== historyKey(result.target) || family.nodes.some(n => n.parent === nodeId) || node.historyState === 'cycle') throw new Error('This form cannot receive that history.')
  const limit = historyLimit(family, nodeId)
  if (limit) throw new Error(limit)
  if (result.choices.length > 1 && !choiceId) throw new Error('Choose an etymology before extending this branch.')
  const choice = result.choices.find(c => c.id === choiceId) ?? (!choiceId && result.choices.length === 1 ? result.choices[0] : undefined)
  if (choiceId && !choice) throw new Error('Unknown etymology choice.')
  const root = choice?.nodes.find(n => n.parent === null)
  const sources = choice?.nodes.filter(n => n.parent !== null) ?? []
  if (family.nodes.length + sources.length > HISTORY_NODE_LIMIT) throw new Error('This continuation exceeds the 64-form limit. Continue in the source entry.')
  const ancestry = ancestorIds(family.nodes, nodeId)
  const keys = new Set(family.nodes.filter(n => ancestry.has(n.id) && n.lookup).map(n => historyKey(n.lookup!)))
  const note = (result.choices.length > 1 ? `Reader selected ${choice!.label}. Alternative etymologies remain separate; this is not automatic sense disambiguation. ` : '') +
    (sources.length ? `History from ${choice!.label}, revision dated ${choice!.verifiedOn}.` : choice?.reason || result.reason)
  const updated = family.nodes.map(n => n.id === nodeId ? { ...n, source: root?.source ?? result.source ?? n.source,
    historyState: sources.length ? 'expanded' as const : 'unavailable' as const, historyNote: note,
    ...(choice && { historyChoice: { id: choice.id, source: root!.source, readerSelected: result.choices.length > 1 } }) } : n)
  const ids = new Map(sources.map((n, i) => [n.id, `${nodeId}.${i + 1}`]))
  const children = sources.map((n, i) => ({ ...n, id: `${nodeId}.${i + 1}`, parent: n.parent === root?.id ? nodeId : ids.get(n.parent!)!,
    ...(n.lookup && keys.has(historyKey(n.lookup)) ? { historyState: 'cycle' as const, historyNote: 'This form already occurs on this path. Further expansion is stopped.' } : {}) }))
  const next = { ...family, nodes: [...updated, ...children] }
  if (familyHierarchy(next.nodes).height > HISTORY_DEPTH_LIMIT) throw new Error('This continuation exceeds eight steps. Open this form as a new word to continue.')
  return next
}

export function foldHistory(family: Family, endpoints: string[], nodeId: string): string[] {
  const branch = familyHierarchy(family.nodes).descendants().find(n => n.id === nodeId)
  if (!branch) return endpoints
  const below = new Set(branch.descendants().map(n => n.data.id))
  return [...endpoints.filter(id => !below.has(id)), nodeId]
}

export const isRelative = (node: Family['nodes'][number]) => ['cognate', 'descendant', 'descendant-borrowed', 'related', 'derivative'].includes(node.relation ?? '')

/** Add only the explicitly listed family branches of a chosen entry. */
export function extendRelatives(family: Family, nodeId: string, result: HistoryResult, choiceId?: string, maxNewForms = HISTORY_NODE_LIMIT): Family {
  const node = family.nodes.find(n => n.id === nodeId)
  if (!node?.lookup || historyKey(node.lookup) !== historyKey(result.target)) throw new Error('This result belongs to a different form.')
  if (result.choices.length > 1 && !choiceId) throw new Error('Choose a separate etymology before loading relatives.')
  const choice = result.choices.find(c => c.id === choiceId) ?? (result.choices.length === 1 ? result.choices[0] : undefined)
  if (!choice) return family
  const chosenId = node.historyChoice?.id ?? (node.parent === null ? family.id : undefined)
  if (chosenId && chosenId !== choice.id) throw new Error('A different etymology is already attached. Explore this form as a new word to keep those histories separate.')
  const root = choice.nodes.find(n => n.parent === null)!
  const relatives = choice.nodes.filter(isRelative)
  const ids = new Map<string, string>([[root.id, nodeId]])
  const added: Family['nodes'] = []
  for (const n of relatives) {
    const parent = ids.get(n.parent!)
    if (!parent) continue
    const existing = family.nodes.find(e => e.parent === parent && e.relation === n.relation && e.label === n.label && e.lang === n.lang)
    if (!existing && added.length >= maxNewForms) continue
    const id = existing?.id ?? `${nodeId}.r${family.nodes.length + added.length}`
    ids.set(n.id, id)
    if (!existing) added.push({ ...n, id, parent })
  }
  if (family.nodes.length + added.length > HISTORY_NODE_LIMIT) throw new Error('This family has reached its 64-form limit. Open this form as a new word to explore its relatives.')
  const next = { ...family, nodes: [...family.nodes.map(n => n.id === nodeId ? { ...n, source: root.source, historyChoice: { id: choice.id, source: root.source, readerSelected: result.choices.length > 1 } } : n), ...added] }
  if (familyHierarchy(next.nodes).height > HISTORY_DEPTH_LIMIT) throw new Error('This continuation exceeds eight steps. Open this form as a new word to continue.')
  return next
}
