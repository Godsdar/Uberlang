import type { NotebookView } from './domain/panels'

type Tool = NotebookView | 'notes'
interface LauncherOptions {
  directEntry: boolean
  context: () => { word: string; label: string }
  select: (tool: Tool) => void
}

/** Presentation-only navigation: never submits input or remounts notebook views. */
export function mountLauncher(app: HTMLElement, options: LauncherOptions) {
  const workspace = app.querySelector<HTMLElement>('.lp-shell')!
  const trigger = app.querySelector<HTMLButtonElement>('[data-open-tools]')!
  const launchpad = document.createElement('section')
  launchpad.className = 'lp-launchpad'
  launchpad.id = `${app.id}-tools`
  launchpad.setAttribute('aria-label', 'Choose a language tool')
  trigger.setAttribute('aria-controls', launchpad.id)
  trigger.setAttribute('aria-expanded', 'false')
  launchpad.innerHTML = `
    <nav class="lp-orbit" aria-label="Language tools">
      <div class="lp-orbit-guide" aria-hidden="true"></div>
      <button class="lp-tool lp-tool-origins" data-tool="origins" aria-label="Word histories" aria-describedby="${app.id}-tool-origins-hint"><span class="lp-tool-copy"><svg class="lp-tool-icon" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M16 25V17M16 20C16 14 7 17 7 11M16 20C16 14 25 17 25 11M16 17V8"/><circle cx="7" cy="7" r="3"/><circle cx="25" cy="7" r="3"/><circle cx="16" cy="5" r="2"/><circle cx="16" cy="27" r="2"/></svg></span></button>
      <span class="lp-tool-hint" id="${app.id}-tool-origins-hint" role="tooltip"><strong>Word histories</strong><span>Follow sourced forms across languages</span></span>
      <button class="lp-tool lp-tool-understand" data-tool="understand" aria-label="Understand" aria-describedby="${app.id}-tool-understand-hint"><span class="lp-tool-copy"><svg class="lp-tool-icon" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M16 9C12 6 8 6 4 7v18c4-1 8-1 12 2 4-3 8-3 12-2V7c-4-1-8-1-12 2Zm0 0v18M8 12c2 0 3 .3 4 1M8 17c2 0 3 .3 4 1M20 13c1-.7 2-1 4-1M20 18c1-.7 2-1 4-1"/></svg></span></button>
      <span class="lp-tool-hint" id="${app.id}-tool-understand-hint" role="tooltip"><strong>Understand</strong><span>English meanings and sentence reading</span></span>
      <div class="lp-orbit-center"><span data-launch-word></span><small data-launch-context></small></div>
      <button class="lp-tool lp-tool-grammar" data-tool="grammar" aria-label="Sentence structure" aria-describedby="${app.id}-tool-grammar-hint"><span class="lp-tool-copy"><svg class="lp-tool-icon" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M16 9v5M6 22v-4a4 4 0 0 1 4-4h12a4 4 0 0 1 4 4v4M16 14v8"/><rect x="12" y="3" width="8" height="6" rx="2"/><rect x="2" y="22" width="8" height="6" rx="2"/><rect x="12" y="22" width="8" height="6" rx="2"/><rect x="22" y="22" width="8" height="6" rx="2"/></svg></span></button>
      <span class="lp-tool-hint" id="${app.id}-tool-grammar-hint" role="tooltip"><strong>Sentence structure</strong><span>English grammar, one sentence at a time</span></span>
      <button class="lp-tool lp-tool-notes" data-tool="notes" aria-label="Study notes" aria-describedby="${app.id}-tool-notes-hint"><span class="lp-tool-copy"><svg class="lp-tool-icon" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M26 5v22H8a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3h18ZM10 5v22M15 12h6M15 17h6M15 22h3"/></svg></span></button>
      <span class="lp-tool-hint" id="${app.id}-tool-notes-hint" role="tooltip"><strong>Study notes</strong><span>Session notes: export to keep discoveries</span></span>
    </nav>
    <div class="lp-launch-actions"><button data-launch-write>Use your own text</button><button data-launch-return>Open notebook <span aria-hidden="true">↗</span></button></div>
    <details class="lp-tool-guide"><summary>Tool guide</summary><ul><li><button class="lp-guide-option" data-tool="origins"><svg class="lp-tool-icon" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M16 25V17M16 20C16 14 7 17 7 11M16 20C16 14 25 17 25 11M16 17V8"/><circle cx="7" cy="7" r="3"/><circle cx="25" cy="7" r="3"/><circle cx="16" cy="5" r="2"/><circle cx="16" cy="27" r="2"/></svg><span>Word histories<small>Sourced forms across languages</small></span></button></li><li><button class="lp-guide-option" data-tool="understand"><svg class="lp-tool-icon" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M16 9C12 6 8 6 4 7v18c4-1 8-1 12 2 4-3 8-3 12-2V7c-4-1-8-1-12 2Zm0 0v18M8 12c2 0 3 .3 4 1M8 17c2 0 3 .3 4 1M20 13c1-.7 2-1 4-1M20 18c1-.7 2-1 4-1"/></svg><span>Understand<small>English meanings and sentence reading</small></span></button></li><li><button class="lp-guide-option" data-tool="grammar"><svg class="lp-tool-icon" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M16 9v5M6 22v-4a4 4 0 0 1 4-4h12a4 4 0 0 1 4 4v4M16 14v8"/><rect x="12" y="3" width="8" height="6" rx="2"/><rect x="2" y="22" width="8" height="6" rx="2"/><rect x="12" y="22" width="8" height="6" rx="2"/><rect x="22" y="22" width="8" height="6" rx="2"/></svg><span>Sentence structure<small>English grammar, one sentence at a time</small></span></button></li><li><button class="lp-guide-option" data-tool="notes"><svg class="lp-tool-icon" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M26 5v22H8a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3h18ZM10 5v22M15 12h6M15 17h6M15 22h3"/></svg><span>Study notes<small>Session notes: export to keep discoveries</small></span></button></li></ul></details>
    <p class="lp-launch-scope">Etymology first · Context and grammar when you need them</p>`
  workspace.before(launchpad)
  launchpad.hidden = true
  let returnFocus: HTMLElement | null = null
  let returnScroll = 0
  let visited = options.directEntry
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches
  function close(focus = true) {
    launchpad.hidden = true
    workspace.hidden = false
    trigger.setAttribute('aria-expanded', 'false')
    if (!reduced()) workspace.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 240, easing: 'cubic-bezier(.22,1,.36,1)' })
    if (focus) {
      (returnFocus?.isConnected ? returnFocus : trigger).focus({ preventScroll: true })
      window.scrollTo({ top: returnScroll, behavior: 'instant' })
    }
    visited = true
  }
  function open(focus = true) {
    returnFocus = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : trigger
    returnScroll = window.scrollY
    const context = options.context()
    launchpad.querySelector('[data-launch-word]')!.textContent = context.word || 'Your next word'
    launchpad.querySelector('[data-launch-context]')!.textContent = context.label
    launchpad.querySelector('[data-launch-return]')!.textContent = visited ? 'Return to notebook ↗' : 'Open notebook ↗'
    workspace.hidden = true
    launchpad.hidden = false
    trigger.setAttribute('aria-expanded', 'true')
    if (focus) {
      launchpad.querySelector<HTMLButtonElement>('[data-tool]')!.focus({ preventScroll: true })
      launchpad.scrollIntoView({ block: 'start', behavior: 'instant' })
    }
  }
  trigger.addEventListener('click', () => launchpad.hidden ? open() : close())
  launchpad.addEventListener('click', event => {
    const button = (event.target as Element).closest<HTMLButtonElement>('button')
    if (!button) return
    if (button.dataset.tool) { close(false); options.select(button.dataset.tool as Tool) }
    else if (button.hasAttribute('data-launch-write')) {
      close(false)
      const context = app.querySelector<HTMLDetailsElement>('.lp-context'); if (context) context.open = true
      app.querySelector<HTMLDetailsElement>('.lp-composer')!.open = true
      app.querySelector<HTMLTextAreaElement>('[data-ui="input"]')!.focus()
    } else if (button.hasAttribute('data-launch-return')) close()
  })
  app.addEventListener('keydown', event => { if (event.key === 'Escape' && !launchpad.hidden) { event.preventDefault(); close() } })
  document.querySelector('.lp-skip-link')?.addEventListener('click', () => { if (!launchpad.hidden) close(false) })
  if (!options.directEntry) open(false)
  return { showNotebook: () => close(false) }
}
