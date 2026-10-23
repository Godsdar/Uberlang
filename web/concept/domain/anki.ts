/** Portable Anki text import. This module never contacts or mutates a collection. */
export interface AnkiSourceNote {
  importedCard?: { answer: string; deck: string; tags: string }
  language?: string
  selectedText: string
  start: number
  end: number
  context: string
  documentId: string
  explanation?: string | null
  explanationSource?: string
  provenance: string
  warnings?: string[]
  meaningCaveat?: string | null
  lexical?: { provenance?: { version: string; license: string } | null; senses: { source: string }[] } | null
  origin?: { note: string; attribution: string; verifiedOn: string; nodes: { label: string; lang: string; source: string; edgeSource?: string; relation?: string; historyNote?: string; skipped?: string[] }[] } | null
}
export interface AnkiDraft {
  word: string
  language: string
  sense?: string
  context: string
  answer: string
  deck: string
  tags: string
  includeHistory: boolean
  readonly evidence: string
  readonly history: string
}

function sentenceContext(text: string, start: number, end: number): string {
  const before = text.slice(0, start).search(/[^.!?\n]*$/u)
  const after = text.slice(end).search(/[.!?\n]/u)
  return text.slice(before, after < 0 ? text.length : end + after + 1).trim()
}

export function createAnkiDraft(note: AnkiSourceNote, document: string): AnkiDraft {
  if (!Number.isInteger(note.start) || !Number.isInteger(note.end) || note.start < 0 || note.end <= note.start || note.end > document.length || document.slice(note.start, note.end) !== note.selectedText) {
    throw new Error('This note is missing its original selection. Explore and select the text again.')
  }
  const sources = [...new Set([
    ...(note.lexical?.senses.map(sense => sense.source) ?? []),
    ...(note.origin?.nodes.flatMap(node => [node.source, node.edgeSource].filter((value): value is string => !!value)) ?? [])
  ])]
  const evidence = [
    'Uberlang source snapshot',
    `Original selection: ${note.selectedText}`,
    `Original context: ${note.context === note.selectedText ? sentenceContext(document, note.start, note.end) : note.context}`,
    `Document ${note.documentId} · UTF-16 [${note.start},${note.end})`,
    note.provenance, note.meaningCaveat, ...(note.warnings ?? []),
    note.lexical?.provenance ? `Dictionary revision: ${note.lexical.provenance.version} · ${note.lexical.provenance.license}` : '',
    note.origin ? `${note.origin.attribution} · ${note.origin.verifiedOn}` : '',
    ...sources,
    sources.length ? 'Wiktionary contributors · CC BY-SA 4.0 · https://creativecommons.org/licenses/by-sa/4.0/' : ''
  ].filter(Boolean).join('\n')
  const history = note.origin ? [note.origin.note, ...note.origin.nodes.map(node => `${node.label} (${node.lang})${node.relation ? ' · ' + node.relation : ''}${node.historyNote ? ' · ' + node.historyNote : ''}${node.skipped?.length ? ' · Condensed stages: ' + node.skipped.join(' → ') : ''} — ${node.source}`)].join('\n') : ''
  return {
    word: note.selectedText, language: note.language ?? 'en',
    context: note.context === note.selectedText ? sentenceContext(document, note.start, note.end) : note.context,
    // A model's grammar reading and dictionary alternatives are not a chosen meaning.
    answer: note.importedCard?.answer || (note.explanationSource === 'prepared' && note.explanation ? `Prepared explanation: ${note.explanation}` : ''),
    deck: note.importedCard?.deck || 'Uberlang', tags: note.importedCard?.tags || 'uberlang', includeHistory: false, evidence, history
  }
}

function required(value: string, label: string, max: number): string {
  const clean = value.trim().normalize('NFC')
  if (!clean) throw new Error(`${label} is required.`)
  if (clean.length > max) throw new Error(`${label} is too long (maximum ${max} characters).`)
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(clean)) throw new Error(`${label} contains unsupported control characters.`)
  return clean.replace(/\r\n?/g, '\n')
}

export function ankiFields(draft: AnkiDraft): { front: string; back: string; tags: string; deck: string } {
  const word = required(draft.word, 'Word or expression', 300)
  const language = required(draft.language, 'Language', 60)
  if (/[\n\t]/u.test(word + language)) throw new Error('Word and language must each use one line.')
  const sense = draft.sense?.trim() ? required(draft.sense, 'Sense label', 120) : ''
  if (/[\n\t]/u.test(sense)) throw new Error('Sense label must use one line.')
  const context = required(draft.context, 'Context', 6000)
  const answer = required(draft.answer, 'Answer', 10000)
  const deck = required(draft.deck, 'Deck', 120)
  if (/[\r\n\t]/u.test(deck)) throw new Error('Deck must use one line without tabs.')
  if (draft.tags.length > 500 || /[\r\n\t]/u.test(draft.tags)) throw new Error('Tags must use one line, separated by spaces (maximum 500 characters).')
  const tags = [...new Set(draft.tags.trim().split(/ +/u).filter(Boolean))]
  if (tags.some(tag => !/^[\p{L}\p{N}_:.;-]+$/u.test(tag))) throw new Error('Use letters, numbers, underscores, colons, semicolons, dots or hyphens in tags.')
  return {
    front: `${word} [${language}]${sense ? ' · ' + sense : ''}\n${context}`,
    back: [answer, draft.includeHistory && draft.history ? `Word history\n${draft.history}` : '', draft.evidence].filter(Boolean).join('\n\n'),
    deck, tags: tags.join(' ')
  }
}

/** Match the actual first field Anki imports; answer/deck changes do not evade a warning. */
export function ankiIdentity(draft: AnkiDraft): string { return ankiFields(draft).front }

export function serializeAnki(draft: AnkiDraft): string {
  const fields = ankiFields(draft)
  const quote = (value: string) => `"${value.replace(/"/g, '""')}"`
  return ['#separator:Tab', '#html:false', `#deck:${fields.deck}`, '#tags column:3', '#columns:Front\tBack\tTags',
    [fields.front, fields.back, fields.tags].map(quote).join('\t'), ''].join('\n')
}
