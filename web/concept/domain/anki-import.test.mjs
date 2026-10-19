import test from 'node:test'
import assert from 'node:assert/strict'
import initSqlJs from 'sql.js'
import { zipSync, strToU8 } from 'fflate'
import { zstdCompressSync } from 'node:zlib'
import { apkg, database, textFixture } from '../../../scripts/anki-import-fixtures.mjs'
import { parseApkg, parseDatabase } from '../import/apkg.ts'
import { parseText, plainField } from '../import/text.ts'
import { readArchive, expandZstd } from '../import/archive.ts'
import { mappedNotes, defaultMapping, planImport } from '../import/library.ts'
const SQL = await initSqlJs()
const mapping = batch => new Map(batch.types.map(t => [t.id, { ...defaultMapping(t.fields), language: 'en' }]))
for (const modern of [false, true]) test(`${modern ? 'modern Zstd' : 'legacy'} APKG retains notes, normalized fields, nested/original decks and tags`, () => {
  const batch = parseApkg(apkg(SQL, modern), SQL, 'synthetic.apkg')
  assert.equal(batch.notes.length, 3); assert.equal(batch.types.length, 2)
  assert.deepEqual(batch.notes[0].decks, ['English::Nature', 'English::Verbs'])
  assert.deepEqual(batch.notes[0].fields, ['water', 'The water is clear.\nWater matters.', 'вода & life'])
  assert.deepEqual(batch.notes[0].tags, ['nature', 'nature::water'])
  assert.equal(batch.notes[1].fields[0], 'The water is clear.')
  assert.match(batch.warnings.join(' '), /media files were left unopened/)
})
test('TXT headers, quoted multiline fields, UTF-8 and explicit HTML flag', () => {
  const batch = parseText(strToU8(textFixture), 'notes.txt')
  assert.deepEqual(batch.types[0].fields, ['Word', 'Example', 'Answer'])
  assert.equal(batch.notes[0].guid, 'text-id'); assert.equal(batch.notes[0].fields[1], 'Water is clear.\nIt is cold.')
  assert.equal(batch.notes[0].fields[2], 'вода'); assert.deepEqual(batch.notes[0].decks, ['English::Nature'])
  assert.equal(parseText(strToU8('#html:false\n<x>\tA &amp; B'), 'plain.tsv').notes[0].fields[0], '<x>')
  assert.equal(parseText(strToU8('#separator:Comma\n"a,""b""",c'), 'notes.txt').notes[0].fields[0], 'a,"b"')
})
test('malformed text never truncates or guesses columns', () => {
  for (const input of ['a\tb\nc', '"a\tb', '#separator:Invalid\na\tb', '#columns:One\na\tb', '#guid column:9\na\tb', '#guid column:1\n#tags column:1\na\tb']) assert.throws(() => parseText(strToU8(input), 'bad.txt'))
  assert.throws(() => parseText(new Uint8Array([0xff]), 'bad.txt'), /UTF-8/)
})
test('hostile markup is text-only, nested content cannot activate, cloze answers survive', () => {
  const text = plainField('<div>Hello<br>world<iframe src="https://evil.test">hidden</iframe><svg><script>attack()</script></svg><style>bad</style><img onerror="attack()"> &lt;img src=x&gt; {{c2::café::hint}} [sound:test.mp3]</div>', true)
  assert.equal(text, 'Hello\nworld <img src=x> café')
  assert.equal(plainField('2 < 3 & 5 > 4', false), '2 < 3 & 5 > 4')
})
test('mapping needs an explicit language, stable GUID duplicates skip/update without erasing other notes', async () => {
  const batch = parseApkg(apkg(SQL), SQL, 'deck.apkg'), selected = new Set(batch.notes.map(n => n.id)), maps = mapping(batch)
  await assert.rejects(mappedNotes(batch, new Map(batch.types.map(t => [t.id, defaultMapping(t.fields)])), selected), /language/)
  const { notes } = await mappedNotes(batch, maps, selected)
  const renamed = await mappedNotes({ ...batch, filename: 'renamed.apkg' }, maps, selected)
  assert.deepEqual(notes.map(n => n.key), renamed.notes.map(n => n.key))
  assert.equal(planImport(notes, renamed.notes, false).skipped, 3)
  const changed = { ...notes[0], answer: 'changed', decks: ['New::Deck'] }
  const update = planImport(notes, [changed, changed], true)
  assert.equal(update.updated, 1); assert.equal(update.withinFile, 1); assert.equal(update.writes[0].answer, 'changed')
  const noGuid = { ...batch, notes: batch.notes.map(n => ({ ...n, guid: '' })) }
  const a = await mappedNotes(noGuid, maps, selected), b = await mappedNotes({ ...noGuid, filename: 'other.apkg' }, maps, selected)
  assert.equal(a.notes[0].key, b.notes[0].key)
  maps.get(batch.notes[0].type).language = 'es'
  assert.notEqual((await mappedNotes(batch, maps, selected)).notes[0].key, notes[0].key)
})
test('unsafe archives and checksum failures are rejected before any file is extracted', () => {
  for (const name of ['../collection.anki2', '/evil', 'a/b', 'a\\b']) assert.throws(() => readArchive(zipSync({ [name]: strToU8('x') })), /Unsafe/)
  const corrupt = zipSync({ a: strToU8('hello') }, { level: 0 }); corrupt[31] ^= 1
  assert.throws(() => readArchive(corrupt).extract('a'), /checksum/)
  assert.throws(() => readArchive(zipSync({ a: new Uint8Array(1_000_000) })), /expansion/)
  const archive = zipSync({ a: strToU8('a') }, { level: 0 }); new DataView(archive.buffer).setUint16(6, 1, true)
  assert.throws(() => readArchive(archive), /headers disagree/)
  assert.throws(() => readArchive(new Uint8Array(32 * 1024 * 1024 + 1)), /32 MiB/)
})
test('modern version takes precedence over placeholder and unknown formats fail explicitly', () => {
  assert.throws(() => parseApkg(zipSync({ meta: new Uint8Array([8,4]), 'collection.anki2': database(SQL) }), SQL, 'new.apkg'), /unsupported/)
  assert.throws(() => parseApkg(zipSync({ 'collection.anki21b': strToU8('anything'), 'collection.anki2': database(SQL) }), SQL, 'broken.apkg'), /metadata is missing/)
  assert.throws(() => parseDatabase(database(SQL, true), 2, SQL, 'wrong.apkg'), /schema/)
  const db = new SQL.Database(database(SQL)); db.run('DROP TABLE notes; CREATE VIEW notes AS SELECT 1 AS id, 2 AS guid, 3 AS mid, 4 AS tags, 5 AS flds;')
  assert.throws(() => parseDatabase(db.export(), 2, SQL, 'view.apkg'), /table: notes/); db.close()
})
test('Zstd allocation preflight rejects huge windows, truncated frames and concatenation', () => {
  assert.throws(() => expandZstd(new Uint8Array([0x28,0xb5,0x2f,0xfd,0,0xff,1,0,0])), /window/)
  const data = zstdCompressSync(strToU8('fixture'))
  assert.equal(new TextDecoder().decode(expandZstd(data)), 'fixture')
  assert.throws(() => expandZstd(data.subarray(0, data.length-1)))
  assert.throws(() => expandZstd(new Uint8Array([...data,...data])), /Zstandard/)
})

