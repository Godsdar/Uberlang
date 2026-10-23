import type { EtymologyNode, LangCode } from '@shared/types'

const API = 'https://en.wiktionary.org/w/api.php'
const USER_AGENT = 'Lingua/0.1 (https://github.com/Godsdar/Lingua; educational word lookup)'

const SECTION: Record<LangCode, string> = {
  en: 'English',
  ru: 'Russian',
  es: 'Spanish',
  fr: 'French'
}

const LANG_NAMES: Record<string, string> = {
  'ine-pro': 'Proto-Indo-European',
  'ine-bsl-pro': 'Proto-Balto-Slavic',
  'gem-pro': 'Proto-Germanic',
  'gmw-pro': 'Proto-West Germanic',
  'sla-pro': 'Proto-Slavic',
  'itc-pro': 'Proto-Italic',
  la: 'Latin',
  grc: 'Ancient Greek',
  enm: 'Middle English',
  ang: 'Old English',
  orv: 'Old East Slavic',
  osp: 'Old Spanish',
  frm: 'Middle French',
  fro: 'Old French',
  goh: 'Old High German',
  odt: 'Old Dutch',
  dum: 'Middle Dutch',
  non: 'Old Norse',
  sga: 'Old Irish',
  got: 'Gothic',
  hit: 'Hittite',
  xcl: 'Old Armenian',
  cu: 'Old Church Slavonic',
  frk: 'Frankish',
  prg: 'Old Prussian',
  en: 'English',
  ru: 'Russian',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  nl: 'Dutch',
  it: 'Italian',
  pt: 'Portuguese',
  pl: 'Polish',
  uk: 'Ukrainian',
  sa: 'Sanskrit'
}

const ANCESTRY = new Set([
  'inh', 'inh+', 'inherited', 'inherited+',
  'der', 'der+', 'derived', 'derived+',
  'bor', 'bor+', 'borrowed', 'borrowed+',
  'lbor', 'slbor', 'ubor', 'abor',
  'learned borrowing', 'semi-learned borrowing', 'unadapted borrowing', 'adapted borrowing',
  'calque', 'calqued', 'clipping', 'contraction', 'blend', 'back-formation', 'reborrowed'
])

const POS_HEADINGS = [
  'Noun', 'Verb', 'Adjective', 'Adverb', 'Pronoun', 'Preposition', 'Conjunction',
  'Interjection', 'Numeral', 'Determiner', 'Article', 'Particle', 'Proper noun',
  'Postposition'
]

function displayName (code: string): string {
  return LANG_NAMES[code] ?? code
}

const MIN_GAP_MS = 150
let lastStart = 0
let chain: Promise<unknown> = Promise.resolve()

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  signal?.throwIfAborted()
  return new Promise((resolve, reject) => {
    const aborted = () => { clearTimeout(timer); signal?.removeEventListener('abort', aborted); reject(signal?.reason) }
    const timer = setTimeout(() => { signal?.removeEventListener('abort', aborted); resolve() }, ms)
    signal?.addEventListener('abort', aborted, { once: true })
  })
}

function schedule<T> (task: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  const run = chain.then(async () => {
    signal?.throwIfAborted()
    const gap = MIN_GAP_MS - (Date.now() - lastStart)
    if (gap > 0) await delay(gap, signal)
    signal?.throwIfAborted()
    lastStart = Date.now()
    return task()
  })
  chain = run.then(() => undefined, () => undefined)
  if (!signal) return run
  return new Promise((resolve, reject) => {
    const aborted = () => { signal.removeEventListener('abort', aborted); reject(signal.reason) }
    signal.addEventListener('abort', aborted, { once: true })
    void run.then(value => { signal.removeEventListener('abort', aborted); resolve(value) }, error => { signal.removeEventListener('abort', aborted); reject(error) })
    if (signal.aborted) aborted()
  })
}

interface RawResponse {
  ok: boolean
  status: number
  retryAfter: number
  data?: any
}

