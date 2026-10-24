/** Bounded English pilot. A script check is not automatic language identification. */
export const analysisLimits = { documentUtf16Units: 6000, utf16Units: 500, words: 50, sentences: 1 } as const
export const analysisModel = { language: 'en', engine: 'spaCy', version: '3.8.7', model: 'en_core_web_sm', modelVersion: '3.8.0' } as const
export const analysisWarnings = [
  'The grammar model supports English. Incorrect language identification can affect predictions.',
  'The script check rejects non-Latin letters, including names or quotations inside English text.'
]
export type InputIssue = { code: string; message: string }
export const wordCount = (text: string) => (text.match(/[\p{L}\p{N}][\p{L}\p{M}\p{N}]*(?:['’][\p{L}\p{N}][\p{L}\p{M}\p{N}]*)*/gu) ?? []).length

export function textIssue(text: string): InputIssue | null {
  if (/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(text)) {
    return { code: 'INVALID_TEXT', message: 'Text contains invalid Unicode. Paste valid text before trying again.' }
  }
  if (!text.trim() || text.length > analysisLimits.utf16Units || wordCount(text) > analysisLimits.words) {
    return { code: 'TEXT_LIMIT', message: 'Choose a shorter sentence: 1–50 words and at most 500 UTF-16 units (some symbols count as two).' }
  }
  return null
}

export function languageIssue(language: string, text: string): InputIssue | null {
  if (!language) return { code: 'LANGUAGE_REQUIRED', message: 'Could not identify the language confidently. Try a longer phrase.' }
  if (language !== 'en') return { code: 'UNSUPPORTED_LANGUAGE', message: 'Grammar is unavailable for this language. Only the English model is installed; your text remains available for reading.' }
  const letters = [...text].filter(character => /\p{L}/u.test(character))
  if (!letters.length) return { code: 'NO_LANGUAGE_CONTENT', message: 'Choose a sentence containing words. Numbers, punctuation or emoji alone have no supported grammar analysis.' }
  if (letters.some(character => !/[A-Za-z\u00C0-\u024F\u1E00-\u1EFF]/u.test(character))) {
    return { code: 'UNSUPPORTED_SCRIPT', message: 'This English pilot accepts only basic and extended Latin letters. Non-Latin or mixed-script text, including names and quotations, is unsupported. No English grammar will be guessed.' }
  }
  return null
}

export function analysisCapabilities(configured: boolean) {
  return {
    engine: configured ? 'spacy' : 'curated-examples', liveGrammar: configured, language: 'en',
    languages: ['en'], model: configured ? analysisModel : null, languageDetection: false,
    scriptPolicy: 'Basic Latin, Latin-1/Extended-A/B/Additional letters only; not language identification', readiness: 'configuration-only',
    meaning: 'grammar-derived structure, not word-sense disambiguation',
    translation: 'prepared examples only in the notebook', fallback: 'exact prepared examples only'
  }
}
