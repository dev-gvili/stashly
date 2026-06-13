/// <reference lib="webworker" />

/**
 * Thumbnail compute worker.
 *
 * Owns CPU-heavy thumbnail compute (canvas resize, tiny-preview extraction,
 * PDF parsing/text extraction). The orchestrator on main thread sends RPC
 * requests and gets `Blob` / metadata back. Concurrency is capped so multiple
 * simultaneous uploads don't starve the runtime.
 *
 * Imports of `../utils/pdf` are dynamic so PDF.js load failures don't take
 * the whole worker down — image paths keep working.
 */

import { extractTinyThumbnail, canvasResize, blurImageBlob } from '../utils/thumbnail'
import type { PdfDocumentMetadata } from '../utils/pdf'

export type ComputeRequest =
  | { id: number; kind: 'tinyImage'; file: File }
  | { id: number; kind: 'tinyPdf'; file: File }
  | { id: number; kind: 'resizeImage'; file: File; maxSize?: number; blur?: number }
  | { id: number; kind: 'resizePdf'; file: File; maxSize?: number; blur?: number }
  | { id: number; kind: 'pdfText'; file: File; maxPages?: number; maxChars?: number }
  | { id: number; kind: 'pdfMeta'; file: File }
  | { id: number; kind: 'imageDimensions'; file: File }

export type ComputeResponse =
  | { id: number; kind: 'tinyImage' | 'tinyPdf'; blob: Blob | null }
  | { id: number; kind: 'resizeImage' | 'resizePdf'; result: { blob: Blob; width: number; height: number } | null }
  | { id: number; kind: 'pdfText'; result: { text: string; pageCount: number; pagesRead: number } | null }
  | { id: number; kind: 'pdfMeta'; result: PdfDocumentMetadata | null }
  | { id: number; kind: 'imageDimensions'; result: { width: number; height: number } | null }
  | { id: number; kind: 'error'; message: string }

// PDF.js falls back to "fake worker" mode inside a dedicated worker (it can't
// always spawn a nested Worker for its internal pipeline). In fake-worker mode
// concurrent PDF operations terminate each other ("Worker task was terminated"
// warnings). Serialize through the queue: one compute op at a time.
const MAX_CONCURRENT = 1
const PER_OP_TIMEOUT_MS = 30_000

let active = 0
const queue: ComputeRequest[] = []

console.log('[thumbnail.compute.worker] started')

self.addEventListener('error', (e) => {
  console.error('[thumbnail.compute.worker] global error', e.message, e.filename, e.lineno)
})
self.addEventListener('unhandledrejection', (e) => {
  console.error('[thumbnail.compute.worker] unhandled rejection', e.reason)
})

self.onmessage = (e: MessageEvent<ComputeRequest>) => {
  queue.push(e.data)
  pump()
}

function pump() {
  while (active < MAX_CONCURRENT && queue.length > 0) {
    const req = queue.shift()!
    active++
    runWithTimeout(req)
      .catch((err) => {
        console.error('[thumbnail.compute.worker] handle threw', req.kind, err)
        post({
          id: req.id,
          kind: 'error',
          message: err instanceof Error ? err.message : String(err),
        })
      })
      .finally(() => {
        active--
        pump()
      })
  }
}

function runWithTimeout(req: ComputeRequest): Promise<void> {
  return new Promise<void>((resolve) => {
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      console.error(`[thumbnail.compute.worker] timeout ${req.kind} (id=${req.id}) after ${PER_OP_TIMEOUT_MS}ms`)
      post({ id: req.id, kind: 'error', message: `worker timeout: ${req.kind}` })
      resolve()
    }, PER_OP_TIMEOUT_MS)

    handle(req)
      .catch((err) => {
        if (settled) return
        console.error('[thumbnail.compute.worker] handle threw', req.kind, err)
        post({
          id: req.id,
          kind: 'error',
          message: err instanceof Error ? err.message : String(err),
        })
      })
      .finally(() => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        resolve()
      })
  })
}

async function handle(req: ComputeRequest): Promise<void> {
  switch (req.kind) {
    case 'tinyImage': {
      const blob = await extractTinyThumbnail(req.file).catch((err) => {
        console.error('[thumbnail.compute.worker] tinyImage failed', err)
        return null
      })
      post({ id: req.id, kind: 'tinyImage', blob })
      return
    }
    case 'resizeImage': {
      const resized = await canvasResize(req.file, req.maxSize ?? 512).catch((err) => {
        console.error('[thumbnail.compute.worker] resizeImage failed', err)
        return null
      })
      if (!resized) {
        post({ id: req.id, kind: 'resizeImage', result: null })
        return
      }
      const blob = req.blur
        ? (await blurImageBlob(resized, req.blur).catch(() => null)) ?? resized
        : resized
      const bitmap = await createImageBitmap(blob)
      const result = { blob, width: bitmap.width, height: bitmap.height }
      bitmap.close()
      post({ id: req.id, kind: 'resizeImage', result })
      return
    }
    case 'imageDimensions': {
      try {
        const bitmap = await createImageBitmap(req.file)
        const result = { width: bitmap.width, height: bitmap.height }
        bitmap.close()
        post({ id: req.id, kind: 'imageDimensions', result })
      } catch (err) {
        console.error('[thumbnail.compute.worker] imageDimensions failed', err)
        post({ id: req.id, kind: 'imageDimensions', result: null })
      }
      return
    }
    case 'tinyPdf': {
      try {
        const { generatePdfThumbnail } = await import('../utils/pdf')
        const blob = await generatePdfThumbnail(req.file)
        post({ id: req.id, kind: 'tinyPdf', blob })
      } catch (err) {
        console.error('[thumbnail.compute.worker] tinyPdf failed', err)
        post({ id: req.id, kind: 'tinyPdf', blob: null })
      }
      return
    }
    case 'resizePdf': {
      try {
        const { renderPdfPageToBlob } = await import('../utils/pdf')
        const rendered = await renderPdfPageToBlob(req.file, req.maxSize ?? 512)
        if (!rendered || !req.blur) {
          post({ id: req.id, kind: 'resizePdf', result: rendered })
          return
        }
        const blurred = await blurImageBlob(rendered.blob, req.blur).catch(() => null)
        post({
          id: req.id,
          kind: 'resizePdf',
          result: blurred
            ? { blob: blurred, width: rendered.width, height: rendered.height }
            : rendered,
        })
      } catch (err) {
        console.error('[thumbnail.compute.worker] resizePdf failed', err)
        post({ id: req.id, kind: 'resizePdf', result: null })
      }
      return
    }
    case 'pdfText': {
      try {
        const { extractPdfText } = await import('../utils/pdf')
        const result = await extractPdfText(req.file, {
          maxPages: req.maxPages,
          maxChars: req.maxChars,
        })
        post({ id: req.id, kind: 'pdfText', result })
      } catch (err) {
        console.error('[thumbnail.compute.worker] pdfText failed', err)
        post({ id: req.id, kind: 'pdfText', result: null })
      }
      return
    }
    case 'pdfMeta': {
      try {
        const { extractPdfMetadata } = await import('../utils/pdf')
        const result = await extractPdfMetadata(req.file)
        post({ id: req.id, kind: 'pdfMeta', result })
      } catch (err) {
        console.error('[thumbnail.compute.worker] pdfMeta failed', err)
        post({ id: req.id, kind: 'pdfMeta', result: null })
      }
      return
    }
  }
}

function post(msg: ComputeResponse) {
  ;(self as unknown as DedicatedWorkerGlobalScope).postMessage(msg)
}
