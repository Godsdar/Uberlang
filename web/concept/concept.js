import { passageFromLink } from './domain/entry';
import { mountRootsBackup } from './roots-backup';
import { lexicalMatches, parseLexicon, selectedLexicalWord } from './domain/lexicon';
import { familyLayout } from './domain/graphs';
import { AnalysisRequestGate, parseAnalysis, readingRanges, sentenceRequest } from './domain/live-analysis';
import { exportDocuments } from './domain/reports';
import { resolveSelection } from './domain/selection';
import { conceptData } from './fixtures.mjs';
import { mountFamily, mountSyntax, unmountExplorers } from './components/explorers';

(() => {
  const root = document.getElementById('lingua-concept');
  mountRootsBackup();
  const linkedPassage = passageFromLink(location.search);
  const fixtures = conceptData.sentences;
  const trees = conceptData.families;
  const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const relationNames={nsubj:'subject',obj:'direct object',iobj:'recipient',aux:'auxiliary',det:'determiner',root:'root','nmod:poss':'possessor','acl:relcl':'relative clause',advmod:'modifier',cop:'copula',punct:'punctuation',dobj:'direct object',pobj:'preposition object',nsubjpass:'passive subject',auxpass:'passive auxiliary',relcl:'relative clause',prep:'preposition',ROOT:'root'};
  let saved={};try{saved=JSON.parse(localStorage.getItem('lingua-concept-preferences-v1')||'{}')||{};}catch{}
  const longText = 'Reading is easier when you can explore one small piece at a time.\n\n'+fixtures.examples.map(e=>e.text).join(' ')+'\n\nA longer document can contain many sentences, unfamiliar expressions, and words with several meanings. Instead of translating every paragraph and filling the screen with every possible analysis, choose the particular word or expression you want to understand. Keep the original context nearby. Save the explanation, grammatical relationships, and word history as a study note. Return to the document when you are ready to continue reading. Prepared examples work offline. For any other English sentence, select a word and choose Analyze sentence to request its grammar.';
  function shell(app){
    app.innerHTML=`<header class="lp-header"><div class="lp-brand"><img src="${new URL('./favicon.svg', import.meta.url).href}" width="28" height="28" alt="" aria-hidden="true"><span translate="no">UberLang</span></div><div class="lp-theme" role="group" aria-label="Color theme"><button data-theme-choice="tokyo" aria-pressed="true" aria-label="Tokyo Night theme"><span class="lp-theme-swatch" style="--swatch:#7aa2f7" aria-hidden="true"></span>Tokyo Night</button><button data-theme-choice="light" aria-pressed="false" aria-label="Light theme"><span class="lp-theme-swatch" style="--swatch:#e0cda5" aria-hidden="true"></span>Light</button><button data-theme-choice="graphite" aria-pressed="false" aria-label="Graphite theme"><span class="lp-theme-swatch" style="--swatch:#afb5c0" aria-hidden="true"></span>Graphite</button></div></header><div class="lp-shell"><h1 class="lp-intro">Word histories</h1><p class="lp-sub">Explore words, their origins, and connections across languages.</p><p class="lp-scope">Start with English. Follow supported histories across languages.</p><div class="lp-main-area"><section><details class="lp-composer"><summary>Write or paste a passage <span class="lp-label">English input · cross-language word histories</span></summary><div class="lp-composer-body"><div class="lp-editor-top"><label class="lp-label" for="${app.id}-input">English text · up to 6000 characters</label><span class="lp-label" data-ui="count"></span></div><textarea class="lp-editor" id="${app.id}-input" data-ui="input" spellcheck="false" maxlength="6000" aria-label="English text"></textarea><div class="lp-actions"><button class="lp-main" data-action="live">Analyze sentence</button><button data-action="cancel" hidden>Cancel</button><button data-action="analyze">Explore offline</button><button data-action="selection">Explore selection</button></div><p class="lp-label lp-privacy">English sentence analysis sends only the sentence around your selection or cursor (up to 50 words / 500 characters) to UberLang’s language engine. Other text stays in this browser. Prepared examples work offline.</p><div class="lp-live-status" data-ui="live-status" role="status" aria-live="polite"></div><details class="lp-model-notes" data-ui="model-notes" hidden><summary>About this analysis</summary><div data-ui="model-evidence"></div></details></div></details><div class="lp-status" data-ui="status" role="status" aria-live="polite"></div><div class="lp-section-label">Your passage <span class="lp-reading-hint">· choose a word to begin</span></div><div class="lp-source" data-ui="source" aria-label="Select a word in the source text"></div><div data-ui="phrases" class="lp-phrase-row"></div><div class="lp-lexical-actions"><div class="lp-actions"><button data-action="lexicon">Look up word</button><button data-action="cancel-lexicon" hidden>Cancel lookup</button></div><p class="lp-label">Initial lookup is for English words. It sends only the selected word or lemma through UberLang to the English-language edition of Wiktionary; source histories can cross languages.</p><div class="lp-live-status" data-ui="lexical-status" role="status" aria-live="polite"></div></div><div class="lp-example-set"><div class="lp-examples"><span>Prepared examples</span><button data-example="mother-water">a word family</button><button data-example="present-perfect-progressive">a verb phrase</button><button data-example="relative-clause">a relative clause</button><button data-example="long">a longer text</button></div><div class="lp-examples"><span>Live lookup</span><button data-live-example="sunflower">Look up sunflower ↗</button><button data-live-example="computer">Look up computer ↗</button></div></div></section><section><nav class="lp-tabs" aria-label="Analysis view"><button data-view="origins" aria-pressed="false">Word origins</button><button data-view="understand" aria-pressed="true">Understand</button><button data-view="grammar" aria-pressed="false">Grammar</button></nav><div data-ui="content"></div><div class="lp-actions"><button data-action="save">＋ Save for this session</button><button data-action="export">Export notes <span data-ui="note-count">0</span></button></div></section></div><section class="lp-notes" data-ui="notes" hidden></section><section class="lp-export" data-ui="export" hidden><div class="lp-actions"><h2 class="lp-export-title">Study notes</h2><label class="lp-label">Format <select data-action="format"><option value="markdown">Markdown</option><option value="json">JSON</option><option value="html">HTML report</option></select></label><button data-action="download">Download report</button><button data-action="copy">Copy report</button><button data-action="close-export" aria-label="Close export">Close</button></div><p class="lp-label">Includes saved fragments, context, explanations, grammar, and available origin sources.</p><div class="lp-report-preview" data-ui="report-preview" hidden></div><textarea data-ui="report" readonly aria-label="Exported study report"></textarea><div class="lp-label" data-ui="copy-status" role="status" aria-live="polite"></div></section><footer class="lp-footer"><span>Reading alpha · live grammar on request · sourced word families</span><span>English lookup and grammar · cross-language histories · prepared Russian translations</span></footer></div>`;
  }
  const persist = s => {try{localStorage.setItem('lingua-concept-preferences-v1',JSON.stringify({theme:s.theme,view:s.view}));}catch{}};
  function init(app){
    shell(app);
    const q = selector => app.querySelector(selector);
    const ui = name => q(`[data-ui="${name}"]`);
    const s={text:fixtures.examples[0].text,analyzed:'',theme:['tokyo','light','graphite'].includes(saved.theme)?saved.theme:'tokyo',view:['understand','grammar','origins'].includes(saved.view)?saved.view:'origins',start:19,end:24,context:null,token:null,phrase:null,notes:[],documents:{},format:'markdown',animation:true,live:null,liveDocument:'',pending:false,liveMessage:'',gate:new AnalysisRequestGate(),selectionSource:'reading',lexical:null,lexicalDocument:'',lexicalGate:new AnalysisRequestGate(),lexicalPending:false,lexicalMessage:'',familyId:null};
    app.dataset.theme=s.theme;syncTheme(app,s);ui('input').value=s.text;
    function stopRequest(){s.gate.invalidate();s.pending=false;s.liveMessage='';s.lexicalGate.invalidate();s.lexicalPending=false;s.lexicalMessage='';}
    function changeSelection(start,end){s.selectionSource='reading';stopRequest();ui('export').hidden=true;s.start=start;s.end=end;resolve(s);render(app,s);persist(s);}
    s.selectToken=changeSelection;
    function analyze(){stopRequest();s.live=null;ui('export').hidden=true;s.text=ui('input').value;s.analyzed=s.text;s.start=0;s.end=s.text.length;s.phrase=null;s.token=null;resolve(s);if(s.context){const example=s.context.example;const preferred=example.tokens.find(t=>t.lemma==='water')||example.tokens.find(t=>t.relation==='root');s.start=s.context.offset+preferred.start;s.end=s.context.offset+preferred.end;resolve(s);}if(wordCount(s.text)>50){s.start=0;s.end=0;resolve(s);}render(app,s);persist(s);}
    async function analyzeLive(){
      const editor=ui('input');
      let start=editor.selectionStart,end=editor.selectionEnd;
      // A selected reading token wins over the editor's old caret; explicit editor highlighting wins.
      if(start===end && s.selectionSource!=='editor' && s.text===editor.value && s.analyzed===s.text && s.end>s.start){start=s.start;end=s.end;}
      let request;
      try{request=sentenceRequest(hash(editor.value),editor.value,start,end);}catch(error){s.liveMessage=error.message;renderLiveStatus(app,s);return;}
      stopRequest();s.live=null;s.liveDocument='';s.text=editor.value;s.analyzed=s.text;
      s.start=request.contextStart+request.selection.start;s.end=request.contextStart+request.selection.end;
      s.pending=true;s.liveMessage='Analyzing this sentence… You can keep reading or cancel.';
      ui('export').hidden=true;resolve(s);render(app,s);
      const ticket=s.gate.begin();
      const timeout=setTimeout(()=>{if(ticket.current()){s.gate.invalidate();s.pending=false;s.liveMessage='Analysis took too long. Choose Analyze sentence to retry; prepared examples remain available.';renderLiveStatus(app,s);}},20000);
      try{
        const response=await fetch('/api/analysis',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(request),signal:ticket.signal,credentials:'same-origin'});
        if(!ticket.current())return;
        if(!response.ok){
          const messages={429:'The service is busy. Wait a moment, then choose Analyze sentence to retry.',413:'This sentence is too long. Choose a shorter one.',422:'Select words within one sentence. If the parser splits this text differently, try a shorter sentence.',503:'The language engine is unavailable. Choose Analyze sentence to retry; prepared examples still work offline.',504:'The language engine timed out. Choose Analyze sentence to retry.',404:'Live analysis is not configured on this deployment. Prepared examples still work offline.'};
          throw new Error(messages[response.status]||'Analysis could not be completed. Choose Analyze sentence to retry.');
        }
        const data=await response.json();if(!ticket.current())return;
        s.live=parseAnalysis(data,request);s.liveDocument=s.text;s.pending=false;s.view='grammar';
        s.liveMessage=s.live.status==='live'?'Live grammar is ready. Model predictions can be wrong; inspect the connections.':'The service returned a prepared example. No live parser was used.';
        resolve(s);render(app,s);persist(s);
      }catch(error){if(!ticket.current())return;s.pending=false;s.liveMessage=error instanceof SyntaxError?'The service returned an unreadable result. Please retry.':error.message;renderLiveStatus(app,s);}
      finally{clearTimeout(timeout);}
    }
    async function lookupLexicon(){
      const request=lexicalRequest(s);
      if(!request||s.text!==s.analyzed){s.lexicalMessage='Select one word in your reading before looking it up.';renderLexicalStatus(app,s);return;}
      stopRequest();s.lexical=null;s.lexicalPending=true;s.lexicalMessage=`Looking up “${request.word}”…`;
      ui('export').hidden=true;resolve(s);render(app,s);
      const ticket=s.lexicalGate.begin();
      const timeout=setTimeout(()=>{if(ticket.current()){s.lexicalGate.invalidate();s.lexicalPending=false;s.lexicalMessage='The dictionary took too long. Choose Look up word to retry.';renderLexicalStatus(app,s);}},20000);
      try{
        const response=await fetch('/api/lexicon',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(request),signal:ticket.signal,credentials:'same-origin'});
        if(!ticket.current())return;
        if(!response.ok)throw new Error(response.status===429?'The dictionary is busy. Wait a moment and retry.':response.status===404?'Word lookup is unavailable on this deployment.':'Word lookup could not be completed. Your grammar is still available; retry when ready.');
        const value=await response.json();if(!ticket.current())return;
        s.lexical=parseLexicon(value,request);s.lexicalDocument=s.text;s.lexicalPending=false;s.familyId=s.lexical.families[0]?.id||null;
        s.lexicalMessage=s.lexical.senses.length||s.lexical.families.length?'Dictionary evidence is ready. Definitions are alternatives; the context may allow more than one.':'No sourced result was found for this word. Nothing has been inferred.';
        if(s.view==='grammar')s.view='understand';resolve(s);render(app,s);persist(s);
      }catch(error){if(!ticket.current())return;s.lexicalPending=false;s.lexicalMessage=error instanceof SyntaxError?'The dictionary returned an unreadable result. Please retry.':error.message;renderLexicalStatus(app,s);}
      finally{clearTimeout(timeout);}
    }
    app.addEventListener('click',async event=>{
      const target=event.target.closest('button');if(!target)return;
      if(target.dataset.themeChoice){s.theme=target.dataset.themeChoice;app.dataset.theme=s.theme;syncTheme(app,s);persist(s);return;}
      if(target.dataset.liveExample){const word=target.dataset.liveExample;ui('input').value=`A ${word} catches my attention.`;s.view='origins';analyze();changeSelection(2,2+word.length);await lookupLexicon();return;}
      if(target.dataset.example){const id=target.dataset.example;ui('input').value=id==='long'?longText:fixtures.examples.find(e=>e.id===id).text;s.view=id==='mother-water'?'origins':'understand';analyze();return;}
      if(target.dataset.start!==undefined){if(s.text!==s.analyzed){ui('status').textContent='Explore the edited text before selecting from the previous reading.';return;}changeSelection(Number(target.dataset.start),Number(target.dataset.end));return;}
      if(target.dataset.phrase!==undefined){const phrase=s.context.example.phrases[Number(target.dataset.phrase)];changeSelection(s.context.offset+phrase.start,s.context.offset+phrase.end);s.view='understand';render(app,s);persist(s);return;}
      if(target.dataset.view){s.view=target.dataset.view;render(app,s);persist(s);return;}
      if(target.dataset.etymology){s.familyId=target.dataset.etymology;ui('export').hidden=true;resolve(s);renderContent(app,s);return;}
      if(target.dataset.remove){s.notes=s.notes.filter(n=>n.id!==target.dataset.remove);renderNotes(app,s);if(!s.notes.length&&(s.text!==s.analyzed||s.end<=s.start)){ui('export').hidden=true;q('[data-action="export"]').disabled=true;}else updateExport(app,s);return;}
      const action=target.dataset.action;
      if(action==='lexicon'){await lookupLexicon();return;}
      if(action==='cancel-lexicon'){s.lexicalGate.invalidate();s.lexicalPending=false;s.lexicalMessage='Word lookup cancelled.';renderLexicalStatus(app,s);return;}
      if(action==='live'){await analyzeLive();return;}
      if(action==='cancel'){stopRequest();s.liveMessage='Analysis cancelled. Your prepared examples remain available.';renderLiveStatus(app,s);return;}
      if(action==='analyze'){analyze();return;}
      if(action==='selection'){
        const editor=ui('input');let start=editor.selectionStart,end=editor.selectionEnd;
        const selection=window.getSelection();if(start===end && selection && !selection.isCollapsed && ui('source').contains(selection.anchorNode)&&ui('source').contains(selection.focusNode)){const range=selection.getRangeAt(0),prefix=document.createRange();prefix.selectNodeContents(ui('source'));prefix.setEnd(range.startContainer,range.startOffset);start=prefix.toString().length;end=start+range.toString().length;}
        if(start===end){ui('status').textContent='Highlight a word or expression in the editor or reading text first.';return;}
        s.text=editor.value;s.analyzed=s.text;changeSelection(start,end);return;
      }
      if(action==='save'){
        if(s.text!==s.analyzed){ui('status').textContent='Explore the edited text before saving an insight.';return;}
        if(s.end<=s.start){ui('status').textContent='Select a word or expression to save.';return;}
        const report=currentNote(s);if(s.notes.some(n=>n.key===report.key)){ui('status').textContent='This fragment is already in your notes.';return;}
        s.notes.push(structuredClone(report));s.documents[report.documentId]=s.text;renderNotes(app,s);if(!ui('export').hidden)updateExport(app,s);ui('status').textContent='Insight saved for this session. Export to keep it after reloading.';persist(s);return;
      }
      if(action==='export'){if(!s.notes.length&&(s.text!==s.analyzed||s.end<=s.start)){ui('status').textContent='Explore and select a fragment before exporting.';return;}ui('export').hidden=false;updateExport(app,s);ui('export').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'nearest'});return;}
      if(action==='close-export'){ui('export').hidden=true;return;}
      if(action==='download'){
        const mime={markdown:'text/markdown',json:'application/json',html:'text/html'}[s.format];
        const extension={markdown:'md',json:'json',html:'html'}[s.format];
        const blob=new Blob([ui('report').value],{type:mime+';charset=utf-8'});
        const url=URL.createObjectURL(blob),link=document.createElement('a');
        link.href=url;link.download='uberlang-study-notes.'+extension;
        link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
        ui('copy-status').textContent='Report download started.';return;
      }
      if(action==='copy'){
        const area=ui('report');try{await navigator.clipboard.writeText(area.value);ui('copy-status').textContent='Report copied.';}catch{area.focus();area.select();ui('copy-status').textContent='Report selected. Press ⌘C or Ctrl+C to copy.';}return;
      }
    });
    app.addEventListener('change',event=>{
      if(event.target.dataset.action==='format'){s.format=event.target.value;updateExport(app,s);}
    });
    ui('input').addEventListener('input',()=>{stopRequest();s.lexical=null;s.lexicalDocument='';s.live=null;s.liveDocument='';s.text=ui('input').value;renderLiveStatus(app,s);ui('export').hidden=true;ui('count').textContent=`${wordCount(s.text)} words${s.text.length>=6000?' · input limit reached':''}`;ui('status').textContent='Text changed. Explore text or a highlighted fragment to update the analysis.';ui('source').setAttribute('aria-disabled','true');q('[data-action="save"]').disabled=true;q('[data-action="export"]').disabled=!s.notes.length;renderContent(app,s);});
    ui('input').addEventListener('pointerdown',()=>{s.selectionSource='editor';});
    ui('input').addEventListener('keydown',()=>{s.selectionSource='editor';});
    ui('input').addEventListener('select',()=>{if(s.pending||s.lexicalPending){stopRequest();s.liveMessage='Selection changed. Choose an action when ready.';renderLiveStatus(app,s);}});
    ui('input').addEventListener('keydown',event=>{if(event.key==='Enter'&&(event.metaKey||event.ctrlKey)){event.preventDefault();analyze();}});
    if(linkedPassage){s.text=linkedPassage;ui('input').value=s.text;s.start=0;s.end=s.text.length;s.view='origins';}
    s.analyzed=s.text;
    resolve(s);if(!s.context && s.text===fixtures.examples[0].text){s.start=19;s.end=24;resolve(s);}render(app,s);
    const observer=new ResizeObserver(()=>{if(s.view==='origins')drawTree(app,s);});observer.observe(app);
  }
  function syncTheme(app,s){app.querySelectorAll('[data-theme-choice]').forEach(button=>{button.setAttribute('aria-pressed',String(button.dataset.themeChoice===s.theme));button.classList.add('cursor-interaction');});}
  function wordCount(text){return(text.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu)||[]).length;}
  function lexicalRequest(s){const word=selectedLexicalWord(s.text,s.start,s.end,s.token);return word?{documentId:hash(s.text),language:'en',word,selection:{start:s.start,end:s.end}}:null;}
  function currentLexical(s){const request=lexicalRequest(s);return request&&s.lexicalDocument===s.text&&lexicalMatches(s.lexical,request)?s.lexical:null;}
  function renderLexicalStatus(app,s){
    const request=lexicalRequest(s),button=app.querySelector('[data-action="lexicon"]');
    button.textContent=request?`Look up “${request.word}”`:'Look up word';button.disabled=!request||s.text!==s.analyzed||s.pending||s.lexicalPending;
    app.querySelector('[data-action="cancel-lexicon"]').hidden=!s.lexicalPending;
    const status=app.querySelector('[data-ui="lexical-status"]');status.textContent=s.lexicalMessage;status.setAttribute('aria-busy',String(s.lexicalPending));
  }
  function dictionaryPanel(s){
    const lexical=currentLexical(s);if(!lexical)return '';
    const sense=item=>`<li><span class="lp-label">${esc(item.pos)} · ${esc(lexical.families.find(f=>f.id===item.etymologyId)?.label||item.etymologyId)}</span><p>${esc(item.definition)}</p><a href="${esc(item.source)}" target="_blank" rel="noreferrer">Dictionary source ↗</a></li>`;
    return `<section class="lp-dictionary"><div class="lp-section-label">Dictionary meanings · ${esc(lexical.request.word)}</div><p class="lp-label">${esc(lexical.definitionsNote||lexical.definitionsReason)}</p><ol>${lexical.senses.slice(0,4).map(sense).join('')}</ol>${lexical.senses.length>4?`<details><summary>Other dictionary senses (${lexical.senses.length-4})</summary><ol start="5">${lexical.senses.slice(4).map(sense).join('')}</ol></details>`:''}${lexical.provenance?`<p class="lp-label">English Wiktionary contributors · <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">CC BY-SA 4.0</a> · revision ${esc(lexical.provenance.version)}</p>`:''}</section>`;
  }
  function resolve(s){
    Object.assign(s,resolveSelection(s.text,s.start,s.end,fixtures.examples,trees));
    s.analysisStatus=s.context?'prepared':'unavailable';
    if(s.live && s.liveDocument===s.text && s.start>=s.live.offset && s.end<=s.live.offset+s.live.example.text.length && s.end>s.start){
      const prepared=s.context;
      s.context={offset:s.live.offset,example:{...s.live.example,phrases:prepared?.example.phrases||[],explanation:prepared?.example.explanation||'',translation:prepared?.example.translation||''}};
      s.token=s.context.example.tokens.find(t=>s.start===s.context.offset+t.start&&s.end===s.context.offset+t.end)||null;
      s.origin=s.token?trees[s.token.lemma.toLowerCase()]||null:null;
      s.analysisStatus=s.live.status;
    }
    const lexical=currentLexical(s);s.originWord=s.token?.lemma||lexical?.request.word||s.text.slice(s.start,s.end);
    if(lexical?.families.length)s.origin=lexical.families.find(f=>f.id===s.familyId)||lexical.families[0];
  }
  function grammarLabel(s){return s.analysisStatus==='live'?`live model · ${s.live.provenance.engine}${s.live.provenance.model?' / '+s.live.provenance.model:''} · ${s.live.provenance.version}`:'prepared analysis';}
  function renderLiveStatus(app,s){
    renderLexicalStatus(app,s);
    const status=app.querySelector('[data-ui="live-status"]');status.textContent=s.liveMessage;
    const notes=app.querySelector('[data-ui="model-notes"]');notes.hidden=s.analysisStatus!=='live'||!s.live||s.liveDocument!==s.text;
    app.querySelector('[data-ui="model-evidence"]').innerHTML=notes.hidden?'':`<p>${esc(grammarLabel(s))}</p><ul>${s.live.warnings.map(w=>`<li>${esc(w)}</li>`).join('')}</ul>`;
    status.setAttribute('aria-busy',String(s.pending));
    app.querySelector('[data-action="live"]').disabled=s.pending;
    app.querySelector('[data-action="cancel"]').hidden=!s.pending;
  }
  function render(app,s){
    app.classList.toggle('lp-animation',s.animation);renderLiveStatus(app,s);
    const ui=name=>app.querySelector(`[data-ui="${name}"]`);ui('count').textContent=`${wordCount(s.text)} words${s.text.length>=6000?' · input limit reached':''}`;
    const long=wordCount(s.text)>50;
    if(s.text!==s.analyzed)ui('source').setAttribute('aria-disabled','true');else ui('source').removeAttribute('aria-disabled');
    ui('status').textContent=s.text!==s.analyzed?'Text changed. Explore text to update the analysis.':s.analysisStatus==='live'?'Live grammar · select words to inspect their connections.':long?'Long-text mode · select a word, then Analyze sentence to send only its context.':s.context?'Prepared example · explore offline, or choose Analyze sentence for a live model result.':'Select a word or place the cursor in a sentence, then choose Analyze sentence.';
    let last=0,html='';
    for(const {start,end,text} of readingRanges(s.text,s.analysisStatus==='live'?s.context:null)){html+=esc(s.text.slice(last,start));const active=start<s.end&&end>s.start;html+=`<button data-start="${start}" data-end="${end}" aria-pressed="${active}" aria-label="Explore ${esc(text)}, position ${start}">${esc(text)}</button>`;last=end;}
    html+=esc(s.text.slice(last));ui('source').innerHTML=html||'<span class="lp-muted">Your text will appear here.</span>';
    ui('phrases').innerHTML=s.context?s.context.example.phrases.map((p,i)=>`<button data-phrase="${i}">${esc(p.text)} ↗</button>`).join(''):'';
    app.querySelectorAll('[data-view]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.view===s.view)));
    app.querySelector('[data-action="save"]').disabled=s.text!==s.analyzed||!s.text.trim()||s.end<=s.start;
    app.querySelector('[data-action="export"]').disabled=!s.notes.length&&(s.text!==s.analyzed||s.end<=s.start);
    app.querySelectorAll('button,select,summary').forEach(control=>control.classList.add('cursor-interaction'));
    renderContent(app,s);renderNotes(app,s);
  }
  function inspector(s){
    const selected=s.text.slice(s.start,s.end);
    if(s.phrase)return `<aside class="lp-inspector"><div class="lp-label">Selected expression</div><p class="lp-word">${esc(selected)}</p><p>${esc(s.phrase.explanation.replace('Handcrafted demo: ',''))}</p><span class="lp-label">Offsets ${s.start}–${s.end} · prepared explanation</span></aside>`;
    if(!s.token)return `<aside class="lp-inspector"><div class="lp-label">Selected fragment</div><p class="lp-word">${esc(selected||'Choose a word')}</p><p class="lp-muted">${s.context?'Select one word for its grammatical features, or a suggested expression.':'Choose Analyze sentence for grammar. Word history is available only for sourced families.'}</p></aside>`;
    const t=s.token,head=t.head?s.context.example.tokens[t.head-1].text:'sentence root';
    return `<aside class="lp-inspector"><div class="lp-label">Selected word</div><p class="lp-word">${esc(t.text)}</p><span class="lp-label">${esc(t.pos)} · lemma ${esc(t.lemma)}</span><dl><div><dt>Relation</dt><dd>${esc(t.relation)}</dd></div><div><dt>Head</dt><dd>${esc(head)}</dd></div>${Object.entries(t.features).map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl><p>${esc(t.explanation||'Inspect the relation and features above. Grammar predictions describe structure; they do not explain every possible meaning.')}</p><span class="lp-label">Offsets ${s.start}–${s.end} · ${esc(grammarLabel(s))}</span></aside>`;
  }
  function renderContent(app,s){
    const area=app.querySelector('[data-ui="content"]');
    const focusId=area.contains(document.activeElement)?document.activeElement.dataset.focusId:null;
    const previousSyntax=s.view==='grammar'?area.querySelector('[data-ui="syntax"]'):null;
    if(previousSyntax)previousSyntax.remove();
    unmountExplorers(area);
    if(s.text!==s.analyzed){if(previousSyntax)unmountExplorers(previousSyntax);area.innerHTML='<p class="lp-empty">Explore the edited text to see its analysis.</p>';return;}
    if(s.view==='understand'){
      area.innerHTML=`<div class="lp-panels"><div class="lp-understand"><div class="lp-section-label" style="margin-top:0">${s.phrase?'The expression':s.analysisStatus==='live'&&s.live.meaning?'Sentence reading · based on grammar':'The sentence'}</div><h2>${s.phrase?'Expression in context':s.context?'Sentence reading':'Select a sentence'}</h2><p>${esc(s.phrase?s.phrase.explanation.replace('Handcrafted demo: ',''):s.analysisStatus==='live'&&s.live.meaning?s.live.meaning.explanation:s.context?.example.explanation?s.context.example.explanation.replace('Handcrafted demo: ',''):s.analysisStatus==='live'?'The grammar is ready in the Grammar view. A contextual meaning explanation is not available for this sentence. Model predictions may have alternative readings.':'Select a sentence to analyze its grammar, or try a prepared example with a meaning explanation.')}</p>${s.analysisStatus==='live'&&s.live.meaning?`<p class="lp-label">${esc(s.live.meaning.caveat)}</p>`:''}${s.context?.example.translation?`<p class="lp-label">Translation · prepared example</p><details class="lp-translation"><summary>Russian translation · prepared example</summary><p style="margin-top:10px">${esc(s.context.example.translation)}</p></details>`:''}${dictionaryPanel(s)}</div>${inspector(s)}</div>`;
    }else if(s.view==='grammar'){
      area.innerHTML=`<div class="lp-panels"><div><div class="lp-section-label" style="margin-top:0">Dependency relationships</div><h2>Sentence structure</h2>${s.context?`<div data-ui="syntax"></div><details class="lp-dependency-details"><summary>All grammatical relationships</summary><div class="lp-dependencies">${s.context.example.tokens.filter(t=>t.pos!=='PUNCT').map(t=>`<div class="lp-dep ${s.token===t?'is-current':''}"><span>${esc(t.text)}</span><span class="lp-relation">${esc(relationNames[t.relation]||t.relation)} →</span><span>${esc(t.head?s.context.example.tokens[t.head-1].text:'root')}</span></div>`).join('')}</div><p class="lp-label" style="margin-top:12px">Dependent → head · dependency labels · ${esc(grammarLabel(s))}</p></details>`:'<p class="lp-empty">Choose Analyze sentence to see live grammatical relationships, or try an offline example.</p>'}</div>${inspector(s)}</div>`;
    }else{
      const lexical=currentLexical(s);
      const choices=lexical?.families.length>1?`<div class="lp-family-choices" role="group" aria-label="Dictionary etymologies">${lexical.families.map(f=>`<button data-etymology="${esc(f.id)}" aria-pressed="${s.origin?.id===f.id}">${esc(f.label)}</button>`).join('')}</div><p class="lp-label">Separate etymologies are alternative histories; these are not branches of one family.</p>`:'';
      area.innerHTML=s.origin?`<div class="lp-section-label" style="margin-top:0">${s.origin.direction==='sources'?'Dictionary evidence':'Prepared word family'}</div><h2 class="lp-tree-title">${esc(s.originWord)}</h2>${choices}<div data-ui="tree"></div>`:`<div class="lp-panels"><div><h2>Word history</h2><p class="lp-muted">${s.phrase?'An expression does not have one word genealogy. Select a word within it to explore its origin.':lexical?(lexical.etymologyReason||'No explicit ancestry is available in this entry.'):'Select one word, then choose Look up word to explore the forms cited by English Wiktionary.'}</p><button data-example="mother-water">Explore water and mother ↗</button></div>${inspector(s)}</div>`;
      drawTree(app,s);
    }
    const syntax=area.querySelector('[data-ui="syntax"]');
    if(syntax&&s.context){
      if(previousSyntax)syntax.replaceWith(previousSyntax);
      mountSyntax(previousSyntax||syntax,{tokens:s.context.example.tokens,selectedStart:s.start,selectedEnd:s.end,offset:s.context.offset,onSelect:s.selectToken});
    }else if(previousSyntax){unmountExplorers(previousSyntax);}
    if(focusId)requestAnimationFrame(()=>area.querySelector(`[data-focus-id="${focusId}"]`)?.focus({preventScroll:true}));
  }
  function drawTree(app,s){
    const container=app.querySelector('[data-ui="tree"]');
    if(container&&s.origin){
      const lexical=currentLexical(s),familyId=s.origin.id;
      mountFamily(container,{family:s.origin,word:s.originWord,onFamilyChange:family=>{
        if(!lexical||currentLexical(s)!==lexical||s.origin?.id!==familyId)return;
        lexical.families=lexical.families.map(f=>f.id===familyId?family:f);s.origin=family;
        if(!app.querySelector('[data-ui="export"]').hidden)updateExport(app,s);
      }});
    }
  }

  function hash(text){let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}return(h>>>0).toString(16);}
  function historyVersion(s){return hash(JSON.stringify(currentLexical(s)?.families.map(f=>f.nodes.map(n=>[n.id,n.source,n.historyState,n.historyChoice]))||[]));}
  function currentNote(s){
    const lexical=currentLexical(s),meaning=s.analysisStatus==='live'&&!s.phrase?s.live.meaning:null;
    const documentId=hash(s.text),selectedText=s.text.slice(s.start,s.end),context=s.context?s.context.example.text:selectedText,explanation=s.phrase?s.phrase.explanation:meaning?meaning.explanation:s.analysisStatus==='live'?(s.context?.example.explanation||null):s.token?s.token.explanation:s.context?s.context.example.explanation:null;
    return{id:`note-${Date.now()}-${s.notes.length}`,key:`${documentId}:${s.start}:${s.end}:${s.analysisStatus}:${s.live?.provenance.version||""}:${lexical?.provenance?.version||""}:${historyVersion(s)}`,documentId,selectedText,start:s.start,end:s.end,context,contextStart:s.context?s.context.offset:s.start,explanation,explanationSource:meaning?'grammar-based':explanation?'prepared':'unavailable',meaningCaveat:meaning?.caveat||null,lexical:lexical?structuredClone(lexical):null,translation:s.context?s.context.example.translation:null,grammar:s.token?{lemma:s.token.lemma,pos:s.token.pos,features:s.token.features,head:s.token.head?s.context.example.tokens[s.token.head-1].text:null,relation:s.token.relation}:null,dependencies:s.context?s.context.example.tokens.map((t,i)=>({...t,id:i+1,start:t.start+s.context.offset,end:t.end+s.context.offset})):[],phrase:s.phrase?{text:s.phrase.text,explanation:s.phrase.explanation}:null,origin:s.origin?{...structuredClone(s.origin),word:s.originWord}:null,provenance:s.analysisStatus==='live'?`Live grammar: ${grammarLabel(s)}. Sentence reading is based on grammar; dictionary senses are alternatives. Translation, when present, is prepared. Word history has separate source evidence.`:s.context?'Prepared grammar example. Dictionary evidence, when present, is recorded separately.':'Grammar not available. Dictionary evidence, when present, is recorded separately.',analysisProvenance:s.analysisStatus==='live'?structuredClone(s.live.provenance):null,warnings:s.analysisStatus==='live'?[...s.live.warnings]:[],status:(s.analysisStatus==='live'?'live grammar':s.context?'prepared example':'grammar unavailable')+(lexical?' · sourced dictionary':''),scope:s.phrase?'expression':s.token||lexical?'word':s.context&&s.start===s.context.offset&&s.end===s.context.offset+s.context.example.text.length?'sentence':'fragment'};
  }
  function reportTree(origin){
    const leaves=origin.nodes.filter(n=>!origin.nodes.some(c=>c.parent===n.id)).map(n=>n.id);
    const layout=familyLayout(origin.nodes,leaves,origin.direction),sign=origin.direction==='sources'?-1:1;
    let svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${layout.width} ${layout.height}" role="img" aria-label="Sources of ${esc(origin.word)}" style="color:inherit"><title>${esc(origin.word)} · ${origin.direction==='sources'?'Selected word above, cited sources below':'Ancestors below, relatives above'}</title>`;
    for(const {from,to,condensed} of layout.links){const bend=(from.y+to.y)/2;svg+=`<path d="M${from.x},${from.y-sign*24} C${from.x},${bend} ${to.x},${bend} ${to.x},${to.y+sign*24}" stroke="currentColor" stroke-opacity=".5" stroke-width="2" ${condensed?'stroke-dasharray="4 5"':''} fill="none"/>${to.relation?`<text x="${(from.x+to.x)/2+8}" y="${bend}" fill="currentColor" font-size="11">${esc(to.relation)}</text>`:''}`;}
    for(const node of layout.nodes)svg+=`<text x="${node.x}" y="${node.y}" fill="currentColor" text-anchor="middle" font-family="system-ui,sans-serif" font-size="17">${esc(node.label)}</text><text x="${node.x}" y="${node.y+18}" fill="currentColor" text-anchor="middle" font-family="system-ui,sans-serif" font-size="12">${esc(node.lang)}</text>`;
    return svg+'</svg>';
  }
  function noteFamilies(n){return n.lexical?.families.length?n.lexical.families.map(f=>({...f,word:n.lexical.request.word})):n.origin?[n.origin]:[];}
  function reportDictionary(n){const lex=n.lexical;if(!lex)return '';return `<section><h3>Dictionary alternatives · ${esc(lex.request.word)}</h3><p>${esc(lex.definitionsNote||lex.definitionsReason)}</p><ol>${lex.senses.map(sense=>`<li><strong>${esc(sense.pos)}</strong> · ${esc(sense.definition)} <a href="${esc(sense.source)}" target="_blank" rel="noreferrer">Source</a><small> · ${esc(sense.etymologyId)}</small></li>`).join('')}</ol>${lex.provenance?`<p><small>${esc(lex.provenance.engine)} · revision ${esc(lex.provenance.version)} · ${esc(lex.provenance.license)} · <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">License</a></small></p>`:''}<p>${esc(lex.etymologyNote||lex.etymologyReason)}</p>${lex.warnings.map(w=>`<p><small>${esc(w)}</small></p>`).join('')}</section>`;}
  function reportOrigins(n){return noteFamilies(n).map(origin=>`<section><h3>${esc(origin.label||'Word family')}</h3>${reportTree(origin)}<small>${origin.direction==='sources'?'Selected word above · cited sources below. Components and inflected forms are not historical ancestors.':'Ancestors below · relatives above · some historical stages condensed'}</small><p>${esc(origin.note)}</p><details><summary>Forms and source evidence</summary><table><thead><tr><th>Form / language</th><th>Relation</th><th>Source</th></tr></thead><tbody>${origin.nodes.map(node=>`<tr><td>${esc(node.label)}<br>${esc(node.lang)}</td><td>${esc(node.relation|| (node.skipped.length?node.skipped.join(' → '):node.parent?'Sourced historical step':origin.direction==='sources'?'Selected word':'Oldest form in this example'))}${node.parent?`<br><small>Linked from ${esc(origin.nodes.find(p=>p.id===node.parent)?.label)}</small>`:''}${node.historyNote?`<br><small>${esc(node.historyNote)}</small>`:''}</td><td><a href="${esc(node.source)}" target="_blank" rel="noreferrer">${origin.direction==='sources'?'Source entry':'Entry'}</a>${node.edgeSource?` · <a href="${esc(node.edgeSource)}" target="_blank" rel="noreferrer">Relation</a>`:''}</td></tr>`).join('')}</tbody></table></details><small>${esc(origin.attribution)} · ${origin.direction==='sources'?'revision dated':'checked'} ${esc(origin.verifiedOn)} · <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">License</a></small></section>`).join('');}
  function dictionaryMarkdown(n){const lex=n.lexical;if(!lex)return '';return `Dictionary alternatives for ${lex.request.word}: ${lex.definitionsNote||lex.definitionsReason}\n${lex.senses.map(sense=>`- ${sense.pos}: ${sense.definition} (${sense.etymologyId}). Source: ${sense.source}`).join('\n')}\n\n${lex.provenance?`${lex.provenance.engine}, revision ${lex.provenance.version}, ${lex.provenance.license}. License: https://creativecommons.org/licenses/by-sa/4.0/\n`:''}${lex.etymologyNote||lex.etymologyReason}\n${lex.warnings.join('\n')}\n`;}
  function originsMarkdown(n){return noteFamilies(n).map(origin=>`${origin.label||'Word history'}: ${origin.note}\n${origin.direction==='sources'?'Selected word and explicitly cited sources; components and inflected forms are not historical ancestors.\n':''}${origin.nodes.map(node=>`- ${node.lang}: ${node.label}. ${node.relation?`Relation: ${node.relation}. `:''}${node.parent?'Linked from '+origin.nodes.find(p=>p.id===node.parent)?.label+'. ':''}${node.historyNote?node.historyNote+' ':''}${node.skipped.length?'Condensed stages: '+node.skipped.join(' → ')+'. ':''}${origin.direction==='sources'?'Source entry':'Entry'}: ${node.source}. Relation evidence: ${node.edgeSource||node.source}`).join('\n')}\n${origin.attribution} · ${origin.direction==='sources'?'revision dated':'checked'} ${origin.verifiedOn}. License: https://creativecommons.org/licenses/by-sa/4.0/\n`).join('\n');}
  function reportArticles(list){return list.map(n=>`<article><h2>${esc(n.selectedText)}</h2><small>${esc(n.scope)} · source ${n.documentId} · positions ${n.start}–${n.end} (UTF-16, end-exclusive)</small><p class="lp-label">${esc(n.provenance)}${n.warnings?.length?' '+esc(n.warnings.join(' ')):''}</p><blockquote>${esc(n.context)}</blockquote><p><small>${esc(n.explanationSource||'unavailable')}</small></p><p>${esc(n.explanation||'No meaning explanation available.')}</p>${n.meaningCaveat?`<p><small>${esc(n.meaningCaveat)}</small></p>`:''}${reportDictionary(n)}${n.translation?`<p>Russian translation of context: ${esc(n.translation)}</p>`:''}${n.grammar?`<p><strong>${esc(n.grammar.pos)}</strong> · lemma ${esc(n.grammar.lemma)} · ${esc(n.grammar.relation)} → ${esc(n.grammar.head||'root')}</p><p>${esc(Object.entries(n.grammar.features).map(([k,v])=>k+': '+v).join(' · '))}</p>`:''}${n.dependencies.length?`<details><summary>Grammar of the context sentence</summary><table><thead><tr><th>Word</th><th>Relation → head</th><th>Features</th></tr></thead><tbody>${n.dependencies.filter(t=>t.pos!=='PUNCT').map(t=>`<tr><td>${esc(t.text)}<br><small>${esc(t.pos)} · ${esc(t.lemma)}</small></td><td>${esc(t.relation)} → ${esc(t.head?n.dependencies[t.head-1].text:'root')}</td><td>${esc(Object.entries(t.features).map(([k,v])=>k+': '+v).join(', '))}</td></tr>`).join('')}</tbody></table></details>`:''}${reportOrigins(n)}</article>`).join('');}
  function renderNotes(app,s){const notes=app.querySelector('[data-ui="notes"]');notes.hidden=!s.notes.length;notes.innerHTML=`<div class="lp-section-label" style="margin-top:0">Study notes · this session</div><p class="lp-label">Export to keep your notes. Reloading clears this session.</p>${s.notes.map(n=>`<div class="lp-note"><div><strong>${esc(n.selectedText)}</strong><div class="lp-label">${esc(n.scope)} · ${n.start}–${n.end} · ${esc(n.status)}</div></div><button data-remove="${esc(n.id)}" aria-label="Remove note ${esc(n.selectedText)}">Remove</button></div>`).join('')}`;app.querySelector('[data-ui="note-count"]').textContent=s.notes.length;}
  function updateExport(app,s){
    const list=s.notes.length?s.notes:[currentNote(s)];let output='';
    if(s.format==='json'){const documents=exportDocuments(list,s.documents,{id:hash(s.text),text:s.text});output=JSON.stringify({application:'UberLang',schemaVersion:1,language:'en',coordinateSystem:'UTF-16, end-exclusive',provenance:'Each note records its own grammar provenance. Meaning, translation and word history are separate layers.',documents,notes:list},null,2);}
    else if(s.format==='markdown'){output='# UberLang study notes\n\nEach note records its analysis source. Positions use UTF-16, end-exclusive.\n\n'+list.map(n=>`## ${n.selectedText}\n\nSource: ${n.documentId}, positions ${n.start}–${n.end}. Scope: ${n.scope}.\n\nProvenance: ${n.provenance}${n.warnings?.length?' '+n.warnings.join(' '):''}\n\nContext: ${n.context}\n\n${n.explanationSource||'unavailable'}: ${n.explanation||'No meaning explanation available.'}\n${n.meaningCaveat||''}\n\n${dictionaryMarkdown(n)}${n.translation?'Russian translation of the context: '+n.translation+'\n\n':''}${n.grammar?'Grammar: '+n.grammar.pos+', lemma '+n.grammar.lemma+', relation '+n.grammar.relation+', head '+(n.grammar.head||'root')+'.\nFeatures: '+JSON.stringify(n.grammar.features)+'\n\n':''}${n.dependencies.length?'Context dependencies (dependent → head):\n'+n.dependencies.filter(t=>t.pos!=='PUNCT').map(t=>'- '+t.text+' ('+t.pos+'): '+t.relation+' → '+(t.head?n.dependencies[t.head-1].text:'root')).join('\n')+'\n\n':''}${originsMarkdown(n)}`).join('\n');}
    else {output='<'+'!doctype html>\n'+'<'+'html lang="en"><meta charset="utf-8"><title>UberLang study notes</title><style>body{font:16px/1.6 system-ui;max-width:850px;margin:40px auto;padding:20px;color:#263244;background:#fff}article{border-top:1px solid #ddd;padding:20px 0}table{border-collapse:collapse;width:100%}td,th{text-align:left;padding:8px;border-bottom:1px solid #eee;overflow-wrap:anywhere}small{color:#556}svg{max-width:100%;height:auto}details{margin:16px 0}@media(max-width:540px){svg{display:none}details>table{display:table}}@media print{body{margin:0}details>table{display:table}svg{break-inside:avoid}}</style><h1>UberLang study notes</h1><p>Analysis sources are recorded per note. Model predictions may be incorrect.</p>'+reportArticles(list)+'</html>';}
    const preview=app.querySelector('[data-ui="report-preview"]');preview.hidden=s.format!=='html';preview.innerHTML=s.format==='html'?reportArticles(list,preview.clientWidth):'';
    app.querySelector('[data-ui="report"]').value=output;app.querySelector('[data-ui="copy-status"]').textContent=s.notes.length?`${s.notes.length} saved ${s.notes.length===1?'insight':'insights'} in the report.`:'No saved notes yet: exporting the current selection.';
  }
  root.querySelectorAll('.lp').forEach(init);
})();
(() => {
  const layouts=document.querySelectorAll('[data-variant]');
  document.querySelectorAll('[data-layout-choice]').forEach(button=>button.addEventListener('click',()=>{
    layouts.forEach(layout=>{layout.hidden=layout.dataset.variant!==button.dataset.layoutChoice;});
    document.querySelectorAll('[data-layout-choice]').forEach(choice=>choice.setAttribute('aria-pressed',String(choice===button)));
  }));
})();

