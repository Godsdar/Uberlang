import type { ResearchEntry } from '../components/research-workspace'
import { readDeck } from './client'
import { defaultMapping, deckSearchKey, listLibrary, mappedNotes, planImport, removeLibrary, saveLibrary, type ImportPlan } from './library'
import { historyLanguages, historyTarget } from '../../../src/shared/etymology'
import { parseHistory } from '../domain/history'
import { mountFamily, unmountExplorers } from '../components/explorers'
import { unique, type ImportBatch, type ImportNote, type LibraryNote, type Mapping } from './model'
import './import.css'

const element = <K extends keyof HTMLElementTagNameMap>(tag: K, text = '') => { const node = document.createElement(tag); node.textContent = text; return node }
const snippet = (text: string, length = 120) => text.length > length ? text.slice(0, length) + '…' : text
const deckPaths = (notes: ImportNote[]) => unique(notes.flatMap(n => n.decks.flatMap(d => { const parts = d.split('::'); return parts.map((_, i) => parts.slice(0, i + 1).join('::')) }))).sort()
export interface DeckNotebookEntry { text: string; word: string; language: 'en'; source: { filename: string; guid: string; decks: string[]; tags: string[] } }

export function mountDeckLibrary(app: HTMLElement, openNotebook: (entry: DeckNotebookEntry) => void, openResearch?: (entry: ResearchEntry) => void) {
  const dialog = document.createElement('dialog'); dialog.className = 'lp-anki lp-import'
  dialog.setAttribute('aria-labelledby', `${app.id}-decks-title`)
  dialog.innerHTML = `<div class="lp-anki-heading"><h2 id="${app.id}-decks-title">My decks</h2><button type="button" data-deck-close>Close</button></div>
    <p class="lp-label">Local to this browser · no Anki connection</p>
    <p class="lp-label">Your Anki decks do not appear automatically. Import an exported file once to browse and explore it here.</p>
    <div data-deck-start><label class="lp-import-file">Import a deck<input data-deck-file type="file" accept=".apkg,.txt,.tsv"></label>
    <details><summary>How to bring a deck from Anki</summary><ol><li>In Anki Desktop, select your deck and choose Export.</li><li>Choose Notes in Plain Text with field names, or Anki Deck Package (.apkg) without media.</li><li>Choose the exported file below, review each note type and import.</li></ol><p>Nothing is uploaded. This browser and site address have their own library; clearing browser data removes it. This is a copy, without automatic sync.</p></details><details><summary>Formats & limits</summary><p>Choose an Anki deck (.apkg, legacy or modern) or UTF-8 Notes in Plain Text (.txt/.tsv). Maximum 32 MiB, 10,000 notes and 5,000 archive files. Export without media for large decks.</p><p>Text only: no pictures, audio, card templates, styling or review schedules. Cloze answers become plain text. No two-way sync. Existing Anki data is never changed.</p><p>Imported notes persist here until removed or browser data is cleared. Keep the original file as your backup; other devices and site origins have separate libraries.</p></details></div>
    <p data-deck-status class="lp-live-status" role="status" aria-live="polite"></p>
    <button data-deck-cancel hidden>Cancel file reading</button>
    <fieldset data-deck-work><legend class="lp-sr-only">Deck library</legend>
      <div data-deck-mapping hidden><h3>Map your fields</h3><p class="lp-label" data-deck-summary></p>
        <div class="lp-anki-fields"><label class="lp-anki-wide">Note type<select data-deck-type></select></label>
        <label>Word or expression<select data-map="word"></select></label><label>Example · optional<select data-map="example"></select></label>
        <label>Answer · optional<select data-map="answer"></select></label><label>Language code<input data-map="language" placeholder="en, es, fr…" list="${app.id}-deck-languages" maxlength="40" autocapitalize="none" spellcheck="false"><datalist id="${app.id}-deck-languages"></datalist></label></div>
        <p class="lp-label">Review the language for every note type. Spanish / English may be suggested from the note type name. English grammar only; word histories cover supported languages. For mixed languages, select a subset and import each language separately.</p>
        <details open><summary>Mapped sample</summary><pre data-deck-sample></pre></details>
        <details><summary>What this file contains & import warnings</summary><ul data-deck-warnings></ul></details>
      </div>
      <div data-deck-browse><div class="lp-anki-fields"><label class="lp-anki-wide">Find a note<input data-deck-search type="search" maxlength="200" placeholder="Word, example or answer"></label>
        <label>Deck<select data-deck-filter></select></label><label>Tag<select data-deck-tag></select></label></div>
        <div class="lp-actions" data-deck-selection hidden><button data-deck-select>Select matching</button><button data-deck-clear>Clear selection</button><span class="lp-label" data-deck-selected></span></div>
        <p class="lp-label" data-deck-count></p><div data-deck-list></div>
        <div class="lp-actions"><button data-deck-prev>Previous</button><span class="lp-label" data-deck-page></span><button data-deck-next>Next</button></div>
      </div>
      <div data-deck-import-actions hidden><details><summary>Duplicate handling</summary><label>Existing notes<select data-deck-duplicates><option value="skip">Skip existing notes</option><option value="update">Update matching notes in this library</option></select></label><p class="lp-label">Match GUID + language; text files without GUIDs match all fields + note type + language. Filename is ignored. Updates replace fields, tags and deck membership. Anki itself is unchanged.</p></details>
        <div class="lp-actions"><button data-deck-review class="lp-main">Review selected notes</button><button data-deck-discard>Back to library</button></div>
        <div data-deck-confirm hidden><p data-deck-plan></p><button data-deck-save class="lp-main">Import into this browser</button></div>
      </div>
      <div data-deck-detail hidden></div>
    </fieldset>`
  app.append(dialog)
  const q = <T extends HTMLElement = HTMLElement>(selector: string) => dialog.querySelector<T>(selector)!
  const select = (selector: string) => q<HTMLSelectElement>(selector)
  const field = q<HTMLInputElement>('[data-deck-file]'), work = q<HTMLFieldSetElement>('[data-deck-work]'), status = q('[data-deck-status]')
  const languages: Record<string, string> = { ...historyLanguages, ja: 'Japanese', zh: 'Chinese', ko: 'Korean', tr: 'Turkish' }
  for (const [code, name] of Object.entries(languages)) { const option = element('option'); option.value = code; option.label = name; q('datalist').append(option) }
  let batch: ImportBatch | null = null, library: LibraryNote[] = [], selected = new Set<string>(), mappings = new Map<string, Mapping>(), page = 0
  let controller: AbortController | null = null, revision = 0, saving = false, returnFocus: HTMLElement | null = null
  let ready: { notes: LibraryNote[]; empty: number; plan: ImportPlan } | null = null
  const show = (selector: string, visible: boolean) => { q(selector).hidden = !visible }
  function cancel() { controller?.abort(); controller = null; revision++; work.disabled = false; field.disabled = false; show('[data-deck-cancel]', false); status.textContent = '' }
  function invalidate() { ready = null; revision++; show('[data-deck-confirm]', false) }
  function options(target: HTMLSelectElement, values: [string, string][], value = '') { target.replaceChildren(...values.map(([v, label]) => new Option(label, v))); target.value = value }
  function filters() {
    const notes = batch?.notes || library
    options(select('[data-deck-filter]'), [['', 'All decks'], ...deckPaths(notes).map(v => [v, v] as [string, string])])
    options(select('[data-deck-tag]'), [['', 'All tags'], ...unique(notes.flatMap(n => n.tags)).sort().map(v => [v, v] as [string, string])])
    q<HTMLInputElement>('[data-deck-search]').value = ''; page = 0
  }
  function matching(): ImportNote[] {
    const search = deckSearchKey(q<HTMLInputElement>('[data-deck-search]').value), deck = select('[data-deck-filter]').value, tag = select('[data-deck-tag]').value
    return (batch?.notes || library).filter(n => (!batch || n.type === select('[data-deck-type]').value) && (!deck || n.decks.some(d => d === deck || d.startsWith(deck + '::'))) && (!tag || n.tags.includes(tag)) && (!search || n.fields.some(f => deckSearchKey(f).includes(search))))
  }
  function sample() {
    if (!batch) return
    const type = select('[data-deck-type]').value, mapping = mappings.get(type)!, note = batch.notes.find(n => n.type === type)!
    q('[data-deck-sample]').textContent = ['word', 'example', 'answer'].map(key => `${key}: ${snippet(note.fields[mapping[key as 'word']] || '(empty)', 600)}`).join('\n\n')
    q('[data-deck-summary]').textContent = `${batch.filename} · ${batch.notes.length} notes · ${batch.types.length} note types · ${[...mappings.values()].filter(m => m.language).length} languages set. Sample excerpts; all text fields are retained.`
  }
  function mappingUI() {
    if (!batch) return
    const type = batch.types.find(t => t.id === select('[data-deck-type]').value)!, mapping = mappings.get(type.id)!
    for (const key of ['word', 'example', 'answer'] as const) options(select(`[data-map="${key}"]`), [...(key === 'word' ? [] : [['-1', 'None'] as [string, string]]), ...type.fields.map((name, i) => [String(i), `${i + 1}. ${name}`] as [string, string])], String(mapping[key]))
    q<HTMLInputElement>('[data-map="language"]').value = mapping.language
    sample(); page = 0; renderList()
  }
  function renderList() {
    const filtered = matching(), pages = Math.max(1, Math.ceil(filtered.length / 20)); page = Math.min(page, pages - 1)
    const host = q('[data-deck-list]'); host.replaceChildren()
    for (const note of filtered.slice(page * 20, page * 20 + 20)) {
      const row = element('div'); row.className = 'lp-import-row'
      const word = batch ? note.fields[mappings.get(note.type)!.word] : (note as LibraryNote).word
      const main = element(batch ? 'label' : 'button'); main.className = 'lp-import-note'
      if (batch) {
        const checkbox = element('input'); checkbox.type = 'checkbox'; checkbox.checked = selected.has(note.id); checkbox.setAttribute('aria-label', `Select ${snippet(word || 'empty word', 60)}`)
        checkbox.addEventListener('change', () => { checkbox.checked ? selected.add(note.id) : selected.delete(note.id); invalidate(); selectionCount() })
        main.append(checkbox)
      } else main.addEventListener('click', () => detail(note as LibraryNote))
      const copy = element('span'); copy.append(element('strong', snippet(word || '(empty word field)')), element('small', snippet(note.decks.join(' · '), 100)))
      main.append(copy); row.append(main)
      if (batch) {
        const disclosure = element('details'); disclosure.append(element('summary', 'Fields'))
        const type = batch.types.find(t => t.id === note.type)!
        disclosure.append(element('pre', note.fields.map((f, i) => `${type.fields[i]}\n${f}`).join('\n\n'))); row.append(disclosure)
      }
      host.append(row)
    }
    q('[data-deck-count]').textContent = filtered.length ? `${filtered.length} matching notes · showing ${page * 20 + 1}–${Math.min((page + 1) * 20, filtered.length)}` : batch || library.length ? 'No matching notes. Try another word or clear the filters.' : 'No imported notes on this site yet. Export your deck from Anki, then choose the file above.'
    q('[data-deck-page]').textContent = `${page + 1} / ${pages}`
    q<HTMLButtonElement>('[data-deck-prev]').disabled = page === 0; q<HTMLButtonElement>('[data-deck-next]').disabled = page + 1 >= pages
    selectionCount()
  }
  function selectionCount() { q('[data-deck-selected]').textContent = `${selected.size} selected across all note types`; q<HTMLButtonElement>('[data-deck-review]').disabled = !selected.size }
  function libraryUI() {
    cancel(); batch = null; ready = null; selected.clear(); mappings.clear(); field.value = ''; select('[data-deck-duplicates]').value = 'skip'
    unmountExplorers(q('[data-deck-detail]')); q('[data-deck-detail]').replaceChildren()
    for (const name of ['mapping', 'selection', 'import-actions', 'confirm', 'detail']) show(`[data-deck-${name}]`, false)
    show('[data-deck-start]', true); show('[data-deck-browse]', true)
    filters(); renderList()
  }
  field.addEventListener('change', async () => {
    const file = field.files?.[0]; if (!file) return
    cancel(); const generation = revision; controller = new AbortController()
    work.disabled = true; field.disabled = true; show('[data-deck-cancel]', true); status.textContent = 'Reading on this device…'
    try {
      const value = await readDeck(file, controller.signal)
      if (generation !== revision || !dialog.open) return
      batch = value; selected = new Set(value.notes.map(n => n.id)); mappings = new Map(value.types.map(t => [t.id, defaultMapping(t.fields, t.name, value.notes.find(n => n.type === t.id)?.fields)]))
      options(select('[data-deck-type]'), value.types.map(t => [t.id, `${t.name} · ${value.notes.filter(n => n.type === t.id).length} notes`]), value.types[0].id)
      q('[data-deck-warnings]').replaceChildren(...value.warnings.map(w => element('li', w)))
      status.textContent = `${value.format}. Review fields and language before importing. Media and schedules are omitted.`
      show('[data-deck-start]', false); for (const name of ['mapping', 'selection', 'import-actions']) show(`[data-deck-${name}]`, true)
      filters(); mappingUI(); dialog.scrollTop = 0
    } catch (error) { if (generation === revision) status.textContent = (error as Error).name === 'AbortError' ? 'File reading cancelled.' : (error as Error).message }
    finally { if (generation === revision) { work.disabled = false; field.disabled = false; show('[data-deck-cancel]', false); field.value = ''; if (batch) select('[data-deck-type]').focus() } }
  })
  select('[data-deck-type]').addEventListener('change', mappingUI)
  for (const key of ['word', 'example', 'answer', 'language'] as const) q(`[data-map="${key}"]`).addEventListener(key === 'language' ? 'input' : 'change', () => {
    const mapping = mappings.get(select('[data-deck-type]').value)!
    if (key === 'language') mapping.language = q<HTMLInputElement>('[data-map="language"]').value.trim().toLowerCase()
    else mapping[key] = Number(select(`[data-map="${key}"]`).value)
    invalidate(); sample(); renderList()
  })
  select('[data-deck-duplicates]').addEventListener('change', invalidate)
  for (const selector of ['[data-deck-search]', '[data-deck-filter]', '[data-deck-tag]']) q(selector).addEventListener(selector.includes('search') ? 'input' : 'change', () => { page = 0; renderList() })
  q('[data-deck-prev]').addEventListener('click', () => { page--; renderList() }); q('[data-deck-next]').addEventListener('click', () => { page++; renderList() })
  q('[data-deck-select]').addEventListener('click', () => { matching().forEach(n => selected.add(n.id)); invalidate(); renderList() })
  q('[data-deck-clear]').addEventListener('click', () => { selected.clear(); invalidate(); renderList() })
  q('[data-deck-cancel]').addEventListener('click', () => { cancel(); status.textContent = 'File reading cancelled. Nothing was imported.' })
  q('[data-deck-discard]').addEventListener('click', libraryUI)
  q('[data-deck-review]').addEventListener('click', async () => {
    invalidate(); const generation = revision
    status.textContent = 'Checking selected notes against this browser’s library…'
    try {
      const mapped = await mappedNotes(batch!, mappings, selected)
      const existing = await listLibrary()
      if (generation !== revision || !dialog.open) return
      const plan = planImport(existing, mapped.notes, select('[data-deck-duplicates]').value === 'update'); ready = { ...mapped, plan }
      q('[data-deck-plan]').textContent = `${plan.added} new · ${plan.updated} updates · ${plan.skipped} existing skipped · ${plan.withinFile} repeated identities in this selection (first selected copy kept) · ${mapped.empty} empty word fields skipped. ${selected.size - mapped.empty} selected notes checked. All other fields, original decks and tags are retained as text.`
      q<HTMLButtonElement>('[data-deck-save]').disabled = !plan.writes.length
      show('[data-deck-confirm]', true); status.textContent = 'Review the counts, then import. Nothing has been saved yet.'
      q('[data-deck-save]').focus(); q('[data-deck-confirm]').scrollIntoView({ block: 'nearest' })
    } catch (error) { if (generation === revision) status.textContent = (error as Error).message }
  })
  q('[data-deck-save]').addEventListener('click', async () => {
    if (!ready || saving) return
    saving = true; work.disabled = true; q<HTMLButtonElement>('[data-deck-close]').disabled = true
    status.textContent = 'Saving to this browser…'
    try {
      const result = await saveLibrary(ready.notes, select('[data-deck-duplicates]').value === 'update')
      let refreshError = false
      try { library = await listLibrary() } catch { refreshError = true }
      libraryUI()
      status.textContent = `Saved locally: ${result.added} new, ${result.updated} updated. ${result.skipped} existing and ${result.withinFile} repeated identities skipped. ${refreshError ? 'The list could not refresh; reopen My decks to read the saved notes.' : 'Open one note to explore.'}`
      status.tabIndex = -1; status.focus(); dialog.scrollTop = 0
    } catch (error) { status.textContent = (error as Error).message }
    finally { saving = false; work.disabled = false; q<HTMLButtonElement>('[data-deck-close]').disabled = false }
  })
  function detail(note: LibraryNote) {
    cancel(); show('[data-deck-start]', false); show('[data-deck-browse]', false); show('[data-deck-detail]', true)
    const host = q('[data-deck-detail]'); unmountExplorers(host); host.replaceChildren()
    const back = element('button', 'Back to library'); back.addEventListener('click', libraryUI)
    const heading = element('h3', note.word); heading.tabIndex = -1
    host.append(back, heading, element('p', `${languages[note.language] || note.language} · ${note.decks.join(' · ')}`))
    if (note.example) host.append(element('blockquote', note.example))
    if (note.answer) { const details = element('details'); details.append(element('summary', 'Your answer'), element('pre', note.answer)); host.append(details) }
    const fields = element('details'); fields.append(element('summary', 'All fields & origin'), element('pre', `${note.fieldNames.map((name, i) => `${name}\n${note.fields[i]}`).join('\n\n')}\n\nSource file: ${note.filename}\nNote type: ${note.typeName}\nGUID: ${note.guid || '(none)'}\nTags: ${note.tags.join(' ')}\nSaved: ${note.importedAt}`)); host.append(fields)
    const text = note.example || note.word
    const open = element('button', 'Open example in notebook'); open.disabled = note.language !== 'en' || text.length > 6000
    open.addEventListener('click', () => { returnFocus = null; dialog.close(); openNotebook({ text, word: note.word, language: 'en', source: { filename: note.filename, guid: note.guid, decks: note.decks, tags: note.tags } }) })
    const scope = element('p', note.language === 'en' ? text.length > 6000 ? 'This example exceeds the notebook’s 6,000-character limit. Choose a shorter example field when importing; the full text is preserved here.' : 'Opening is local. In the notebook, explicitly choose a word lookup or sentence analysis to send that selection.' : 'Notebook grammar and initial meanings are English-only. This note keeps its selected language; use Explore this word for supported word histories.')
    scope.className = 'lp-label'; host.append(open, scope)
    if (openResearch) {
      const lookupLabel = element('label', 'Word to explore'); const lookupWord = element('input'); lookupWord.value = note.word; lookupWord.maxLength = 80; lookupLabel.append(lookupWord); host.insertBefore(lookupLabel, open);
      const explore = element('button', 'Explore this word →'); explore.className = 'lp-main';
      const updateWord = () => { explore.disabled = !historyTarget(note.language, lookupWord.value.trim()) }; updateWord(); lookupWord.addEventListener('input', updateWord);
      explore.addEventListener('click', () => { returnFocus = null; dialog.close(); openResearch({ word: lookupWord.value.trim(), language: note.language, context: (note.example || note.word).slice(0, 6000), ...(lookupWord.value.trim() === note.word.trim() && { importedCard: { answer: note.answer.slice(0, 10000), deck: (note.decks[0] || 'Uberlang').slice(0, 120), tags: note.tags.join(' ').slice(0, 500) } }) }) });
      host.insertBefore(explore, open);
      const hint = element('p', 'For a phrase or annotated card, edit the word above first. Open it in research, then choose Explore. No lookup is sent when opening. Save its tree there to return later.'); hint.className = 'lp-label'; host.insertBefore(hint, open);
    }
    if (!openResearch) {
    const history = element('details'); history.append(element('summary', 'Explore word history'))
    const label = element('label', 'Word to look up'); const word = element('input'); word.value = note.word; word.maxLength = 80; label.append(word)
    const request = element('button', 'Look up word history'), stop = element('button', 'Cancel lookup'); stop.hidden = true
    const info = element('p', `Only this word and language (${note.language}) are sent through Uberlang to English Wiktionary when you choose Look up. Other fields stay here. A dictionary entry may offer several histories.`); info.className = 'lp-label'
    const message = element('p'); message.setAttribute('role', 'status'); message.className = 'lp-live-status'
    const choices = element('div'), tree = element('div'); tree.className = 'lp-import-history'
    const supported = Object.hasOwn(historyLanguages, note.language)
    request.disabled = !supported; if (!supported) message.textContent = 'Word history is not supported for this language yet. The imported note is retained locally.'
    history.append(label, info, request, stop, message, choices, tree); host.append(history)
    const reset = () => { controller?.abort(); controller = null; revision++; stop.hidden = true; request.disabled = !supported; unmountExplorers(tree); tree.replaceChildren(); choices.replaceChildren() }
    word.addEventListener('input', () => { reset(); message.textContent = supported ? 'Word changed. Choose Look up to request a new history.' : 'This language is not supported yet.' })
    stop.addEventListener('click', () => { reset(); message.textContent = 'Lookup cancelled.' })
    request.addEventListener('click', async () => {
      reset(); const target = historyTarget(note.language, word.value.trim())
      if (!target) { message.textContent = 'Choose a supported single word or dictionary expression (up to 80 characters).'; return }
      controller = new AbortController(); const active = controller, signal = active.signal, generation = revision
      request.disabled = true; stop.hidden = false; message.textContent = 'Looking up this word…'
      const timer = setTimeout(() => active.abort(), 15000)
      try {
        const response = await fetch('/api/etymology', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(target), signal, credentials: 'same-origin' })
        if (!response.ok) throw new Error('Word history is unavailable right now. Your imported note is still saved here.')
        const result = parseHistory(await response.json(), target)
        if (generation !== revision || !dialog.open) return
        message.textContent = result.choices.length ? 'Choose the dictionary history to explore; no sense has been selected for you.' : result.reason || 'No sourced history is available.'
        for (const choice of result.choices) {
          const button = element('button', `${choice.label}: ${choice.summary || choice.reason}`); button.className = 'lp-import-choice'
          button.addEventListener('click', () => { unmountExplorers(tree); tree.replaceChildren(); mountFamily(tree, { family: choice, word: target.term }); choices.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b === button))) })
          choices.append(button)
        }
      } catch (error) { if (generation === revision) message.textContent = signal.aborted ? 'Lookup timed out or was cancelled. Choose Look up to retry.' : (error as Error).message }
      finally { clearTimeout(timer); if (generation === revision) { request.disabled = false; stop.hidden = true } }
    })
    }
    const removal = element('details'); removal.append(element('summary', 'Remove from this browser'))
    const remove = element('button', 'Remove this imported note'); remove.addEventListener('click', async () => {
      remove.disabled = true
      try { await removeLibrary(note.key); library = library.filter(n => n.key !== note.key); libraryUI(); status.textContent = 'Note removed from this browser. Your Anki file is unchanged.' }
      catch (error) { status.textContent = (error as Error).message; remove.disabled = false }
    }); removal.append(remove); host.append(removal)
    heading.focus(); dialog.scrollTop = 0
  }
  q('[data-deck-close]').addEventListener('click', () => dialog.close())
  dialog.addEventListener('cancel', event => { if (saving) event.preventDefault() })
  dialog.addEventListener('close', () => { cancel(); unmountExplorers(dialog); batch = null; ready = null; selected.clear(); mappings.clear(); q('[data-deck-list]').replaceChildren(); q('[data-deck-detail]').replaceChildren(); returnFocus?.focus({ preventScroll: true }) })
  return { async open() {
    returnFocus = document.activeElement as HTMLElement | null
    libraryUI(); dialog.showModal(); q('[data-deck-close]').focus(); status.textContent = 'Opening local library…'
    const generation = revision
    try { const notes = await listLibrary(); if (generation !== revision || !dialog.open) return; library = notes; filters(); renderList(); status.textContent = `${notes.length} notes saved in this browser.` }
    catch (error) { if (generation === revision) status.textContent = (error as Error).message }
  } }
}
