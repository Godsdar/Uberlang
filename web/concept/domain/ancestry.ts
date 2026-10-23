import { historyKey, type HistoryTarget } from '../../../src/shared/etymology.ts'
import type { Family, FamilyNode } from './graphs.ts'
import { extendHistory, historyLimit, isRelative, parseHistory, type HistoryResult } from './history.ts'

export const ANCESTRY_REQUEST_LIMIT = 24
export const isPIE = (node: FamilyNode) => node.lookup?.language === 'ine-pro' || node.lang === 'Proto-Indo-European'
export const ancestryLeaves = (family: Family) => {
  const byId = new Map(family.nodes.map(n => [n.id, n]))
  const primary = family.nodes.filter(n => {
    let current: FamilyNode | undefined = n
    const seen = new Set<string>()
    while (current) { if (isRelative(current) || seen.has(current.id)) return false; seen.add(current.id); current = current.parent ? byId.get(current.parent) : undefined }
    return true
  })
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

type TraceResult = { family: Family; message: string; choice?: { nodeId: string; result: HistoryResult } }
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
