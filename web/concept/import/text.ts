import { Parser } from 'htmlparser2'
import { LIMIT, cleanLabel, fail, tagsFrom, unique, utf8, type ImportBatch, type ImportNote } from './model.ts'

/** No DOMParser, document, URL, or rendering: this tokenizer cannot load resources. */
export function plainField(value: string, html: boolean): string {
  if (value.length > LIMIT.field) return fail('A field exceeds 32,000 characters. Export a smaller text selection.')
  let result = value
  if (html) {
    const excluded = new Set(['script', 'style', 'iframe', 'object', 'embed', 'svg', 'math', 'template', 'audio', 'video'])
    let hidden = 0
    const stack: boolean[] = [], parts: string[] = []
    const parser = new Parser({
      onopentag(name) { const blocked = excluded.has(name); stack.push(blocked); if (blocked) hidden++; if (!hidden && /^(br|div|p|li|tr|hr)$/.test(name)) parts.push('\n') },
      ontext(text) { if (!hidden) parts.push(text) },
      onclosetag(name) { if (stack.pop()) hidden--; if (!hidden && /^(div|p|li|tr)$/.test(name)) parts.push('\n') }
    }, { decodeEntities: true })
    parser.end(value); result = parts.join('')
  }
  return result.replace(/\[sound:[^\]\r\n]*\]/gi, '').replace(/\{\{c\d+::([^{}]*?)(?:::[^{}]*?)?\}\}/g, '$1')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').replace(/\r\n?/g, '\n').trim()
}

export function parseRows(text: string, separator: string): string[][] {
  const rows: string[][] = []; let row: string[] = [], field = '', quoted = false, closed = false, start = true
  const addField = () => { if (field.length > LIMIT.field) fail('A text field exceeds 32,000 characters.'); row.push(field); field = ''; start = true; closed = false; if (row.length > LIMIT.fields) fail('More than 64 columns are not supported.') }
  const addRow = () => { addField(); if (row.some(v => v.length)) rows.push(row); row = []; if (rows.length > LIMIT.notes) fail('This file has more than 10,000 notes. Export a smaller deck.') }
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (quoted) { if (char === '"') { if (text[i+1] === '"') { field += '"'; i++ } else { quoted = false; closed = true } } else field += char; continue }
    if (char === separator) addField()
    else if (char === '\n' || char === '\r') { if (char === '\r' && text[i+1] === '\n') i++; addRow() }
    else if (char === '"' && start) { quoted = true; start = false }
    else { if (closed) fail('Unexpected text after a quoted field. Check the file separator.'); field += char; start = false }
  }
  if (quoted) fail('A quoted field is unfinished. Nothing was imported.')
  if (field || row.length || closed) addRow()
  return rows
}
export function parseText(bytes: Uint8Array, filename: string): ImportBatch {
  if (bytes.length > LIMIT.file) fail('The file exceeds 32 MiB. Export a smaller deck without media.')
  let text = utf8(bytes).replace(/^\uFEFF/, '')
  const headers = new Map<string, string>(), warnings: string[] = []
  while (text.startsWith('#')) {
    const end = text.indexOf('\n'), line = (end < 0 ? text : text.slice(0, end)).replace(/\r$/, '')
    text = end < 0 ? '' : text.slice(end + 1)
    const match = /^#([^:]+):(.*)$/.exec(line)
    if (match) { const key = match[1].toLowerCase(); if (headers.has(key)) fail(`Repeated text header: ${key}.`); headers.set(key, match[2]) }
  }
  const separators: Record<string, string> = { tab: '\t', comma: ',', semicolon: ';', space: ' ', pipe: '|', colon: ':' }
  const declared = headers.get('separator')
  const separator = declared ? separators[declared.toLowerCase()] || (Object.values(separators).includes(declared) ? declared : '') : '\t'
  if (!separator) fail('Unsupported text separator. Export Notes in Plain Text with tabs.')
  if (headers.has('html') && !['true', 'false'].includes(headers.get('html')!)) fail('The #html header must be true or false.')
  const html = headers.get('html') === 'true'
  const rows = parseRows(text, separator)
  if (!rows.length) fail('No notes were found in this text file.')
  const width = rows[0].length
  if (rows.some(row => row.length !== width)) fail('Rows have different numbers of fields. Check the separator or export again; no fields were dropped.')
  const known = ['separator', 'html', 'columns', 'deck', 'tags', 'notetype', 'deck column', 'tags column', 'notetype column', 'guid column']
  const unknown = [...headers.keys()].filter(key => !known.includes(key))
  if (unknown.length) warnings.push(`Unrecognized headers (not applied): ${unknown.join(', ')}.`)
  const special = new Map<string, number>()
  for (const name of ['deck', 'tags', 'notetype', 'guid']) {
    const raw = headers.get(`${name} column`)
    if (raw !== undefined) { const col = Number(raw) - 1; if (!/^\d+$/.test(raw) || col < 0 || col >= width || [...special.values()].includes(col)) fail('Invalid or overlapping special column headers.'); special.set(name, col) }
  }
  const regular = Array.from({ length: width }, (_, i) => i).filter(i => ![...special.values()].includes(i))
  if (!regular.length) fail('No note fields remain after the special columns.')
  const labels = headers.has('columns') ? parseRows(headers.get('columns')!, separator)[0] : undefined
  if (labels && labels.length !== width) fail('Column names do not match the number of text fields.')
  const types = new Map<string, { id: string; name: string; fields: string[] }>()
  let total = 0
  const notes: ImportNote[] = rows.map((row, i) => {
    const meta = (name: string) => cleanLabel(special.has(name) ? row[special.get(name)!] : headers.get(name) || '')
    const type = meta('notetype') || 'Text notes'
    if (!types.has(type)) types.set(type, { id: type, name: type, fields: regular.map((col, n) => cleanLabel(labels?.[col] || `Field ${n + 1}`)) })
    const fields = regular.map(col => plainField(row[col], html)); total += fields.reduce((n, f) => n + f.length, 0)
    if (total > LIMIT.text) fail('Text exceeds the local 8-million-character limit. Export a smaller deck.')
    return { id: String(i), guid: meta('guid'), type, fields, decks: [meta('deck') || filename.replace(/\.[^.]+$/, '')], tags: unique([...tagsFrom(headers.get('tags') || ''), ...tagsFrom(meta('tags'))]) }
  })
  if (!declared) warnings.push('Tab separator assumed. Use Anki #separator headers for other delimiters. The first row is data, unless #columns defines labels.')
  if (special.has('notetype')) warnings.push('Text exports do not carry per-type field names. Review mapping for every note type.')
  warnings.push('Text only: media, card templates, formatting and review schedules are not imported. Cloze markers become answer text.')
  return { format: 'UTF-8 text', filename, types: [...types.values()], notes, warnings }
}
