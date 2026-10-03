/**
 * The bridge to the compute worker (`app/workers/thumbnail.compute.worker.ts`):
 * one module-scope worker, request ids, and a timeout per request.
 *
 * Shared by everything that renders or parses a file off the main thread: the
 * thumbnail stages (`@/utils/thumbnail-stages`), media metadata
 * (`@/utils/media-metadata`) and PDF OCR rasterizing (`@/utils/thumbnail-ocr`).
 * It moved here from `thumbnail-pipeline.ts`, which held it beside code that
 * had nothing to do with it.
 */
import type {
  ComputeRequest,
  ComputeResponse,
} from '@/workers/thumbnail.compute.worker'

let computeWorker: Worker | null = null
let nextRequestId = 1
const pending = new Map<number, (msg: ComputeResponse) => void>()

/** The worker, constructed on first use. Null on the server or if it can't start. */
function getComputeWorker(): Worker | null {
  if (typeof window === 'undefined') return null
  if (computeWorker) return computeWorker

  try {
    computeWorker = new Worker(
      new URL('../workers/thumbnail.compute.worker.ts', import.meta.url),
      { type: 'module' }
    )
  } catch (err) {
    console.error('[thumbnail compute worker] failed to construct', err)
    return null
  }
  computeWorker.onmessage = (e: MessageEvent<ComputeResponse>) => {
    const handler = pending.get(e.data.id)
    if (handler) {
      pending.delete(e.data.id)
      handler(e.data)
    }
  }
  computeWorker.onerror = (e) => {
    console.error(
      '[thumbnail compute worker] error event',
      e.message,
      e.filename,
      e.lineno
    )
  }
  return computeWorker
}

const COMPUTE_TIMEOUT_MS = 60_000

/**
 * Rasterizing a whole document at OCR resolution is minutes of work, well past
 * the budget sized for single-page thumbnail ops. Must stay >= the worker's
 * own `PDF_PAGES_TIMEOUT_MS`, or the caller gives up on a request the worker
 * is still faithfully processing.
 */
const PDF_PAGES_TIMEOUT_MS = 200_000

/**
 * Sends one request to the compute worker and resolves with its answer.
 *
 * Never rejects: no worker, a timeout or a worker-side failure all resolve as
 * `{ kind: 'error', message }`, so callers narrow on `res.kind`.
 *
 * @param req - The request, without `id` (assigned here).
 * @returns The response variant for `req.kind`, or the `error` variant.
 *
 * @example
 * const res = await compute({ kind: 'resizeImage', file })
 * if (res.kind === 'resizeImage' && res.result) use(res.result.blob)
 */
export function compute<TKind extends ComputeRequest['kind']>(
  req: Omit<Extract<ComputeRequest, { kind: TKind }>, 'id'>
): Promise<Extract<ComputeResponse, { kind: TKind | 'error' }>> {
  return new Promise((resolve) => {
    const worker = getComputeWorker()
    if (!worker) {
      resolve({ id: 0, kind: 'error', message: 'no worker available' } as never)
      return
    }
    const id = nextRequestId++
    const budget =
      req.kind === 'pdfPages' ? PDF_PAGES_TIMEOUT_MS : COMPUTE_TIMEOUT_MS
    const timer = setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id)
        console.error(
          `[thumbnail compute] timeout waiting for ${req.kind} (id=${id})`
        )
        resolve({ id, kind: 'error', message: `timeout: ${req.kind}` } as never)
      }
    }, budget)
    pending.set(id, (msg) => {
      clearTimeout(timer)
      resolve(msg as never)
    })
    worker.postMessage({ ...req, id } as ComputeRequest)
  })
}
