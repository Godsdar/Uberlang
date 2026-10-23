import test from 'node:test'
import assert from 'node:assert/strict'
import { createHistoryLookup, createPageCache, parseLexicalPage } from '../src/lexicon.ts'
import { parseHistory, extendHistory, extendRelatives } from '../../web/concept/domain/history.ts'
import { traceAncestry } from '../../web/concept/domain/ancestry.ts'
import { historyTarget } from '../../src/shared/etymology.ts'

const page = (title: string, wikitext: string, revision = 91215062, edition = 'en') => ({ title, wikitext, revision, timestamp: '2026-06-14T00:00:00Z', source: `https://${edition}.wiktionary.org/w/index.php?oldid=${revision}` })
// Short CC BY-SA excerpts from the cited Wiktionary revisions, inspected 2026-10-23.
const brat = page('брать', `==Russian==
===Etymology===
{{root|ru|ine-pro|*bʰer-}}
{{inh+|ru|orv|бьрати}}, from {{inh|ru|sla-pro|*bьràti||to take}}, from {{inh|ru|ine-bsl-pro|*bírāˀtei}}, from {{inh|ru|ine-pro|*bʰéreti}}, whence {{cog|en|bear}} and {{cog|fa|بردن|tr=bordan|t=to take, to carry}}.
===Verb===
# to [[take]]`)
const present = page('Reconstruction:Proto-Indo-European/bʰéreti', `==Proto-Indo-European==
===Etymology===
{{etymon|ine-pro|id=to be carrying|:af|*bʰer-<id:bear>|*-eti}}
====Descendants====
* {{desc|ine-bsl-pro|*bírāˀtei}}
** {{desc|lv|bērt}}
* {{desc|gem-pro|*beraną}}
* {{desc|grk-pro|*pʰérō}}
* {{desc|iir-pro|*bʰárati}}
* {{desc|itc-pro|*ferō}}`, 93428420)

test('брать keeps every explicitly linked stage even if the Old East Slavic entry is absent', async () => {
  const calls: string[] = []
  const lookup = createHistoryLookup(createPageCache(async titles => { calls.push(...titles); return titles[0] === 'брать' ? [brat] : titles[0].endsWith('/bʰéreti') ? [present] : [] }))
  const target = { language: 'ru', term: 'брать' }, signal = new AbortController().signal
  const result = parseHistory(await lookup(target, signal), target)
  const family = result.choices[0]
  assert.deepEqual(family.nodes.slice(0, 5).map(n => n.label), ['брать', 'бьрати', '*bьràti', '*bírāˀtei', '*bʰéreti'])
  assert.equal(family.nodes[2].parent, family.nodes[1].id)
  assert.equal(family.nodes[5].relation, 'cognate')
  assert.equal(family.nodes[5].parent, family.nodes[0].id)
  const traced = await traceAncestry(family, { signal, load: async (t, s) => parseHistory(await lookup(t, s), t), progress() {} })
  assert.ok(traced.family.nodes.some(n => n.label === '*bʰer-' && n.relation === 'component'))
  assert.ok(traced.family.nodes.some(n => n.lang === 'Proto-Germanic' && n.relation === 'descendant'))
  assert.ok(!calls.includes('бьрати'), 'a missing separate page must not erase revision-backed stages')
  assert.ok(!calls.includes('bear') && !calls.some(c => c.endsWith('/beraną')), 'relatives are never automatically crawled')
})

test('modern nested etymons preserve an unlinked intermediate form and its components', () => {
  const p = page('Reconstruction:Proto-Balto-Slavic/slaidús', `==Proto-Balto-Slavic==
===Etymology===
{{ety|ine-bsl-pro|:inh|ine-pro:<alt:*h₃sloydʰ-u-s><ety:af<ine-pro:*h₃sleydʰ-<t:to slip>><ine-pro:*-us>>}}`, 92311895)
  const family = parseLexicalPage(p, 'ine-bsl-pro', true, true).families[0]
  assert.deepEqual(family.nodes.map(n => n.label), ['*slaidús', '*h₃sloydʰ-u-s', '*h₃sleydʰ-', '*-us'])
  assert.equal(family.nodes[2].parent, family.nodes[1].id)
  assert.equal(family.nodes[2].relation, 'component')
  assert.ok(family.nodes.slice(1).every(n => n.edgeSource === p.source))
})

