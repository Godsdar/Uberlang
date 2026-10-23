/** Public dictionary targets, never arbitrary URLs or namespaces. */
export interface HistoryTarget { language: string; term: string }
export const historyLanguages: Record<string, string> = {
  en: 'English', enm: 'Middle English', ang: 'Old English', la: 'Latin',
  fr: 'French', fro: 'Old French', frm: 'Middle French', 'xno': 'Anglo-Norman',
  grc: 'Ancient Greek', el: 'Greek', it: 'Italian', de: 'German',
  goh: 'Old High German', gmh: 'Middle High German', nl: 'Dutch', dum: 'Middle Dutch',
  non: 'Old Norse', sv: 'Swedish', da: 'Danish', got: 'Gothic',
  cu: 'Old Church Slavonic', uk: 'Ukrainian', be: 'Belarusian', bg: 'Bulgarian', cs: 'Czech', sk: 'Slovak', lt: 'Lithuanian', lv: 'Latvian',
  'grk-pro': 'Proto-Hellenic', 'iir-pro': 'Proto-Indo-Iranian', 'inc-pro': 'Proto-Indo-Aryan', 'ira-pro': 'Proto-Iranian',
  ru: 'Russian', orv: 'Old East Slavic', pl: 'Polish', sa: 'Sanskrit',
  es: 'Spanish', pt: 'Portuguese', ar: 'Arabic', fa: 'Persian',
  'gem-pro': 'Proto-Germanic', 'gmw-pro': 'Proto-West Germanic',
  'ine-pro': 'Proto-Indo-European', 'sla-pro': 'Proto-Slavic',
  'ine-bsl-pro': 'Proto-Balto-Slavic', 'itc-pro': 'Proto-Italic'
}
export function historyTarget(language: string, term: string): HistoryTarget | undefined {
  if (!Object.hasOwn(historyLanguages, language) || term.length > 80 ||
      !/^\*?-?[\p{L}\p{M}\p{N}]+(?:[ '\u2019\u02bc-][\p{L}\p{M}\p{N}]+)*-?$/u.test(term)) return undefined
  // These dictionaries omit editorial length/dot marks from page titles.
  const normalized = ['ru', 'orv', 'cu', 'uk', 'be', 'bg', 'sla-pro'].includes(language)
    ? term.normalize('NFD').replace(/[\u0300\u0301\u030f\u0311]/g, '').normalize('NFC')
    : ['la', 'ang'].includes(language)
    ? term.normalize('NFD').replace(/[\u0304\u0307]/g, '').normalize('NFC') : term.normalize('NFC')
  if (language.endsWith('-pro') !== normalized.startsWith('*')) return undefined
  return { language, term: normalized }
}
export function historyTitle(target: HistoryTarget): string {
  const valid = historyTarget(target.language, target.term)
  if (!valid) throw new Error('Unsupported dictionary target')
  return valid.term.startsWith('*') ? `Reconstruction:${historyLanguages[valid.language]}/${valid.term.slice(1)}` : valid.term
}
export const historyKey = (target: HistoryTarget) => `${target.language}:${historyTitle(target)}`
