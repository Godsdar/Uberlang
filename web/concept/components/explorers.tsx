import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { AnimatePresence, motion, useIsPresent, useReducedMotion } from 'motion/react'
import { ancestorIds, familyLayout, familyHierarchy, relationNames, syntaxLayout } from '../domain/graphs'
import { extendHistory, extendRelatives, isRelative, foldHistory, historyLimit, parseHistory, type HistoryResult } from '../domain/history'
import type { Family, FamilyNode, Token } from '../domain/graphs'
import { historyLanguages } from '../../../src/shared/etymology'
import { ancestryLeaves, ancestrySummary, isPIE, loadHistory, traceWordFamily, stageEndpoints, pieOverview, pieKind, originLabel, ORIGIN_HELP } from '../domain/ancestry'
import type { ExplorerView } from '../domain/explorations'

export interface FamilyProps {
  family: Family; word: string; onFamilyChange?: (family: Family) => void
  initialView?: ExplorerView
  onSnapshot?: (family: Family, view: ExplorerView) => void
  onInspect?: (id: string) => void
  onStartFrom?: (node: FamilyNode) => void
  preferredLanguages?: string[]
  autoTrace?: boolean
}

// Exiting nodes must not remain keyboard targets while their branch fades out.
function FamilyPoint({ node, selected, lineage, reduced, onSelect }: {
  node: ReturnType<typeof familyLayout>['nodes'][number]; selected: boolean;
  lineage: boolean; reduced: boolean | null; onSelect: () => void
}) {
  const present = useIsPresent()
  return <motion.div className="lp-graph-node" inert={!present}
    initial={reduced ? false : { opacity: 0, x: node.x, y: node.y + 12, scale: .96 }}
    animate={{ opacity: 1, x: node.x, y: node.y, scale: 1 }}
    exit={{ opacity: 0, scale: reduced ? 1 : .96 }}
    transition={{ duration: reduced ? 0 : .32, ease: [.22, 1, .36, 1] }}>
    <button className={`lp-family-node ${node.parent ? '' : 'is-root'} ${lineage ? 'is-lineage' : ''} ${node.reconstructed ? 'is-reconstructed' : ''}`}
      data-node-id={node.id} aria-pressed={selected} aria-label={`${node.label}, ${node.lang}`} title={`${node.label} · ${node.lang}${isRelative(node) ? ' · ' + node.relation : ''}`} onClick={onSelect}>
      <span className="lp-node-port" aria-hidden="true" />
      <span className="lp-form">{node.label}</span><span className="lp-lang">{node.lang}</span>
    </button>
  </motion.div>
}

