import test from 'node:test'
import assert from 'node:assert/strict'
import { sentenceRanges, researchSelection, occurrenceRows } from './context-research.ts'
import { sentenceRequest } from './live-analysis.ts'

test('sentence navigation sends the chosen repeated sentence with exact original offsets', () => {
  const text = '😀 Birds sing.\n\nBirds sing.  '
  const ranges = sentenceRanges(text)
  assert.equal(ranges.length, 2)
  assert.equal(ranges[1].start, 16)
  const request = sentenceRequest('doc', text, ranges[1].start, ranges[1].end, 'en')
  assert.equal(request.text, 'Birds sing.')
  assert.equal(request.contextStart, 16)
  assert.deepEqual(request.selection, { start: 0, end: 11 })
})

test('phrase research keeps the whole phrase and source document, word research uses its lemma', () => {
  const text = 'Birds kick the bucket. Birds sing.'
  const phrase = researchSelection(text, 6, 22, 'en', { text: 'Birds', lemma: 'bird' })
  assert.equal(phrase, null, 'punctuated sentence is not silently rewritten as a dictionary entry')
  const expression = researchSelection(text, 6, 21, 'en')
  assert.equal(expression.kind, 'expression')
  assert.equal(expression.target.term, 'kick the bucket')
  assert.equal(expression.context, text)
  const word = researchSelection(text, 23, 28, 'en', { text: 'Birds', lemma: 'bird' })
  assert.equal(word.target.term, 'bird')
  assert.equal(word.start, 23)
  assert.equal(researchSelection(text, 0, 5, 'ru', { text: 'Birds', lemma: 'wrong' }).target.term, 'Birds')
  assert.equal(researchSelection(text, -1, 4, 'en'), null)
})

test('occurrences retain repeated words, morphology and exact dependency head positions', () => {
  const tokens = [
    { text: 'Dogs', lemma: 'dog', start: 0, end: 4, pos: 'NOUN', head: 2, relation: 'nsubj', features: {Number:'Plur'} },
    { text: 'chase', lemma: 'chase', start: 5, end: 10, pos: 'VERB', head: 0, relation: 'root', features: {} },
    { text: 'dogs', lemma: 'dog', start: 11, end: 15, pos: 'NOUN', head: 2, relation: 'dobj', features: {Number:'Plur'} }
  ]
  const rows = occurrenceRows({offset:20, example:{tokens}})
  assert.deepEqual(rows.map(row=>[row.start,row.end,row.headStart]), [[20,24,25],[25,30,null],[31,35,25]])
  assert.equal(rows[0].features.Number, 'Plur')
  assert.equal(rows[2].relation, 'dobj')
})

test('reading window preserves repeated sentence offsets and surrounding whitespace', async () => {
  const { readingSentence } = await import('./context-research.ts')
  const text = '  Water flows.  Water flows.  '
  assert.deepEqual(readingSentence(text, 0), { text: 'Water flows.', start: 2, end: 14 })
  assert.deepEqual(readingSentence(text, 16), { text: 'Water flows.', start: 16, end: 28 })
  assert.equal(readingSentence(text, text.length).start, 16)
  assert.equal(readingSentence('', 0), undefined)
})

test('phrase selection in the second visible sentence maps back to its original occurrence', async () => {
  const { readingSelection } = await import('./context-research.ts')
  const text = 'Water flows.  Water flows.'
  assert.deepEqual(readingSelection(text, 14, 0, 5), { start: 14, end: 19 })
  assert.equal(readingSelection(text, 14, 0, 99), null)
})
