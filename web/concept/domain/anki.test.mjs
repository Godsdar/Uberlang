import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createAnkiDraft, ankiFields, ankiIdentity, serializeAnki } from './anki.ts'

const text = 'A word is a word. A mother drinks water.'
const note = { selectedText: 'word', start: 12, end: 16, context: 'word', documentId: 'fixture', provenance: 'Grammar unavailable.', explanationSource: 'unavailable' }
function draft() { return { ...createAnkiDraft(note, text), answer: 'A unit of language.' } }

// Independent reader for the documented quote/delimiter rules, not the serializer.
function readRows(input) {
  const rows = []; let row = [], cell = '', quoted = false
  for (let i = 0; i < input.length; i++) {
    const c = input[i]
    if (c === '"') { if (quoted && input[i + 1] === '"') { cell += '"'; i++ } else quoted = !quoted }
    else if (!quoted && c === '\t') { row.push(cell); cell = '' }
    else if (!quoted && c === '\n') { row.push(cell); rows.push(row); row = []; cell = '' }
    else cell += c
  }
  assert.equal(quoted, false)
  return rows
}

test('a second occurrence retains exact range and full local context; stale selection is rejected', () => {
  const card = draft()
  assert.equal(card.context, 'A word is a word.')
  assert.match(card.evidence, /UTF-16 \[12,16\)/)
  assert.throws(() => createAnkiDraft(note, 'An edited unrelated passage'), /original selection/)
  assert.throws(() => createAnkiDraft({ ...note, start: -1 }, text))
  assert.throws(() => createAnkiDraft({ ...note, end: 100 }, text))
  assert.throws(() => createAnkiDraft({ ...note, selectedText: 'water', start: 0, end: 100 }, 'water'))
})

test('unicode and hostile HTML remain plain fields; multiline tabs and quotes round-trip', () => {
  const card = { ...draft(), word: '水', language: '日本語', context: '水\t"water"\n<script>alert(1)</script>', answer: 'A & B\n"yes"\t<iframe src="https://tracker.invalid">', tags: 'uberlang 日本語 日本語' }
  const output = serializeAnki(card)
  const lines = output.split('\n')
  assert.deepEqual(lines.slice(0, 5), ['#separator:Tab', '#html:false', '#deck:Uberlang', '#tags column:3', '#columns:Front\tBack\tTags'])
  const rows = readRows(lines.slice(5).join('\n'))
  assert.equal(rows.length, 1)
  assert.deepEqual(rows[0], [ankiFields(card).front, ankiFields(card).back, 'uberlang 日本語'])
  assert.ok(rows[0][1].includes('<iframe'))
})

test('first-field duplicate identity ignores answer/deck but separates language and context', () => {
  const card = draft()
  assert.equal(ankiIdentity(card), ankiIdentity({ ...card, answer: 'Different', deck: 'Other' }))
  assert.notEqual(ankiIdentity(card), ankiIdentity({ ...card, language: 'de' }))
  assert.notEqual(ankiIdentity(card), ankiIdentity({ ...card, sense: 'linguistic unit' }))
  assert.notEqual(ankiIdentity(card), ankiIdentity({ ...card, context: 'Another context' }))
  assert.equal(ankiIdentity({ ...card, word: 'cafe\u0301' }), ankiIdentity({ ...card, word: 'café' }))
})

test('no header/column injection, empty cards, invalid tags or oversized payloads', () => {
  for (const fields of [{ deck: 'Deck\n#html:true' }, { deck: 'a\tb' }, { tags: 'one\ntwo' }, { tags: 'one\ttwo' }, { tags: '<script>' }, { word: '' }, { language: 'en\n#html:true' }, { answer: ' ' }, { context: '' }, { answer: 'x'.repeat(10001) }, { word: '\u0000word' }]) {
    assert.throws(() => serializeAnki({ ...draft(), ...fields }))
  }
})

test('immutable evidence and optional history keep sources, revision, uncertainty and reconstruction', () => {
  const source = { ...note, explanation: 'A model guess', explanationSource: 'grammar-based', meaningCaveat: 'Not word sense.', lexical: { provenance: { version: '123', license: 'CC BY-SA 4.0' }, senses: [{ source: 'https://en.wiktionary.org/wiki/word' }] }, origin: { note: 'Prepared family, not a complete ancestry.', attribution: 'Wiktionary contributors', verifiedOn: '2026-10-18', nodes: [{ label: '*wer', lang: 'PIE', source: 'https://en.wiktionary.org/wiki/word', edgeSource: 'https://en.wiktionary.org/wiki/Reconstruction:Proto-Indo-European/wer', relation: 'reconstructed ancestor' }] } }
  const card = createAnkiDraft(source, text)
  assert.equal(card.answer, '')
  assert.equal(card.includeHistory, false)
  source.origin.nodes[0].label = 'mutated'
  const fields = ankiFields({ ...card, answer: 'Chosen meaning', includeHistory: true })
  assert.match(fields.back, /\*wer \(PIE\)/)
  assert.match(fields.back, /Dictionary revision: 123/)
  assert.match(fields.back, /Not word sense/)
  assert.match(fields.back, /creativecommons.org/)
  assert.match(fields.back, /Original selection: word/)
  assert.doesNotMatch(fields.back, /mutated|model guess/)
})

test('prepared explanations are labeled and unknown meaning stays blank', () => {
  assert.equal(createAnkiDraft({ ...note, explanationSource: 'prepared', explanation: 'A prepared explanation.' }, text).answer, 'Prepared explanation: A prepared explanation.')
  assert.equal(createAnkiDraft(note, text).answer, '')
})

test('declared source language survives the Anki draft; legacy English notes remain compatible',()=>{
  assert.equal(createAnkiDraft({...note,language:'ru'},text).language,'ru')
  assert.equal(createAnkiDraft({...note,language:'und'},text).language,'und')
  assert.equal(createAnkiDraft(note,text).language,'en')
})
