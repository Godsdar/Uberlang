// Synthetic format fixtures only. Never reads an installed Anki collection.
import { zipSync, strToU8 } from 'fflate'
import { zstdCompressSync } from 'node:zlib'
export function database(SQL, modern = false, count = 3) {
  const db = new SQL.Database()
  db.run('CREATE TABLE col (ver integer, models text, decks text); CREATE TABLE notes (id integer primary key, guid text, mid integer, tags text, flds text); CREATE TABLE cards (id integer primary key, nid integer, did integer, odid integer);')
  const fields = ['Word', 'Example', 'Meaning']
  if (modern) {
    db.run('CREATE TABLE notetypes (id integer primary key, name text COLLATE BINARY); CREATE TABLE fields (ntid integer, ord integer, name text COLLATE BINARY); CREATE TABLE decks (id integer primary key, name text COLLATE BINARY);')
    db.run('INSERT INTO notetypes VALUES (10, ?), (11, ?)', ['Words', 'Cloze'])
    fields.forEach((name, i) => db.run('INSERT INTO fields VALUES (10, ?, ?)', [i, name]))
    db.run('INSERT INTO fields VALUES (11, 0, ?), (11, 1, ?)', ['Text', 'Extra'])
    db.run('INSERT INTO decks VALUES (1, ?), (2, ?), (3, ?)', ['English\x1fNature', 'English\x1fVerbs', 'Filtered'])
    db.run('INSERT INTO col VALUES (18, ?, ?)', ['{}', '{}'])
    // Match Anki's custom collation schema without implementing or invoking it.
    db.run("PRAGMA writable_schema=ON; UPDATE sqlite_master SET sql=replace(sql, 'COLLATE BINARY', 'COLLATE unicase'); PRAGMA writable_schema=OFF;")
  } else {
    const models = { 10: { name: 'Words', flds: fields.map((name, ord) => ({ name, ord })) }, 11: { name: 'Cloze', flds: [{ name: 'Text', ord: 0 }, { name: 'Extra', ord: 1 }] } }
    db.run('INSERT INTO col VALUES (11, ?, ?)', [JSON.stringify(models), JSON.stringify({ 1: { name: 'English::Nature' }, 2: { name: 'English::Verbs' }, 3: { name: 'Filtered' } })])
  }
  for (let i = 0; i < count; i++) {
    const cloze = i === 1
    const flds = cloze ? ['The {{c1::water::liquid}} is clear.', 'Cloze answer'] : [i ? `word${i}` : '<b>water</b><img src="https://tracking.invalid/pixel"><script>evil()</script>', i ? `A word${i} appears here.` : 'The water is clear.\nWater matters.', 'вода &amp; life']
    db.run('INSERT INTO notes VALUES (?, ?, ?, ?, ?)', [100+i, `synthetic-${i}`, cloze ? 11 : 10, ' nature nature::water ', flds.join('\x1f')])
    db.run('INSERT INTO cards VALUES (?, ?, ?, ?)', [1000+i, 100+i, i===0 ? 3 : 1, i===0 ? 1 : 0])
  }
  db.run('INSERT INTO cards VALUES (9999, 100, 2, 0)') // reverse card in a different deck
  const data = db.export(); db.close(); return data
}
export function apkg(SQL, modern = false, count = 3) {
  const data = database(SQL, modern, count)
  return zipSync(modern ? { meta: new Uint8Array([8,3]), 'collection.anki21b': zstdCompressSync(data), 'collection.anki2': strToU8('compatibility placeholder, never import'), media: strToU8('[]'), '0': strToU8('not real media') } : { 'collection.anki21': data, media: strToU8('{}'), '0': strToU8('not real media') })
}
export const textFixture = '#separator:Tab\n#html:true\n#columns:GUID\tDeck\tTags\tWord\tExample\tAnswer\n#guid column:1\n#deck column:2\n#tags column:3\n"text-id"\t"English::Nature"\t"nature water"\t"water"\t"Water is clear.\nIt is cold."\t"<b>вода</b>"\n'
