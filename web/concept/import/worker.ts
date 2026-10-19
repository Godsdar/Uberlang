import { ImportError, LIMIT } from './model'
import { parseText } from './text'
self.onmessage = async (event: MessageEvent<{ bytes: ArrayBuffer; filename: string }>) => {
  try {
    const { bytes, filename } = event.data
    if (bytes.byteLength > LIMIT.file) throw new ImportError('The file exceeds 32 MiB. Export a smaller deck without media.')
    if (!/\.(apkg|txt|tsv)$/i.test(filename)) throw new ImportError('Choose an .apkg deck or UTF-8 .txt/.tsv notes file. Collection backups (.colpkg) are not supported.')
    let batch
    if (/\.apkg$/i.test(filename)) {
      const [{ default: initSqlJs }, { default: wasm }, { parseApkg }] = await Promise.all([import('sql.js'), import('sql.js/dist/sql-wasm.wasm?url'), import('./apkg')])
      batch = parseApkg(new Uint8Array(bytes), await initSqlJs({ locateFile: () => wasm }), filename)
    } else batch = parseText(new Uint8Array(bytes), filename)
    self.postMessage({ batch })
  } catch (error) {
    // Do not return SQL/parser internals: they may contain private source text.
    self.postMessage({ error: error instanceof ImportError ? error.message : 'This file is damaged or uses an unsupported format. Export it again from Anki, with “Support older Anki versions”, or as Notes in Plain Text.' })
  }
}
