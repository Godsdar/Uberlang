import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { AnimatePresence, motion, useIsPresent, useReducedMotion } from 'motion/react'
import { ancestorIds, familyLayout, familyHierarchy, relationNames, syntaxLayout } from '../domain/graphs'
import { extendHistory, foldHistory, historyLimit, parseHistory, type HistoryResult } from '../domain/history'
import type { Family, Token } from '../domain/graphs'

interface FamilyProps { family: Family; word: string; onFamilyChange?: (family: Family) => void }

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
      aria-pressed={selected} aria-label={`${node.label}, ${node.lang}`} title={`${node.label} · ${node.lang}`} onClick={onSelect}>
      <span className="lp-node-port" aria-hidden="true" />
      <span className="lp-form">{node.label}</span><span className="lp-lang">{node.lang}</span>
    </button>
  </motion.div>
}

function FamilyExplorer({ family: initialFamily, word, onFamilyChange }: FamilyProps) {
  const [family, setFamily] = useState(initialFamily)
  const request = useRef<AbortController | null>(null)
  const [pending, setPending] = useState(false)
  const [historyMessage, setHistoryMessage] = useState('')
  const [choice, setChoice] = useState<{ nodeId: string; result: HistoryResult } | null>(null)
  const leaves = useMemo(() => familyHierarchy(family.nodes).leaves().map(n => n.data), [family])
  const sourced = family.direction === 'sources'
  const anchor = leaves.find(n => n.lang === 'English') ?? leaves[0]
  const initial = sourced ? family.nodes.find(n => n.parent === null)! : anchor
  const defaults = useMemo(() => {
    const others = leaves.filter(n => n.id !== anchor.id)
    return [...new Set([anchor.id, ...[others[0], others.at(-1)].filter(n => n !== undefined).map(n => n.id)])]
  }, [anchor, leaves])
  const [selectedId, setSelected] = useState(initial.id)
  const [endpoints, setEndpoints] = useState(defaults)
  const [pathOnly, setPathOnly] = useState(false)
  const [zoom, setZoom] = useState(1)
  const reduced = useReducedMotion()
  const selected = family.nodes.find(n => n.id === selectedId) ?? initial
  // A dictionary entry can stand alone when all its cited branches are folded.
  const visibleEndpoints = endpoints.length ? endpoints : [initial.id]
  const layout = useMemo(() => familyLayout(family.nodes, pathOnly ? [selected.id] : visibleEndpoints, family.direction), [family, endpoints, pathOnly, selected.id])
  const ancestry = useMemo(() => ancestorIds(family.nodes, selected.id), [family, selected.id])
  const trail = useMemo(() => familyHierarchy(family.nodes).descendants().find(n => n.id === selected.id)!.ancestors().reverse(), [family, selected.id])
  const transition = { duration: reduced ? 0 : .32, ease: [.22, 1, .36, 1] as [number, number, number, number] }
  function selectNode(id: string) {
    request.current?.abort(); request.current = null
    setPending(false); setChoice(null); setHistoryMessage(''); setSelected(id)
  }
  useEffect(() => {
    request.current?.abort(); request.current = null
    setPending(false); setChoice(null); setHistoryMessage('')
    return () => { request.current?.abort(); request.current = null }
  }, [selectedId])
  function applyHistory(result: HistoryResult, choiceId?: string) {
    const next = extendHistory(family, selected.id, result, choiceId)
    const children = next.nodes.filter(n => n.parent === selected.id).map(n => n.id)
    setFamily(next); onFamilyChange?.(next)
    setEndpoints(previous => [...new Set([...previous.filter(id => id !== selected.id), ...(children.length ? children : [selected.id])])])
    setPathOnly(false); setChoice(null)
    setHistoryMessage(children.length ? `${children.length} sourced ${children.length === 1 ? 'form' : 'forms'} added. Choose a new form to go deeper.` : 'No supported continuation found. The entry remains available below.')
  }
  async function exploreHistory() {
    if (!selected.lookup || pending) return
    const controller = new AbortController(); request.current?.abort(); request.current = controller
    setPending(true); setHistoryMessage('Reading the cited dictionary entry…'); setChoice(null)
    const timer = setTimeout(() => controller.abort(), 12000)
    try {
      const response = await fetch('/api/etymology', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', signal: controller.signal, body: JSON.stringify(selected.lookup) })
      if (!response.ok) throw new Error(response.status === 429 ? 'The dictionary is busy. Wait a minute before retrying.' : 'The entry could not be loaded. Your tree is safe; try again when ready.')
      const result = parseHistory(await response.json(), selected.lookup)
      if (request.current !== controller || controller.signal.aborted) return
      if (result.choices.length > 1) { setChoice({ nodeId: selected.id, result }); setHistoryMessage('This entry has different etymologies. Choose one to explore; they will not be combined.') }
      else applyHistory(result)
    } catch (error) {
      if (request.current === controller) setHistoryMessage(controller.signal.aborted ? 'Lookup stopped. You can retry when ready.' : error instanceof Error ? error.message : 'The entry could not be read.')
    } finally { clearTimeout(timer); if (request.current === controller) { request.current = null; setPending(false) } }
  }
  const continuation = family.nodes.filter(n => n.parent === selected.id)
  const continuationVisible = layout.nodes.some(n => n.parent === selected.id)
  const limit = historyLimit(family, selected.id)
  function reveal(next: string[]) {
    setEndpoints(next)
    setPathOnly(false)
    if (!familyLayout(family.nodes, next.length ? next : [initial.id]).nodes.some(n => n.id === selectedId)) selectNode(initial.id)
  }
  function toggle(id: string) {
    if (!sourced && id === anchor.id) return
    reveal(endpoints.includes(id) ? endpoints.filter(n => n !== id) : [...endpoints, id])
  }
  return <div className="lp-family-explorer">
    <div className="lp-branch-picker" role="group" aria-label="Visible family branches">
      <span className="lp-label">{sourced ? 'Cited forms' : 'Branches'}</span>
      {leaves.filter(n => n.id !== (sourced ? initial.id : '')).map(node => <button key={node.id} aria-pressed={endpoints.includes(node.id)}
        disabled={!sourced && node.id === anchor.id} onClick={() => toggle(node.id)}>
        <span className="lp-branch-mark" aria-hidden="true">{endpoints.includes(node.id) ? '−' : '+'}</span> {sourced ? `${node.label} · ${node.lang}` : node.lang}
      </button>)}
      {leaves.length > 3 && <button className="lp-reveal-all" onClick={() => reveal(endpoints.length === leaves.length ? defaults : leaves.map(n => n.id))}>
        {endpoints.length === leaves.length ? 'Fewer branches' : 'Reveal all'}
      </button>}
    </div>
    <div className="lp-explorer-grid">
      <div className="lp-graph-panel">
        <div className="lp-graph-toolbar">
          <div role="group" aria-label="Family detail">
            <button aria-pressed={!pathOnly} onClick={() => setPathOnly(false)}>{sourced ? 'Sources' : 'Family'}</button>
            <button aria-pressed={pathOnly} disabled={sourced && selected.parent === null} onClick={() => setPathOnly(true)}>Selected path</button>
          </div>
          <div role="group" aria-label="Tree scale">
            <button aria-label="Zoom out" disabled={zoom <= .75} onClick={() => setZoom(z => Math.max(.75, z - .25))}>−</button>
            <button aria-label="Reset tree scale" onClick={() => setZoom(1)}>{Math.round(zoom * 100)}%</button>
            <button aria-label="Zoom in" disabled={zoom >= 1.5} onClick={() => setZoom(z => Math.min(1.5, z + .25))}>+</button>
          </div>
        </div>
        <div className={`lp-graph-scroll lp-family-canvas ${sourced ? 'is-sourced' : ''}`} tabIndex={0} role="region" aria-label={`${word} ${sourced ? 'sources' : 'family'}. Scroll horizontally to explore branches.`}>
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
                      <motion.path initial={reduced || condensed ? false : { pathLength: 0 }}
                        animate={{ d, opacity: active ? 1 : .55, strokeWidth: active ? 2.5 : Math.max(1.1, 2.4 - to.depth * .35), ...(!condensed && { pathLength: 1 }) }}
                        transition={transition} stroke={active ? 'var(--lp-accent)' : 'var(--lp-muted)'}
                        strokeLinecap="round" strokeDasharray={condensed ? '3 7' : undefined} fill="none" />
                      {sourced && to.relation && <motion.text className="lp-arc-label" initial={false}
                        animate={{ x: (from.x + to.x) / 2 + 8, y: bend }} transition={transition}>{to.relation}</motion.text>}
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
        <div className="lp-graph-legend"><span>{sourced ? 'Word above · cited forms below' : 'Ancestors below · relatives above'}</span><span>┄ omitted stages</span><span>* reconstructed</span></div>
        <p className="lp-explorer-hint">Choose a form to follow its story. {sourced ? 'Select a form, then Explore deeper to follow its cited history.' : 'Unfold branches above; scroll across wider trees.'}</p>
      </div>
      <aside className="lp-inspector lp-family-inspector">
        <div className="lp-section-label">Selected form</div>
        <div aria-live="polite" aria-atomic="true"><p className={`lp-word ${selected.reconstructed ? 'is-reconstructed' : ''}`}>{selected.label}</p><p className="lp-label">{selected.lang}{selected.reconstructed ? ' · reconstructed' : ''}</p></div>
        {sourced && <section className="lp-history-controls" aria-label="Explore word history">
          {continuation.length > 0 ? <button onClick={() => { setPathOnly(false); setEndpoints(previous => continuationVisible ? foldHistory(family, previous, selected.id) : [...new Set([...previous.filter(id => id !== selected.id), ...continuation.map(n => n.id)])]) }}>{continuationVisible ? 'Fold continuation' : 'Unfold continuation'}</button> :
            selected.lookup && !selected.historyState ? <button className="lp-main" disabled={pending || !!limit} onClick={exploreHistory}>Explore deeper ↘</button> : null}
          {pending && <button onClick={() => { request.current?.abort(); request.current = null; setPending(false); setHistoryMessage('Lookup cancelled. Your tree is unchanged.') }}>Cancel</button>}
          <p className="lp-label">{limit || selected.historyNote || (!selected.lookup ? 'This language or form is not supported for expansion. Read the linked entry.' : 'Loads only this form and language from Wiktionary when you choose Explore deeper.')}</p>
          <p className="lp-history-status" role="status" aria-live="polite">{historyMessage}</p>
          {choice?.nodeId === selected.id && <div className="lp-history-choices" role="group" aria-label="Choose a separate etymology">
            {choice.result.choices.map(option => <button key={option.id} onClick={() => { try { applyHistory(choice.result, option.id) } catch (error) { setHistoryMessage(error instanceof Error ? error.message : 'Cannot add this history.') } }}>
              <strong>{option.label}</strong><span>{option.summary}</span><small>{option.nodes.length > 1 ? `${option.nodes.length - 1} cited forms` : 'No supported continuation'}</small>
            </button>)}
          </div>}
        </section>}
        <p className="lp-word-gloss">{selected.gloss || family.note}</p>
        <nav className="lp-lineage-trail" aria-label="Selected lineage">
          {trail.map(n => <button key={n.id} aria-current={n.id === selected.id ? 'true' : undefined} onClick={() => selectNode(n.data.id)}>{n.data.label}</button>)}
        </nav>
        {sourced && selected.relation && <p className="lp-label">Relation: {selected.relation}.{selected.relation === 'component' ? ' A word part, not a historical ancestor.' : selected.relation === 'form-of' ? ' The previous form is an inflection of this lemma; this is not ancestry.' : ''}</p>}
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
