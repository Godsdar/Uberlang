import { ankiFields, ankiIdentity, createAnkiDraft, serializeAnki } from './domain/anki'
import type { AnkiDraft, AnkiSourceNote } from './domain/anki'

/** Owns a short-lived draft; all source values enter the DOM through textContent/value. */
export function mountAnkiDialog(app: HTMLElement) {
  const dialog = document.createElement('dialog')
  dialog.className = 'lp-anki'
  dialog.setAttribute('aria-labelledby', `${app.id}-anki-title`)
  dialog.innerHTML = `<form novalidate>
    <div class="lp-anki-heading"><h2 id="${app.id}-anki-title">A word to revisit</h2><button type="button" data-anki-close aria-label="Close Anki draft">Close</button></div>
    <p class="lp-label">File export · Anki not connected</p>
    <div class="lp-anki-fields">
      <label>Word or expression<input name="word" maxlength="300" required></label>
      <label>Language<input name="language" maxlength="60" required></label>
      <label class="lp-anki-wide">Context<textarea name="context" rows="2" maxlength="6000" required></textarea></label>
      <label class="lp-anki-wide">Answer<textarea name="answer" rows="2" maxlength="10000" placeholder="Write the meaning or insight you want to remember" required></textarea></label>
    </div>
    <details><summary>Deck, tags & word history</summary><div class="lp-anki-fields">
      <label class="lp-anki-wide">Sense label · optional<input name="sense" maxlength="120" placeholder="Distinguish meanings in the same context"></label>
      <label>Deck suggestion<input name="deck" maxlength="120" required></label>
      <label>Tags · space separated<input name="tags" maxlength="500"></label>
      <label class="lp-anki-wide lp-anki-check"><input name="includeHistory" type="checkbox">Include available word history</label>
    </div><p class="lp-label">Use an existing deck at import. History retains its source labels.</p></details>
    <details><summary>Original context & sources</summary><pre data-anki-evidence></pre></details>
    <details><summary>Card preview</summary><div class="lp-anki-preview"><div><span class="lp-label">Front</span><p data-anki-front></p></div><div><span class="lp-label">Back</span><p data-anki-back></p></div></div></details>
    <details><summary>How to import into Anki</summary><ol><li>Download the text file, then open Anki Desktop 2.1.54+ → File → Import.</li><li>Choose an existing two-field note type. Map Front, Back and Tags. Keep HTML off and review the target deck.</li><li>Choose Ignore duplicates, then review and confirm the import. To study on a phone, sync using Anki's own clients.</li></ol><p class="lp-label">This page cannot check your collection or confirm import. AnkiWeb has no direct import here.</p></details>
    <div class="lp-anki-footer"><p class="lp-label" data-anki-status role="status" aria-live="polite"></p>
    <div class="lp-actions"><button class="lp-main" type="submit">Download for Anki</button><button type="button" data-anki-redownload hidden>Download again</button><button type="button" data-anki-close>Cancel</button></div>
    <p class="lp-label">Draft only · closing discards edits. No localhost connection is made.</p></div>
  </form>`
  app.append(dialog)
  const form = dialog.querySelector('form')!
  const node = (selector: string) => dialog.querySelector<HTMLElement>(selector)!
  const input = (name: string) => form.elements.namedItem(name) as HTMLInputElement
  const submit = form.querySelector<HTMLButtonElement>('[type="submit"]')!
  const again = dialog.querySelector<HTMLButtonElement>('[data-anki-redownload]')!
  const status = node('[data-anki-status]')
  const exported = new Set<string>()
  let draft: AnkiDraft | null = null
  let returnFocus: HTMLElement | null = null
  function read(): AnkiDraft {
    if (!draft) throw new Error('Open a new Anki draft first.')
    return { ...draft, ...Object.fromEntries(['word', 'language', 'context', 'answer', 'deck', 'tags'].map(name => [name, input(name).value])), sense: input('sense').value, includeHistory: input('includeHistory').checked }
  }
  function preview() {
    again.hidden = true
    try {
      const value = read(), fields = ankiFields(value)
      node('[data-anki-front]').textContent = fields.front
      node('[data-anki-back]').textContent = fields.back
      const duplicate = exported.has(ankiIdentity(value))
      submit.disabled = duplicate
      again.hidden = !duplicate
      status.textContent = duplicate ? 'This front was already exported in this session. Check Anki before downloading it again.' : 'Ready to download · review the answer and import settings.'
    } catch (error) {
      submit.disabled = true
      // Still show a useful front while the user supplies a missing answer.
      const value = read()
      node('[data-anki-front]').textContent = `${value.word} [${value.language}]\n${value.context}`
      node('[data-anki-back]').textContent = value.answer || 'Your answer will appear here.'
      status.textContent = (error as Error).message
    }
  }
  function download(repeat = false) {
    try {
      const value = read(), identity = ankiIdentity(value)
      if (exported.has(identity) && !repeat) { preview(); return }
      const file = serializeAnki(value)
      const url = URL.createObjectURL(new Blob([file], { type: 'text/plain;charset=utf-8' }))
      try {
        const link = document.createElement('a')
        link.href = url; link.download = 'uberlang-anki-card.txt'
        dialog.append(link); link.click(); link.remove()
      } finally { setTimeout(() => URL.revokeObjectURL(url), 1000) }
      exported.add(identity)
      preview()
      status.textContent = 'Download started · import in Anki to finish. This page cannot confirm import or check collection duplicates.'
    } catch (error) { status.textContent = `Download could not start. ${(error as Error).message}` }
  }
  form.addEventListener('input', preview)
  form.addEventListener('submit', event => { event.preventDefault(); download() })
  again.addEventListener('click', () => download(true))
  dialog.querySelectorAll('[data-anki-close]').forEach(button => button.addEventListener('click', () => dialog.close()))
  dialog.addEventListener('close', () => {
    draft = null; form.reset()
    node('[data-anki-evidence]').textContent = ''
    node('[data-anki-front]').textContent = ''; node('[data-anki-back]').textContent = ''
    returnFocus?.focus({ preventScroll: true })
  })
  return {
    open(note: AnkiSourceNote, document: string) {
      draft = createAnkiDraft(note, document)
      returnFocus = window.document.activeElement as HTMLElement | null
      form.reset()
      for (const name of ['word', 'language', 'context', 'answer', 'deck', 'tags'] as const) input(name).value = draft[name]
      input('includeHistory').checked = false
      input('includeHistory').disabled = !draft.history
      node('[data-anki-evidence]').textContent = draft.evidence
      dialog.querySelectorAll('details').forEach((details) => { details.open = false })
      preview(); dialog.showModal(); input('answer').focus({ preventScroll: true }); dialog.scrollTop = 0
    }
  }
}
