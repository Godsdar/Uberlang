export type NotebookView = 'origins' | 'understand' | 'grammar'

/** Keep mounted explorers when only navigation changes. Context changes expire
 * hidden views, while the active view may retain its own selection-aware renderer. */
export class NotebookPanels<T> {
  private entries = new Map<NotebookView, { value: T; context: readonly unknown[] }>()

  private create: () => T
  private dispose: (value: T) => void

  constructor(create: () => T, dispose: (value: T) => void) {
    this.create = create
    this.dispose = dispose
  }

  visit(view: NotebookView, context: readonly unknown[]): { value: T; fresh: boolean } {
    const same = (before: readonly unknown[]) =>
      before.length === context.length && before.every((part, i) => Object.is(part, context[i]))
    for (const [name, entry] of this.entries) {
      if (name !== view && !same(entry.context)) {
        this.dispose(entry.value)
        this.entries.delete(name)
      }
    }
    const previous = this.entries.get(view)
    if (previous && same(previous.context)) return { value: previous.value, fresh: false }
    const value = previous?.value ?? this.create()
    this.entries.set(view, { value, context: [...context] })
    return { value, fresh: true }
  }
}
