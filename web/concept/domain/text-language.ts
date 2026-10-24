import { detectAll } from 'tinyld/light'

/** Local heuristic; scores are ranking weights, not calibrated probabilities. */
export function detectTextLanguage(text: string): string {
  const letters = text.match(/\p{L}/gu) ?? []
  const words = text.match(/[\p{L}\p{M}]+/gu) ?? []
  if (letters.length < 10 || words.length < 2) return ''
  const [first, second] = detectAll(text)
  if (!first || first.accuracy < 0.08 || (second && first.accuracy - second.accuracy < 0.015)) return ''
  return first.lang
}

/** Identify the sentence around a selection, not an isolated ambiguous word. */
export function languageAtSelection(text: string, offset: number): string {
  const point = Math.max(0, Math.min(offset, text.length - 1))
  for (const part of new Intl.Segmenter(undefined, { granularity: 'sentence' }).segment(text)) {
    if (point >= part.index && point < part.index + part.segment.length) return detectTextLanguage(part.segment)
  }
  return detectTextLanguage(text)
}
