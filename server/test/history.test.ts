import test from 'node:test'
import assert from 'node:assert/strict'
import { createPageCache, createHistoryLookup, createLexiconLookup, parseLexicalPage } from '../src/lexicon.ts'
import { historyTarget, historyTitle } from '../../src/shared/etymology.ts'
import { buildApp } from '../src/app.ts'
import { readConfig } from '../src/config.ts'

// Small synthetic sections exercise parsing boundaries, not linguistic accuracy.
const page = (title: string, wikitext: string, revision = 123) => ({ title, wikitext, revision, timestamp: '2026-10-16T00:00:00Z', source: `https://en.wiktionary.org/w/index.php?oldid=${revision}` })
const computer = page('computer', `==English==
===Etymology===
{{af|en|compute|-er}}
===Noun===
# A device.
==French==
===Etymology===
From {{bor|fr|la|computō}}.
===Verb===
# To calculate.`)

test('history uses the requested language and shares the bounded lexical page cache', async () => {
  const calls: string[][] = []
  const cache = createPageCache(async titles => { calls.push(titles); return [computer] })
  const lexical = createLexiconLookup(undefined, cache), history = createHistoryLookup(cache)
  await lexical({ documentId: 'test', language: 'en', word: 'computer', selection: { start: 0, end: 8 } }, new AbortController().signal)
  const result = await history({ language: 'fr', term: 'computer' }, new AbortController().signal)
  assert.deepEqual(calls, [['computer']], 'one cached page serves different language sections')
  assert.equal(result.choices[0].nodes[0].lang, 'French')
  assert.equal(result.choices[0].nodes[1].label, 'computō')
  assert.deepEqual(result.choices[0].nodes[1].lookup, { language: 'la', term: 'computo' })
  assert.equal(result.choices[0].nodes[1].edgeSource, computer.source)
  assert.match(result.choices[0].nodes[1].source, /wiki\/computo#Latin/)
  const absent = await history({ language: 'ang', term: 'computer' }, new AbortController().signal)
  assert.equal(absent.choices.length, 0, 'never substitute an English section')
})

test('all etymologies remain alternatives, including unsupported continuations', async () => {
  const lookup = createHistoryLookup(createPageCache(async () => [page('bank', `==English==
===Etymology 1===
Unknown. Possibly from {{der|en|la|wrong}}.
====Noun====
# A river edge.
===Etymology 2===
From {{bor|en|fr|banque}}.
====Noun====
# A financial institution.`)]))
  const result = await lookup({ language: 'en', term: 'bank' }, new AbortController().signal)
  assert.equal(result.choices.length, 2)
  assert.equal(result.choices[0].nodes.length, 1)
  assert.ok(result.choices[0].reason)
  assert.equal(result.choices[1].summary, 'A financial institution.')
})

test('reconstruction targets use fixed namespaces and editorial marks are normalized conservatively', async () => {
  assert.equal(historyTitle(historyTarget('gem-pro', '*watōr')!), 'Reconstruction:Proto-Germanic/watōr')
  assert.equal(historyTitle(historyTarget('ang', 'bōc')!), 'boc')
  assert.equal(historyTitle(historyTarget('grc', 'βούτυρον')!), 'βούτυρον')
  const calls: string[][] = []
  const lookup = createHistoryLookup(createPageCache(async titles => { calls.push(titles); return [page(titles[0], '==Proto-Germanic==\n===Etymology===\nFrom {{inh|gem-pro|ine-pro|*wódr̥}}.')] }))
  const result = await lookup({ language: 'gem-pro', term: '*watōr' }, new AbortController().signal)
  assert.deepEqual(calls, [['Reconstruction:Proto-Germanic/watōr']])
  assert.equal(result.choices[0].nodes[1].reconstructed, true)
  for (const target of [{language:'en',term:'https://private.invalid'}, {language:'constructor',term:'test'}, {language:'en',term:'File:foo'}, {language:'en',term:'foo|bar'}, {language:'gem-pro',term:'watōr'}]) await assert.rejects(lookup(target, new AbortController().signal))
  await assert.rejects(lookup({language:'en',term:'word'}, AbortSignal.abort()))
  assert.equal(calls.length, 1, 'invalid and aborted requests perform no fetches')
})

test('language overrides and uncertain component annotations are not silently discarded', () => {
  for (const block of ['{{af|la|con-|putō|lang1=grc}}', '{{ety|la|:af|con-|putō<q:perhaps>}}', '{{ety|la|:af|con-|putō<unknown:flag>}}']) {
    assert.equal(parseLexicalPage(page('computo', `==Latin==\n===Etymology===\n${block}`), 'la').families.length, 0)
  }
})

test('history endpoint retains authentication, schema rejection and provider isolation', async () => {
  const key = 'history-test-credential-with-at-least-32-characters'
  let calls = 0
  const {app} = await buildApp(readConfig({LINGUA_API_KEY:key}), {lookupPages:async () => { calls++; return [computer] }})
  try {
    assert.equal((await app.inject({method:'POST',url:'/v1/etymology',payload:{language:'fr',term:'computer'}})).statusCode,401)
    assert.equal(calls,0)
    const headers = {authorization:`Bearer ${key}`}
    assert.equal((await app.inject({method:'POST',url:'/v1/etymology',headers,payload:{language:'fr',term:'computer',url:'https://evil.invalid'}})).statusCode,400)
    assert.equal(calls,0)
    const response = await app.inject({method:'POST',url:'/v1/etymology',headers,payload:{language:'fr',term:'computer'}})
    assert.equal(response.statusCode,200)
    assert.equal(response.json().choices[0].nodes[1].relation,'borrowed')
  } finally { await app.close() }
})

test('nested etymon annotation does not skip a cited inflected form; nonlemma is typed separately', () => {
  const french = parseLexicalPage(page('computer', '==French==\n===Etymology===\n{{etymon|fr|:lbor|la:computāre<id:computo><ety:from<la:computō>>}}'), 'fr')
  assert.equal(french.families[0].nodes[1].label, 'computāre')
  assert.equal(french.families[0].nodes.length, 2, 'nested commentary is not another automatically attached edge')
  const latin = parseLexicalPage(page('computare', '==Latin==\n===Etymology===\n{{ety|la|:from|computō|nl=1|id=computo}}'), 'la')
  assert.equal(latin.families[0].nodes[1].relation, 'form-of')
  assert.equal(parseLexicalPage(page('computare', '==Latin==\n===Etymology===\n{{ety|la|:from|computō}}'), 'la').families.length,0)
  const compound = parseLexicalPage(page('sunflower', '==English==\n===Etymology===\nFrom {{com|en|sun|flower}}. Compare {{cog|en|sunbloom}}.'))
  assert.deepEqual(compound.families[0].nodes.slice(1).map(n=>n.label), ['sun','flower'])
})

test('initial lookup keeps an unsupported homonym beside a supported history', async () => {
  const p = page('bank', '==English==\n===Etymology 1===\nUnknown origin.\n====Noun====\n# A word.\n===Etymology 2===\n{{bor|en|fr|banque}}')
  const lookup = createLexiconLookup(async()=>[p])
  const result = await lookup({documentId:'test',language:'en',word:'bank',selection:{start:0,end:4}},new AbortController().signal)
  const layer = result.layers.etymology
  assert.ok('data' in layer)
  assert.equal(layer.data.families.length,2)
  assert.equal(layer.data.families[0].nodes[0].historyState,'unavailable')
})

test('expression history preserves cited prose and uncertainty without inventing word ancestry', async () => {
  const source = page('kick the bucket', `==English==
===Etymology===
The origin is uncertain. Possibly a reference to a [[bucket]].
===Idiom===
# To die.`, 345)
  const lookup = createHistoryLookup(createPageCache(async () => [source]))
  const result = await lookup({language:'en',term:'kick the bucket'}, new AbortController().signal)
  assert.equal(result.choices[0].historyText, 'The origin is uncertain. Possibly a reference to a bucket.')
  assert.equal(result.choices[0].nodes.length, 1, 'prose is not a source edge')
  assert.equal(result.choices[0].nodes[0].source, source.source)
  assert.equal(result.choices[0].summary, 'To die.')
})

test('unsupported expression prose stays unavailable and alternative histories stay separate', async () => {
  const source = page('test phrase', `==English==
===Etymology 1===
Possibly {{unsupported|a story}}.
====Phrase====
# First meaning.
===Etymology 2===
A later expression with a different origin.
====Phrase====
# Second meaning.`)
  const lookup = createHistoryLookup(createPageCache(async () => [source]))
  const result = await lookup({language:'en',term:'test phrase'}, new AbortController().signal)
  assert.equal(result.choices.length, 2)
  assert.equal(result.choices[0].historyText, undefined)
  assert.equal(result.choices[1].historyText, 'A later expression with a different origin.')
  const absent = await createHistoryLookup(createPageCache(async()=>[]))({language:'en',term:'Birds sing near my window'},new AbortController().signal)
  assert.equal(absent.choices.length, 0)
  assert.equal(absent.source, null)
})
