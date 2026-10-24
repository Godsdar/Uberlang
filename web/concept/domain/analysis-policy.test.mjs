import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { languageIssue, textIssue, wordCount } from '../../../src/shared/analysis-policy.ts'
import { sentenceRequest, parseAnalysis } from './live-analysis.ts'
import { analysisExamples } from './analysis-examples.ts'
import { analysisError } from './analysis-errors.ts'
import { conceptData } from '../../../src/data/reading-fixtures.mjs'
const corpus = JSON.parse(readFileSync(new URL('../../../src/data/analysis-corpus.json', import.meta.url)))

test('shared corpus rejects unsupported input before any English request', () => {
  for (const item of corpus) {
    assert.equal((textIssue(item.text) ?? languageIssue(item.language,item.text))?.code ?? 'accepted',item.expected,item.id)
    if (item.expected==='accepted') assert.equal(sentenceRequest('doc',item.text,0,0,item.language).language,item.language)
    else assert.throws(()=>sentenceRequest('doc',item.text,0,0,item.language), /not been sent/,item.id)
  }
  assert.throws(()=>sentenceRequest('doc','Birds sing.',0,0,''),/Could not identify the language/)
})
test('UTF-16, word boundaries and combining marks preserve exact source without truncation',()=>{
  assert.equal(wordCount("café l'été 42"),3)
  for (const text of ['a'.repeat(500), 'é '.repeat(50)]) assert.equal(textIssue(text),null)
  for (const text of ['a'.repeat(501), 'é '.repeat(51)]) assert.equal(textIssue(text).code,'TEXT_LIMIT')
  for (const text of ['\ud800','word\udc00']) assert.equal(textIssue(text).code,'INVALID_TEXT')
  assert.equal(textIssue('🌱 English.'),null)
})
test('new text examples contain no prepared answers and do not match offline fixtures',()=>{
  for(const example of analysisExamples){
    assert.deepEqual(Object.keys(example).sort(),['id','label','text'])
    assert.ok(!conceptData.sentences.examples.some(prepared=>prepared.text===example.text))
  }
})
test('unavailable results and stable input errors are honest and do not echo upstream content',()=>{
  const request=sentenceRequest('doc','Birds sing.',0,0,'en')
  assert.match(analysisError(422,{error:{code:'UNSUPPORTED_LANGUAGE',message:'private'}}),/Only the English model/)
  assert.ok(!analysisError(503,{error:{code:'private',message:'private'}}).includes('private'))
  assert.throws(()=>parseAnalysis({schemaVersion:1,language:'ru'},request),/invalid result/)
})
