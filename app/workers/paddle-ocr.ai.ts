/**
 * Browser-side OCR with PaddleOCR PP-OCRv6 (Baidu), on ONNX Runtime Web.
 *
 * The default OCR engine. Two small models read a page: a detector finds the
 * text lines, a recognizer reads each one. About 31 MB together, against
 * GLM-OCR's 623 MB, and each call is short.
 *
 * Its recognizer covers Chinese, Japanese, English and Latin scripts, not
 * Hebrew. The caller compares {@link PaddlePage.confidence} with
 * {@link PADDLE_FALLBACK_BELOW} and re-reads doubtful pages with GLM-OCR.
 *
 * The models run in `paddle-ocr.worker.ts`; this is its main-thread client.
 * Each page is one job on the shared AI queue that waits for the worker's
 * reply. A worker that reports any error, or crashes, is ended, and the next
 * page starts a fresh one with its own ONNX Runtime and WebGPU device: after a
 * GPU reset the old runtime never recovers (31 Oct 2026).
 */
import { enqueue } from './ai-queue'
import type { PaddlePage, PaddleRequest, PaddleResponse, PageTiming } from './paddle-ocr.worker'

/**
 * Pixel budget for a page render. Recognition reads line crops from the full
 * render, so it gets more pixels than GLM-OCR's 1.0M: about A4 at 150 dpi.
 * Not tuned yet; overridable with `stashly:ocr-max-pixels`.
 */
export const PADDLE_MAX_PIXELS = 2_000_000

/**
 * Page confidence below which the caller re-reads the page with GLM-OCR.
 *
 * Measured 31 Oct 2026 with `pageConfidence` as it is now: 27 real English
 * scan pages (two PDFs) scored 0.92–0.997, the lowest a cover full of icons;
 * synthetic Hebrew pages 0.649 (Arial) and 0 (David, nothing read); Hebrew
 * mixed with Latin and digits 0.868. Set midway between 0.868 and 0.92.
 *
 * A misrouted page is not free: GLM-OCR has reset the GPU (Windows TDR) on
 * this machine's NVIDIA Turing twice. Each page logs its confidence.
 */
export const PADDLE_FALLBACK_BELOW = 0.89

type Reply = Exclude<PaddleResponse, { type: 'error' }>

/** A request without its id; distributes so `read` keeps its `blob`. */
type RequestBody = PaddleRequest extends infer R ? (R extends unknown ? Omit<R, 'id'> : never) : never

interface PendingRequest {
  resolve: (reply: Reply) => void
  reject: (err: Error) => void
}

/** The live worker, or null before first use and after a failure. */
let worker: Worker | null = null
let nextRequestId = 1
const pending = new Map<number, PendingRequest>()

function failPending(err: Error) {
  for (const request of pending.values()) request.reject(err)
  pending.clear()
}

/** Ends the worker; the next request starts a fresh one. */
function discardWorker(ending: Worker, reason: string) {
  if (worker !== ending) return
  worker = null
  ending.terminate()
  console.warn(`[ocr] PaddleOCR worker restarted after: ${reason}`)
}

function getWorker(): Worker {
  if (worker) return worker
  const started = new Worker(new URL('./paddle-ocr.worker.ts', import.meta.url), {
    type: 'module',
  })
  started.onmessage = (event: MessageEvent<PaddleResponse>) => {
    const message = event.data
    const request = pending.get(message.id)
    if (!request) return
    pending.delete(message.id)
    if (message.type !== 'error') {
      request.resolve(message)
      return
    }
    request.reject(new Error(message.message))
    discardWorker(started, message.message)
  }
  started.onerror = (event) => {
    failPending(new Error(`PaddleOCR worker failed: ${event.message}`))
    discardWorker(started, event.message)
  }
  worker = started
  return started
}

/** Sends one request and waits for its reply. Must run inside an AI-queue job. */
function request(message: RequestBody): Promise<Reply> {
  const target = getWorker()
  const id = nextRequestId++
  return new Promise<Reply>((resolve, reject) => {
    pending.set(id, { resolve, reject })
    target.postMessage({ ...message, id } as PaddleRequest)
  })
}

function logLoad(loadMs: number | undefined) {
  if (loadMs !== undefined) console.info(`[ocr] PaddleOCR ready in ${loadMs}ms`)
}

/**
 * Loads both models as one queue job. A run calls this before its first page
 * so a model that cannot load fails the run once, not once per page.
 */
export function preloadPaddleOcr(): Promise<void> {
  return enqueue(async () => {
    const reply = await request({ type: 'load' })
    logLoad(reply.loadMs)
  }, 'background')
}

function describe(page: PaddlePage, timing: PageTiming): string {
  const confidence = page.confidence === null ? 'n/a (no text)' : page.confidence.toFixed(3)
  return (
    `${page.text.length} chars, ${page.lines} lines, confidence ${confidence} ` +
    `(${Math.round(timing.pixels / 1000)}k px; detect ${Math.round(timing.detMs)}ms, ` +
    `recognize ${Math.round(timing.recMs)}ms for ${Math.round(timing.outMB)}MB of output, ` +
    `decode ${Math.round(timing.decodeMs)}ms)`
  )
}

/**
 * Reads one rendered page, as its own AI-queue job.
 *
 * @param page - The page render (from the compute worker's `pdfPageAt`).
 * @returns The page text in reading order, its confidence and line count.
 *
 * @example
 * const { text, confidence } = await paddleOcrPage({ blob, pageNum: 1 }, { totalPages: 3 })
 */
export function paddleOcrPage(
  page: { blob: Blob; pageNum: number },
  options: { totalPages?: number } = {},
): Promise<PaddlePage> {
  return enqueue(async () => {
    const startedAt = performance.now()
    const reply = await request({ type: 'read', blob: page.blob })
    if (reply.type !== 'page') throw new Error(`Unexpected PaddleOCR reply: ${reply.type}`)
    logLoad(reply.loadMs)
    console.info(
      `[ocr] paddle page ${page.pageNum}${options.totalPages ? `/${options.totalPages}` : ''} ` +
        `in ${Math.round(performance.now() - startedAt)}ms: ${describe(reply.page, reply.timing)}`,
    )
    return reply.page
  }, 'background')
}
