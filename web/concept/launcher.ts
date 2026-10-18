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
    <p class="lp-launch-eyebrow">Words · histories · connections</p>
    <h1>Where will a word take you?</h1>
    <p class="lp-launch-intro">A small toolkit for curious language learners.</p>
    <nav class="lp-orbit" aria-label="Language tools">
      <div class="lp-orbit-guide" aria-hidden="true"></div>
      <button class="lp-tool lp-tool-origins" data-tool="origins"><span class="lp-tool-symbol" aria-hidden="true">⌘</span><span>Word histories<small>Follow sourced forms across languages</small></span></button>
      <button class="lp-tool lp-tool-understand" data-tool="understand"><span class="lp-tool-symbol" aria-hidden="true">Aa</span><span>Understand<small>English meanings & sentence reading</small></span></button>
      <div class="lp-orbit-center"><span data-launch-word></span><small data-launch-context></small></div>
      <button class="lp-tool lp-tool-grammar" data-tool="grammar"><span class="lp-tool-symbol" aria-hidden="true">↳</span><span>Sentence structure<small>English grammar, one sentence at a time</small></span></button>
      <button class="lp-tool lp-tool-notes" data-tool="notes"><span class="lp-tool-symbol" aria-hidden="true">＋</span><span>Study notes<small>Save a discovery · export to keep it</small></span></button>
    </nav>
    <div class="lp-launch-actions"><button data-launch-write>Use your own text</button><button data-launch-return>Open notebook <span aria-hidden="true">↗</span></button></div>
    <p class="lp-launch-scope">Start with English. Follow supported word histories across languages.</p>`
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
      app.querySelector<HTMLDetailsElement>('.lp-composer')!.open = true
      app.querySelector<HTMLTextAreaElement>('[data-ui="input"]')!.focus()
    } else if (button.hasAttribute('data-launch-return')) close()
  })
  app.addEventListener('keydown', event => { if (event.key === 'Escape' && !launchpad.hidden) { event.preventDefault(); close() } })
  document.querySelector('.lp-skip-link')?.addEventListener('click', () => { if (!launchpad.hidden) close(false) })
  if (!options.directEntry) open(false)
}
