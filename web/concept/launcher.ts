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
    <div class="lp-launch-heading"><h2>Tools</h2><button data-launch-return>Back to research</button></div>
    <nav class="lp-tool-list" aria-label="Language tools">
      <button data-tool="origins"><strong>Word histories</strong><span>Sourced forms and their connections</span></button>
      <button data-tool="understand"><strong>Sentence reading</strong><span>English meanings in context</span></button>
      <button data-tool="grammar"><strong>Sentence structure</strong><span>English grammar and relationships</span></button>
      <button data-tool="notes"><strong>Study notes</strong><span>Session notes and exports</span></button>
      <button data-open-decks><strong>My decks</strong><span>Imported Anki cards</span></button>
    </nav>`
  workspace.before(launchpad)
  launchpad.hidden = true
  let returnFocus: HTMLElement | null = null
  let returnScroll = 0
  function close(focus = true) {
    launchpad.hidden = true
    workspace.hidden = false
    trigger.setAttribute('aria-expanded', 'false')
    if (focus) {
      (returnFocus?.isConnected ? returnFocus : trigger).focus({ preventScroll: true })
      window.scrollTo({ top: returnScroll, behavior: 'instant' })
    }
  }
  function open(focus = true) {
    returnFocus = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : trigger
    returnScroll = window.scrollY
    workspace.hidden = true
    launchpad.hidden = false
    trigger.setAttribute('aria-expanded', 'true')
    if (focus) {
      launchpad.querySelector<HTMLButtonElement>('[data-tool]')!.focus({ preventScroll: true })
      launchpad.scrollIntoView({ block: 'start', behavior: 'instant' })
    }
  }
  trigger.addEventListener('click', () => launchpad.hidden ? open() : close())
  app.querySelector('.lp-entry-modes')?.addEventListener('click', () => { if (!launchpad.hidden) close(false) })
  launchpad.addEventListener('click', event => {
    const button = (event.target as Element).closest<HTMLButtonElement>('button')
    if (!button) return
    if (button.dataset.tool) { close(false); options.select(button.dataset.tool as Tool) }
    else if (button.hasAttribute('data-launch-return')) close()
  })
  app.addEventListener('keydown', event => { if (event.key === 'Escape' && !launchpad.hidden) { event.preventDefault(); close() } })
  document.querySelector('.lp-skip-link')?.addEventListener('click', () => { if (!launchpad.hidden) close(false) })
  if (!options.directEntry) open(false)
  return { showNotebook: () => close(false) }
}
