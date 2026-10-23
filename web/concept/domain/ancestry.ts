import { historyKey, type HistoryTarget } from '../../../src/shared/etymology.ts'
import type { Family, FamilyNode } from './graphs.ts'
import { extendHistory, extendRelatives, HISTORY_NODE_LIMIT, historyLimit, isRelative, parseHistory, type HistoryResult } from './history.ts'

export const ANCESTRY_REQUEST_LIMIT = 24
export const isPIE = (node: FamilyNode) => node.lookup?.language === 'ine-pro' || node.lang === 'Proto-Indo-European'
export const ancestryNodes = (family: Family) => {
  const byId = new Map(family.nodes.map(n => [n.id, n]))
  return family.nodes.filter(n => {
    let current: FamilyNode | undefined = n
    const seen = new Set<string>()
    while (current) { if (isRelative(current) || seen.has(current.id)) return false; seen.add(current.id); current = current.parent ? byId.get(current.parent) : undefined }
    return true
  })
}
export const ancestryLeaves = (family: Family) => {
  const primary = ancestryNodes(family)
  const parents = new Set(primary.map(n => n.parent))
  return primary.filter(n => !parents.has(n.id))
}
export const canTrace = (node: FamilyNode) => !!node.lookup && !isRelative(node) && !node.historyState && !(isPIE(node) && node.label.endsWith('-'))
export function ancestrySummary(family: Family): string {
  const leaves = ancestryLeaves(family), pie = leaves.filter(isPIE).length
  if (leaves.some(n => canTrace(n) && !historyLimit(family, n.id))) return 'Continue tracing to follow the remaining cited forms toward Proto-Indo-European.'
  if (leaves.length && pie === leaves.length) return 'Proto-Indo-European reached on every loaded source path. Reconstructed forms are marked with *.'
  return `${pie ? 'Proto-Indo-European reached on part of this tree. ' : ''}Other origins, missing evidence or unsupported forms can stop a branch before PIE. Select its last form to read the source.`
}

export async function loadHistory(target: HistoryTarget, signal: AbortSignal): Promise<HistoryResult> {
  const response = await fetch('/api/etymology', { method:'POST', headers:{'Content-Type':'application/json'}, credentials:'same-origin',
    signal:AbortSignal.any([signal, AbortSignal.timeout(15000)]), body:JSON.stringify(target) })
  if (!response.ok) throw new Error(response.status === 429 ? 'The dictionary is busy. Wait a minute, then continue tracing.' : 'The next entry could not be loaded. Your tree is kept; continue when ready.')
  return parseHistory(await response.json(), target)
}

type TraceResult = { family: Family; message: string; choice?: { nodeId: string; result: HistoryResult; relatives?: boolean } }
/** Sequential, cancellable traversal of cited edges only; alternatives need the reader. */
export async function traceAncestry(initial: Family, options: {
  signal: AbortSignal
  load: (target: HistoryTarget, signal: AbortSignal) => Promise<HistoryResult>
  progress: (family: Family, node: FamilyNode) => void
}): Promise<TraceResult> {
  let family = initial, requests = 0
  const cache = new Map<string, HistoryResult>()
  if (family.direction !== 'sources') return { family, message:ancestrySummary(family) }
  while (true) {
    options.signal.throwIfAborted()
    const candidates = ancestryLeaves(family).filter(canTrace)
    const node = candidates.find(n => !historyLimit(family, n.id))
    if (!node) return { family, message:candidates.length ? historyLimit(family, candidates[0].id)! : ancestrySummary(family) }
    const key = historyKey(node.lookup!)
    if (!cache.has(key) && requests >= ANCESTRY_REQUEST_LIMIT) return { family, message:'Tracing paused after 24 entries. Continue tracing to follow the remaining evidence.' }
    options.progress(family, node)
    let result = cache.get(key)
    if (!result) {
      requests++
      result = await options.load(node.lookup!, options.signal)
      options.signal.throwIfAborted()
      cache.set(key, result)
    }
    if (result.choices.length > 1) return { family, message:`${node.label} has separate etymologies. Choose one to continue this path.`, choice:{nodeId:node.id, result} }
    family = extendHistory(family, node.id, result)
    options.progress(family, node)
  }
}