async function fetchOnce (params: Record<string, string>, parent?: AbortSignal, edition: 'en' | 'ru' = 'en'): Promise<RawResponse> {
  const url = `${edition === 'ru' ? 'https://ru.wiktionary.org/w/api.php' : API}?${new URLSearchParams({ format: 'json', formatversion: '2', redirects: '1', origin: '*', ...params })}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 9000)
  try {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: parent ? AbortSignal.any([parent, controller.signal]) : controller.signal })
    const retryAfter = Number(res.headers.get('retry-after')) || 1
    if (!res.ok) {
      await res.body?.cancel().catch(() => undefined)
      return { ok: false, status: res.status, retryAfter }
    }
    const reader = res.body?.getReader()
    if (!reader) throw new Error('Empty Wiktionary response')
    const chunks: Uint8Array[] = []; let size = 0
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        size += value.length
        if (size > 4 * 1024 * 1024) throw new Error('Wiktionary response exceeds limit')
        chunks.push(value)
      }
    } finally { await reader.cancel() }
    const bytes = new Uint8Array(size); let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
    return { ok: true, status: res.status, retryAfter, data: JSON.parse(new TextDecoder().decode(bytes)) }
  } finally {
    clearTimeout(timer)
  }
}

async function api (params: Record<string, string>, signal?: AbortSignal, edition: 'en' | 'ru' = 'en'): Promise<any> {
  for (let attempt = 0; ; attempt++) {
    signal?.throwIfAborted()
    const res = await schedule(() => fetchOnce(params, signal, edition), signal)
    if (res.status === 429 && attempt < 2) {
      await delay(Math.min(res.retryAfter, 5) * 1000, signal)
      continue
    }
    if (!res.ok) throw new Error(`Wiktionary HTTP ${res.status}`)
    return res.data
  }
}

function stripMarkup (value: string): string {
  return value
    .replace(/\[\[([^\]|]*\|)?([^\]]*)\]\]/g, '$2')
    .replace(/'{2,}/g, '')
    .trim()
}

function cleanForm (value: string): string {
  return stripMarkup(value).split(',')[0].trim()
}

function scopeToLanguage (wikitext: string, langName: string): string {
  const heading = new RegExp(`^==\\s*${langName}\\s*==\\s*$`, 'm')
  const match = heading.exec(wikitext)
  if (!match) return ''
  const rest = wikitext.slice(match.index + match[0].length)
  const next = /^==[^=].*?==\s*$/m.exec(rest)
  return next ? rest.slice(0, next.index) : rest
}

function firstPos (section: string): string | undefined {
  let best: { index: number, pos: string } | undefined
  for (const pos of POS_HEADINGS) {
    const match = new RegExp(`^={3,5}\\s*${pos}\\s*={3,5}\\s*$`, 'm').exec(section)
    if (match && (!best || match.index < best.index)) best = { index: match.index, pos }
  }
  return best?.pos
}

function extractEtymologyBlock (section: string): string {
  const heading = /^(={3,5})\s*(.*?)\s*\1\s*$/gm
  const headings: { index: number, end: number, title: string }[] = []
  let match: RegExpExecArray | null
  while ((match = heading.exec(section))) {
    headings.push({ index: match.index, end: heading.lastIndex, title: match[2] })
  }
  for (let i = 0; i < headings.length; i++) {
    if (/etymolog/i.test(headings[i].title)) {
      const start = headings[i].end
      const end = headings[i + 1] ? headings[i + 1].index : section.length
      return section.slice(start, end)
    }
  }
  return ''
}

function topLevelTemplates (text: string): string[] {
  const out: string[] = []
  let depth = 0
  let start = -1
  for (let i = 0; i < text.length - 1; i++) {
    if (text[i] === '{' && text[i + 1] === '{') {
      if (depth === 0) start = i
      depth++
      i++
    } else if (text[i] === '}' && text[i + 1] === '}') {
      depth--
      if (depth === 0 && start >= 0) {
        out.push(text.slice(start, i + 2))
        start = -1
      }
      i++
    }
  }
  return out
}

function splitArgs (template: string): string[] {
  const inner = template.replace(/^\{\{/, '').replace(/\}\}$/, '')
  const args: string[] = []
  let depth = 0
  let current = ''
  for (let i = 0; i < inner.length; i++) {
    const two = inner.slice(i, i + 2)
    if (two === '{{') {
      depth++
      current += '{{'
      i++
    } else if (two === '}}') {
      depth--
      current += '}}'
      i++
    } else if (inner[i] === '|' && depth === 0) {
      args.push(current)
      current = ''
    } else {
      current += inner[i]
    }
  }
  args.push(current)
  return args.map(arg => arg.trim())
}

function chainFromWikitext (section: string): EtymologyNode[] {
  const block = extractEtymologyBlock(section)
  if (!block) return []
  const paragraph = block.trim().split(/\n\s*\n/)[0]
  const nodes: EtymologyNode[] = []
  for (const template of topLevelTemplates(paragraph)) {
    const args = splitArgs(template)
    const name = args[0]?.toLowerCase()
    if (!name || !ANCESTRY.has(name)) continue
    const lang = args[2]
    const word = cleanForm(args[3] ?? '')
    if (!lang || !word) continue
    nodes.push({ lang, langName: displayName(lang), word, relation: name })
  }
  return nodes
}

function decodeEntities (value: string): string {
  return value
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

export function chainFromEtyTree (html: string, langName: string): EtymologyNode[] {
  const start = html.search(new RegExp(`<h2[^>]*id="${langName}"`, 'i'))
  if (start < 0) return []
  const rest = html.slice(start)
  const next = rest.slice(1).search(/<h2[^>]*id="/i)
  const section = next >= 0 ? rest.slice(0, next + 1) : rest
  const match = section.match(/data-ety-tree-json="([^"]+)"/)
  if (!match) return []

  let root: unknown
  try {
    root = JSON.parse(decodeEntities(match[1]))
  } catch {
    return []
  }

  const chain: EtymologyNode[] = []
  // This API returns a chain. Flattening sibling branches would fabricate ancestry.
  // Keep the existing wikitext fallback when the tree needs a graph representation.
  const walk = (value: unknown, depth = 0): boolean => {
    if (!value || typeof value !== 'object' || depth > 32) return false
    const node = value as Record<string, unknown>
    if (node.term !== undefined) {
      if (typeof node.term !== 'string' || typeof node.lang !== 'string') return false
      const word = cleanForm(node.term)
      if (!word) return false
      chain.push({ lang: node.lang, langName: typeof node.lang_name === 'string' ? node.lang_name : displayName(node.lang), word })
    }
    if ((node.terms !== undefined && !Array.isArray(node.terms)) ||
        (node.children !== undefined && !Array.isArray(node.children))) return false
    const children: unknown[] = [...(Array.isArray(node.terms) ? node.terms : []), ...(Array.isArray(node.children) ? node.children : [])]
    if (children.length > 1) return false
    return children.length === 0 || walk(children[0], depth + 1)
  }
  if (!walk(root)) return []
  return chain
}

function normalizeForm (word: string): string {
  return word.trim().replace(/^\*+/, '').toLowerCase()
}

function isAffix (word: string): boolean {
  const core = word.trim().replace(/^\*+/, '')
  return core.startsWith('-') || core.endsWith('-')
}

function finalizeChain (chain: EtymologyNode[], word: string, lang: LangCode): EtymologyNode[] {
  let list = chain.slice()
  const hasHeadword = list.length > 0 && list[0].lang === lang && normalizeForm(list[0].word) === normalizeForm(word)
  if (!hasHeadword) {
    list = [{ lang, langName: displayName(lang), word }, ...list]
  }
  list = list.filter(node => !isAffix(node.word))
  list.reverse()

  const deduped: EtymologyNode[] = []
  for (const node of list) {
    const prev = deduped[deduped.length - 1]
    if (prev && prev.lang === node.lang && normalizeForm(prev.word) === normalizeForm(node.word)) continue
    deduped.push(node)
  }
  return deduped
}

export function findSharedAncestor (a: EtymologyNode[], b: EtymologyNode[]): EtymologyNode | undefined {
  let best: EtymologyNode | undefined
  let bestScore = Number.POSITIVE_INFINITY
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) {
      if (a[i].lang === b[j].lang && normalizeForm(a[i].word) === normalizeForm(b[j].word)) {
        if (i + j < bestScore) {
          bestScore = i + j
          best = a[i]
        }
      }
    }
  }
  return best
}

function cleanTranslationForm (form: string): string {
  return form
    .replace(/\[\[([^\]|]*\|)?([^\]]*)\]\]/g, '$2')
    .replace(/\u0301/g, '')
    .replace(/<[^>]+>/g, '')
    .trim()
}

function translationsFromWikitext (text: string, target: LangCode): string[] {
  const out: string[] = []
  const pattern = new RegExp(
    `\\{\\{\\s*(?:tt\\+?|t\\+?)\\s*\\|\\s*${target}\\s*\\|\\s*([^|}]+?)\\s*(?:\\|[^}]*)?\\}\\}`,
    'g'
  )
  let match: RegExpExecArray | null
  while ((match = pattern.exec(text))) {
    const word = cleanTranslationForm(match[1])
    if (word && !out.includes(word)) out.push(word)
  }
  return out
}

export interface Lexicon {
  pos?: string
  etymology: EtymologyNode[]
  translations: string[]
}

const MAX_CACHE = 1000
const cache = new Map<string, Lexicon>()

const cacheKey = (word: string, lang: LangCode, target?: LangCode): string =>
  `${lang}:${target ?? '-'}:${word.toLowerCase()}`

function remember (key: string, value: Lexicon): void {
  cache.set(key, value)
  if (cache.size > MAX_CACHE) {
    const oldest = cache.keys().next().value
    if (oldest !== undefined) cache.delete(oldest)
  }
}

async function queryBatch (titles: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  const unique = Array.from(new Set(titles))
  for (let i = 0; i < unique.length; i += 50) {
    const chunk = unique.slice(i, i + 50)
    const data = await api({
      action: 'query',
      prop: 'revisions',
      rvprop: 'content',
      rvslots: 'main',
      titles: chunk.join('|')
    })

    const mapping = new Map<string, string>()
    for (const entry of data?.query?.normalized ?? []) {
      mapping.set(String(entry.from).toLowerCase(), String(entry.to).toLowerCase())
    }
    for (const entry of data?.query?.redirects ?? []) {
      mapping.set(String(entry.from).toLowerCase(), String(entry.to).toLowerCase())
    }
    const resolve = (word: string): string => {
      const lower = word.toLowerCase()
      return mapping.get(lower) ?? lower
    }

    const pages = new Map<string, string>()
    for (const page of data?.query?.pages ?? []) {
      const content = page?.revisions?.[0]?.slots?.main?.content
      if (typeof content === 'string' && page.title) {
        pages.set(String(page.title).toLowerCase(), content)
      }
    }

    for (const word of chunk) {
      const content = pages.get(resolve(word))
      if (content !== undefined) out.set(word.toLowerCase(), content)
    }
  }
  return out
}

async function fetchEtyTree (word: string, langName: string): Promise<EtymologyNode[]> {
  const data = await api({ action: 'parse', page: word, prop: 'text' })
  return chainFromEtyTree(data?.parse?.text ?? '', langName)
}

interface Partial {
  pos?: string
  chain: EtymologyNode[]
  translations: string[]
  subpage: boolean
}

export async function getLexicons (
  words: string[],
  lang: LangCode,
  target?: LangCode
): Promise<Map<string, Lexicon>> {
  const result = new Map<string, Lexicon>()
  const missing: string[] = []

  for (const word of words) {
    const cached = cache.get(cacheKey(word, lang, target))
    if (cached) result.set(word, cached)
    else if (!missing.some(item => item.toLowerCase() === word.toLowerCase())) missing.push(word)
  }
  if (missing.length === 0) return result

  let content = new Map<string, string>()
  let batchOk = true
  try {
    content = await queryBatch(missing)
  } catch {
    batchOk = false
  }

  const partial = new Map<string, Partial>()
  const needsTree: string[] = []
  const needsSubpage: string[] = []
  const incomplete = new Set<string>()

  for (const word of missing) {
    let pos: string | undefined
    let chain: EtymologyNode[] = []
    let translations: string[] = []
    let subpage = false

    const wikitext = content.get(word.toLowerCase())
    if (wikitext) {
      const section = scopeToLanguage(wikitext, SECTION[lang])
      if (section) {
        pos = firstPos(section)
        chain = chainFromWikitext(section)
        if (target) {
          if (/see translation subpage/i.test(section)) {
            subpage = true
            needsSubpage.push(word)
          } else {
            translations = translationsFromWikitext(section, target)
          }
        }
      }
    }

    partial.set(word, { pos, chain, translations, subpage })
    if (chain.length === 0 || !chain.some(node => node.lang.endsWith('-pro'))) needsTree.push(word)
  }

  if (needsSubpage.length > 0 && target) {
    try {
      const subContent = await queryBatch(needsSubpage.map(word => `${word}/translations`))
      for (const word of needsSubpage) {
        const text = subContent.get(`${word}/translations`.toLowerCase())
        const entry = partial.get(word)
        if (text && entry) entry.translations = translationsFromWikitext(text, target)
      }
    } catch {
      for (const word of needsSubpage) incomplete.add(word)
    }
  }

  for (const word of needsTree) {
    try {
      const tree = await fetchEtyTree(word, SECTION[lang])
      const entry = partial.get(word)
      if (tree.length && entry) entry.chain = tree
      else incomplete.add(word)
    } catch {
      incomplete.add(word)
    }
  }

  for (const word of missing) {
    const entry = partial.get(word)
    const lexicon: Lexicon = {
      pos: entry?.pos,
      etymology: finalizeChain(entry?.chain ?? [], word, lang),
      translations: entry?.translations ?? []
    }
    if (batchOk && !incomplete.has(word)) remember(cacheKey(word, lang, target), lexicon)
    result.set(word, lexicon)
  }
  return result
}

/** Revision-scoped source pages for server lexical enrichment. Uses the shared queue. */
export interface WiktionaryPage {
  title: string; revision: number; timestamp: string; wikitext: string; source: string
}
export async function queryWiktionaryPages(titles: string[], signal?: AbortSignal, edition: 'en' | 'ru' = 'en'): Promise<WiktionaryPage[]> {
  const unique = [...new Set(titles)]
  if (!unique.length || unique.length > 20) throw new Error('Invalid Wiktionary batch size')
  signal?.throwIfAborted()
  const data = await api({ action: 'query', prop: 'revisions', rvprop: 'ids|timestamp|content', rvslots: 'main', titles: unique.join('|') }, signal, edition)
  if (!Array.isArray(data?.query?.pages)) throw new Error('Invalid Wiktionary response')
  return data.query.pages.flatMap((page: any) => {
    if (page?.missing) return []
    const revision = page?.revisions?.[0]
    if (typeof page?.title !== 'string' || !Number.isSafeInteger(revision?.revid) || typeof revision?.timestamp !== 'string' || typeof revision?.slots?.main?.content !== 'string') throw new Error('Invalid Wiktionary revision')
    return [{ title: page.title, revision: revision.revid, timestamp: revision.timestamp, wikitext: revision.slots.main.content, source: `https://${edition}.wiktionary.org/w/index.php?oldid=${revision.revid}` }]
  })
}
