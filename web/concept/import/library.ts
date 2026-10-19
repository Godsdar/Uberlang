import { LIMIT, fail, type ImportBatch, type LibraryNote, type Mapping } from './model.ts'
const DB_NAME = 'lingua-anki-library-v1'
const STORE = 'notes'
export const libraryLanguage = (s: string) => /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/.test(s) && s.length <= 40
export function defaultMapping(fields: string[]): Mapping {
  const find = (pattern: RegExp, fallback: number) => { const i = fields.findIndex(f => pattern.test(f)); return i >= 0 ? i : fallback }
  return { word: find(/^(word|expression|front|term|vocabulary)$/i, 0), example: find(/^(context|example|sentence|text)$/i, -1), answer: find(/^(back|answer|meaning|definition|translation)$/i, fields.length > 1 ? 1 : -1), language: '' }
}
export async function mappedNotes(batch: ImportBatch, mappings: Map<string, Mapping>, selected: Set<string>): Promise<{ notes: LibraryNote[]; empty: number }> {
  const notes: LibraryNote[] = []; let empty = 0
  const types = new Map(batch.types.map(t => [t.id, t]))
  for (const note of batch.notes) {
    if (!selected.has(note.id)) continue
    const type = types.get(note.type)!, mapping = mappings.get(note.type)
    if (!mapping || !libraryLanguage(mapping.language)) fail(`Choose a language code for ${type.name} (for example en or es).`)
    for (const key of ['word', 'example', 'answer'] as const) if (!Number.isInteger(mapping[key]) || mapping[key] < (key === 'word' ? 0 : -1) || mapping[key] >= note.fields.length) fail('Choose valid field mappings.')
    const word = note.fields[mapping.word], example = note.fields[mapping.example] || '', answer = note.fields[mapping.answer] || ''
    if (!word.trim()) { empty++; continue }
    const identity = JSON.stringify(note.guid ? ['guid', mapping.language, note.guid] : ['text', mapping.language, type.name.normalize('NFC'), note.fields.map(f => f.normalize('NFC'))])
    const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(identity)))
    const key = Array.from(hash, b => b.toString(16).padStart(2, '0')).join('')
    notes.push({ ...note, key, typeName: type.name, fieldNames: [...type.fields], language: mapping.language, word, example, answer, filename: batch.filename, importedAt: new Date().toISOString() })
  }
  return { notes, empty }
}
export interface ImportPlan { added: number; updated: number; skipped: number; withinFile: number; writes: LibraryNote[] }
export function planImport(existing: LibraryNote[], incoming: LibraryNote[], update: boolean): ImportPlan {
  const keys = new Set(existing.map(n => n.key)), seen = new Set<string>()
  const plan: ImportPlan = { added: 0, updated: 0, skipped: 0, withinFile: 0, writes: [] }
  for (const note of incoming) {
    if (seen.has(note.key)) { plan.withinFile++; continue }
    seen.add(note.key)
    if (keys.has(note.key)) { if (!update) { plan.skipped++; continue }; plan.updated++ }
    else plan.added++
    plan.writes.push(note)
  }
  return plan
}
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'key' })
    request.onsuccess = () => { request.result.onversionchange = () => request.result.close(); resolve(request.result) }
    request.onerror = () => reject(new Error('Local deck storage is unavailable. Nothing was saved.'))
    request.onblocked = () => reject(new Error('Close other Uberlang tabs and try opening My decks again.'))
  })
}
export async function listLibrary(): Promise<LibraryNote[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly'), request = tx.objectStore(STORE).getAll()
    tx.oncomplete = () => { db.close(); resolve(request.result.sort((a: LibraryNote, b: LibraryNote) => b.importedAt.localeCompare(a.importedAt) || a.word.localeCompare(b.word))) }
    tx.onabort = () => { db.close(); reject(new Error('Local deck storage could not be read.')) }
  })
}
/** Recheck duplicates in one serializable readwrite transaction (including other tabs). */
export async function saveLibrary(incoming: LibraryNote[], update: boolean): Promise<ImportPlan> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite'), store = tx.objectStore(STORE), read = store.getAll()
    let plan: ImportPlan, message = 'Local storage is full or unavailable. The entire import was rolled back; nothing was saved.'
    read.onsuccess = () => {
      try {
        plan = planImport(read.result, incoming, update)
        const next = new Map<string, LibraryNote>(read.result.map((n: LibraryNote) => [n.key, n]))
        plan.writes.forEach(n => next.set(n.key, n))
        // Count serialized metadata as well as fields; no unbounded growth through repeated imports.
        if (next.size > LIMIT.notes || [...next.values()].reduce((size, n) => size + JSON.stringify(n).length, 0) > 16_000_000) {
          message = 'The local library limit is 10,000 notes / 16 million stored characters. Remove entries or import fewer notes.'; tx.abort(); return
        }
        for (const note of plan.writes) store.put(note)
      } catch { tx.abort() }
    }
    tx.oncomplete = () => { db.close(); resolve(plan!) }
    tx.onabort = () => { db.close(); reject(new Error(message)) }
  })
}
export async function removeLibrary(key: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite'); tx.objectStore(STORE).delete(key)
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onabort = () => { db.close(); reject(new Error('The local note could not be removed.')) }
  })
}
