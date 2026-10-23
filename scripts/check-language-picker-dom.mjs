// Keyboard and ARIA regression checks; NODE_PATH can use the disposable QA tools.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { build } from 'esbuild'
const require=createRequire(import.meta.url),{JSDOM}=require('jsdom'),axe=require('axe-core')
const bundle=await build({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import {LanguagePicker} from './web/concept/components/language-picker.tsx';function Test(){const [value,setValue]=React.useState('en');return <form onSubmit={e=>{e.preventDefault();window.submissions++}}><LanguagePicker value={value} onChange={v=>{window.changes.push(v);setValue(v)}}/><button type="submit">Explore</button></form>}createRoot(document.querySelector('main')).render(<Test/>);`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,jsx:'automatic',format:'iife',define:{'process.env.NODE_ENV':'"production"'}})
const dom=new JSDOM('<!doctype html><html lang="en"><title>Language picker</title><main></main></html>',{url:'https://test.invalid',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,errors=[]
w.HTMLElement.prototype.scrollIntoView=()=>{};w.submissions=0;w.changes=[];w.addEventListener('error',e=>errors.push(e.error));w.eval(bundle.outputFiles[0].text);w.eval(axe.source)
const wait=()=>new Promise(resolve=>setTimeout(resolve,25));await wait()
const input=w.document.querySelector('[role=combobox]'),key=async value=>{input.dispatchEvent(new w.KeyboardEvent('keydown',{key:value,bubbles:true,cancelable:true}));await wait()},type=async value=>{Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype,'value').set.call(input,value);input.dispatchEvent(new w.Event('input',{bubbles:true}));await wait()}
const audit=async()=>{const r=await w.axe.run(w.document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag22aa']},rules:{'color-contrast':{enabled:false}}});assert.equal(r.violations.length,0,JSON.stringify(r.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.html)}))))}
await audit();input.focus();await key('ArrowDown');assert.equal(input.getAttribute('aria-expanded'),'true');await audit()
await key('ArrowDown');await key('Enter');assert.equal(input.value,'French');assert.deepEqual([...w.changes],['fr']);assert.equal(w.submissions,0)
await key('Enter');await type('proto');assert.equal(w.document.querySelectorAll('[role=option]').length,6);await audit();await key('ArrowDown');await key('ArrowDown');await key('Enter');assert.equal(input.value,'Proto-Indo-European');assert.equal(w.changes.at(-1),'ine-pro')
await key('Enter');await type('zzzz');assert.match(w.document.querySelector('[role=status]').textContent,/No matching/);await key('Enter');assert.equal(w.submissions,0);await key('Escape');assert.equal(input.value,'Proto-Indo-European');assert.equal(w.document.activeElement,input)
await key('ArrowDown');await key('Home');await key('Enter');assert.equal(input.value,'Arabic');await key('Enter');await key('End');await key('Enter');assert.equal(input.value,'Proto-West Germanic')
await key('Enter');await type('old english');w.document.querySelector('[role=option]').click();await wait();assert.equal(input.value,'Old English');assert.equal(w.document.activeElement,input)
await key('Enter');w.document.querySelector('button').dispatchEvent(new w.Event('pointerdown',{bubbles:true}));await wait();assert.equal(input.getAttribute('aria-expanded'),'false');assert.equal(input.value,'Old English')
await key('Enter');await key('Tab');assert.equal(input.getAttribute('aria-expanded'),'false');assert.equal(w.submissions,0);assert.deepEqual(errors,[]);await audit()
dom.window.close();console.log('PASS language picker: filtering, keyboard, pointer, escape, outside dismissal, tab, no accidental submit; 4 axe semantic audits (contrast checked in browser).')
