import { Inflate } from 'fflate'
import { Decompress } from 'fzstd'
import { LIMIT, fail, utf8 } from './model.ts'
interface Entry { name: string; size: number; compressed: number; start: number; method: number; crc: number }
const crcTable = Uint32Array.from({ length: 256 }, (_, i) => { let n = i; for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1; return n >>> 0 })
export function crc32(bytes: Uint8Array): number { let crc = 0xffffffff; for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8); return (crc ^ 0xffffffff) >>> 0 }

/** Validate the whole central directory, but inflate only the selected database/meta. */
export function readArchive(bytes: Uint8Array) {
  if (bytes.length > LIMIT.file) fail('The file exceeds 32 MiB. Export a smaller deck without media.')
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const u16 = (p: number) => v.getUint16(p, true), u32 = (p: number) => v.getUint32(p, true)
  let end = -1
  for (let p = bytes.length - 22; p >= Math.max(0, bytes.length - 65557); p--) if (u32(p) === 0x06054b50 && p + 22 + u16(p + 20) === bytes.length) { end = p; break }
  if (end < 0) fail('This is not a complete ZIP deck package.')
  const count = u16(end + 10), size = u32(end + 12), start = u32(end + 16)
  if (u16(end + 4) || u16(end + 6) || count !== u16(end + 8) || count === 65535 || start === 0xffffffff || size === 0xffffffff) fail('Split and ZIP64 archives are not supported. Export a smaller deck.')
  if (!count || count > LIMIT.entries || start + size !== end) fail('Invalid ZIP directory or more than 5,000 files in the deck. Export without media.')
  const entries = new Map<string, Entry>(), ranges: [number, number][] = []; let p = start, expanded = 0
  for (let i = 0; i < count; i++) {
    if (p + 46 > end || u32(p) !== 0x02014b50) fail('Invalid ZIP directory.')
    const flags = u16(p + 8), method = u16(p + 10), compressed = u32(p + 20), length = u32(p + 24), nl = u16(p + 28), el = u16(p + 30), cl = u16(p + 32), local = u32(p + 42)
    if (p + 46 + nl + el + cl > end || !nl || nl > 255) fail('Invalid ZIP filename.')
    const name = utf8(bytes.subarray(p + 46, p + 46 + nl))
    if (!/^[A-Za-z0-9_.-]+$/.test(name) || name.includes('..') || entries.has(name) || ((u32(p + 38) >>> 16) & 0xf000) === 0xa000) fail('Unsafe path, link, or duplicate filename in this deck.')
    if (flags & ~0x080e || flags & 1 || ![0, 8].includes(method) || u16(p + 34)) fail('Encrypted or unsupported ZIP entries. Export a standard Anki deck.')
    if (length > LIMIT.expanded || compressed === 0xffffffff || local === 0xffffffff || (length && (!compressed || length / compressed > LIMIT.ratio))) fail('This archive exceeds safe expansion limits. Export a smaller deck without media.')
    expanded += length; if (expanded > LIMIT.expanded) fail('Expanded archive exceeds 128 MiB. Export without media.')
    // Reject ZIP64 extra fields even when the small-size sentinel was omitted.
    for (let e = p + 46 + nl; e < p + 46 + nl + el;) { if (e + 4 > p + 46 + nl + el || u16(e) === 1) fail('Invalid or ZIP64 metadata.'); e += 4 + u16(e + 2); if (e > p + 46 + nl + el) fail('Invalid ZIP extra field.') }
    if (local + 30 > start || u32(local) !== 0x04034b50 || u16(local + 6) !== flags || u16(local + 8) !== method) fail('ZIP entry headers disagree.')
    const ln = u16(local + 26), le = u16(local + 28), data = local + 30 + ln + le
    if (data + compressed > start || utf8(bytes.subarray(local + 30, local + 30 + ln)) !== name) fail('Invalid ZIP entry range.')
    if (!(flags & 8) && (u32(local + 18) !== compressed || u32(local + 22) !== length || u32(local + 14) !== u32(p + 16))) fail('ZIP entry sizes disagree.')
    ranges.push([local, data + compressed]); entries.set(name, { name, start: data, size: length, compressed, method, crc: u32(p + 16) })
    p += 46 + nl + el + cl
  }
  if (p !== end) fail('Invalid ZIP directory size.')
  ranges.sort((a, b) => a[0] - b[0]); if (ranges.some((range, i) => i && range[0] < ranges[i-1][1])) fail('Overlapping ZIP entries are not supported.')
  return { names: [...entries.keys()], extract(name: string, cap = LIMIT.file as number) {
    const e = entries.get(name); if (!e) return fail(`Missing ${name}. Export this deck again from Anki.`)
    if (e.size > cap) fail('The database or metadata exceeds the local import limit.')
    const input = bytes.subarray(e.start, e.start + e.compressed)
    const output = new Uint8Array(e.size); let offset = 0
    const append = (chunk: Uint8Array) => { if (offset + chunk.length > e.size) fail('ZIP data exceeds its declared size.'); output.set(chunk, offset); offset += chunk.length }
    if (e.method === 0) append(input)
    else { const stream = new Inflate(append); for (let i = 0; i < input.length; i += 1024) stream.push(input.subarray(i, i + 1024), i + 1024 >= input.length) }
    if (offset !== e.size || crc32(output) !== e.crc) fail('The deck failed its ZIP checksum. Export it again.')
    return output
  } }
}

