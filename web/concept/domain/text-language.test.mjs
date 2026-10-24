import test from 'node:test'
import assert from 'node:assert/strict'
import { detectTextLanguage, languageAtSelection } from './text-language.ts'
import { sentenceRequest } from './live-analysis.ts'

test('sentence languages are identified locally without asking for a language', () => {
  for (const [text, language] of [
    ['The cat sat on the mat.', 'en'], ['Я читаю интересную книгу.', 'ru'],
    ['Je lis un livre intéressant.', 'fr'], ['Estoy leyendo un libro interesante.', 'es'],
    ['Ich lese ein interessantes Buch.', 'de']
  ]) assert.equal(detectTextLanguage(text), language)
  for (const text of ['', '42 🌱', 'bear', 'Birds sing.', 'Hola mundo']) assert.equal(detectTextLanguage(text), '')
})
test('auto analysis detects only the submitted sentence and keeps exact offsets', () => {
  const text = 'Я читаю интересную книгу. The cat sat on the mat.'
  const start = text.indexOf('cat')
  const request = sentenceRequest('doc', text, start, start + 3, detectTextLanguage)
  assert.equal(request.language, 'en')
  assert.equal(request.text, 'The cat sat on the mat.')
  assert.equal(request.contextStart, text.indexOf('The'))
  assert.equal(languageAtSelection(text, start), 'en')
  assert.equal(languageAtSelection(text, 0), 'ru')
  assert.throws(() => sentenceRequest('doc', text, 0, 0, detectTextLanguage), /Grammar is unavailable/)
  assert.throws(() => sentenceRequest('doc', 'Je lis un livre intéressant.', 0, 0, detectTextLanguage), /Grammar is unavailable/)
  assert.throws(() => sentenceRequest('doc', 'bear', 0, 0, detectTextLanguage), /longer phrase/)
})
