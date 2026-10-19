export const LIMIT = { file: 32 * 1024 * 1024, expanded: 128 * 1024 * 1024, entries: 5000, ratio: 200, notes: 10000, cards: 50000, fields: 64, field: 32000, text: 8_000_000, seconds: 20 } as const
export class ImportError extends Error {}
export function fail(message: string): never { throw new ImportError(message) }
export const utf8 = (bytes: Uint8Array): string => {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes) }
  catch { return fail('This file contains invalid UTF-8. Export it again as UTF-8 text or an Anki deck.') }
}
export interface NoteType { id: string; name: string; fields: string[] }
export interface ImportNote { id: string; guid: string; type: string; fields: string[]; decks: string[]; tags: string[] }
export interface ImportBatch { format: string; filename: string; types: NoteType[]; notes: ImportNote[]; warnings: string[] }
export interface Mapping { word: number; example: number; answer: number; language: string }
export interface LibraryNote extends ImportNote {
  key: string; typeName: string; fieldNames: string[]; language: string
  word: string; example: string; answer: string; filename: string; importedAt: string
}
export const cleanLabel = (value: unknown): string => {
  if (typeof value !== 'string' || value.length > LIMIT.field) return fail('Invalid or oversized metadata in this deck.')
  return value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim()
}
export const unique = (values: string[]) => [...new Set(values.filter(Boolean))]
export const tagsFrom = (value: string) => unique(cleanLabel(value).split(/\s+/))