export function FamilyExplorer({ family: initialFamily, word, onFamilyChange, initialView, onSnapshot, onInspect, onStartFrom, preferredLanguages = [], autoTrace = false }: FamilyProps) {
  const [family, setFamily] = useState(initialFamily)
  const request = useRef<AbortController | null>(null)
  const [pending, setPending] = useState(false)
  const traceRequest = useRef<AbortController | null>(null)
  const [tracing, setTracing] = useState(false)
  const [traceMessage, setTraceMessage] = useState('')
  const [traceChoice, setTraceChoice] = useState<{ nodeId: string; result: HistoryResult; relatives?: boolean } | null>(null)
  const [historyMessage, setHistoryMessage] = useState('')
  const [choice, setChoice] = useState<{ nodeId: string; result: HistoryResult; relatives?: boolean } | null>(null)
  const [loadedRelatives, setLoadedRelatives] = useState<string[]>([])
  const leaves = useMemo(() => familyHierarchy(family.nodes).leaves().map(n => n.data), [family])
  const sourced = family.direction === 'sources'
  const anchor = leaves.find(n => n.lang === 'English') ?? leaves[0]
  const initial = sourced ? family.nodes.find(n => n.parent === null)! : anchor
  const defaults = useMemo(() => {
    const others = leaves.filter(n => n.id !== anchor.id)
    if (sourced) return stageEndpoints(family)
    return [...new Set([anchor.id, ...[others[0], others.at(-1)].filter(n => n !== undefined).map(n => n.id)])]
  }, [anchor, leaves, sourced, family])
  const [selectedId, setSelected] = useState(initialView?.selectedId ?? initial.id)
  const [endpoints, setEndpoints] = useState(initialView?.endpoints ?? defaults)
  const [pathOnly, setPathOnly] = useState(initialView?.pathOnly ?? false)
  const [zoom, setZoom] = useState(initialView?.zoom ?? 1)
  const scroll = useRef<HTMLDivElement>(null)
  const readerMoved = useRef(Boolean(initialView))
  const inspector = useRef<HTMLElement>(null)
  const callbacks = useRef({ onSnapshot, onInspect })
  callbacks.current = { onSnapshot, onInspect }
  const [positions, setPositions] = useState({ scrollLeft: initialView?.scrollLeft ?? 0, scrollTop: initialView?.scrollTop ?? 0 })
  const visited = useRef<string[]>(initialView?.visited ?? [initialView?.selectedId ?? initial.id])
  const [cursor, setCursor] = useState(initialView?.cursor ?? 0)
  useEffect(() => { if (scroll.current) { scroll.current.scrollLeft = initialView?.scrollLeft ?? 0; scroll.current.scrollTop = initialView?.scrollTop ?? 0 } }, [])
  useEffect(() => {
    callbacks.current.onSnapshot?.(family, { selectedId, endpoints, pathOnly, zoom, ...positions, visited: visited.current, cursor })
    callbacks.current.onInspect?.(selectedId)
  }, [family, selectedId, endpoints, pathOnly, zoom, positions, cursor])
  const reduced = useReducedMotion()
  const selected = family.nodes.find(n => n.id === selectedId) ?? initial
  // A dictionary entry can stand alone when all its cited branches are folded.
  const visibleEndpoints = endpoints.length ? endpoints : [initial.id]
  const layout = useMemo(() => familyLayout(family.nodes, pathOnly ? [selected.id] : visibleEndpoints, family.direction), [family, endpoints, pathOnly, selected.id])
  useEffect(() => {
    if (readerMoved.current || !scroll.current) return
    const point = layout.nodes.find(n => n.id === initial.id)
    if (point) scroll.current.scrollLeft = Math.max(0, point.x * zoom - scroll.current.clientWidth / 2)
  }, [layout.width, zoom, initial.id])
  const ancestry = useMemo(() => sourced && selected.parent === null ? new Set(ancestryLeaves(family).flatMap(n => [...ancestorIds(family.nodes, n.id)])) : ancestorIds(family.nodes, selected.id), [family, selected.id])
  const trail = useMemo(() => familyHierarchy(family.nodes).descendants().find(n => n.id === selected.id)!.ancestors().reverse(), [family, selected.id])
  const transition = { duration: reduced ? 0 : .32, ease: [.22, 1, .36, 1] as [number, number, number, number] }
  function selectNode(id: string, navigating = false) {
    readerMoved.current = true
    if (!navigating && id !== selectedId) {
      visited.current = [...visited.current.slice(0, cursor + 1), id].slice(-100)
      setCursor(visited.current.length - 1)
    }
    request.current?.abort(); request.current = null
    setPending(false); setChoice(null); setHistoryMessage(''); setSelected(id)
  }
  useEffect(() => {
    request.current?.abort(); request.current = null
    setPending(false); setChoice(null); setHistoryMessage('')
    return () => { request.current?.abort(); request.current = null }
  }, [selectedId])
  function applyHistory(result: HistoryResult, choiceId?: string, relativesOnly = false) {
    const next = relativesOnly ? extendRelatives(family, selected.id, result, choiceId) : extendHistory(family, selected.id, result, choiceId)
    if (relativesOnly) setLoadedRelatives(previous => [...previous, selected.id])
    const children = familyHierarchy(next.nodes).descendants().find(n => n.data.id === selected.id)!.leaves().map(n => n.data.id)
    setFamily(next); onFamilyChange?.(next)
    setEndpoints(previous => [...new Set([...previous.filter(id => id !== selected.id), ...(children.length ? children : [selected.id])])])
    setPathOnly(false); setChoice(null)
    setHistoryMessage(children.length ? `${children.length} sourced ${children.length === 1 ? 'form' : 'forms'} added. Choose a new form to go deeper.` : 'No supported continuation found. The entry remains available below.')
  }
  async function exploreHistory(relativesOnly = false) {
    if (!selected.lookup || pending) return
    const controller = new AbortController(); request.current?.abort(); request.current = controller
    setPending(true); setHistoryMessage('Reading the cited dictionary entry…'); setChoice(null)
    const timer = setTimeout(() => controller.abort(), 12000)
    try {
      const response = await fetch('/api/etymology', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', signal: controller.signal, body: JSON.stringify(selected.lookup) })
      if (!response.ok) throw new Error(response.status === 429 ? 'The dictionary is busy. Wait a minute before retrying.' : 'The entry could not be loaded. Your tree is safe; try again when ready.')
      const result = parseHistory(await response.json(), selected.lookup)
      if (request.current !== controller || controller.signal.aborted) return
      if (result.choices.length > 1) { setChoice({ nodeId: selected.id, result, relatives: relativesOnly }); setHistoryMessage('This entry has different etymologies. Choose one to explore; they will not be combined.') }
      else applyHistory(result, undefined, relativesOnly)
    } catch (error) {
      if (request.current === controller) setHistoryMessage(controller.signal.aborted ? 'Lookup stopped. You can retry when ready.' : error instanceof Error ? error.message : 'The entry could not be read.')
    } finally { clearTimeout(timer); if (request.current === controller) { request.current = null; setPending(false) } }
  }
  function showTrace(next: Family) {
    setFamily(next); onFamilyChange?.(next)
    setEndpoints(stageEndpoints(next)); setPathOnly(false)
  }
  async function runTrace(start: Family = family) {
    request.current?.abort(); request.current = null; setPending(false); setChoice(null)
    const controller = new AbortController(); traceRequest.current?.abort(); traceRequest.current = controller
    setTracing(true); setTraceChoice(null)
    try {
      const result = await traceWordFamily(start, { signal:controller.signal, load:loadHistory, progress:(next, node) => {
        if (traceRequest.current !== controller || controller.signal.aborted) return
        showTrace(next); setTraceMessage(`Reading ${node.label} · ${node.lang}: sources and relatives…`)
      } })
      if (traceRequest.current !== controller || controller.signal.aborted) return
      showTrace(result.family); setTraceMessage(result.message); setTraceChoice(result.choice ?? null)
    } catch (error) {
      if (traceRequest.current === controller) setTraceMessage(controller.signal.aborted ? 'Tracing stopped. The forms already found are kept.' : error instanceof Error ? error.message : 'Tracing interrupted. Your tree is kept.')
    } finally { if (traceRequest.current === controller) { traceRequest.current = null; setTracing(false) } }
  }
  useEffect(() => {
    if (autoTrace && initialFamily.direction === 'sources') void runTrace(initialFamily)
    return () => { traceRequest.current?.abort(); traceRequest.current = null }
  }, [])
  const continuation = family.nodes.filter(n => n.parent === selected.id)
  const continuationVisible = layout.nodes.some(n => n.parent === selected.id)
  const limit = historyLimit(family, selected.id)
  function reveal(next: string[]) {
    readerMoved.current = true
    setEndpoints(next)
    setPathOnly(false)
    if (!familyLayout(family.nodes, next.length ? next : [initial.id]).nodes.some(n => n.id === selectedId)) selectNode(initial.id)
  }
  function navigate(delta: number) {
    const next = cursor + delta, id = visited.current[next]
    if (!id) return
    setCursor(next); selectNode(id, true)
    // Revisiting a folded form reveals its existing path; it never requests data.
    setEndpoints(previous => [...new Set([...previous, id])])
  }
  function toggle(id: string) {
    if (!sourced && id === anchor.id) return
    reveal(endpoints.includes(id) ? endpoints.filter(n => n !== id) : [...endpoints, id])
  }
  return <div className="lp-family-explorer">
    {sourced && <section className="lp-ancestry" aria-label="Trace word ancestry">
      <div className="lp-actions"><span className="lp-section-label">Roots & relatives</span>
        {tracing ? <button onClick={() => { traceRequest.current?.abort() }}>Stop tracing</button> :
          !traceChoice && <button disabled={pending} onClick={() => void runTrace()}>Continue roots & relatives</button>}
      </div>
      <p role="status" aria-live="polite">{traceMessage || ancestrySummary(family)}</p>
      <div className="lp-pie-overview" aria-label="Proto-Indo-European overview">
        {pieOverview(family).map(node => <div className="lp-pie-summary" key={node.id}>
          <span className="lp-section-label">{pieKind(node)}</span><strong>{node.label}</strong>
          <span className="lp-label">Reconstructed{node.gloss ? ` · ${node.gloss}` : ''}</span>
          <div className="lp-actions"><a href={node.edgeSource || node.source} target="_blank" rel="noreferrer">Source ↗</a>
            <button onClick={() => {
              selectNode(node.id); setPathOnly(false); setEndpoints(previous => [...new Set([...previous, node.id])])
              requestAnimationFrame(() => {
                const point = Array.from(scroll.current?.querySelectorAll<HTMLButtonElement>('.lp-family-node') ?? []).find(button => button.dataset.nodeId === node.id)
                point?.scrollIntoView({ block:'nearest', inline:'nearest', behavior:reduced ? 'instant' : 'smooth' }); point?.focus({ preventScroll:true })
              })
            }}>Locate {node.label} in tree ↓</button></div>
        </div>)}
      </div>
      {traceChoice && <div className="lp-history-choices" role="group" aria-label="Choose ancestry to trace"><p>{ORIGIN_HELP}</p>{traceChoice.result.choices.map(option => <button key={option.id} onClick={() => {
        try { const next = traceChoice.relatives ? extendRelatives(family, traceChoice.nodeId, traceChoice.result, option.id, 2) : extendHistory(family, traceChoice.nodeId, traceChoice.result, option.id); showTrace(next); void runTrace(next) }
        catch (error) { setTraceMessage(error instanceof Error ? error.message : 'Cannot add this history.') }
      }}><strong>{originLabel(option.label)}</strong><span>{option.summary || option.reason}</span></button>)}</div>}
    </section>}

    <details className="lp-family-branch-menu"><summary>Choose branches · {leaves.length} available</summary><div className="lp-branch-picker" role="group" aria-label="Visible family branches">
      <span className="lp-label">{sourced ? 'Branches · choose what to show' : 'Branches'}</span>
      {leaves.filter(n => n.id !== (sourced ? initial.id : '')).map(node => <button key={node.id} aria-pressed={endpoints.includes(node.id)}
        disabled={!sourced && node.id === anchor.id} onClick={() => toggle(node.id)}>
        <span className="lp-branch-mark" aria-hidden="true">{endpoints.includes(node.id) ? '−' : '+'}</span> {sourced ? `${node.label} · ${node.lang}${isRelative(node) ? ' · ' + node.relation : ''}` : node.lang}{preferredLanguages.includes(node.lookup?.language ?? Object.entries(historyLanguages).find(([, name]) => name === node.lang)?.[0] ?? '') ? ' ★' : ''}
      </button>)}
      {leaves.length > 3 && <button className="lp-reveal-all" onClick={() => reveal(endpoints.length === leaves.length ? defaults : leaves.map(n => n.id))}>
        {endpoints.length === leaves.length ? 'Fewer branches' : 'Reveal all'}
      </button>}
    </div></details>
    <div className="lp-explorer-grid">
      <div className="lp-graph-panel">
        <div className="lp-graph-toolbar">
          <div role="group" aria-label="Exploration navigation">
            <button aria-label="Previous form" disabled={cursor === 0} onClick={() => navigate(-1)}>← Back</button>
            <button aria-label="Next form" disabled={cursor >= visited.current.length - 1} onClick={() => navigate(1)}>Forward →</button>
          </div>
          <div role="group" aria-label="Family detail">
            <button aria-pressed={!pathOnly} onClick={() => setPathOnly(false)}>Family</button>
            <button aria-pressed={pathOnly} disabled={sourced && selected.parent === null} onClick={() => setPathOnly(true)}>Selected path</button>
          </div>
          <div role="group" aria-label="Tree scale">
            <button aria-label="Zoom out" disabled={zoom <= .75} onClick={() => setZoom(z => Math.max(.75, z - .25))}>−</button>
            <button aria-label="Reset tree scale" onClick={() => setZoom(1)}>{Math.round(zoom * 100)}%</button>
            <button aria-label="Zoom in" disabled={zoom >= 1.5} onClick={() => setZoom(z => Math.min(1.5, z + .25))}>+</button>
          </div>
        </div>
        <button className="lp-mobile-inspect" onClick={() => { inspector.current?.scrollIntoView({ block: 'start', behavior: 'instant' }); inspector.current?.focus({ preventScroll: true }) }}>Selected: {selected.label} · details ↓</button>
        <div className={`lp-graph-scroll lp-family-canvas ${sourced ? 'is-sourced' : ''}`} ref={scroll} onWheel={() => { readerMoved.current = true }} onPointerDown={() => { readerMoved.current = true }} onKeyDown={() => { readerMoved.current = true }} onScroll={event => setPositions({ scrollLeft: event.currentTarget.scrollLeft, scrollTop: event.currentTarget.scrollTop })} tabIndex={0} role="region" aria-label={`${word} ${sourced ? 'sources' : 'family'}. Scroll horizontally to explore branches.`}>
          <motion.div className="lp-graph-size" animate={{ width: layout.width * zoom, height: layout.height * zoom }} transition={transition}>
            <div className="lp-graph-stage" style={{ width: layout.width, height: layout.height, transform: `scale(${zoom})`, transformOrigin: 'top left' }}>
              <svg width={layout.width} height={layout.height} aria-hidden="true" className="lp-family-branches">
                <AnimatePresence initial={false}>
                  {layout.links.map(({ id, from, to, condensed }) => {
                    const active = ancestry.has(id) && ancestry.has(from.id)
                    const bend = (from.y + to.y) / 2
                    const sign = sourced ? -1 : 1
                    const d = `M${from.x},${from.y - sign * 32} C${from.x},${bend} ${to.x},${bend} ${to.x},${to.y + sign * 32}`
                    return <motion.g key={id} initial={reduced ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={transition}>
                      <motion.path initial={reduced || condensed || isRelative(to) ? false : { pathLength: 0 }}
                        animate={{ d, opacity: active ? 1 : .55, strokeWidth: active ? 2.5 : Math.max(1.1, 2.4 - to.depth * .35), ...(!condensed && !isRelative(to) && { pathLength: 1 }) }}
                        transition={transition} stroke={active ? 'var(--lp-accent)' : 'var(--lp-muted)'}
                        strokeLinecap="round" strokeDasharray={condensed ? '3 7' : isRelative(to) ? '7 4' : undefined} fill="none" />
                      {sourced && to.relation && <motion.text className="lp-arc-label" initial={false}
                        textAnchor="middle" style={{ paintOrder: 'stroke', stroke: 'var(--lp-bg)', strokeWidth: 4 }} animate={{ x: to.x, y: to.y - 47 }} transition={transition}>{to.relation === 'descendant-borrowed' ? 'borrowed descendant' : to.relation}</motion.text>}
                    </motion.g>
                  })}
                </AnimatePresence>
              </svg>
              <AnimatePresence initial={false}>
                {layout.nodes.map(node => <FamilyPoint key={node.id} node={node} selected={selected.id === node.id}
                  lineage={ancestry.has(node.id)} reduced={reduced} onSelect={() => selectNode(node.id)} />)}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
        <div className="lp-graph-legend"><span>{sourced ? 'Solid: sources · dashed: relatives' : 'Ancestors below · relatives above'}</span><span>┄ omitted stages</span><span>* reconstructed</span></div>
        <p className="lp-explorer-hint">Choose a form to follow its story. {sourced ? 'The word’s source path and lateral relatives have separate labels. Select an older form and load its relatives to explore other language branches.' : 'Unfold branches above; scroll across wider trees.'}</p>
      </div>
      <aside ref={inspector} tabIndex={-1} className="lp-inspector lp-family-inspector">
        <button className="lp-mobile-inspect" onClick={() => { scroll.current?.scrollIntoView({ block: 'start', behavior: 'instant' }); scroll.current?.focus({ preventScroll: true }) }}>↑ Back to tree</button>
        <div className="lp-section-label">Selected form</div>
        <div aria-live="polite" aria-atomic="true"><p className={`lp-word ${selected.reconstructed ? 'is-reconstructed' : ''}`}>{selected.label}</p><p className="lp-label">{selected.lang}{selected.reconstructed ? ' · reconstructed' : ''}</p></div>
        {sourced && <section className="lp-history-controls" aria-label="Explore word history">
          {continuation.length > 0 ? <button onClick={() => { setPathOnly(false); setEndpoints(previous => continuationVisible ? foldHistory(family, previous, selected.id) : [...new Set([...previous.filter(id => id !== selected.id), ...continuation.map(n => n.id)])]) }}>{continuationVisible ? 'Fold continuation' : 'Unfold continuation'}</button> :
            selected.lookup && !selected.historyState && !(isPIE(selected) && selected.label.endsWith('-')) ? <button className="lp-main" disabled={pending || tracing || !!traceChoice || !!limit} onClick={() => void exploreHistory()}>Explore deeper ↘</button> : null}
          {selected.lookup && <button disabled={pending || tracing || !!traceChoice || loadedRelatives.includes(selected.id)} onClick={() => void exploreHistory(true)}>{loadedRelatives.includes(selected.id) ? 'Relatives loaded' : 'Load this form’s relatives'}</button>}
          {pending && <button onClick={() => { request.current?.abort(); request.current = null; setPending(false); setHistoryMessage('Lookup cancelled. Your tree is unchanged.') }}>Cancel</button>}
          <p className="lp-label">{(isPIE(selected) ? 'Proto-Indo-European reconstruction. Components and descendant branches may be available; this form is not directly attested.' : null) || limit || selected.historyNote || (continuation.length ? 'Cited continuation is loaded. Select a form to inspect its evidence.' : null) || (!selected.lookup ? 'This language or form is not supported for expansion. Read the linked entry.' : 'Loads only this form and language from Wiktionary when you choose Explore deeper.')}</p>
          <p className="lp-history-status" role="status" aria-live="polite">{historyMessage}</p>
          {choice?.nodeId === selected.id && <div className="lp-history-choices" role="group" aria-label="Choose a separate etymology"><p>{ORIGIN_HELP}</p>
            {choice.result.choices.map(option => <button key={option.id} onClick={() => { try { applyHistory(choice.result, option.id, choice.relatives) } catch (error) { setHistoryMessage(error instanceof Error ? error.message : 'Cannot add this history.') } }}>
              <strong>{originLabel(option.label)}</strong><span>{option.summary}</span><small>{option.nodes.length > 1 ? `${option.nodes.length - 1} cited forms` : 'No supported continuation'}</small>
            </button>)}
          </div>}
        </section>}
        {onStartFrom && <button className="lp-new-origin" onClick={() => onStartFrom(selected)}>Explore as a new word ↗</button>}
        <p className="lp-word-gloss">{selected.gloss || family.note}</p>
        <nav className="lp-lineage-trail" aria-label="Selected evidence path">
          {trail.map(n => <button key={n.id} aria-current={n.id === selected.id ? 'true' : undefined} onClick={() => selectNode(n.data.id)}>{n.data.label}</button>)}
        </nav>
        {sourced && selected.relation && <p className="lp-label">Relation: {selected.relation}.{isRelative(selected) ? ' A lateral family branch, not an ancestor of the word you searched. Descendants develop from the connected form; cognates share an origin without a direct descent claim.' : selected.relation === 'component' ? ' A word part, not a historical ancestor.' : selected.relation === 'form-of' ? ' The previous form is an inflection of this lemma; this is not ancestry.' : ''}</p>}
        <p className="lp-label">{selected.condensed ? `Omitted stages: ${selected.skipped.join(' → ')}` : sourced ? 'Explicitly cited in the dictionary entry.' : 'A sourced form in this word family.'}</p>
        <div className="lp-evidence-links"><a href={selected.source} target="_blank" rel="noreferrer">Read the entry ↗</a>
          {selected.edgeSource && <a href={selected.edgeSource} target="_blank" rel="noreferrer">Relation evidence ↗</a>}</div>
        <details><summary>{sourced ? 'About these sources' : 'About this family'}</summary><p className="lp-label">{family.note}</p><p className="lp-label">{sourced ? 'Revision dated' : 'Checked'} {family.verifiedOn}. {family.attribution}</p></details>
        <p className="lp-label lp-attribution">Wiktionary · <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">CC BY-SA 4.0</a><br />{sourced ? 'Live source lookup · partial history' : 'Curated family · selected relatives'}</p>
      </aside>
    </div>
  </div>
}

interface SyntaxProps { tokens: Token[]; selectedStart: number; selectedEnd: number; offset: number; onSelect: (start: number, end: number) => void }
function SyntaxExplorer({ tokens, selectedStart, selectedEnd, offset, onSelect }: SyntaxProps) {
  const markerId = useId().replace(/:/g, '')
  const graph = useMemo(() => syntaxLayout(tokens), [tokens])
  const reduced = useReducedMotion()
  const selectedId = tokens.findIndex(t => t.start + offset === selectedStart) + 1
  const selection = new Set(tokens.flatMap((t, i) => t.start + offset < selectedEnd && t.end + offset > selectedStart ? [i + 1] : []))
  const [all, setAll] = useState(false)
  const selected = tokens[selectedId - 1]
  return <div className="lp-syntax-explorer">
    <div className="lp-graph-toolbar"><span className="lp-label">Sentence structure</span>
      <button aria-pressed={all} onClick={() => setAll(v => !v)}>{all ? 'Focus on selected word' : 'Show all connections'}</button>
    </div>
    <div className="lp-graph-scroll" tabIndex={0} role="region" aria-label="Sentence dependencies. Scroll to read all words.">
      <div className="lp-syntax-stage" style={{ width: graph.width, height: graph.baseline + 80 }}>
        <svg width={graph.width} height={graph.baseline + 20} aria-hidden="true">
          <defs><marker id={`arrow-${markerId}`} markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6" fill="var(--lp-accent)" /></marker></defs>
          {graph.arcs.map(arc => {
            const active = selection.has(arc.id) || selection.has(arc.head)
            return <g key={arc.id}>
              <motion.path initial={false} animate={{ opacity: active || all ? 1 : .1 }} transition={{ duration: reduced ? 0 : .18 }}
                d={`M${arc.from},${graph.baseline} C${arc.from},${graph.baseline - arc.rise} ${arc.to},${graph.baseline - arc.rise} ${arc.to},${graph.baseline - 5}`}
                stroke={active ? 'var(--lp-accent)' : 'var(--lp-muted)'} strokeWidth={active ? 2 : 1} fill="none" markerEnd={`url(#arrow-${markerId})`} />
              {active && <text x={(arc.from + arc.to) / 2} y={graph.baseline - arc.rise * .75 - 8} textAnchor="middle" className="lp-arc-label">{arc.relation}</text>}
            </g>
          })}
        </svg>
        {graph.tokens.map(({ token, id }, i) => <button key={id} className="lp-syntax-token" style={{ left: i * 112 + 22, top: graph.baseline + 6 }}
          aria-pressed={selection.has(id)} data-focus-id={`syntax-${id}`}
          onClick={() => onSelect(token.start + offset, token.end + offset)}>
          <span>{token.text}</span><small>{token.pos}{id === graph.rootId ? ' · root' : ''}</small>
        </button>)}
      </div>
    </div>
    <p className="lp-graph-legend">Dependent → head. Click a word to follow its connections; scroll horizontally for the full sentence.</p>
    {selection.size > 1 ? <p className="lp-syntax-reading">Selected expression · {selection.size} tokens. Highlighted connections include the surrounding sentence.</p> : selected && <p className="lp-syntax-reading"><strong>{selected.text}</strong> · {relationNames[selected.relation] || selected.relation}{selected.head ? <> → <strong>{tokens[selected.head - 1].text}</strong></> : ''}. {selected.explanation}</p>}
  </div>
}

const roots = new Map<HTMLElement, Root>()
function mount(container: HTMLElement, element: React.ReactNode) {
  let root = roots.get(container)
  if (!root) { root = createRoot(container); roots.set(container, root) }
  root.render(element)
}
export function mountFamily(container: HTMLElement, props: FamilyProps) {
  mount(container, <FamilyExplorer key={`${props.word}:${props.family.id || 'prepared'}`} {...props} />)
}
export function mountSyntax(container: HTMLElement, props: SyntaxProps) {
  mount(container, <SyntaxExplorer {...props} />)
}
export function unmountExplorers(parent: HTMLElement) {
  for (const [container, root] of roots) {
    if (parent === container || parent.contains(container)) { root.unmount(); roots.delete(container) }
  }
}
