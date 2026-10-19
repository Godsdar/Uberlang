import type { Database, SqlJsStatic, SqlValue } from 'sql.js'
import { expandZstd, packageVersion, readArchive } from './archive.ts'
import { LIMIT, cleanLabel, fail, tagsFrom, unique, type ImportBatch, type ImportNote, type NoteType } from './model.ts'
import { plainField } from './text.ts'
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const jsonObject = (text: SqlValue | undefined) => { let value: unknown; try { value = JSON.parse(String(text)) } catch { fail('Invalid Anki metadata JSON.') } if (!object(value)) return fail('Missing Anki metadata.'); return value }
const str = (value: SqlValue | undefined): string => { if (typeof value !== 'string') return fail('Invalid text in the Anki database.'); return value }
function rows(db: Database, sql: string, limit: number): SqlValue[][] {
  const result: SqlValue[][] = [], statement = db.prepare(sql)
  try { while (statement.step()) { if (result.length >= limit) fail('This deck exceeds the supported record count. Export a smaller deck.'); result.push(statement.get()) } }
  finally { statement.free() }
  return result
}
function table(db: Database, name: string, columns: string[]) {
  const schema = db.exec('SELECT type, sql FROM sqlite_master WHERE name = ?', [name])[0]?.values
  if (schema?.length !== 1 || schema[0][0] !== 'table' || /\bVIRTUAL\b/i.test(String(schema[0][1]))) fail(`Unsupported Anki table: ${name}.`)
  const info = rows(db, `PRAGMA table_xinfo("${name}")`, 64)
  if (info.some(row => Number(row[6]) !== 0) || columns.some(col => !info.some(row => row[1] === col))) fail(`Unsupported columns in Anki ${name}.`)
}
export function parseDatabase(bytes: Uint8Array, version: number, SQL: SqlJsStatic, filename: string): ImportBatch {
  if (bytes.length > LIMIT.file || new TextDecoder().decode(bytes.subarray(0, 16)) !== 'SQLite format 3\0') fail('The deck does not contain a supported SQLite collection.')
  const db = new SQL.Database(bytes)
  try {
    db.run('PRAGMA trusted_schema=OFF; PRAGMA query_only=ON; PRAGMA hard_heap_limit=67108864;')
    table(db, 'col', ['ver']); table(db, 'notes', ['id', 'guid', 'mid', 'tags', 'flds']); table(db, 'cards', ['nid', 'did', 'odid'])
    const collection = rows(db, 'SELECT ver FROM col NOT INDEXED', 1)
    if (collection.length !== 1 || Number(collection[0][0]) !== (version === 3 ? 18 : 11)) fail('Unsupported Anki database schema. Export with “Support older Anki versions”, or use Notes in Plain Text.')
    const types = new Map<string, NoteType>(), decks = new Map<string, string>()
    if (version === 3) {
      table(db, 'notetypes', ['id', 'name']); table(db, 'fields', ['ntid', 'ord', 'name']); table(db, 'decks', ['id', 'name'])
      for (const [id, name] of rows(db, 'SELECT CAST(id AS TEXT), name FROM notetypes NOT INDEXED', 128)) types.set(str(id), { id: str(id), name: cleanLabel(name), fields: [] })
      for (const [id, ord, name] of rows(db, 'SELECT CAST(ntid AS TEXT), ord, name FROM fields NOT INDEXED ORDER BY ntid, ord', 128 * LIMIT.fields)) {
        const type = types.get(str(id)); if (!type || type.fields.length !== ord || type.fields.length >= LIMIT.fields) fail('Invalid Anki field ordering.')
        type.fields.push(cleanLabel(name))
      }
      for (const [id, name] of rows(db, 'SELECT CAST(id AS TEXT), name FROM decks NOT INDEXED', LIMIT.entries)) decks.set(str(id), cleanLabel(str(name).replace(/\x1f/g, '::')))
    } else {
      table(db, 'col', ['models', 'decks'])
      const [modelsRaw, decksRaw] = rows(db, 'SELECT models, decks FROM col NOT INDEXED', 1)[0]
      const models = Object.entries(jsonObject(modelsRaw)), deckEntries = Object.entries(jsonObject(decksRaw))
      if (models.length > 128 || deckEntries.length > LIMIT.entries) fail('This deck has too many note types or decks.')
      for (const [id, model] of models) {
        if (!object(model) || !Array.isArray(model.flds) || !model.flds.length || model.flds.length > LIMIT.fields) fail('Invalid Anki note type.')
        const fields = [...model.flds].sort((a, b) => Number(a?.ord) - Number(b?.ord)).map((f: unknown, i) => {
          if (!object(f) || f.ord !== i) return fail('Invalid Anki field ordering.')
          return cleanLabel(f.name)
        })
        types.set(id, { id, name: cleanLabel(model.name), fields })
      }
      for (const [id, deck] of deckEntries) { if (!object(deck)) fail('Invalid Anki deck metadata.'); decks.set(id, cleanLabel(deck.name)) }
    }
    const memberships = new Map<string, string[]>()
    for (const [nid, did] of rows(db, 'SELECT CAST(nid AS TEXT), CAST(CASE WHEN odid != 0 THEN odid ELSE did END AS TEXT) FROM cards NOT INDEXED', LIMIT.cards)) {
      const name = decks.get(str(did)); if (!name) fail('A card refers to an unknown deck. Export the deck again.')
      const key = str(nid), list = memberships.get(key) || []; if (!list.includes(name)) list.push(name); memberships.set(key, list)
    }
    let total = 0, unassigned = 0
    const ids = new Set<string>()
    const notes: ImportNote[] = rows(db, 'SELECT CAST(id AS TEXT), guid, CAST(mid AS TEXT), tags, flds FROM notes NOT INDEXED', LIMIT.notes).map(([id, guid, mid, tags, flds]) => {
      const type = types.get(str(mid)), raw = str(flds).split('\x1f')
      if (!type || !type.fields.length || raw.length !== type.fields.length) fail('A note does not match its note type. Nothing was dropped; export it again.')
      const fields = raw.map(field => plainField(field, true)); total += fields.reduce((n, f) => n + f.length, 0)
      if (total > LIMIT.text) fail('Text exceeds the local 8-million-character limit. Export a smaller deck.')
      const deck = memberships.get(str(id)); if (!deck) unassigned++
      ids.add(str(id))
      return { id: str(id), guid: cleanLabel(guid), type: str(mid), fields, decks: deck || ['Unassigned'], tags: tagsFrom(str(tags)) }
    })
    if (!notes.length) fail('This package contains no notes.')
    if ([...memberships.keys()].some(id => !ids.has(id))) fail('A card refers to a missing note. Export the deck again.')
    const used = new Set(notes.map(n => n.type))
    const warnings = ['Text only: media, templates, styling, review schedules and card-specific faces are not imported. Cloze markers become answer text.', 'Multiple cards of one Anki note become one library record, retaining every original deck membership.']
    if (unassigned) warnings.push(`${unassigned} notes have no cards and are retained in Unassigned.`)
    return { format: version === 3 ? 'Modern Anki · Zstandard / schema 18' : 'Legacy Anki · schema 11', filename, types: [...types.values()].filter(t => used.has(t.id)), notes, warnings }
  } finally { db.close() }
}
export function parseApkg(bytes: Uint8Array, SQL: SqlJsStatic, filename: string): ImportBatch {
  const archive = readArchive(bytes)
  const version = archive.names.includes('meta') ? packageVersion(archive.extract('meta', 1024)) : archive.names.includes('collection.anki21b') ? fail('Modern deck metadata is missing. Export again; the compatibility placeholder was not imported.') : archive.names.includes('collection.anki21') ? 2 : 1
  const name = ['', 'collection.anki2', 'collection.anki21', 'collection.anki21b'][version]
  const data = archive.extract(name)
  const result = parseDatabase(version === 3 ? expandZstd(data) : data, version, SQL, filename)
  const media = archive.names.filter(n => /^\d+$/.test(n)).length
  if (media) result.warnings.push(`${media} media files were left unopened. Image/audio-only fields may be empty; review mapping and skipped counts.`)
  const unexpected = archive.names.filter(n => !/^\d+$/.test(n) && !['meta', 'media', 'collection.anki2', 'collection.anki21', 'collection.anki21b'].includes(n))
  if (unexpected.length) result.warnings.push(`${unexpected.length} unrecognized archive files were left unopened.`)
  result.warnings = unique(result.warnings)
  return result
}
