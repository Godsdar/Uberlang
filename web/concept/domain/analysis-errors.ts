const messages: Record<string, string> = {
  UNSUPPORTED_LANGUAGE: 'Grammar is available for English text only.',
  UNSUPPORTED_SCRIPT: 'This sentence contains a script the English model does not support.',
  NO_LANGUAGE_CONTENT: 'Choose a sentence containing words, not just numbers or symbols.',
  INVALID_TEXT: 'The sentence contains invalid Unicode. Paste valid text before retrying.',
  TEXT_LIMIT: 'Choose a shorter sentence: up to 50 words and 500 characters.',
  SENTENCE_REQUIRED: 'The model found more than one sentence. Select a shorter sentence.',
  MULTIPLE_SENTENCES: 'The model found more than one sentence. Select a shorter sentence.'
}
export function analysisError(status: number, value: unknown): string {
  const code = value && typeof value === 'object' && 'error' in value && value.error && typeof value.error === 'object' && 'code' in value.error ? value.error.code : null
  if (typeof code === 'string' && Object.hasOwn(messages, code)) return messages[code]
  return ({
    429: 'Analysis is busy. Please try again in a moment.',
    413: messages.TEXT_LIMIT,
    422: 'Select one sentence and try again.',
    503: 'Analysis is temporarily unavailable. Try again or open an example.',
    504: 'Analysis took too long. Please try again.',
    404: 'Analysis is unavailable here. You can still explore an example.'
  } as Record<number, string>)[status] ?? 'Analysis could not be completed. Check the input and retry.'
}
