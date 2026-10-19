import test from 'node:test'
import assert from 'node:assert/strict'
import { sentenceRequest, parseAnalysis, AnalysisRequestGate, readingRanges } from './live-analysis.ts'

const englishRequest = (...args) => sentenceRequest(...args, 'en')
const request = englishRequest('doc', 'First sentence. Birds sing.', 16, 21)
const result = () => ({ schemaVersion: 1, language: 'en', documentId: request.documentId, contextStart: request.contextStart,
  coordinateSystem: 'UTF-16, end-exclusive', selection: { ...request.selection, absoluteStart: 16, absoluteEnd: 21, text: 'Birds' },
  layers: { grammar: { status: 'live', provenance: { language: 'en', engine: 'test-parser', model: 'english', version: '1', live: true }, data: { scope: 'sentence', tokens: [
    { id: 1, text: 'Birds', start: 16, end: 21, lemma: 'bird', pos: 'NOUN', features: { Number: 'Plur' }, head: 2, relation: 'nsubj' },
    { id: 2, text: 'sing', start: 22, end: 26, lemma: 'sing', pos: 'VERB', features: {}, head: 0, relation: 'root' },
    { id: 3, text: '.', start: 26, end: 27, lemma: '.', pos: 'PUNCT', features: {}, head: 2, relation: 'punct' }
  ] } } } })

test('sentence context preserves repeated occurrence offsets and limits outgoing text', () => {
  const document = 'Birds sing. Birds sing.'
  const second = englishRequest('two', document, 12, 17)
  assert.equal(second.contextStart, 12)
  assert.equal(second.text, 'Birds sing.')
  assert.deepEqual(second.selection, { start: 0, end: 5 })
  assert.throws(() => englishRequest('two', document, 0, document.length), /one sentence/)
  assert.throws(() => englishRequest('long', 'word '.repeat(51) + '.', 0, 4), /shorter sentence/)
  const emoji = englishRequest('unicode', '😀 Birds sing.', 3, 8)
  assert.equal(emoji.selection.start, 3)
  assert.throws(() => englishRequest('unicode', '😀 Birds sing.', 1, 2), /Select a word/)
  assert.equal(englishRequest('caret', document, document.length, document.length).text, 'Birds sing.')
})

test('live adapter preserves offsets and evidence, rejects stale and malformed dependencies', () => {
  const parsed = parseAnalysis(result(), request)
  assert.equal(parsed.status, 'live')
  assert.equal(parsed.example.tokens[0].start, 0)
  assert.equal(parsed.offset, 16)
  assert.equal(parsed.example.tokens[0].features.Number, 'Plur')
  for (const mutate of [
    r => { r.documentId = 'stale' }, r => { r.selection.absoluteStart = 0 },
    r => { r.layers.grammar.data.tokens[0].start = 17 },
    r => { r.layers.grammar.data.tokens[0].text = 'Wrong' },
    r => { r.layers.grammar.data.tokens[0].head = 99 },
    r => { r.layers.grammar.data.tokens[0].head = 3; r.layers.grammar.data.tokens[2].head = 1 },
    r => { r.layers.grammar.data.tokens[0].head = 0 },
    r => { r.layers.grammar.data.tokens.pop() },
    r => { r.layers.grammar.provenance.live = false }
  ]) { const bad = result(); mutate(bad); assert.throws(() => parseAnalysis(bad, request), /invalid result/) }
})

test('request gate rejects late completion after edits, selection changes or a new request', () => {
  const gate = new AnalysisRequestGate()
  const first = gate.begin()
  assert.equal(first.current(), true)
  gate.invalidate()
  assert.equal(first.signal.aborted, true)
  assert.equal(first.current(), false)
  const second = gate.begin(), third = gate.begin()
  assert.equal(second.current(), false)
  assert.equal(third.current(), true)
})

test('reading text selects exact model tokens in contractions without changing the document', () => {
  const text = "Before. I can't go. After."
  const context = { offset: 8, example: { text: "I can't go.", tokens: [
    { text: 'I', start: 0, end: 1 }, { text: 'ca', start: 2, end: 4 },
    { text: "n't", start: 4, end: 7 }, { text: 'go', start: 8, end: 10 }, { text: '.', start: 10, end: 11 }
  ] } }
  const ranges = readingRanges(text, context)
  assert.deepEqual(ranges.map(r => r.text), ['Before', 'I', 'ca', "n't", 'go', '.', 'After'])
  for (const range of ranges) assert.equal(text.slice(range.start, range.end), range.text)
})

test('grammar-based reading retains its uncertainty separately from model tokens', () => {
  const response = result()
  response.layers.meaning = { status: 'live', data: { scope: 'sentence', kind: 'structure', explanation: 'The subject is Birds; the action is sing.', caveat: 'This describes predicted structure, not speaker intention.' } }
  const parsed = parseAnalysis(response, request)
  assert.equal(parsed.meaning.kind, 'structure')
  assert.match(parsed.meaning.caveat, /not speaker intention/)
  delete response.layers.meaning.data.caveat
  assert.throws(() => parseAnalysis(response, request), /invalid result/)
})