/** Preflight one complete Zstd frame, including allocation/window and block bounds. */
export function expandZstd(data: Uint8Array): Uint8Array {
  const bad = () => fail('Unsupported or damaged Zstandard deck. Export with “Support older Anki versions”, or use Notes in Plain Text.')
  if (data.length < 6 || data[0] !== 0x28 || data[1] !== 0xb5 || data[2] !== 0x2f || data[3] !== 0xfd) bad()
  const flag = data[4], single = !!(flag & 32), fcsFlag = flag >>> 6, dictBytes = [0, 1, 2, 4][flag & 3]
  if (flag & 24 || dictBytes) bad()
  let p = 5, window = 0
  if (!single) { const descriptor = data[p++]; window = 2 ** (10 + (descriptor >>> 3)) * (1 + (descriptor & 7) / 8); if (window > LIMIT.file) fail('Zstandard window exceeds 32 MiB. Export a smaller or legacy deck.') }
  const n = fcsFlag ? 2 ** fcsFlag : single ? 1 : 0
  if (p + n > data.length) bad()
  let content = 0n
  for (let i = 0; i < n; i++) content |= BigInt(data[p++]) << BigInt(8 * i)
  if (fcsFlag === 1) content += 256n
  if (content > BigInt(LIMIT.file)) fail('The expanded database exceeds 32 MiB. Export a smaller deck.')
  if (single) window = Number(content)
  if (!window) bad()
  let last = false
  while (!last) {
    if (p + 3 > data.length) bad()
    const header = data[p] | data[p+1] << 8 | data[p+2] << 16; p += 3
    last = !!(header & 1); const type = (header >>> 1) & 3, size = header >>> 3
    if (type === 3 || size > Math.min(131072, window)) bad()
    p += type === 1 ? 1 : size; if (p > data.length) bad()
  }
  if (flag & 4) p += 4
  if (p !== data.length) bad() // Reject concatenated/skippable frames before a decoder allocates.
  const chunks: Uint8Array[] = []; let length = 0
  const stream = new Decompress(chunk => { length += chunk.length; if (length > LIMIT.file) fail('The expanded database exceeds 32 MiB.'); chunks.push(chunk.slice()) })
  for (let i = 0; i < data.length; i += 1024) stream.push(data.subarray(i, i + 1024), i + 1024 >= data.length)
  if (n && content !== BigInt(length)) bad()
  const output = new Uint8Array(length); let offset = 0
  for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.length }
  return output
}
export function packageVersion(meta: Uint8Array): number {
  // Known proto3 message: a single version field. Future extensions fail explicitly.
  if (meta.length !== 2 || meta[0] !== 8 || ![1, 2, 3].includes(meta[1])) return fail('This Anki package version is unsupported. Export with “Support older Anki versions” or as Notes in Plain Text.')
  return meta[1]
}