/** Show a small preview at every sourced stage, never recursively crawl relatives. */
export function stageEndpoints(family: Family): string[] {
  const primary = ancestryNodes(family)
  const primaryKeys = new Set(primary.filter(n => n.lookup).map(n => historyKey(n.lookup!)))
  return [...new Set([...ancestryLeaves(family).map(n => n.id), ...primary.flatMap(parent =>
    family.nodes.filter(n => n.parent === parent.id && isRelative(n) && (!n.lookup || !primaryKeys.has(historyKey(n.lookup)))).slice(0, 2).map(n => n.id))])]
}

export const originLabel = (label: string) => label.replace(/^Etymology(?: (\d+))?$/, (_, number) => number ? `Origin ${number}` : 'Word origin')
export const ORIGIN_HELP = 'Separate dictionary histories for the same spelling, often with different meanings. These numbers are not steps in time or confidence rankings. Choose the meaning you want to explore.'
export const pieKind = (node: FamilyNode) => /^\*?-/.test(node.label) ? 'PIE affix' : node.label.endsWith('-') ? 'PIE root' : 'PIE form'
export const pieOverview = (family: Family) => ancestryNodes(family).filter(isPIE).filter((node, index, nodes) =>
  nodes.findIndex(other => other.label === node.label) === index).sort((a, b) => Number(pieKind(b) === 'PIE root') - Number(pieKind(a) === 'PIE root'))

/** Ancestry has priority; remaining budget fills skipped intermediate entries. */
export async function traceWordFamily(initial: Family, options: Parameters<typeof traceAncestry>[1]): Promise<TraceResult> {
  const cache = new Map<string, HistoryResult>()
  let requests = 0
  const load = async (target: HistoryTarget, signal: AbortSignal) => {
    const key = historyKey(target)
    if (!cache.has(key)) {
      requests++
      const result = await options.load(target, signal)
      signal.throwIfAborted()
      cache.set(key, result)
    }
    return cache.get(key)!
  }
  const traced = await traceAncestry(initial, { ...options, load })
  if (traced.choice || initial.direction !== 'sources') return traced
  let family = traced.family
  let limited = false
  for (const candidate of ancestryNodes(family)) {
    options.signal.throwIfAborted()
    // A traced entry already supplied its relatives; only condensed stages need a lookup.
    if (!candidate.lookup || candidate.historyChoice || candidate.historyState === 'cycle') continue
    if (historyLimit(family, candidate.id)) { limited = true; continue }
    if (!cache.has(historyKey(candidate.lookup)) && requests >= ANCESTRY_REQUEST_LIMIT) return { family, message: 'Family lookup paused after 24 entries. Continue to check the remaining stages.' }
    options.progress(family, candidate)
    const result = await load(candidate.lookup, options.signal)
    options.signal.throwIfAborted()
    const chosen = candidate.parent === null ? family.id : undefined
    if (result.choices.length > 1 && !result.choices.some(c => c.id === chosen)) return { family,
      message: `${candidate.label} has separate histories. Choose one before adding its relatives.`, choice: { nodeId: candidate.id, result, relatives: true } }
    const primaryKeys = new Set(ancestryNodes(family).filter(n => n.lookup).map(n => historyKey(n.lookup!)))
    const preview = { ...result, choices: result.choices.map(c => ({ ...c, nodes: c.nodes.filter(n => !isRelative(n) || !n.lookup || !primaryKeys.has(historyKey(n.lookup))) })) }
    family = extendRelatives(family, candidate.id, preview, chosen, Math.min(2, HISTORY_NODE_LIMIT - family.nodes.length))
    options.progress(family, candidate)
  }
  return { family, message: `${ancestrySummary(family)} ${limited ? 'Some stages could not be checked within this tree’s size or depth limit.' : 'Related branches are shown at each stage where the entry provides them.'}` }
}
