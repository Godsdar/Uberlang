import { originLabel } from '../domain/ancestry'
import { LanguagePicker } from './language-picker'
import { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { FamilyExplorer } from './explorers'
import { historyLanguages, historyTarget, type HistoryTarget } from '../../../src/shared/etymology'
import { openHistory, parseHistory, type HistoryResult } from '../domain/history'
import { DISCOVERY_KEY, MAX_BACKUP, emptyLibrary, parseLibrary, resumeDiscovery, savedCuriosities, saveDiscovery, sharedForms, validateDiscovery, writeLibrary, type Discovery, type DiscoveryLibrary, type ExplorerView } from '../domain/explorations'
import type { Family } from '../domain/graphs'

export interface ResearchEntry { word: string; language: string; family?: Family; context?: string; importedCard?: Discovery['importedCard'] }
interface Options { prepared: Record<string, Family>; onAnki: (discovery: Discovery) => void; onContext: () => void }
interface Bridge { open: (entry: ResearchEntry) => void }
const message = (error: unknown) => error instanceof Error ? error.message : 'This action could not be completed.'
function load() {
  try {
    const raw = localStorage.getItem(DISCOVERY_KEY)
    return { raw, library: raw ? parseLibrary(raw) : emptyLibrary(), error: '' }
  } catch { return { raw: null, library: emptyLibrary(), error: 'Saved discoveries could not be read. Download the stored data before restoring a backup. Nothing has been overwritten.' } }
}
function download(value: string, name: string) {
  const url = URL.createObjectURL(new Blob([value], { type: 'application/json;charset=utf-8' }))
  const link = document.createElement('a'); link.href = url; link.download = name; link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
function newDiscovery(entry: ResearchEntry & { family: Family }): Discovery {
  return validateDiscovery({ ...entry, id: crypto.randomUUID(), note: '', marks: {}, updatedAt: new Date().toISOString() })
}

function ResearchWorkspace({ options, bridge }: { options: Options; bridge: Bridge }) {
  const [loaded] = useState(load)
  const [library, setLibrary] = useState(loaded.library)
  const libraryRef = useRef(library), raw = useRef(loaded.raw)
  const [storageError, setStorageError] = useState(loaded.error)
  const [active, setActive] = useState<Discovery | null>(() => loaded.library.discoveries.find(d => d.id === loaded.library.activeId) ?? null)
  const activeRef = useRef(active)
  const [generation, setGeneration] = useState(0)
  const [autoTrace, setAutoTrace] = useState(false)
  const [term, setTerm] = useState(active?.word ?? '')
  const [language, setLanguage] = useState(active?.language ?? 'en')
  const [context, setContext] = useState('')
  const [importedCard, setImportedCard] = useState<Discovery['importedCard']>()
  const [pending, setPending] = useState(false)
  const [status, setStatus] = useState('')
  const [choices, setChoices] = useState<HistoryResult | null>(null)
  const [unsaved, setUnsaved] = useState<Discovery[]>([])
  const draftsRef = useRef(unsaved); draftsRef.current = unsaved
  const [compareId, setCompareId] = useState('')
  const [filter, setFilter] = useState('')
  const [restore, setRestore] = useState<DiscoveryLibrary | null>(null)
  const request = useRef<AbortController | null>(null)
  const search = useRef<HTMLInputElement>(null)
  const resultHeading = useRef<HTMLHeadingElement>(null)
  const saved = !!active && library.discoveries.some(d => d.id === active.id)

  function commit(next: DiscoveryLibrary) {
    if (loaded.error && raw.current === null) throw new Error(loaded.error)
    raw.current = writeLibrary(localStorage, next, raw.current)
    libraryRef.current = next; setLibrary(next); setStorageError('')
  }
  function cancel() { request.current?.abort(); request.current = null; setPending(false) }
  function update(next: Discovery) { activeRef.current = next; setActive(next) }
  function patch(delta: Partial<Discovery>) {
    if (activeRef.current) update({ ...activeRef.current, ...delta, updatedAt: new Date().toISOString() })
  }
  function keepForLater(nodeId: string) {
    const current = activeRef.current
    if (!current) return
    const marks = { ...current.marks }
    if (marks[nodeId] === 'curious') delete marks[nodeId]; else marks[nodeId] = 'curious'
    const next = { ...current, marks, updatedAt: new Date().toISOString() }
    try { commit(saveDiscovery(libraryRef.current, next)); update(next); setStatus(marks[nodeId] ? 'Saved for later on this browser. Continue exploring will bring you back to this form.' : 'Removed from your later list. The discovery is still saved.') }
    catch (error) { setStorageError(message(error)) }
  }
  function remember() {
    const current = activeRef.current
    if (!current) return
    try { commit(saveDiscovery(libraryRef.current, current)); setStatus('Saved on this browser. Changes to this discovery will save automatically.') }
    catch (error) { setStorageError(message(error)) }
  }
  function activate(next: Discovery, trace = false, alternatives: HistoryResult | null = null) {
    setAutoTrace(trace)
    cancel(); setChoices(alternatives)
    const previous = activeRef.current
    // Keep a recoverable draft when a new search replaces an unsaved tree.
    if (previous && previous.id !== next.id && !libraryRef.current.discoveries.some(d => d.id === previous.id)) setUnsaved(items => [previous, ...items.filter(d => d.id !== previous.id)])
    if (previous && libraryRef.current.discoveries.some(d => d.id === previous.id)) {
      try { commit(saveDiscovery(libraryRef.current, previous)) } catch (error) { setStorageError(message(error)); setUnsaved(items => [previous, ...items.filter(d => d.id !== previous.id)]) }
    }
    update(structuredClone(next)); setContext(next.context ?? ''); setImportedCard(next.importedCard); setTerm(next.word); setLanguage(next.language); setGeneration(n => n + 1)
    if (libraryRef.current.discoveries.some(d => d.id === next.id)) {
      try { commit({ ...libraryRef.current, activeId: next.id }) } catch (error) { setStorageError(message(error)) }
    }
    requestAnimationFrame(() => { resultHeading.current?.scrollIntoView({ block: 'start', behavior: 'instant' }); resultHeading.current?.focus({ preventScroll: true }) })
  }
  bridge.open = entry => {
    cancel(); setChoices(null); setTerm(entry.word); setLanguage(entry.language); setContext(entry.context ?? ''); setImportedCard(entry.importedCard)
    if (entry.family) { activate(newDiscovery({ ...entry, family: entry.family })); setStatus('') }
    else { setStatus('Ready to explore.'); search.current?.focus() }
  }
  useEffect(() => () => request.current?.abort(), [])
  useEffect(() => {
    if (!active || !saved) return
    const timer = setTimeout(() => {
      try { commit(saveDiscovery(libraryRef.current, active)) }
      catch (error) { setStorageError(message(error)) }
    }, 300)
    return () => clearTimeout(timer)
  }, [active, saved])
  useEffect(() => {
    const flush = () => {
      if (activeRef.current && libraryRef.current.discoveries.some(d => d.id === activeRef.current!.id)) {
        try { commit(saveDiscovery(libraryRef.current, activeRef.current)) } catch (error) { setStorageError(message(error)) }
      }
    }
    const visibility = () => { if (document.visibilityState === 'hidden') flush() }
    const leaving = (event: BeforeUnloadEvent) => {
      flush()
      const current = activeRef.current
      if ((current && JSON.stringify(libraryRef.current.discoveries.find(d => d.id === current.id)) !== JSON.stringify(current)) || draftsRef.current.some(d => d.id !== current?.id && !libraryRef.current.discoveries.some(saved => saved.id === d.id))) { event.preventDefault(); event.returnValue = '' }
    }
    const changed = (event: StorageEvent) => { if (event.key === DISCOVERY_KEY) setStorageError('Discoveries changed in another tab. Download current work before reloading the saved library.') }
    window.addEventListener('beforeunload', leaving); window.addEventListener('pagehide', flush); document.addEventListener('visibilitychange', visibility); window.addEventListener('storage', changed)
    return () => { window.removeEventListener('beforeunload', leaving); window.removeEventListener('pagehide', flush); document.removeEventListener('visibilitychange', visibility); window.removeEventListener('storage', changed) }
  }, [])
  async function explore(target: HistoryTarget, seed: Pick<ResearchEntry, 'context' | 'importedCard'> = { context, importedCard }) {
    cancel(); setChoices(null)
    const controller = new AbortController(); request.current = controller
    setPending(true); setStatus(`Looking up ${target.term} in ${historyLanguages[target.language]}…`)
    const timer = setTimeout(() => controller.abort(), 15000)
    try {
      const response = await fetch('/api/etymology', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', signal: controller.signal, body: JSON.stringify(target) })
      if (!response.ok) throw new Error(response.status === 429 ? 'The dictionary is busy. Wait a moment and retry.' : 'Word history is unavailable right now. Your current tree is still here; try a prepared family below.')
      const result = parseHistory(await response.json(), target)
      if (request.current !== controller || controller.signal.aborted) return
      const family = openHistory(result)
      if (family) {
        activate(newDiscovery({ word: target.term, language: target.language, family, ...seed }), !target.term.includes(' '), result.choices.length > 1 ? result : null)
        setStatus('')
      } else {
        setChoices(result)
        setStatus(target.term.includes(' ') ? 'No supported dictionary history was found for this expression. Ordinary sentences often have no shared origin; the words can be researched separately.' : result.reason || 'No sourced history was found. This does not prove the word has no history.')
      }
    } catch (error) {
      if (request.current === controller) setStatus(controller.signal.aborted ? 'Lookup timed out. Your tree is still here; try again when ready.' : message(error))
    } finally { clearTimeout(timer); if (request.current === controller) { request.current = null; setPending(false) } }
  }
  function snapshot(family: Family, view: ExplorerView) { patch({ family, view }) }
  const selected = active?.family.nodes.find(n => n.id === active.view?.selectedId) ?? active?.family.nodes.find(n => n.parent === null)
  const comparison = library.discoveries.find(d => d.id === compareId && d.id !== active?.id)
  const shared = active && comparison ? sharedForms(active.family, comparison.family) : []
  const visible = library.discoveries.filter(d => `${d.word} ${d.note} ${historyLanguages[d.language]}`.toLowerCase().includes(filter.toLowerCase()))
  function backupCurrent() { if (activeRef.current) download(JSON.stringify(saveDiscovery(emptyLibrary(), activeRef.current)), 'uberlang-discovery.json') }

  const curiosities = savedCuriosities(library)

  return <section className={`lp-research${active ? ' has-discovery' : ''}`} aria-label="Etymology research">
    <h1 className="lp-sr-only">Word origins</h1>
    <form className="lp-research-search" onSubmit={event => {
      event.preventDefault(); const target = historyTarget(language, term.trim())
      if (!target) { setStatus('Enter a supported word or dictionary expression, up to 80 characters. Reconstructed forms need an asterisk (*).'); return }
      void explore(target)
    }}>
      <label className="lp-search-word">Word<input ref={search} value={term} maxLength={80} placeholder="Enter a word" autoComplete="off" onChange={e => { cancel(); setChoices(null); setTerm(e.target.value); setContext(''); setImportedCard(undefined); setStatus('') }} /></label>
      <LanguagePicker value={language} onChange={code => { cancel(); setChoices(null); setLanguage(code); setContext(''); setImportedCard(undefined); setStatus('') }} />
      <button className="lp-main" type="submit" disabled={pending}>Explore →</button>
      {pending && <button type="button" onClick={() => { cancel(); setStatus('Lookup cancelled. Your tree is unchanged.') }}>Cancel</button>}
    </form>
    {context && <details className="lp-entry-context"><summary>Context for this lookup</summary><p>{context}</p><button onClick={options.onContext}>Back to sentence analysis</button></details>}
    <div className="lp-research-options"><details><summary>Examples</summary><div className="lp-research-starts"><span>Prepared families</span>{['water', 'mother'].filter(word => options.prepared[word]).map(word => <button key={word} onClick={() => { activate(newDiscovery({ word, language: 'en', family: options.prepared[word] })); setStatus(''); setContext(''); setImportedCard(undefined) }}>{word} ↗</button>)}</div></details><details><summary>About word lookup</summary><p>Explore sends the word and selected language to Wiktionary. Dictionary expressions are also supported. Histories may be incomplete; separate etymologies stay separate.</p><p>Examples are prepared and open offline. Saved discoveries stay in this browser; download a backup to keep a copy.</p><p><a href="https://en.wiktionary.org/" target="_blank" rel="noreferrer">Wiktionary ↗</a> · <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">CC BY-SA 4.0</a></p></details>
    {curiosities.length > 0 && <details className="lp-curiosity-queue"><summary>Continue exploring · {curiosities.length}</summary><p className="lp-label">Your saved questions · on this browser</p>{curiosities.slice(0, 5).map(({ discovery, node }) => <button key={`${discovery.id}:${node.id}`} onClick={() => { activate(resumeDiscovery(discovery, node.id)); setStatus('') }}><strong>{node.label}</strong><span>{node.lang} · from {discovery.word}</span><span aria-hidden="true">→</span></button>)}{curiosities.length > 5 && <details><summary>{curiosities.length - 5} more saved forms</summary>{curiosities.slice(5).map(({ discovery, node }) => <button key={`${discovery.id}:${node.id}`} onClick={() => activate(resumeDiscovery(discovery, node.id))}>{node.label} · {node.lang} · from {discovery.word}</button>)}</details>}</details>}
    <details className="lp-discoveries"><summary>Your discoveries · {library.discoveries.length}</summary>
      <p className="lp-label">Stored in this browser only. Download a backup to keep a copy or move to another device.</p>
      <label>Find a discovery<input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Word or your note" /></label>
      <ul className="lp-discovery-list">{visible.map(d => <li key={d.id}><button onClick={() => { activate(d); setStatus('') }}>{d.word}<small>{historyLanguages[d.language]} · {d.family.nodes.length} forms{Object.values(d.marks).includes('curious') ? ' · to explore' : ''}</small></button><details><summary>Manage</summary><button onClick={() => {
        try { commit({ ...libraryRef.current, discoveries: libraryRef.current.discoveries.filter(item => item.id !== d.id), activeId: libraryRef.current.activeId === d.id ? null : libraryRef.current.activeId }); setStatus('Removed from saved discoveries. An open copy stays available until you leave.') }
        catch (error) { setStorageError(message(error)) }
      }}>Remove saved copy of {d.word}</button></details></li>)}</ul>
      {!visible.length && <p className="lp-label">{library.discoveries.length ? 'No matching discoveries.' : 'Save a tree to return to its branches and your notes.'}</p>}
      <div className="lp-actions"><button disabled={!library.discoveries.length} onClick={() => download(JSON.stringify(library), 'uberlang-discoveries.json')}>Download library</button><label className="lp-restore-label">Restore a backup<input type="file" accept=".json,application/json" onChange={async e => {
        const file = e.target.files?.[0]; e.target.value = ''; if (!file) return
        try { if (file.size > MAX_BACKUP * 3) throw new Error('This backup is too large (maximum 6 MB).'); setRestore(parseLibrary(await file.text())) }
        catch (error) { setStatus(message(error)); setRestore(null) }
      }} /></label></div>
      {restore && <div><p>{loaded.error ? 'Replace the unreadable library with this backup? Download stored data first to keep the original.' : `Restore ${restore.discoveries.length} discoveries as new copies? Existing discoveries will stay.`}</p><button onClick={() => {
        try {
          const copies = restore.discoveries.map(d => ({ ...d, id: crypto.randomUUID() }))
          const next = { ...libraryRef.current, discoveries: [...libraryRef.current.discoveries, ...copies] }
          if (loaded.error) { raw.current = localStorage.getItem(DISCOVERY_KEY); const recoveryError = loaded.error; loaded.error = ''; try { commit(next) } catch (error) { loaded.error = recoveryError; throw error } } else commit(next); setRestore(null); setStatus(`Restored ${copies.length} discoveries. Open one to continue.`)
        } catch (error) { setStorageError(message(error)) }
      }}>{loaded.error ? 'Replace unreadable library' : 'Restore copies'}</button><button onClick={() => setRestore(null)}>Cancel restore</button></div>}
      <details className="lp-language-interests"><summary>Languages I’m curious about</summary><p className="lp-label">Star matching branches in your trees. These preferences do not create new connections.</p><div>{Object.entries(historyLanguages).map(([code, name]) => <label key={code}><input type="checkbox" checked={library.languages.includes(code)} onChange={e => { try { commit({ ...libraryRef.current, languages: e.target.checked ? [...libraryRef.current.languages, code] : libraryRef.current.languages.filter(l => l !== code) }) } catch (error) { setStorageError(message(error)) } }} />{name}</label>)}</div></details>
    </details>
    </div>
    <p className="lp-research-status" role="status" aria-live="polite">{status}</p>
    {storageError && <div role="alert" className="lp-storage-error"><p>{storageError}</p><button onClick={backupCurrent} disabled={!active}>Download current discovery</button><button onClick={() => { try { download(localStorage.getItem(DISCOVERY_KEY) ?? '', 'uberlang-stored-data.json') } catch { setStatus('The browser is blocking access to stored data.') } }}>Download stored data</button><button onClick={() => { const next = load(); raw.current = next.raw; loaded.error = next.error; libraryRef.current = next.library; setLibrary(next.library); setStorageError(next.error); if (!next.error) { const current = next.library.discoveries.find(d => d.id === next.library.activeId); if (current) { setAutoTrace(false); update(current); setGeneration(g => g + 1) } } }}>Reload saved library</button></div>}
    {unsaved.filter(d => d.id !== active?.id && !library.discoveries.some(s => s.id === d.id)).length > 0 && <details className="lp-draft-recovery"><summary>Unsaved trees from this session</summary>{unsaved.filter(d => d.id !== active?.id && !library.discoveries.some(s => s.id === d.id)).map(d => <div key={d.id}><button onClick={() => activate(d)}>{d.word} — reopen</button><button onClick={() => download(JSON.stringify(saveDiscovery(emptyLibrary(), d)), 'uberlang-unsaved-discovery.json')}>Download {d.word}</button></div>)}<p>Save or download these trees before closing this page.</p></details>}
    {choices && !choices.choices.length && choices.source && <a href={choices.source} target="_blank" rel="noreferrer">Read the dictionary entry ↗</a>}
    {active ? <article className="lp-discovery" aria-label="Current discovery">
      <header className="lp-discovery-heading"><h2 ref={resultHeading} tabIndex={-1}>{active.word}{' '}<span>{historyLanguages[active.language]} · {active.family.direction === 'sources' ? 'Live · partial history' : 'Prepared family'}</span></h2></header>
      {(!active.word.includes(' ') || active.family.nodes.length > 1) && <FamilyExplorer key={`${active.id}:${generation}`} family={active.family} word={active.word} autoTrace={autoTrace} initialView={active.view} onSnapshot={snapshot} preferredLanguages={library.languages} onKeepLater={keepForLater} laterIds={Object.keys(active.marks).filter(id => active.marks[id] === 'curious')} onStartFrom={node => {
        const code = node.lookup?.language ?? Object.entries(historyLanguages).find(([, name]) => name === node.lang)?.[0]
        const target = code ? historyTarget(code, node.lookup?.term ?? node.label) : undefined
        if (!target) { setStatus('This form cannot be looked up directly. Its source entry is linked in the inspector.'); return }
        setTerm(target.term); setLanguage(target.language); setContext(''); setImportedCard(undefined); void explore(target, {})
      }} />}
      <div className="lp-discovery-tools"><div className="lp-actions"><button className="lp-main" onClick={remember}>{saved && !storageError ? 'Saved · save now' : 'Save discovery'}</button><button onClick={backupCurrent}>Download</button></div></div>
      {active.context && <details><summary>Original context</summary><p className="lp-discovery-context">{active.context}</p></details>}
      {active.word.includes(' ') && <section className="lp-expression-history" aria-label="Expression history"><h3>History of the expression</h3><p className="lp-label">This is the dictionary entry for the whole expression. The origins of its individual words are separate research.</p><p>{active.family.historyText || 'No readable history of this expression is available in the supported source format. A dictionary entry or a word connection alone does not establish how a phrase originated.'}</p><a href={active.family.nodes.find(n => n.parent === null)?.source} target="_blank" rel="noreferrer">Read the cited entry ↗</a><p className="lp-label">{active.family.attribution}</p></section>}
      {choices && choices.choices.length > 1 && <details key={active.id} className="lp-other-histories"><summary>Other histories of {active.word} · {choices.choices.length - 1}</summary><p className="lp-label">Different meanings can have separate histories. The first dictionary history opens automatically; the alternatives stay separate.</p><div className="lp-history-choices" aria-label="Other word histories">{choices.choices.map(choice => <button key={choice.id} disabled={choice.id === active.family.id} aria-pressed={choice.id === active.family.id} onClick={() => {
        const family = openHistory(choices, choice.id)!
        activate(newDiscovery({ word: choices.target.term, language: choices.target.language, family, ...(context && { context }), ...(importedCard && { importedCard }) }), !choices.target.term.includes(' '), choices)
        setStatus('History opened. Your previous tree is kept separately.')
      }}><strong>{choice.summary || originLabel(choice.label)}</strong><span>{choice.id === active.family.id ? 'Showing this history' : 'Open this history →'}</span></button>)}</div></details>}
      <details className="lp-discovery-notes"><summary>Notes & cards</summary><div>{selected && <div className="lp-actions" role="group" aria-label={`Your interest in ${selected.label}`}><span>{selected.label}</span>{(['known', 'curious'] as const).map(mark => <button key={mark} aria-pressed={active.marks[selected.id] === mark} onClick={() => { if (mark === 'curious') { keepForLater(selected.id); return } const marks = { ...active.marks }; if (marks[selected.id] === mark) delete marks[selected.id]; else marks[selected.id] = mark; patch({ marks }) }}>{mark === 'known' ? 'I know this' : 'Explore later'}</button>)}</div>}<label>Note<textarea value={active.note} maxLength={4000} rows={3} placeholder="Add a note" onChange={e => patch({ note: e.target.value })} /></label><p className="lp-label">{saved && !storageError ? 'Notes and tree changes save on this browser.' : 'Save this discovery to keep your tree and notes after closing the page.'}</p></div><button onClick={() => options.onAnki(active)}>Make an Anki card…</button></details>
      <details className="lp-compare"><summary>Compare with another discovery</summary><label>Saved discovery<select value={compareId} onChange={e => setCompareId(e.target.value)}><option value="">Choose a word</option>{library.discoveries.filter(d => d.id !== active.id).map(d => <option key={d.id} value={d.id}>{d.word} · {historyLanguages[d.language]} · {originLabel(d.family.label || 'Prepared family')}</option>)}</select></label>
        {comparison && <div><h3>{active.word} & {comparison.word}</h3><p>{shared.length ? 'Forms found in both loaded histories:' : 'No shared form appears in the loaded histories. The trees may be incomplete; this is not proof that the words are unrelated.'}</p><ul>{shared.map(({ left, right }) => <li key={`${left.id}:${right.id}`}><strong>{left.label}</strong> · {left.lang}<br /><a href={left.edgeSource || left.source} target="_blank" rel="noreferrer">{active.word}: {left.relation || 'family evidence'} ↗</a>{' · '}<a href={right.edgeSource || right.source} target="_blank" rel="noreferrer">{comparison.word}: {right.relation || 'family evidence'} ↗</a></li>)}</ul><p className="lp-label">A shared form is a lead to investigate, not proof of a shared ancestor. Homonyms, components, inflections and separate etymologies need their own evidence. No connecting edge has been invented.</p></div>}
      </details>
    </article> : null}
  </section>
}

export function mountResearch(container: HTMLElement, options: Options): Bridge {
  const bridge: Bridge = { open: () => {} }
  createRoot(container).render(<ResearchWorkspace options={options} bridge={bridge} />)
  return bridge
}
