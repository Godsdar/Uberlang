/** Stable action/data hooks keep analysis, selection and export contracts intact. */
export function sentenceWorkspace(appId: string) {
  const id = appId.replace(/[^a-zA-Z0-9_-]/g, '')
  return `<div class="lp-main-area lp-sentence-workspace">
    <section class="lp-sentence-input">
      <details class="lp-composer" open>
        <summary>Edit text <span aria-hidden="true">↗</span></summary>
        <div class="lp-composer-body">
          <label class="lp-editor-label" for="${id}-input">Your text</label>
          <textarea class="lp-editor" id="${id}-input" data-ui="input" spellcheck="false" placeholder="Paste a sentence or a passage…" maxlength="6000" aria-label="Your text" rows="4"></textarea>
          <div class="lp-compose-bottom"><span class="lp-label" data-ui="count"></span><div class="lp-actions"><button data-action="cancel" hidden>Cancel</button><button class="lp-main" data-action="live">Analyze <span aria-hidden="true">→</span></button></div></div>
        </div>
      </details>
      <div class="lp-input-foot"><details class="lp-example-set"><summary>Try an example</summary><div class="lp-examples"><button data-example="mother-water">A simple sentence</button><button data-example="present-perfect-progressive">A verb phrase</button><button data-example="relative-clause">A relative clause</button><button data-example="long">A longer passage</button></div></details><details class="lp-privacy"><summary>English grammar · About</summary><p>Language is identified automatically on this device. Analyze sends only the sentence at your cursor or selection to Uberlang. The rest of your passage stays here.</p><p>Grammar supports English: up to 50 words per sentence. You can enter a passage of up to 6,000 characters and explore it sentence by sentence. Short or ambiguous text may need more context.</p><p>Examples have prepared answers. New analysis uses a language model and may be wrong. It describes structure, not a definitive interpretation. No live translation is provided.</p><button data-action="analyze">Read without analysis</button></details></div>
      <div class="lp-live-status" data-ui="live-status" role="status" aria-live="polite"></div>
    </section>
    <section class="lp-sentence-result" data-ui="result" aria-label="Text exploration" tabindex="-1" hidden>
      <div class="lp-reading-top"><span data-ui="status" class="lp-status" role="status"></span><span class="lp-reading-hint">Tap a word to explore</span></div>
      <div data-ui="sentences" class="lp-sentence-picker" aria-label="Sentences in your text"></div>
      <div class="lp-source" data-ui="source" aria-label="Select a word in the source text"></div>
      <div data-ui="phrases" class="lp-phrase-row"></div>
      <button class="lp-main lp-analyze-current" data-action="live-current" hidden>Analyze this sentence →</button>
      <nav class="lp-tabs" aria-label="Analysis view"><button data-view="understand" aria-pressed="true">Reading</button><button data-view="grammar" aria-pressed="false">Structure</button></nav>
      <div data-ui="content"></div>
      <div class="lp-lexical-actions"><div class="lp-actions"><button data-action="research-word">Word history →</button><button data-action="research-phrase" hidden>Expression history →</button><button data-action="lexicon">Dictionary</button><button data-action="cancel-lexicon" hidden>Cancel</button></div><div class="lp-live-status" data-ui="lexical-status" role="status" aria-live="polite"></div></div>
      <div class="lp-result-tools"><details class="lp-selection-tools"><summary>Explore a phrase</summary><p>Select words in the editor, then open the selection.</p><button data-action="selection">Open selection</button><button data-action="edit">Edit / select text</button></details><details class="lp-save-tools"><summary>Save or export</summary><div class="lp-actions"><button data-action="save">Save note</button><button data-action="anki">Anki…</button><button data-action="export">Export notes <span data-ui="note-count">0</span></button></div></details><details class="lp-model-notes" data-ui="model-notes" hidden><summary>Analysis details</summary><div data-ui="model-evidence"></div></details></div>
    </section>
  </div>`
}
