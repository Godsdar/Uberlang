import test from 'node:test'
import assert from 'node:assert/strict'
import { parseHistory, extendHistory, foldHistory, historyLimit } from './history.ts'

const source = n => `https://en.wiktionary.org/w/index.php?oldid=${n}`
const node = (id, parent, term, language='en') => ({ id, parent, label:term, lang:language==='en'?'English':'French', lookup:{language,term}, source:source(1), skipped:[], ...(parent && {relation:'component',edgeSource:source(1)}) })
const family = () => ({id:'etymology-1',label:'Etymology',direction:'sources',note:'Partial history.',attribution:'Wiktionary CC BY-SA 4.0',verifiedOn:'2026-10-16',nodes:[node('root',null,'computer'),node('compute','root','compute')]})
const raw = () => ({schemaVersion:1,target:{language:'en',term:'compute'},source:source(2),reason:'',choices:[{...family(),summary:'To calculate.',reason:'',nodes:[{...node('word',null,'compute'),source:source(2)}, {...node('fr','word','computer','fr'),relation:'borrowed',edgeSource:source(2)}]}]})

test('expansion adds only selected immediate evidence, preserves IDs and immutable saved notes', () => {
  const original = family(), snapshot = structuredClone(original)
  const result = parseHistory(raw(),original.nodes[1].lookup)
  const grown = extendHistory(original,'compute',result)
  assert.deepEqual(original,snapshot)
  assert.equal(grown.nodes[1].source,source(2))
  assert.equal(grown.nodes[1].edgeSource,source(1),'incoming relation retains its earlier revision')
  assert.equal(grown.nodes[2].edgeSource,source(2))
  assert.equal(grown.nodes[2].parent,'compute')
  assert.equal(grown.nodes[2].historyState,undefined,'same spelling in French is not an English cycle')
  assert.deepEqual(foldHistory(grown,['compute.1'],'compute'),['compute'])
  assert.equal(JSON.parse(JSON.stringify(grown)).nodes[1].historyChoice.source,source(2),'evidence survives JSON export')
})

test('ambiguous histories require a choice and never silently combine homonyms', () => {
  const response = raw()
  response.choices.push({...structuredClone(response.choices[0]),id:'etymology-2',label:'Etymology 2'})
  response.choices[0].nodes = [response.choices[0].nodes[0]]
  response.choices[0].reason = 'Unknown origin.'
  const result = parseHistory(response,response.target)
  assert.throws(()=>extendHistory(family(),'compute',result),/Choose/)
  const grown = extendHistory(family(),'compute',result,'etymology-2')
  assert.equal(grown.nodes.length,3)
  assert.equal(grown.nodes[1].historyChoice.readerSelected,true)
  assert.match(grown.nodes[1].historyNote,/Reader selected/)
  const stopped = extendHistory(family(),'compute',result,'etymology-1')
  assert.equal(stopped.nodes.length,2)
  assert.equal(stopped.nodes[1].historyState,'unavailable')
})

test('repeat forms stop expansion and graph growth is bounded', () => {
  const response = raw(); response.choices[0].nodes[1] = {...node('again','word','computer'),edgeSource:source(2)}
  const result = parseHistory(response,response.target)
  const grown = extendHistory(family(),'compute',result)
  assert.equal(grown.nodes[2].historyState,'cycle')
  assert.throws(()=>extendHistory(grown,'compute.1',{...result,target:{language:'en',term:'computer'}}))
  const large = family(); while(large.nodes.length<64) large.nodes.push(node(`n${large.nodes.length}`,'root','word'))
  assert.match(historyLimit(large,'root'),/64/)
  const deep = family(); let parent='compute'; for(let i=0;i<8;i++){ const id=`d${i}`; deep.nodes.push(node(id,parent,'word')); parent=id }
  assert.match(historyLimit(deep,parent),/eight/)
})

test('stale or malformed history responses cannot be attached to a different word', () => {
  for(const mutate of [r=>r.target.term='wrong',r=>r.choices[0].nodes[0].lookup.language='fr',r=>r.source='https://example.com',r=>r.choices[0].nodes[1].parent='missing',r=>r.choices[0].nodes[1].lookup={language:'en',term:'https://evil.invalid'}]){
    const response=raw(); mutate(response); assert.throws(()=>parseHistory(response,{language:'en',term:'compute'}))
  }
  assert.throws(()=>extendHistory(family(),'root',parseHistory(raw(),raw().target)))
})

test('expression prose survives the network adapter without losing its revision', () => {
  const response = raw()
  response.choices[0].historyText = 'Possibly a later expression; the origin is uncertain.'
  const parsed = parseHistory(response, response.target)
  assert.equal(parsed.choices[0].historyText, response.choices[0].historyText)
  assert.equal(parsed.choices[0].nodes[0].source, source(2))
  response.choices[0].historyText = 'x'.repeat(3001)
  assert.throws(() => parseHistory(response, response.target))
})
