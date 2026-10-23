import { useEffect, useId, useRef, useState } from 'react'
import { historyLanguages } from '../../../src/shared/etymology'

const historical = new Set(['enm','ang','la','fro','frm','xno','grc','goh','gmh','dum','non','got','orv','sa'])
const groups = ['Modern languages', 'Historical languages', 'Reconstructed languages']
const languages = Object.entries(historyLanguages).map(([code, name]) => ({code, name,
  group:code.endsWith('-pro') ? 2 : historical.has(code) ? 1 : 0
})).sort((a,b) => a.group - b.group || a.name.localeCompare(b.name))

/** Editable listbox combobox: focus stays in the input during arrow navigation. */
export function LanguagePicker({ value, onChange }: { value: string; onChange: (code: string) => void }) {
  const id = useId(), input = useRef<HTMLInputElement>(null), root = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false), [query, setQuery] = useState(''), [active, setActive] = useState(value)
  const matches = languages.filter(item => `${item.name} ${item.code}`.toLowerCase().includes(query.trim().toLowerCase()))
  const highlighted = matches.find(item => item.code === active) ?? matches[0]
  function show() { setQuery(''); setActive(value); setOpen(true) }
  function choose(code: string) { onChange(code); setOpen(false); setQuery(''); input.current?.focus() }
  useEffect(() => {
    if (open && highlighted) document.getElementById(`${id}-${highlighted.code}`)?.scrollIntoView({block:'nearest'})
  }, [open, highlighted?.code])
  useEffect(() => {
    if (!open) return
    const dismiss = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false) }
    document.addEventListener('pointerdown', dismiss)
    return () => document.removeEventListener('pointerdown', dismiss)
  }, [open])
  return <div className="lp-language-picker" ref={root}>
    <label htmlFor={id}>Language</label>
    <div className="lp-language-field">
      <input ref={input} id={id} role="combobox" autoComplete="off" spellCheck={false}
        aria-expanded={open} aria-autocomplete="list" aria-controls={`${id}-list`}
        aria-activedescendant={open && highlighted ? `${id}-${highlighted.code}` : undefined}
        value={open ? query : historyLanguages[value]} placeholder="Find a language…"
        onFocus={event => { if (!open) event.currentTarget.select() }}
        onClick={() => { if (!open) show() }}
        onBlur={() => setOpen(false)}
        onChange={event => { setOpen(true); setQuery(event.target.value); setActive('') }}
        onKeyDown={event => {
          if (event.nativeEvent.isComposing) return
          if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); setOpen(false); return }
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            if (!open) { show(); return }
            const index = matches.findIndex(item => item.code === highlighted?.code)
            setActive(matches[Math.max(0, Math.min(matches.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)))]?.code ?? '')
          }
          if (open && (event.key === 'Home' || event.key === 'End') && !query) {
            event.preventDefault(); setActive((event.key === 'Home' ? matches[0] : matches.at(-1))?.code ?? '')
          }
          if (event.key === 'Enter') {
            event.preventDefault()
            if (!open) show()
            else if (highlighted) choose(highlighted.code)
          }
          if (event.key === 'Tab') setOpen(false)
        }} />
      <svg className={open ? 'is-open' : ''} viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4" /></svg>
    </div>
    {open && <div className="lp-language-menu">
      <div id={`${id}-list`} role="listbox" aria-label="Languages" className="lp-language-options">
        {groups.map((name, group) => {
          const items = matches.filter(item => item.group === group)
          return items.length ? <div key={name} role="group" aria-label={name}>
            <div className="lp-language-group" aria-hidden="true">{name}</div>
            {items.map(item => <div key={item.code} id={`${id}-${item.code}`} role="option" aria-selected={item.code === value}
              className={`lp-language-option ${item.code === highlighted?.code ? 'is-active' : ''}`}
              onMouseDown={event => event.preventDefault()} onClick={() => choose(item.code)}>
              <span>{item.name}</span><span aria-hidden="true">{item.code === value ? '✓' : ''}</span>
            </div>)}
          </div> : null
        })}
      </div>
      {!matches.length && <p role="status">No matching language.</p>}
      <div className="lp-language-help">Type to filter · ↑ ↓ to browse · Enter to select</div>
    </div>}
  </div>
}
