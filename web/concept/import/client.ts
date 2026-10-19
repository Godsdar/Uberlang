import { LIMIT, type ImportBatch } from './model.ts'
export function readDeck(file: File, signal: AbortSignal): Promise<ImportBatch> {
  return new Promise((resolve, reject) => {
    if (file.size > LIMIT.file) { reject(new Error('The file exceeds 32 MiB. Export a smaller deck without media.')); return }
    if (signal.aborted) { reject(new DOMException('Cancelled', 'AbortError')); return }
    const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
    let finished = false
    const finish = (error?: Error, batch?: ImportBatch) => { if (finished) return; finished = true; clearTimeout(timer); worker.terminate(); signal.removeEventListener('abort', abort); error ? reject(error) : resolve(batch!) }
    const abort = () => finish(new DOMException('Cancelled', 'AbortError'))
    const timer = setTimeout(() => finish(new Error('Local parsing took more than 20 seconds. Export a smaller deck without media.')), LIMIT.seconds * 1000)
    signal.addEventListener('abort', abort, { once: true })
    worker.onerror = () => finish(new Error('Local import could not start. This browser must support workers and WebAssembly; try a current browser or a text export.'))
    worker.onmessage = event => event.data.error ? finish(new Error(event.data.error)) : finish(undefined, event.data.batch)
    file.arrayBuffer().then(bytes => { if (!finished) worker.postMessage({ bytes, filename: file.name }, [bytes]) }, () => finish(new Error('The selected file could not be read.')))
  })
}
