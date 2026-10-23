import test from 'node:test'
import assert from 'node:assert/strict'
import { DISCOVERY_KEY, discoveryCard, emptyLibrary, parseLibrary, saveDiscovery, sharedForms, validateDiscovery, writeLibrary } from './explorations.ts'
import { conceptData } from '../fixtures.mjs'
import { extendHistory, parseHistory } from './history.ts'
const now = '2026-10-23T10:00:00.000Z'
const prepared = () => ({ id:'water-1', word:'water', language:'en', family:structuredClone(conceptData.families.water), note:'My own insight', marks:{}, updatedAt:now })
const storage = () => { const data = new Map(); return { getItem:key=>data.get(key)??null, setItem:(key,value)=>data.set(key,value) } }
const source = n => `https://en.wiktionary.org/w/index.php?oldid=${n}`
const node = (id,parent,term,language='en') => ({ id,parent,label:term,lang:language==='en'?'English':'French',lookup:{language,term},source:source(1),skipped:[],...(parent&&{relation:'component',edgeSource:source(1)}) })
const live = () => ({id:'e1',label:'Etymology 1',direction:'sources',note:'Partial history',attribution:'Wiktionary CC BY-SA 4.0',verifiedOn:now,nodes:[node('root',null,'computer'),node('compute','root','compute')]})

test('saved tree restores selection, folded branches, viewport, notes and marks without mutating the original',()=>{
 const item=prepared(), id=item.family.nodes.at(-1).id
 item.view={selectedId:id,endpoints:[id],pathOnly:true,zoom:1.25,scrollLeft:40,scrollTop:9};item.marks[id]='curious'
 const library=saveDiscovery(emptyLibrary(),item);item.note='changed after saving';item.family.nodes[0].label='changed'
 const restored=parseLibrary(JSON.stringify(library));assert.equal(restored.discoveries[0].note,'My own insight');assert.notEqual(restored.discoveries[0].family.nodes[0].label,'changed')
 assert.deepEqual(restored.discoveries[0].view,{selectedId:id,endpoints:[id],pathOnly:true,zoom:1.25,scrollLeft:40,scrollTop:9});assert.equal(restored.discoveries[0].marks[id],'curious')
})
test('expanded source graph round trips with alternative choice, revisions and relation evidence intact',()=>{
 const response={schemaVersion:1,target:{language:'en',term:'compute'},source:source(2),reason:'',choices:[{...live(),summary:'',reason:'',nodes:[{...node('root',null,'compute'),source:source(2)},{...node('fr','root','computer','fr'),relation:'borrowed',edgeSource:source(2)}]}]}
 const extended=extendHistory(live(),'compute',parseHistory(response,response.target))
 const d={...prepared(),word:'computer',family:extended}
 const restored=parseLibrary(JSON.stringify(saveDiscovery(emptyLibrary(),d))).discoveries[0]
 assert.deepEqual(restored.family,JSON.parse(JSON.stringify(extended)));assert.equal(restored.family.nodes[1].historyChoice.source,source(2));assert.equal(restored.family.nodes[1].edgeSource,source(1))
})
test('invalid imports, hostile URLs, cycles and unknown view references cannot replace the library',()=>{
 const store=storage(),good=saveDiscovery(emptyLibrary(),prepared()),raw=writeLibrary(store,good,null)
 for(const mutate of [d=>d.family.nodes[0].source='javascript:alert(1)',d=>d.family.nodes[0].parent=d.family.nodes[0].id,d=>d.family.nodes[0].parent='missing',d=>d.marks.missing='curious',d=>d.family.nodes[0].lookup={language:'xx',term:'water'},d=>d.view={selectedId:'missing',endpoints:[],pathOnly:false,zoom:1,scrollLeft:0,scrollTop:0}]) {
  const broken=prepared();mutate(broken);assert.throws(()=>validateDiscovery(broken));assert.equal(store.getItem(DISCOVERY_KEY),raw)
 }
 assert.throws(()=>parseLibrary('{broken'));assert.throws(()=>parseLibrary(JSON.stringify({...good,version:9})));assert.throws(()=>parseLibrary(JSON.stringify({...good,discoveries:[prepared(),prepared()]})))
})
test('storage capacity and another tab cannot silently overwrite existing discoveries',()=>{
 const store=storage(),first=saveDiscovery(emptyLibrary(),prepared()),raw=writeLibrary(store,first,null)
 const next=saveDiscovery(first,{...prepared(),id:'second'});writeLibrary(store,next,raw)
 assert.throws(()=>writeLibrary(store,first,raw),/another tab/);assert.equal(parseLibrary(store.getItem(DISCOVERY_KEY)).discoveries.length,2)
 const failing={getItem:()=>raw,setItem:()=>{throw new Error('quota')}};assert.throws(()=>writeLibrary(failing,first,raw),/could not save/)
 assert.throws(()=>writeLibrary(storage(),{...first,discoveries:Array.from({length:31},(_,i)=>({...prepared(),id:String(i)}))},null),/full/)
})
test('comparison respects language identity and reports components without inventing ancestry',()=>{
 const left=live(),right=live();right.nodes[0].lookup.language='fr';right.nodes[0].lang='French'
 const shared=sharedForms(left,right);assert.equal(shared.length,1);assert.equal(shared[0].left.relation,'component');assert.equal(shared[0].left.label,'compute');assert.equal(left.nodes.length,2)
})

test('Anki from a German form in an English research tree keeps the form language and exact selection',()=>{
 const item=prepared(),node=item.family.nodes.find(n=>n.lang==='German')
 item.view={selectedId:node.id,endpoints:[node.id],pathOnly:false,zoom:1,scrollLeft:0,scrollTop:0}
 const card=discoveryCard(item);assert.equal(card.note.language,'de');assert.equal(card.note.selectedText,'Wasser');assert.equal(card.document.slice(card.note.start,card.note.end),'Wasser');assert.deepEqual(card.note.origin,item.family)
})

test('imported card answer is retained only for its original form', async () => {
  const {createAnkiDraft} = await import('./anki.ts')
  const {discoveryCard, validateDiscovery} = await import('./explorations.ts')
  const {historyLanguages} = await import('../../../src/shared/etymology.ts')
  const source='https://en.wiktionary.org/w/index.php?oldid=123'
  const d = validateDiscovery({id:'imported',word:'árbol',language:'es',note:'',marks:{},updatedAt:'2026-10-23T00:00:00Z',context:'El árbol es alto',importedCard:{answer:'tree',deck:'Spanish',tags:'noun'},family:{direction:'sources',nodes:[{id:'root',parent:null,label:'árbol',lang:historyLanguages.es,lookup:{language:'es',term:'árbol'},source,skipped:[]},{id:'other',parent:'root',label:'árbol',lang:'French',lookup:{language:'fr',term:'árbol'},source,edgeSource:source,relation:'borrowed',skipped:[]}],note:'Partial',attribution:'Wiktionary CC BY-SA',verifiedOn:'2026-10-23'}})
  const original=discoveryCard(d), draft=createAnkiDraft(original.note, original.document)
  assert.equal(draft.answer,'tree');assert.equal(draft.deck,'Spanish');assert.equal(draft.context,'El árbol es alto')
  const historical=discoveryCard({...d,view:{selectedId:'other'}})
  assert.equal(createAnkiDraft(historical.note,historical.document).answer,'')
})
