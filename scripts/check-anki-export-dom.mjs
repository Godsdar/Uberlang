// Actual notebook/controller/dialog and injected AnkiConnect transport. No collection is accessed.
import assert from 'node:assert/strict'
import { setup, settle } from './check-export-harness.mjs'

async function until(predicate) {
  for (let i=0;i<50;i++) { if(predicate()) return; await settle() }
  assert.ok(predicate(), 'UI did not settle')
}
function change(h, selector, value) {
  const input=h.q(selector); input.value=value
  input.dispatchEvent(new h.w.Event(input.tagName==='SELECT'?'change':'input',{bubbles:true}))
}
let checks=0
async function check(name,run) { await run();checks++;console.log('PASS '+name) }
await check('Anki draft is local, validates missing answer and previews hostile text without HTML execution',async()=>{
  const h=setup('#direct');h.q('[data-action="anki"]').focus();h.click('[data-action="anki"]')
  assert.equal(h.q('dialog').open,true);assert.equal(h.requests.length,0)
  change(h,'[name="answer"]','');assert.equal(h.q('[type="submit"]').disabled,true)
  change(h,'[name="answer"]','<script>private()</script> & water')
  assert.equal(h.q('[type="submit"]').disabled,false)
  h.click('dialog details:nth-of-type(3)>summary')
  assert.equal(h.q('[data-anki-back]').querySelector('script'),null)
  assert.match(h.q('[data-anki-back]').textContent,/<script>private/)
  h.click('[data-anki-close]');assert.equal(h.q('dialog').open,false)
  assert.equal(h.document.activeElement,h.q('[data-action="anki"]'))
  h.dom.window.close()
})
await check('saved occurrence creates a sourced card after edit while current stale Anki action stays disabled',async()=>{
  const h=setup('?q=water%20water#direct');h.click('[data-action="analyze"]');h.click('[data-start="6"]');h.click('[data-action="save"]')
  h.edit('an unsaved replacement');assert.equal(h.q('[data-action="anki"]').disabled,true)
  h.click('.lp-notes-disclosure>summary');h.click('[data-anki-note]')
  assert.equal(h.q('[name="context"]').value,'water water')
  assert.match(h.q('[data-anki-evidence]').textContent,/\[6,11\)/)
  assert.doesNotMatch(h.q('[data-anki-evidence]').textContent,/unsaved replacement/)
  assert.equal(h.requests.length,0);h.dom.window.close()
})
await check('download creates one valid text file, warns about repeat and permits explicit re-download',async()=>{
  const h=setup('#direct'),downloads=[],files=[]
  h.w.Blob=Blob;h.w.URL.createObjectURL=blob=>{files.push(blob);return 'blob:fixture'}
  h.w.HTMLAnchorElement.prototype.click=function(){downloads.push(this.download)}
  h.click('[data-action="anki"]');h.click('dialog [type="submit"]')
  assert.deepEqual(downloads,['uberlang-anki-card.txt'])
  assert.match(await files[0].text(),/#html:false/)
  assert.equal(h.q('[type="submit"]').disabled,true)
  assert.match(h.q('[data-anki-status]').textContent,/Download started/)
  h.click('[data-anki-redownload]');assert.equal(downloads.length,2)
  change(h,'[name="answer"]','A changed answer');assert.equal(h.q('[type="submit"]').disabled,true)
  change(h,'[name="context"]','A different example');assert.equal(h.q('[type="submit"]').disabled,false)
  h.dom.window.close()
})
console.log(`${checks} isolated export scenarios passed.`)
