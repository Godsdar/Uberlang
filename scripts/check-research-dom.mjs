// React integration scenarios. NODE_PATH may point to a disposable jsdom install.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { build } from 'esbuild'
import { conceptData } from '../web/concept/fixtures.mjs'
import { DISCOVERY_KEY, emptyLibrary, saveDiscovery } from '../web/concept/domain/explorations.ts'
const { JSDOM } = createRequire(import.meta.url)('jsdom')
const bundle = await build({ stdin:{contents:`import { mountResearch } from './web/concept/components/research-workspace.tsx'; window.mountResearch = mountResearch;`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,jsx:'automatic',format:'iife',define:{'process.env.NODE_ENV':'"production"'} })
const wait = () => new Promise(resolve=>setTimeout(resolve,40))
async function setup(initial) {
 const dom=new JSDOM('<div id="research"></div>',{url:'https://local-test.invalid',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,errors=[],calls=[]
 Object.assign(w,{structuredClone,AbortController,AbortSignal,TextEncoder}); w.matchMedia=()=>({matches:true,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}})
 w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};Object.defineProperty(w,'crypto',{value:crypto})
 if(initial!==undefined)w.localStorage.setItem(DISCOVERY_KEY,initial)
 w.addEventListener('error',e=>errors.push(e.error));w.fetch=async(...args)=>{calls.push(args);return{ok:false,status:503}}
 w.eval(bundle.outputFiles[0].text)
 const bridge=w.mountResearch(w.document.querySelector('#research'),{prepared:conceptData.families,onContext(){},onAnki(){}})
 const all=()=>[...w.document.querySelectorAll('button')]
 const button=text=>{const b=all().find(b=>b.textContent.trim()===text);assert.ok(b,'missing '+text);return b}
 const click=async text=>{button(text).click();await wait();assert.deepEqual(errors,[])}
 await wait();return{w,dom,errors,calls,bridge,button,click}
}
const d=()=>({id:'one',word:'water',language:'en',family:structuredClone(conceptData.families.water),note:'A question to keep',marks:{},updatedAt:'2026-10-23T12:00:00.000Z'})
{
 const h=await setup();await h.click('water ↗');await h.click('Save discovery');assert.equal(JSON.parse(h.w.localStorage.getItem(DISCOVERY_KEY)).discoveries.length,1)
 assert.equal(h.calls.length,0);h.dom.window.close()
}
{
 const item=d(),id=item.family.nodes.at(-1).id;item.view={selectedId:id,endpoints:[id],pathOnly:true,zoom:1.25,scrollLeft:0,scrollTop:0,visited:[id],cursor:0};item.marks[id]='curious'
 const h=await setup(JSON.stringify(saveDiscovery(emptyLibrary(),item)));assert.equal(h.w.document.querySelector('textarea').value,item.note)
 assert.equal(h.w.document.querySelector('.lp-family-node[aria-pressed=true]').getAttribute('aria-label'),`${item.family.nodes.at(-1).label}, ${item.family.nodes.at(-1).lang}`)
 assert.equal(h.button('125%').textContent,'125%');assert.equal(h.calls.length,0);h.dom.window.close()
}
{
 const h=await setup('{broken');await h.click('water ↗');await h.click('Save discovery');assert.equal(h.w.localStorage.getItem(DISCOVERY_KEY),'{broken');assert.ok(h.w.document.querySelector('[role=alert]'));h.dom.window.close()
}
{
 const h=await setup();await h.click('water ↗');await h.click('Save discovery')
 const before=h.w.localStorage.getItem(DISCOVERY_KEY);const other=JSON.stringify(saveDiscovery(JSON.parse(before),{...d(),id:'other'}));h.w.localStorage.setItem(DISCOVERY_KEY,other)
 await h.click('Saved · save now');assert.equal(h.w.localStorage.getItem(DISCOVERY_KEY),other);assert.match(h.w.document.querySelector('[role=alert]').textContent,/another tab/);h.dom.window.close()
}
{
 const h=await setup();h.bridge.open({word:'agua',language:'es',context:'El agua está fría.'});await wait();assert.equal(h.calls.length,0)
 let finish;h.w.fetch=(...args)=>{h.calls.push(args);return new Promise(resolve=>{finish=resolve})}
 h.w.document.querySelector('form').dispatchEvent(new h.w.Event('submit',{bubbles:true,cancelable:true}));await wait()
 assert.deepEqual(JSON.parse(h.calls[0][1].body),{language:'es',term:'agua'})
 await h.click('mother ↗');finish({ok:true,json:async()=>({schemaVersion:1,target:{language:'es',term:'agua'},source:null,reason:'No result',choices:[]})});await wait()
 assert.equal(h.w.document.querySelector('.lp-discovery-heading h2').textContent,'motherEnglish');assert.deepEqual(h.errors,[]);h.dom.window.close()
}
const revision='https://en.wiktionary.org/w/index.php?oldid=123'
const tracedNode=(id,parent,target)=>({id,parent,label:target.term,lang:target.language==='ine-pro'?'Proto-Indo-European':'English',lookup:target,source:revision,skipped:[],...(parent&&{relation:'inherited',edgeSource:revision})})
const response=(target,child)=>({schemaVersion:1,target,source:revision,reason:'No supported continuation',choices:[{id:'etymology-1',label:'Etymology',direction:'sources',note:'Partial history',attribution:'Wiktionary CC BY-SA 4.0',verifiedOn:'2026-10-23',summary:'A sourced form',reason:'',nodes:[tracedNode('root',null,target),...(child?[tracedNode('child','root',child)]:[])]}]})
const start=async h=>{h.bridge.open({word:'water',language:'en'});await wait();h.w.document.querySelector('form').dispatchEvent(new h.w.Event('submit',{bubbles:true,cancelable:true}));await wait();await wait()}
{
 const h=await setup();h.w.fetch=async(...args)=>{h.calls.push(args);const t=JSON.parse(args[1].body);return{ok:true,json:async()=>response(t,t.term==='water'?{language:'en',term:'oldwater'}:{language:'ine-pro',term:'*wódr̥'})}}
 await start(h);assert.equal(h.calls.length,2);assert.match(h.w.document.querySelector('.lp-ancestry').textContent,/every loaded branch/)
 await h.click('View PIE root · *wódr̥ ↓');assert.equal(h.w.document.querySelector('.lp-family-node[aria-pressed=true]').textContent,'*wódr̥Proto-Indo-European')
 await h.click('Save discovery');const stored=JSON.parse(h.w.localStorage.getItem(DISCOVERY_KEY));assert.ok(stored.discoveries[0].family.nodes.some(n=>n.lang==='Proto-Indo-European'))
 assert.deepEqual(h.errors,[]);h.dom.window.close()
 const restored=await setup(JSON.stringify(stored));assert.equal(restored.calls.length,0);restored.dom.window.close()
}
{
 const h=await setup();h.w.fetch=async(...args)=>{h.calls.push(args);const t=JSON.parse(args[1].body),r=response(t,t.term==='water'?{language:'en',term:'oldwater'}:{language:'ine-pro',term:'*wódr̥'});if(t.term==='oldwater')r.choices.push({...r.choices[0],id:'etymology-2',label:'Alternative'});return{ok:true,json:async()=>r}}
 await start(h);const choice=h.w.document.querySelector('[aria-label="Choose ancestry to trace"] button');assert.ok(choice);assert.equal(h.calls.length,2)
 choice.click();await wait();assert.match(h.w.document.querySelector('.lp-ancestry').textContent,/every loaded branch/);assert.equal(h.calls.length,2);assert.deepEqual(h.errors,[]);h.dom.window.close()
}
for(const action of ['Stop tracing','mother ↗']) {
 const h=await setup();let finish;h.w.fetch=async(...args)=>{h.calls.push(args);const t=JSON.parse(args[1].body);if(t.term==='water')return{ok:true,json:async()=>response(t,{language:'en',term:'oldwater'})};return new Promise(resolve=>{finish=()=>resolve({ok:true,json:async()=>response(t,{language:'ine-pro',term:'*wódr̥'})})})}
 await start(h);assert.equal(h.calls.length,2);await h.click(action);finish();await wait();assert.deepEqual(h.errors,[])
 if(action==='Stop tracing'){assert.match(h.w.document.querySelector('.lp-ancestry').textContent,/stopped/);assert.equal(h.w.document.querySelectorAll('.lp-family-node').length,2)}
 else assert.equal(h.w.document.querySelector('.lp-discovery-heading h2').textContent,'motherEnglish')
 h.dom.window.close()
}
console.log('PASS 9 research controller scenarios: explicit save, full restore without lookup, corrupt storage, stale tab, local Anki prefill, tracing to PIE, explicit ambiguity, restored tree without lookup, stop and stale-response cancellation')