test('исследовать uses a bounded, cached Russian fallback with separate template revision and a visible gap', async () => {
  const russian = page('исследовать', '= {{-ru-}} =\n=== Этимология ===\nПроисходит от {{этимология:след|да}}\n=== Перевод ===\n', 13633642, 'ru')
  const template = page('Шаблон:этимология:след', '{{праслав|[[*slědъ]]}} {{lang|ru|след}}', 11760808, 'ru')
  const calls: string[] = []
  const lookup = createHistoryLookup(createPageCache(async () => []), createPageCache(async titles => { calls.push(...titles); return [titles[0] === russian.title ? russian : template] }))
  const target = { language: 'ru', term: 'исследовать' }, signal = new AbortController().signal
  const first = parseHistory(await lookup(target, signal), target)
  await lookup(target, signal)
  assert.deepEqual(calls, ['исследовать', 'Шаблон:этимология:след'])
  const n = first.choices[0].nodes[1]
  assert.equal(n.label, '*slědъ'); assert.equal(n.relation, 'derived'); assert.equal(n.condensed, true)
  assert.equal(n.edgeSource, template.source); assert.equal(first.source, russian.source)
  assert.ok(n.skipped.length)
  await assert.rejects(lookup(target, AbortSignal.abort()))
  assert.equal(calls.length, 2)
})

test('negated, uncertain and unrelated templates never become family ancestry', () => {
  for (const block of ['Possibly {{ety|ru|:inh|sla-pro:*test}}', '{{ety|ru|:inh|sla-pro:*test<q:perhaps>}}', '{{ety|ru|:inh|sla-pro:*test<ety:unknown<ine-pro:*bad>>>}}', 'Not from {{inh|ru|sla-pro|*test}}.']) {
    assert.equal(parseLexicalPage(page('test', `==Russian==\n===Etymology===\n${block}`), 'ru', true, true).families[0].nodes.length, 1)
  }
  const f = parseLexicalPage(page('test', '==Russian==\n===Etymology===\n{{inh|ru|orv|word}}. Compare {{inh|ru|sla-pro|*other}}.'), 'ru', true, true).families[0]
  assert.equal(f.nodes.length, 2)
})

test('descendant list nesting and borrowing survive continuation and repeated family loading', async () => {
  const p = page('test', '==English==\n===Etymology===\nUnknown origin.\n====Descendants====\n* {{desc|fr|forme|bor=1}}\n** {{desc|es|forma}}\n* {{desc|de|Wort|unc=1}}\n** {{desc|nl|woord}}')
  const target = { language: 'en', term: 'test' }, lookup = createHistoryLookup(createPageCache(async () => [p]))
  const result = parseHistory(await lookup(target, new AbortController().signal), target)
  const family = result.choices[0]
  assert.equal(family.nodes.length, 3)
  assert.equal(family.nodes[1].relation, 'descendant-borrowed')
  assert.equal(family.nodes[2].parent, family.nodes[1].id)
  const parent = { ...family, nodes: [{ ...family.nodes[0], id: 'outer' }, { ...family.nodes[0], id: 'inner', parent: 'outer', relation: 'derived' as const, edgeSource: p.source, historyState: undefined }] }
  const extended = extendHistory(parent, 'inner', result)
  assert.equal(extended.nodes[3].parent, extended.nodes[2].id)
  const relatives = extendRelatives(parent, 'inner', result)
  assert.equal(extendRelatives(relatives, 'inner', result).nodes.length, relatives.nodes.length)
  assert.equal(historyTarget('ru', 'вы́бор')?.term, 'выбор')
  assert.equal(historyTarget('sla-pro', '*bьràti')?.term, '*bьrati')
})

test('family expansion cannot merge a different etymology into an existing source path', async () => {
  const target = {language:'ru',term:'брать'}, lookup = createHistoryLookup(createPageCache(async()=>[brat]))
  const result = parseHistory(await lookup(target,new AbortController().signal),target)
  const alternative = {...result.choices[0],id:'etymology-2'}
  const ambiguous = {...result,choices:[result.choices[0],alternative]}
  assert.throws(()=>extendRelatives(result.choices[0],result.choices[0].nodes[0].id,ambiguous,'etymology-2'),/different etymology/)
  const uncertain=page('test','==Russian==\n===Etymology===\n{{ety|ru|:inh|sla-pro:*test|unc=1}}')
  assert.equal(parseLexicalPage(uncertain,'ru',true,true).families[0].nodes.length,1)
})
