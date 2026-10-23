import { historyLanguages as names, historyTarget, historyTitle, type HistoryTarget } from '../../src/shared/etymology.ts'
import { queryWiktionaryPages, type WiktionaryPage } from '../../src/core/wiktionary.ts'
import { ServiceError } from './errors.ts'

export interface LexiconInput { documentId: string; language: 'en'; word: string; selection: { start: number; end: number } }
export type LookupPages = (titles: string[], signal?: AbortSignal) => Promise<WiktionaryPage[]>
const attribution = 'Wiktionary contributors · CC BY-SA 4.0. Definitions and source relationships adapted from the cited revision.'
const relations: Record<string, string> = { inh: 'inherited', inherited: 'inherited', bor: 'borrowed', borrowed: 'borrowed', lbor: 'borrowed', ubor: 'borrowed', slbor: 'borrowed', der: 'derived', derived: 'derived' }
const posNames = new Set(['Noun', 'Verb', 'Adjective', 'Adverb', 'Pronoun', 'Determiner', 'Preposition', 'Conjunction', 'Interjection', 'Proper noun', 'Numeral', 'Particle', 'Article'])

function templates(text: string): { raw: string; args: string[]; index: number }[] {
  const out = []; let depth = 0; let start = 0
  for (let i = 0; i < text.length - 1; i++) {
    const pair = text.slice(i, i + 2)
    if (pair === '{{') { if (!depth) start = i; depth++; i++ }
    else if (pair === '}}' && depth) { depth--; i++; if (!depth) {
      const raw = text.slice(start, i + 1); const inner = raw.slice(2, -2)
      const args: string[] = []; let part = ''; let nesting = 0
      for (let j = 0; j < inner.length; j++) {
        const two = inner.slice(j, j + 2)
        if (two === '{{' || two === '[[') { nesting++; part += two; j++ }
        else if (two === '}}' || two === ']]') { nesting--; part += two; j++ }
        else if (inner[j] === '|' && nesting === 0) { args.push(part.trim()); part = '' }
        else part += inner[j]
      }
      args.push(part.trim()); out.push({ raw, args, index: start })
    } }
  }
  return out
}

