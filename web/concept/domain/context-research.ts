import { historyTarget } from '../../../src/shared/etymology.ts'
import { selectedLexicalWord } from './lexicon.ts'
import type { Token } from './graphs'
import type { Sentence } from './selection'

/** Navigation retains original UTF-16 positions, including repeated sentences. */
export function sentenceRanges(document: string) {
  return [...new Intl.Segmenter('en', { granularity: 'sentence' }).segment(document)]
    .filter(part => part.segment.trim())
    .map(part => {
      const text = part.segment.trim(), start = part.index + part.segment.indexOf(text)
      return { text, start, end: start + text.length }
    })
}

/** A phrase stays whole. A model lemma is usable only for its exact occurrence. */
export function researchSelection(document: string, start: number, end: number, language: string, token?: Token | null) {
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start || end > document.length) return null
  const selected = document.slice(start, end).trim()
  const kind = /\s/u.test(selected) ? 'expression' : 'word'
  const term = kind === 'word' && language === 'en'
    ? selectedLexicalWord(document, start, end, token?.text === document.slice(start, end) ? token : null) ?? selected
    : selected
  const target = historyTarget(language, term)
  return target ? { kind, target, context: document, start, end } : null
}

/** Head positions distinguish repeated forms without inventing lexical meanings. */
export function occurrenceRows(context: { example: Sentence; offset: number }) {
  return context.example.tokens.filter(t => t.pos !== 'PUNCT').map(token => {
    const head = token.head ? context.example.tokens[token.head - 1] : null
    return { ...token, start: context.offset + token.start, end: context.offset + token.end,
      headText: head?.text ?? 'sentence root', headStart: head ? context.offset + head.start : null }
  })
}

/** One visible sentence, with absolute offsets into the untouched passage. */
export function readingSentence(document: string, offset: number) {
  const ranges = sentenceRanges(document)
  return ranges.find(range => offset >= range.start && offset < range.end)
    ?? ranges.find(range => range.start >= offset) ?? ranges.at(-1)
}

/** DOM selection offsets are relative to the currently visible sentence. */
export function readingSelection(document: string, offset: number, start: number, end: number) {
  const sentence = readingSentence(document, offset)
  if (!sentence || !Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start || end > sentence.text.length) return null
  return { start: sentence.start + start, end: sentence.start + end }
}
