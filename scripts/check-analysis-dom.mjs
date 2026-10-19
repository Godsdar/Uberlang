// Real notebook controller under jsdom; browser/layout evidence is separate.
import assert from 'node:assert/strict'
import { setup, settle } from './check-export-harness.mjs'
const s=setup('?q=The%20curious%20otter%20carried%20a%20silver%20spoon%20across%20the%20garden.')
const language=code=>{const select=s.q('[data-action="language"]');select.value=code;select.dispatchEvent(new s.w.Event('change',{bubbles:true}))}
const message=()=>s.q('[data-ui="live-status"]').textContent
s.click('[data-action="live"]');await settle();assert.equal(s.requests.length,0);assert.match(message(),/Choose the text language/)
s.edit('Мама читает книгу.');language('en');s.click('[data-action="live"]');await settle();assert.equal(s.requests.length,0);assert.match(message(),/No English grammar/)
language('ru');s.click('[data-action="live"]');await settle();assert.equal(s.requests.length,0);assert.match(message(),/Only the English model/)
s.click('[data-action="analyze"]');s.click('[data-start="0"]');s.click('[data-action="anki"]')
assert.equal(s.q('dialog input[name="language"]').value,'ru')
s.q('dialog').close()
s.click('[data-example="mother-water"]');const original=s.q('[data-ui="input"]').value
s.edit(original+'x');s.edit(original);s.click('[data-view="grammar"]')
assert.equal(s.q('[data-action="language"]').value,'')
assert.ok(!s.q('[data-ui="content"]').textContent.includes('prepared analysis'))
s.click('[data-action="analyze"]');s.click('[data-action="save"]');s.click('[data-action="export"]')
const format=s.q('[data-action="format"]');format.value='json';format.dispatchEvent(new s.w.Event('change',{bubbles:true}))
let note=JSON.parse(s.q('[data-ui="report"]').value).notes[0]
assert.equal(note.language,'und');assert.equal(note.grammar,null);assert.deepEqual(note.dependencies,[])
s.click('[data-analysis-example="otter"]');assert.equal(s.requests.length,0);assert.match(message(),/No prepared answer/)
s.click('[data-action="live"]');await settle();assert.equal(s.requests.length,1);assert.match(message(),/engine is unavailable/)
// Late response after language change must be ignored. Use an actual prepared
// envelope (not fabricated grammar), held until the request has been invalidated.
const {analyzeSelection}=await import('../server/src/analysis.ts')
let release
s.w.fetch=(_url,options)=>new Promise(resolve=>{release=()=>resolve({ok:true,json:async()=>analyzeSelection(JSON.parse(options.body))})})
s.click('[data-example="mother-water"]');s.click('[data-action="live"]');language('ru');release();await settle()
assert.equal(s.q('[data-action="language"]').value,'ru');assert.ok(!s.q('[data-ui="status"]').textContent.includes('Live'))
assert.equal(s.q('[data-ui="model-notes"]').hidden,true)
assert.deepEqual(s.errors,[])
s.dom.window.close()
console.log('Analysis controller checks passed: no automatic submission, language/script rejection, edit/undo invalidation, declared Anki language, input-only examples, unavailable and stale response states.')
