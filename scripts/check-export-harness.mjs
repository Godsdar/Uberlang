// Controller integration checks, not a browser/layout test.
// Run with NODE_PATH pointing to a temporary jsdom installation (see validation doc).
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire, stripTypeScriptTypes } from 'node:module'
import { Script } from 'node:vm'
import { NotebookPanels } from '../web/concept/domain/panels.ts'
import { passageFromLink } from '../web/concept/domain/entry.ts'
import { lexicalMatches, parseLexicon, selectedLexicalWord } from '../web/concept/domain/lexicon.ts'
import { familyLayout } from '../web/concept/domain/graphs.ts'
import { AnalysisRequestGate, parseAnalysis, readingRanges, sentenceRequest } from '../web/concept/domain/live-analysis.ts'
import { exportDocuments } from '../web/concept/domain/reports.ts'
import { resolveSelection } from '../web/concept/domain/selection.ts'
import { conceptData } from '../web/concept/fixtures.mjs'
import { ankiFields, createAnkiDraft, serializeAnki, ankiIdentity } from '../web/concept/domain/anki.ts'
const { JSDOM } = createRequire(import.meta.url)('jsdom')
const source = readFileSync(new URL('../web/concept/concept.js', import.meta.url), 'utf8')
  .replace(/^import .*;\n/gm, '').replaceAll('import.meta.url', JSON.stringify(import.meta.url))
const launcherSource = stripTypeScriptTypes(readFileSync(new URL('../web/concept/launcher.ts', import.meta.url), 'utf8'))
  .replace(/^export /gm, '')
const ankiSources = ['anki-dialog.ts'].map(path => stripTypeScriptTypes(readFileSync(new URL('../web/concept/' + path, import.meta.url), 'utf8')).replace(/^import .*\n/gm, '').replace(/^export /gm, ''))
function setup(search = '') {
  const dom = new JSDOM('<a class="lp-skip-link" href="#lingua-concept">Skip</a><main id="lingua-concept"><section data-variant="Reading"><div class="lp" id="lingua-reading"></div></section></main>', {url:'https://test.invalid/'+search,runScripts:'outside-only'})
  const w=dom.window, document=w.document, requests=[], mounts=new Map(), errors=[]
  w.addEventListener('error', e=>errors.push(e.error))
  w.matchMedia=()=>({matches:true})
  Object.defineProperty(w, 'crypto', { value: crypto })
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true}
  w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'))}
  w.URL.createObjectURL=()=> 'blob:fixture'
  w.URL.revokeObjectURL=()=>{}
  w.HTMLElement.prototype.scrollIntoView=()=>{}
  w.scrollTo=()=>{}
  w.HTMLElement.prototype.animate=()=>{}
  Object.assign(w, {NotebookPanels,passageFromLink,lexicalMatches,parseLexicon,selectedLexicalWord,familyLayout,AnalysisRequestGate,parseAnalysis,readingRanges,sentenceRequest,exportDocuments,resolveSelection,conceptData,structuredClone,AbortController,TextEncoder,ankiFields,createAnkiDraft,serializeAnki,ankiIdentity,
    mountRootsBackup:()=>{},ResizeObserver:class {observe(){}},requestAnimationFrame:f=>f(),
    mountFamily:(el,props)=>{if(!mounts.has(el))mounts.set(el,{kind:'family',props,localState:{}})},
    mountSyntax:(el,props)=>{if(!mounts.has(el))mounts.set(el,{kind:'syntax',props,localState:{}})},
    unmountExplorers:parent=>{for(const el of mounts.keys())if(parent===el||parent.contains(el))mounts.delete(el)},
    fetch:async(...args)=>{requests.push(args);return {ok:false,status:503}}
  })
  for(const source of ankiSources)new Script(source).runInContext(dom.getInternalVMContext())
  new Script(launcherSource).runInContext(dom.getInternalVMContext())
  new Script(source).runInContext(dom.getInternalVMContext())
  const q=s=>{const el=document.querySelector(s);assert.ok(el,'Missing '+s);return el}
  const click=s=>{q(s).click();assert.deepEqual(errors,[])}
  const edit=text=>{q('[data-ui="input"]').value=text;q('[data-ui="input"]').dispatchEvent(new w.Event('input',{bubbles:true}));assert.deepEqual(errors,[])}
  const visible=s=>!q(s).closest('[hidden]')
  return {dom,w,document,q,click,edit,visible,requests,mounts,errors}
}
const settle=()=>new Promise(resolve=>setTimeout(resolve,10))

export { setup, settle }
