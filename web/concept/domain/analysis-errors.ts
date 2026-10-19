const messages: Record<string, string> = {
  UNSUPPORTED_LANGUAGE: 'Grammar is unavailable for the declared language. Only the English model is installed.',
  UNSUPPORTED_SCRIPT: 'This English pilot accepts only basic and extended Latin letters. Mixed-script text, names and quotations in other scripts are unsupported.',
  NO_LANGUAGE_CONTENT: 'Choose a sentence containing words, not just numbers or symbols.',
  INVALID_TEXT: 'The sentence contains invalid Unicode. Paste valid text before retrying.',
  TEXT_LIMIT: 'Choose one sentence of at most 50 words and 500 UTF-16 units.',
  SENTENCE_REQUIRED: 'The model found more than one sentence. Select a shorter sentence.',
  MULTIPLE_SENTENCES: 'The model found more than one sentence. Select a shorter sentence.'
}
export function analysisError(status: number, value: unknown): string {
  const code = value && typeof value === 'object' && 'error' in value && value.error && typeof value.error === 'object' && 'code' in value.error ? value.error.code : null
  if (typeof code === 'string' && Object.hasOwn(messages, code)) return messages[code]
  return ({
    429: 'The service is busy. Wait a moment, then choose Analyze sentence to retry.',
    413: messages.TEXT_LIMIT,
    422: 'This input is unsupported. Check the declared language and select one sentence.',
    503: 'The language engine is unavailable. Prepared examples still work offline; new text needs a live engine.',
    504: 'The language engine timed out. Choose Analyze sentence to retry.',
    404: 'Live analysis is not configured on this deployment. Only prepared examples work offline.'
  } as Record<number, string>)[status] ?? 'Analysis could not be completed. Check the input and retry.'
}
