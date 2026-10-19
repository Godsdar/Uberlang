import { conceptData } from '../../src/data/reading-fixtures.mjs'
import { textIssue, languageIssue } from '../../src/shared/analysis-policy.ts'
import { ServiceError } from './errors.ts'

export interface AnalysisInput {
  documentId: string
  language: string
  text: string
  contextStart: number
  selection: { start: number; end: number }
}

export function validateText(text: string): void {
  const issue = textIssue(text)
  if (issue) throw new ServiceError(400, issue.code, issue.message)
}

export function analyzeSelection(input: AnalysisInput) {
  validateText(input.text)
  const issue = languageIssue(input.language, input.text)
  if (issue) throw new ServiceError(422, issue.code, issue.message)
  const { start, end } = input.selection
  const splitsSurrogate = (index: number) => /[\uD800-\uDBFF]/.test(input.text[index - 1] ?? '') && /[\uDC00-\uDFFF]/.test(input.text[index] ?? '')
  if (end <= start || end > input.text.length || splitsSurrogate(start) || splitsSurrogate(end)) {
    throw new ServiceError(400, 'INVALID_SELECTION', 'Selection must be a valid UTF-16 range within the sentence')
  }
  const example = conceptData.sentences.examples.find(e => e.text === input.text)
  const token = example?.tokens.find(t => t.start === start && t.end === end)
  const phrase = example?.phrases.find(p => p.start === start && p.end === end)
  const family = token ? (conceptData.families as Record<string, unknown>)[token.lemma] : undefined
  const unavailable = { status: 'unavailable' as const, reason: 'No prepared result for this selection. Live parsing is not configured.' }
  const prepared = <T>(data: T) => ({ status: 'prepared' as const, provenance: { engine: 'curated-examples', version: '2026-10-11', live: false }, data })
  return {
    schemaVersion: 1, language: input.language, documentId: input.documentId, contextStart: input.contextStart,
    coordinateSystem: 'UTF-16, end-exclusive',
    selection: { ...input.selection, absoluteStart: input.contextStart + start, absoluteEnd: input.contextStart + end, text: input.text.slice(start, end) },
    layers: {
      meaning: example ? prepared({ scope: phrase ? 'expression' : 'sentence', explanation: phrase?.explanation ?? example.explanation }) : unavailable,
      grammar: example ? prepared({ scope: 'sentence', tokens: example.tokens.map((t, i) => ({ ...t, id: i + 1, start: input.contextStart + t.start, end: input.contextStart + t.end })) }) : unavailable,
      etymology: family ? prepared(family) : unavailable
    }
  }
}