/** Deliberately small wikitext renderer: unsupported templates discard that sense. */
function plain(text: string): string | undefined {
  let value = text.replace(/<!--[\s\S]*?-->/g, '').replace(/<ref\b[^>]*>[\s\S]*?<\/ref>|<ref\b[^>]*\/>/gi, '')
  for (const template of templates(value)) {
    const [name, ...args] = template.args
    let rendered: string | undefined
    if (['lb', 'label', 'context'].includes(name)) rendered = `(${args.slice(1).filter(a => !a.includes('=')).join(', ')})`
    else if (['senseid', 'sid', 'senseno', 'sno', 'defdate'].includes(name)) rendered = ''
    else if (['l', 'm', 'm+', 'mention', 'link'].includes(name)) rendered = args[2] || args[1]
    else if (['w', 'wikipedia'].includes(name)) rendered = args[1] || args[0]
    else if (['gloss', 'glossary', 'non-gloss definition', 'ngd', 'small', 'nowrap', 'nobr', 'vern'].includes(name)) rendered = args[0]
    else if (name === 'taxfmt') rendered = args[0]
    else if (name === 'qualifier' || name === 'q') rendered = `(${args.join(', ')})`
    if (rendered === undefined || rendered.includes('{{')) return undefined
    value = value.replace(template.raw, rendered)
  }
  value = value.replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1').replace(/'{2,}/g, '').replace(/<\/?(?:i|b|span|sup|sub)\b[^>]*>/g, '').replace(/\s+/g, ' ').trim()
  if (/[{}<>]|\[https?:|&[a-z#]/i.test(value)) return undefined
  return value || undefined
}

interface LexicalNode { lookup?: HistoryTarget; historyState?: 'unavailable'; historyNote?: string; id: string; parent: string | null; label: string; lang: string; source: string; skipped: string[]; edgeSource?: string; reconstructed?: boolean; relation?: string }
interface SourceTerm { label: string; lang: string; relation: string; parentIndex?: number; condensed?: boolean }
function immediateSources(block: string, languageCode = 'en'): SourceTerm[] {
  const clean = block.replace(/<!--[\s\S]*?-->/g, '').replace(/<ref\b[^>]*>[\s\S]*?<\/ref>/gi, '')
  const all = templates(clean)
  const structured = all.filter(({ args }) => ['ety', 'etymon'].includes(args[0].toLowerCase()) && args[1] === languageCode)
  // A declared etymon is authoritative. Unsupported or uncertain structures never fall through to prose.
  const candidates = structured.length ? structured.slice(0, 1) : all
  // Only explicit source templates; cognates, roots, comparisons and uncertain prose are not edges.
  for (const candidate of candidates) {
    const { index } = candidate
    // A nested ety annotation may describe a further step. Keep only the outer
    // cited form; its own entry must establish any continuation.
    const args = candidate.args.map(a => a.replace(/<ety:from<[a-z-]+:[^<>]+>>/g, ''))
    const name = args[0].toLowerCase().replace(/\+$/, '')
    // Cross-language overrides and unrecognised modifiers need a richer parser.
    if (args.some(a => /^lang\d*=/.test(a) || [...a.matchAll(/<([^:>]+)(?::[^>]*)?>/g)].some(m => !['id', 't', 'tr', 'alt', 'pos', 'g'].includes(m[1])))) return []
    if (args.some(a => /(?:^|<)(?:unc|uncertain|q|qq|qual|qualifier)(?:[:=>]|$)/i.test(a))) return []
    if (/\b(?:not|never|unrelated|possibly|perhaps|probably|uncertain|unknown|disputed|thought to|compare|cognate)\b/i.test(clean.slice(Math.max(0, index - 120), index))) return []
    if ((name === 'ety' || name === 'etymon') && args[1] === languageCode) {
      const operation = args.findIndex(a => a.startsWith(':'))
      if (operation < 0) continue
      const mode = args[operation].slice(1)
      const terms = args.slice(operation + 1).filter(a => a && !a.includes('='))
      if (mode === 'af' || mode === 'compound' || mode === 'com') return terms.slice(0, 5).map(a => ({ label: a.replace(/<[^>]*>/g, ''), lang: languageCode, relation: 'component' })).filter(t => t.label && t.label !== '-' && !t.label.includes(':'))
      if (mode === 'from' && args.includes('nl=1') && terms.length === 1 && !terms[0].includes(':')) {
        const label = plain(terms[0]); if (label && label !== '-') return [{ lang: languageCode, label, relation: 'form-of' }]
      }
      if (relations[mode] && terms.length === 1) {
        const match = /^([a-z][a-z-]*):([^<>]+)(?:<[^>]*>)*$/.exec(terms[0])
        if (match && match[2] !== '-') return [{ lang: match[1], label: match[2], relation: relations[mode] }]
      }
      continue
    }
    if (relations[name] && args[1] === languageCode) {
      const label = plain(args[3] ?? '')
      if (label && label !== '-' && /^[a-z][a-z-]*$/.test(args[2] ?? '')) return [{ lang: args[2], label, relation: relations[name] }]
    }
    if (['affix', 'af', 'suffix', 'prefix', 'compound', 'com'].includes(name) && args[1] === languageCode) {
      const components = args.slice(2).filter(a => a && !a.includes('='))
      return components.slice(0, 5).flatMap((a, i) => {
        const label = plain(a)
        return label && label !== '-' ? [{ lang: languageCode, label: name === 'suffix' && i === 1 ? '-' + label.replace(/^-/, '') : name === 'prefix' && i === 0 ? label.replace(/-$/, '') + '-' : label, relation: 'component' }] : []
      })
    }
  }
  return []
}

/** Balanced modern etymon annotations preserve each explicitly nested stage. */
function annotatedTerm(value: string): { base: string; modifiers: string[] } | undefined {
  const first = value.indexOf('<')
  if (first < 0) return { base: value, modifiers: [] }
  const modifiers: string[] = []; let depth = 0, start = first
  for (let i = first; i < value.length; i++) {
    if (value[i] === '<') { if (!depth) start = i + 1; depth++ }
    else if (value[i] === '>') { if (!depth) return; if (!--depth) modifiers.push(value.slice(start, i)) }
    else if (!depth) return
  }
  return depth ? undefined : { base: value.slice(0, first), modifiers }
}
function structuredSources(block: string, code: string): SourceTerm[] | undefined {
  const entry = templates(block).find(t => ['ety', 'etymon'].includes(t.args[0]) && t.args[1] === code)
  if (!entry) return
  if (/\b(?:not|never|possibly|perhaps|probably|uncertain|unknown|disputed)\b/i.test(block.slice(Math.max(0, entry.index - 120), entry.index))) return []
  const operation = entry.args.findIndex(a => a.startsWith(':'))
  if (operation < 0) return []
  const result: SourceTerm[] = []
  function add(value: string, relation: string, parentIndex?: number, defaultLanguage = code): boolean {
    const parsed = annotatedTerm(value)
    if (!parsed || parsed.modifiers.some(m => !/^(id|t|tr|alt|pos|g|ety):/.test(m))) return false
    const qualified = /^([a-z][a-z-]*):(.*)$/.exec(parsed.base)
    const lang = qualified?.[1] ?? defaultLanguage
    const label = (qualified ? qualified[2] : parsed.base) || parsed.modifiers.find(m => m.startsWith('alt:'))?.slice(4)
    if (!label || label === '-' || /[{}<>:]/.test(label)) return false
    const index = result.length
    if (index >= 7) return false
    result.push({ label, lang, relation, ...(parentIndex !== undefined && { parentIndex }) })
    const nested = parsed.modifiers.filter(m => m.startsWith('ety:'))
    if (nested.length > 1) return false
    if (nested.length) {
      const operation = annotatedTerm(nested[0].slice(4))
      if (!operation || !operation.modifiers.length) return false
      const mode = operation.base
      // Generic nested `from` does not establish whether this is inflection or derivation.
      if (mode === 'from') return true
      const nextRelation = relations[mode] ?? (['af', 'com', 'compound'].includes(mode) ? 'component' : undefined)
      if (!nextRelation || (!['af', 'com', 'compound'].includes(mode) && operation.modifiers.length !== 1)) return false
      for (const term of operation.modifiers) if (!add(term, nextRelation, index, lang)) return false
    }
    return true
  }
  const mode = entry.args[operation].slice(1)
  const relation = relations[mode] ?? (['af', 'com', 'compound'].includes(mode) ? 'component' : mode === 'from' && entry.args.includes('nl=1') ? 'form-of' : undefined)
  if (!relation || entry.args.some(a => /^(?:lang\d*|unc|uncertain|q|qq|qual|qualifier)=/.test(a))) return []
  const terms = entry.args.slice(operation + 1).filter(a => a && !a.includes('='))
  if (relation !== 'component' && terms.length !== 1) return []
  return terms.every(t => add(t, relation)) ? result : []
}

/** A prose chain is accepted only when each next citation is joined by “from”. */
function citedChain(block: string, code: string): SourceTerm[] {
  const structured = structuredSources(block, code)
  const immediate = structured ?? immediateSources(block, code)
  if (immediate.length !== 1 || !['inherited', 'borrowed', 'derived'].includes(immediate[0].relation)) return immediate
  const all = templates(block)
  let previous = all.find(t => relations[t.args[0].replace(/\+$/, '')] && t.args[1] === code && t.args[2] === immediate[0].lang && t.args[3] === immediate[0].label)
  if (!previous) return immediate
  const chain = [...immediate]
  for (const next of all.filter(t => t.index > previous!.index)) {
    const join = block.slice(previous.index + previous.raw.length, next.index)
    if (!/^\s*,?\s*from\s+$/i.test(join)) break
    const relation = relations[next.args[0].replace(/\+$/, '')]
    const label = plain(next.args[3] ?? '')
    if (!relation || next.args[1] !== code || !label || !historyTarget(next.args[2], label) || next.args.some(a => /(?:unc|q|qual)=/.test(a))) break
    chain.push({ label, lang: next.args[2], relation, parentIndex: chain.length - 1 })
    previous = next
    if (chain.length >= 7) break
  }
  return chain
}

const uncertain = /\b(?:not|never|unrelated|possibly|perhaps|probably|uncertain|unknown|disputed)\b|(?:unc|q|qual)=|<q:|\?/i
function relatives(block: string, _code: string, section: string): SourceTerm[] {
  const result: SourceTerm[] = []
  // Keep list nesting. A language-only group is transparent; an unparsed form
  // blocks its subtree so grandchildren are never promoted to direct children.
  const stack: { depth: number; index: number | null }[] = []
  for (const line of block.split('\n')) {
    const depth = /^(\*+)/.exec(line)?.[1].length ?? 0
    while (stack.length && stack.at(-1)!.depth >= depth) stack.pop()
    if (uncertain.test(line)) { if (depth) stack.push({ depth, index: null }); continue }
    let added: number | undefined
    for (const t of templates(line)) {
      const [name, lang, term] = t.args
      const descendant = ['desc', 'desctree'].includes(name)
      const linked = ['l', 'link'].includes(name) && ['Derived terms', 'Related terms'].includes(section)
      const cognate = ['cog', 'cognate'].includes(name) && section === 'Etymology'
      if (!descendant && !linked && !cognate) continue
      if (descendant && section !== 'Descendants' && section !== 'Derived terms') continue
      if (!term || !historyTarget(lang, term)) { if (term && depth) stack.push({ depth, index: null }); continue }
      if (stack.some(s => s.index === null)) continue
      const parentIndex = stack.at(-1)?.index ?? undefined
      added = result.length
      result.push({ lang, label: term, relation: descendant ? t.args.includes('bor=1') ? 'descendant-borrowed' : t.args.includes('der=1') ? 'derivative' : 'descendant' : cognate ? 'cognate' : section === 'Derived terms' ? 'derivative' : 'related', ...(parentIndex !== undefined && { parentIndex }) })
      if (result.length >= 10) return result
    }
    if (depth && added !== undefined) stack.push({ depth, index: added })
    // A plain language grouping has no asserted lexical stage.
    else if (depth && templates(line).some(t => ['l', 'm'].includes(t.args[0]))) stack.push({ depth, index: null })
  }
  return result
}

function termNode(term: SourceTerm, id: string, parent: string, page: WiktionaryPage): LexicalNode {
  const lookup = historyTarget(term.lang, term.label)
  return { id, parent, label: term.label, lang: names[term.lang] ?? term.lang, lookup,
    source: lookup ? `https://en.wiktionary.org/wiki/${encodeURIComponent(historyTitle(lookup))}#${encodeURIComponent(names[term.lang].replaceAll(' ', '_'))}` : page.source,
    edgeSource: page.source, reconstructed: term.label.startsWith('*'), relation: term.relation, skipped: [] }
}

export function parseLexicalPage(page: WiktionaryPage, languageCode = 'en', includeEmpty = false, includeFamily = false) {
  const languageName = names[languageCode]
  const language = languageName && [...page.wikitext.matchAll(/^==\s*([^=\n]+?)\s*==\s*$/gm)].find(m => m[1].trim() === languageName)
  if (!language) return { senses: [], families: [], omittedSenses: 0 }
  const tail = page.wikitext.slice(language.index + language[0].length)
  const english = tail.split(/^==[^=].*?==\s*$/m)[0]
  const headings = [...english.matchAll(/^(={3,6})\s*(.*?)\s*\1\s*$/gm)]
  let etymologyId = 'etymology-1'; let etymologyLabel = 'Etymology'; let pos = ''
  const senses: { id: string; pos: string; definition: string; source: string; etymologyId: string }[] = []
  const families = []; let omittedSenses = 0
  for (let i = 0; i < headings.length; i++) {
    const heading = headings[i]; const title = heading[2].trim()
    const block = english.slice(heading.index! + heading[0].length, headings[i + 1]?.index ?? english.length)
    if (/^Etymology(?: \d+)?$/.test(title)) {
      etymologyLabel = title; etymologyId = `etymology-${title.match(/\d+/)?.[0] ?? 1}`; pos = ''
      const terms = includeFamily ? citedChain(block, languageCode) : immediateSources(block, languageCode)
      if ((terms.length || includeEmpty) && families.length < 8) {
        const root = `${etymologyId}-word`
        families.push({ id: etymologyId, label: etymologyLabel, direction: 'sources',
          nodes: [{ id: root, parent: null as string | null, label: page.title.replace(/^Reconstruction:[^/]+\//, '*'), lang: languageName, ...(!terms.length && { historyState: 'unavailable' as const, historyNote: 'No supported, certain continuation was found in this etymology.' }), lookup: historyTarget(languageCode, page.title.replace(/^Reconstruction:[^/]+\//, '*')), source: page.source, skipped: [] as string[] },
            ...terms.map((term, n) => termNode(term, `${etymologyId}-source-${n + 1}`, term.parentIndex === undefined ? root : `${etymologyId}-source-${term.parentIndex + 1}`, page))] as LexicalNode[],
          note: 'Explicitly cited history and selected relatives. Inheritance points toward an older source; descendant and derivative branches point toward later forms. Cognates and related terms are lateral links, not ancestors. This partial graph omits unsupported or uncertain relationships. This group is not automatically matched to the sentence meaning.',
          attribution, verifiedOn: page.timestamp.slice(0, 10) })
      }
      if (includeFamily && families.at(-1)?.id === etymologyId) {
        const family = families.at(-1)!, root = family.nodes[0].id
        const related = relatives(block, languageCode, 'Etymology')
        family.nodes.push(...related.map((t, n) => termNode(t, `${etymologyId}-relative-${n}`, root, page)))
      }
    } else if (includeFamily && ['Descendants', 'Derived terms', 'Related terms'].includes(title)) {
      if (!families.length && includeEmpty) {
        families.push({ id: etymologyId, label: 'Word family', direction: 'sources', nodes: [{ id: `${etymologyId}-word`, parent: null, label: page.title.replace(/^Reconstruction:[^/]+\//, '*'), lang: languageName, lookup: historyTarget(languageCode, page.title.replace(/^Reconstruction:[^/]+\//, '*')), source: page.source, skipped: [] }], note: 'Explicitly listed relatives; this entry does not establish an earlier ancestor.', attribution, verifiedOn: page.timestamp.slice(0, 10) })
      }
      const family = families.find(f => f.id === etymologyId)
      if (family) {
        const related = relatives(block, languageCode, title).slice(0, Math.max(0, 18 - family.nodes.length))
        const prefix = `${etymologyId}-${i}-relative-`
        family.nodes.push(...related.map((t, n) => termNode(t, prefix + n, t.parentIndex === undefined ? family.nodes[0].id : prefix + t.parentIndex, page)))
      }
    } else if (posNames.has(title)) {
      pos = title
      for (const match of block.matchAll(/^#{1,4} (.+)$/gm)) {
        if (match[1].length > 5000) { omittedSenses++; continue }
        const definition = plain(match[1])
        if (!definition || definition.length > 1200) { omittedSenses++; continue }
        if (senses.length < 18) senses.push({ id: `sense-${senses.length + 1}`, pos, definition, source: page.source, etymologyId })
        else omittedSenses++
      }
    } else pos = ''
  }
  return { senses, families: families.slice(0, 8), omittedSenses }
}

export function createPageCache(fetchPages: LookupPages = queryWiktionaryPages) {
  const cache = new Map<string, { expires: number; page: WiktionaryPage }>()
  let cacheCharacters = 0
  return async (key: string, signal: AbortSignal) => {
    signal.throwIfAborted()
    let page = cache.get(key)?.expires! > Date.now() ? cache.get(key)!.page : undefined
    if (!page) {
      const pages = await fetchPages([key], signal)
      page = pages[0]
      if (page && page.wikitext.length > 500000) return undefined
      if (page && page.wikitext.length <= 500000) {
        cacheCharacters -= cache.get(key)?.page.wikitext.length ?? 0
        cache.set(key, { expires: Date.now() + 3600000, page })
        cacheCharacters += page.wikitext.length
        while (cache.size > 128 || cacheCharacters > 2000000) {
          const oldest = cache.keys().next().value!
          cacheCharacters -= cache.get(oldest)!.page.wikitext.length
          cache.delete(oldest)
        }
      }
    }
    signal.throwIfAborted()
    return page
  }
}

export function createLexiconLookup(fetchPages: LookupPages = queryWiktionaryPages, load = createPageCache(fetchPages)) {
  return async (input: LexiconInput, signal: AbortSignal) => {
    if (!/^[\p{L}]+(?:['’ -][\p{L}]+)*$/u.test(input.word) || input.word.length > 80 || input.selection.end <= input.selection.start || input.selection.end - input.selection.start > 500) throw new ServiceError(400, 'INVALID_SELECTION', 'Select one word for dictionary lookup')
    signal.throwIfAborted()
    const page = await load(input.word.normalize('NFC'), signal)
    const unavailable = (reason: string) => ({ status: 'unavailable', reason })
    const parsed = page ? parseLexicalPage(page, 'en', true) : { senses: [], families: [], omittedSenses: 0 }
    // Keep unsupported alternatives when another history is available; never hide
    // a homonym just because its templates cannot be extracted.
    if (!parsed.families.some(f => f.nodes.length > 1)) parsed.families = []
    const provenance = page ? { engine: 'English Wiktionary', version: String(page.revision), source: page.source, live: true, license: 'CC BY-SA 4.0' } : undefined
    return { schemaVersion: 1, documentId: input.documentId, word: input.word, selection: input.selection, coordinateSystem: 'UTF-16, end-exclusive', layers: {
      definitions: parsed.senses.length ? { status: 'sourced', provenance, data: { senses: parsed.senses, attribution, note: `Dictionary alternatives, not a disambiguated sentence meaning.${parsed.omittedSenses ? ' Additional or unsupported senses are omitted; consult the source.' : ''}` } } : unavailable('No supported English dictionary senses were found. The source may use unsupported formatting.'),
      etymology: parsed.families.length ? { status: 'sourced', provenance, data: { families: parsed.families, attribution, verifiedOn: page!.timestamp.slice(0, 10), note: 'Separate etymologies are alternatives. No automatic sense or ancestry choice is made.' } } : unavailable('No explicit, supported source relationship was found. Unknown ancestry is not inferred.')
    } }
  }
}


/** One explicit request loads one fixed-host page, never a recursive crawl. */
export function createHistoryLookup(load = createPageCache(), loadRussian = createPageCache((titles, signal) => queryWiktionaryPages(titles, signal, 'ru'))) {
  return async (input: HistoryTarget, signal: AbortSignal) => {
    const target = historyTarget(input.language, input.term)
    if (!target) throw new ServiceError(400, 'INVALID_TARGET', 'This dictionary language or form is not supported')
    let page = await load(historyTitle(target), signal)
    signal.throwIfAborted()
    let parsed = page ? parseLexicalPage(page, target.language, true, true) : { families: [], senses: [] }
    if ((!parsed.families.length || parsed.families.every(f => f.label === 'Word family')) && target.language === 'ru') {
      const fallback = await russianHistory(target, loadRussian, signal)
      if (fallback) { page = fallback.page; parsed = fallback.parsed }
    }
    const choices = parsed.families.map(family => ({ ...family,
      summary: parsed.senses.find(s => s.etymologyId === family.id)?.definition ?? 'Consult the entry to identify this history.',
      reason: family.nodes.length > 1 ? '' : 'No supported, certain continuation was found in this etymology.'
    }))
    return { schemaVersion: 1, target: input, choices,
      reason: choices.length ? '' : 'No supported etymology section was found for this language and form. The history may be unknown or use unsupported formatting.',
      source: page?.source ?? null, attribution }
  }
}

/** Narrow Russian fallback: an explicit etymology template citing Proto-Slavic.
 * Never infer morphemes from spelling or equate the template name with a lemma. */
async function russianHistory(target: HistoryTarget, load: ReturnType<typeof createPageCache>, signal: AbortSignal) {
  const page = await load(target.term, signal)
  if (!page) return
  const section = page.wikitext.split(/^=\s*\{\{-ru-\}\}\s*=\s*$/m)[1]?.split(/^=[^=].*?=\s*$/m)[0]
  const etymology = section?.match(/^=== Этимология ===\s*([\s\S]*?)(?=^===|$(?![\s\S]))/m)?.[1]
  const reference = etymology?.trim().match(/^Происходит от \{\{(этимология:[а-яё-]+)\|да\}\}\.?$/i)
  if (!reference) return
  const template = await load(`Шаблон:${reference[1]}`, signal)
  const proto = template?.wikitext.match(/^\{\{праслав\|\[\[(\*[^\]|]+)\]\]\}\}/)?.[1]
  if (!template || !proto || !historyTarget('sla-pro', proto)) return
  const node = termNode({ label: proto, lang: 'sla-pro', relation: 'derived' }, 'etymology-1-source-1', 'etymology-1-word', template)
  const parsed = { omittedSenses: 0, senses: [], families: [{ id: 'etymology-1', label: 'Etymology', direction: 'sources',
    nodes: [{ id: 'etymology-1-word', parent: null, label: target.term, lang: 'Russian', lookup: target, source: page.source, skipped: [] },
      { ...node, condensed: true, skipped: ['Intermediate word-formation stages not specified by this source'] }],
    note: 'Russian Wiktionary cites a shared etymology template. The link is a derivational origin with unspecified intermediate stages, not direct inheritance. Word parts are not inferred.', attribution, verifiedOn: page.timestamp.slice(0, 10) }] }
  return { page, parsed }
}