test('empty mapped words are counted and unmatched source fields remain available', async () => {
  const batch = parseText(strToU8('one\tcontext\tanswer\textra\n\tcontext two\tanswer two\textra two'), 'notes.tsv')
  const result = await mappedNotes(batch, mapping(batch), new Set(['0', '1']))
  assert.equal(result.empty, 1); assert.equal(result.notes.length, 1)
  assert.equal(result.notes[0].fields[3], 'extra')
})
test('IndexedDB batches recheck concurrent duplicates and roll back on capacity errors', async () => {
  const { indexedDB } = await import('fake-indexeddb'); globalThis.indexedDB = indexedDB
  const { listLibrary, saveLibrary, removeLibrary } = await import('../import/library.ts')
  const batch = parseApkg(apkg(SQL), SQL, 'synthetic.apkg')
  const { notes } = await mappedNotes(batch, mapping(batch), new Set(batch.notes.map(n => n.id)))
  const results = await Promise.all([saveLibrary(notes, false), saveLibrary(notes, false)])
  assert.equal(results.reduce((sum, p) => sum + p.added, 0), 3)
  assert.equal(results.reduce((sum, p) => sum + p.skipped, 0), 3)
  assert.equal((await listLibrary()).length, 3)
  await assert.rejects(saveLibrary([{ ...notes[0], key: 'over-capacity', answer: 'x'.repeat(16_000_001) }], false), /limit/)
  assert.equal((await listLibrary()).length, 3, 'failed batch must not partially write')
  await saveLibrary([{ ...notes[0], answer: 'new answer', decks: ['Updated::Deck'] }], true)
  assert.equal((await listLibrary()).find(n => n.key === notes[0].key).answer, 'new answer')
  await removeLibrary(notes[0].key); assert.equal((await listLibrary()).length, 2)
})

test('worker cancellation, timeout and file budget terminate parsing without a result', async t => {
  const { readDeck } = await import('../import/client.ts')
  const workers = []
  class WorkerFixture { terminated = false; constructor() { workers.push(this) } postMessage() {} terminate() { this.terminated = true } }
  const original = globalThis.Worker; globalThis.Worker = WorkerFixture
  t.after(() => { globalThis.Worker = original })
  const file = { name: 'fixture.apkg', size: 10, arrayBuffer: async () => new ArrayBuffer(10) }
  const signal = new AbortController(), pending = readDeck(file, signal.signal)
  signal.abort(); await assert.rejects(pending, { name: 'AbortError' }); assert.equal(workers[0].terminated, true)
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const expired = readDeck(file, new AbortController().signal)
  t.mock.timers.tick(20000); await assert.rejects(expired, /20 seconds/); assert.equal(workers[1].terminated, true)
  await assert.rejects(readDeck({ ...file, size: 33 * 1024 * 1024 }, new AbortController().signal), /32 MiB/)
  assert.equal(workers.length, 2)
})
