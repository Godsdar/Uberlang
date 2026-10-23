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
 Object.assign(w,{structuredClone,AbortController,TextEncoder}); w.matchMedia=()=>({matches:true,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}})
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
console.log('PASS 5 research controller scenarios: explicit save, full restore without lookup, corrupt storage, stale tab, local Anki prefill and late response cancellation')
