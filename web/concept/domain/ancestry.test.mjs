import test from 'node:test'
import assert from 'node:assert/strict'
import { traceAncestry, isPIE } from './ancestry.ts'
import { extendHistory, parseHistory } from './history.ts'
import { historyLanguages } from '../../../src/shared/etymology.ts'
const source = 'https://en.wiktionary.org/w/index.php?oldid=123'
const target = (language, term) => ({language,term})
const en = target('en','water'), old = target('ang','wæter'), gem = target('gem-pro','*watōr'), pie = target('ine-pro','*wódr̥')
const node = (id,parent,t) => ({id,parent,label:t.term,lang:historyLanguages[t.language],lookup:t,source,skipped:[],...(t.term.startsWith('*')&&{reconstructed:true}),...(parent&&{relation:'inherited',edgeSource:source})})
const family = (root, children=[]) => ({id:'etymology-1',label:'Etymology',direction:'sources',note:'Partial history',attribution:'Wiktionary CC BY-SA 4.0',verifiedOn:'2026-10-23',nodes:[node('root',null,root),...children.map((t,i)=>node(`n${i}`,'root',t))]})
const result = (t, children=[]) => parseHistory({schemaVersion:1,target:t,source,reason:'No further supported evidence.',choices:[{...family(t,children),summary:'Water',reason:'No further supported evidence.'}]},t)
const run = (f,load,extra={}) => traceAncestry(f,{signal:new AbortController().signal,progress(){},load,...extra})

test('traces sequential cited ancestry to PIE, retaining revisions and stopping at PIE', async()=>{
  const original=family(en,[old]), calls=[], updates=[]; let inFlight=0
  const outcome=await run(original,async t=>{assert.equal(inFlight++,0);calls.push(t);await Promise.resolve();inFlight--;return result(t,t.language==='ang'?[gem]:[pie])},{progress:f=>updates.push(f)})
  assert.deepEqual(calls,[old,gem]);assert.equal(original.nodes.length,2)
  assert.equal(outcome.family.nodes.length,4);assert.ok(isPIE(outcome.family.nodes.at(-1)))
  assert.ok(outcome.family.nodes.slice(1).every(n=>n.edgeSource===source));assert.match(outcome.message,/every loaded branch/)
  assert.equal(updates.at(-1).nodes.length,4)
})

test('ambiguous ancestry pauses without adding alternatives; reader choice resumes',async()=>{
  const f=family(en,[old]), ambiguous=result(old,[gem]);ambiguous.choices.push({...family(old,[target('la','aqua')]),id:'etymology-2',summary:'Alternative',reason:''})
  const paused=await run(f,async()=>ambiguous)
  assert.equal(paused.family.nodes.length,2);assert.equal(paused.choice.nodeId,'n0')
  const chosen=extendHistory(paused.family,'n0',paused.choice.result,'etymology-1')
  const finished=await run(chosen,async t=>result(t,[pie]))
  assert.ok(finished.family.nodes.some(isPIE));assert.ok(!finished.family.nodes.some(n=>n.label==='aqua'))
  assert.equal(finished.family.nodes.find(n=>n.id==='n0').historyChoice.readerSelected,true)
})

test('non-IE and unavailable branches stop honestly without synthetic PIE nodes',async()=>{
  const arabic=target('ar','قهوة');const outcome=await run(family(en,[arabic]),async t=>result(t))
  assert.equal(outcome.family.nodes.length,2);assert.equal(outcome.family.nodes[1].historyState,'unavailable')
  assert.ok(!outcome.family.nodes.some(isPIE));assert.match(outcome.message,/Other origins/)
})

test('abort after a response cannot attach stale ancestry',async()=>{
  const controller=new AbortController(), updates=[]
  await assert.rejects(run(family(en,[old]),async t=>{controller.abort();return result(t,[pie])},{signal:controller.signal,progress:f=>updates.push(f)}),{name:'AbortError'})
  assert.ok(updates.every(f=>f.nodes.length===2))
})

test('cycles terminate and repeated targets share a request without joining branches',async()=>{
  let calls=0
  const cycle=await run(family(en,[old]),async t=>{calls++;return result(t,[en])})
  assert.equal(calls,1);assert.equal(cycle.family.nodes.at(-1).historyState,'cycle')
  calls=0
  const repeated=await run(family(en,[old,old]),async t=>{calls++;return result(t,[pie])})
  assert.equal(calls,1);assert.equal(repeated.family.nodes.filter(isPIE).length,2)
  assert.notEqual(repeated.family.nodes.at(-1).parent,repeated.family.nodes.at(-2).parent)
})

test('request budget, depth and node limits keep automatic traversal bounded',async()=>{
  const children=Array.from({length:30},(_,i)=>target('en',`word${i}`));let calls=0
  const budget=await run(family(en,children),async t=>{calls++;return result(t)})
  assert.equal(calls,24);assert.match(budget.message,/24 entries/)
  const deep=await run(family(en,[old]),async t=>result(t,[target('en',t.term+'x')]))
  assert.match(deep.message,/eight steps/)
  const large=family(en,Array.from({length:63},(_,i)=>target('en',`form${i}`)))
  await run(large,async()=>assert.fail('No request at node limit')).then(r=>assert.match(r.message,/64/))
})

test('a network failure preserves previous progress for an explicit retry',async()=>{
  let latest=family(en,[old])
  await assert.rejects(run(latest,async t=>{if(t.language==='gem-pro')throw new Error('offline');return result(t,[gem])},{progress:f=>latest=f}),/offline/)
  assert.equal(latest.nodes.length,3)
  const resumed=await run(latest,async t=>{assert.equal(t.language,'gem-pro');return result(t,[pie])})
  assert.ok(resumed.family.nodes.some(isPIE))
})
