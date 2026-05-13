import * as pdfjs from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

// PDF.js v5+ configuration for CMaps and standard fonts
// disableFontFace: true forces PDF.js to render text via canvas instead of trying
// to load fonts from the network, which prevents squares/missing-glyph issues
const pdfjsOptions = {
  cMapUrl: '/pdfjs-cmaps/',
  cMapPacked: true,
  standardFontDataUrl: '/pdfjs-standard-fonts/',
  disableFontFace: true, // Use canvas-rendered text to avoid font loading failures
}

// Quiet PDF.js's noisy "Worker task was terminated" warnings that fire on
// every doc.destroy() in fake-worker mode. They are non-fatal — pdfjs already
// logs them with "ignoring errors" — but they spam the console.
const PDFJS_VERBOSITY_ERRORS = 0

// PDF.js's default `DOMCanvasFactory` calls `document.createElement('canvas')`
// for internal auxiliary canvases (subpixel-AA font detection, intermediate
// image-scaling buffers). `document` doesn't exist in a Web Worker, so any
// PDF that triggers those code paths (most non-trivial documents) crashes
// with "Cannot read properties of undefined (reading 'createElement')".
//
// Provide a worker-compatible factory backed by OffscreenCanvas. The shape
// matches PDF.js's BaseCanvasFactory contract: { create, reset, destroy }
// returning `{ canvas, context }` pairs.
class OffscreenCanvasFactory {
  create(width: number, height: number) {
    if (width <= 0 || height <= 0) {
      throw new Error('Invalid canvas size')
    }
    const canvas = new OffscreenCanvas(width, height)
    const context = canvas.getContext('2d')
    return { canvas, context }
  }

  reset(
    canvasAndContext: { canvas: OffscreenCanvas | null; context: unknown },
    width: number,
    height: number,
  ) {
    if (!canvasAndContext.canvas) throw new Error('Canvas is not specified')
    if (width <= 0 || height <= 0) throw new Error('Invalid canvas size')
    canvasAndContext.canvas.width = width
    canvasAndContext.canvas.height = height
  }

  destroy(canvasAndContext: { canvas: OffscreenCanvas | null; context: unknown }) {
    if (!canvasAndContext.canvas) throw new Error('Canvas is not specified')
    canvasAndContext.canvas.width = 0
    canvasAndContext.canvas.height = 0
    canvasAndContext.canvas = null
    canvasAndContext.context = null
  }
}

// Use the worker-friendly factory only when there's no `document` (i.e. inside
// a Web Worker). In a regular page context, fall through to PDF.js's default
// DOMCanvasFactory.
const workerSafeDocOptions =
  typeof document === 'undefined'
    ? { CanvasFactory: OffscreenCanvasFactory as unknown as never }
    : {}

async function withFirstPage<T>(
  label: string,
  file: File,
  fn: (page: pdfjs.PDFPageProxy) => Promise<T | null>,
): Promise<T | null> {
  let doc: pdfjs.PDFDocumentProxy | null = null
  try {
    const buffer = await file.arrayBuffer()
    doc = await pdfjs.getDocument({ data: buffer, verbosity: PDFJS_VERBOSITY_ERRORS, ...workerSafeDocOptions, ...pdfjsOptions }).promise
    if (doc.numPages === 0) {
      console.error(`[pdf] ${label}: doc has 0 pages`)
      return null
    }
    const page = await doc.getPage(1)
    try {
      return await fn(page)
    } finally {
      page.cleanup()
    }
  } catch (err) {
    console.error(`[pdf] ${label} failed:`, err)
    return null
  } finally {
    doc?.destroy()
  }
}

export function getPdfMetadata(
  file: File,
): Promise<{ pageCount: number; width: number; height: number } | null> {
  return (async () => {
    let doc: pdfjs.PDFDocumentProxy | null = null
    try {
      const buffer = await file.arrayBuffer()
      doc = await pdfjs.getDocument({ data: buffer, verbosity: PDFJS_VERBOSITY_ERRORS, ...workerSafeDocOptions, ...pdfjsOptions }).promise
      const page = await doc.getPage(1)
      const viewport = page.getViewport({ scale: 1 })
      const result = {
        pageCount: doc.numPages,
        width: Math.round(viewport.width),
        height: Math.round(viewport.height),
      }
      page.cleanup()
      return result
    } catch {
      return null
    } finally {
      doc?.destroy()
    }
  })()
}

/**
 * Render the first PDF page small and downsample to an 8×8 WebP Blob.
 * Worker-compatible (uses OffscreenCanvas).
 */
export function generatePdfThumbnail(file: File): Promise<Blob | null> {
  return withFirstPage('generatePdfThumbnail', file, async (page) => {
    const baseViewport = page.getViewport({ scale: 1 })
    const renderScale = 64 / Math.max(baseViewport.width, baseViewport.height)
    const viewport = page.getViewport({ scale: renderScale })
    const cw = Math.max(1, Math.round(viewport.width))
    const ch = Math.max(1, Math.round(viewport.height))
    const renderCanvas = new OffscreenCanvas(cw, ch)
    const renderCtx = renderCanvas.getContext('2d')
    if (!renderCtx) {
      console.error('[pdf] generatePdfThumbnail: getContext returned null')
      return null
    }

    renderCtx.fillStyle = '#ffffff'
    renderCtx.fillRect(0, 0, cw, ch)
    try {
      await page.render({
        canvasContext: renderCtx as unknown as CanvasRenderingContext2D,
        viewport,
        canvas: renderCanvas as unknown as HTMLCanvasElement,
      }).promise
    } catch (err) {
      console.error('[pdf] generatePdfThumbnail: page.render failed', err)
      return null
    }

    const tinyCanvas = new OffscreenCanvas(8, 8)
    const tinyCtx = tinyCanvas.getContext('2d')
    if (!tinyCtx) {
      console.error('[pdf] generatePdfThumbnail: tiny getContext returned null')
      return null
    }
    tinyCtx.drawImage(renderCanvas, 0, 0, 8, 8)
    try {
      const blob = await tinyCanvas.convertToBlob({ type: 'image/webp', quality: 0.5 })
      if (!blob) console.error('[pdf] generatePdfThumbnail: convertToBlob returned null')
      return blob
    } catch (err) {
      console.error('[pdf] generatePdfThumbnail: convertToBlob threw', err)
      return null
    }
  })
}

/**
 * Render the first PDF page directly to a WebP Blob at fit scale.
 * Worker-compatible (uses OffscreenCanvas).
 */
export function renderPdfPageToBlob(
  file: File,
  maxSize = 512,
): Promise<{ blob: Blob; width: number; height: number } | null> {
  return withFirstPage('renderPdfPageToBlob', file, async (page) => {
    const baseViewport = page.getViewport({ scale: 1 })
    const scale = Math.min(
      maxSize / baseViewport.width,
      maxSize / baseViewport.height,
      2,
    )
    const viewport = page.getViewport({ scale })
    const w = Math.max(1, Math.round(viewport.width))
    const h = Math.max(1, Math.round(viewport.height))
    const canvas = new OffscreenCanvas(w, h)
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      console.error('[pdf] renderPdfPageToBlob: getContext returned null')
      return null
    }

    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
    try {
      await page.render({
        canvasContext: ctx as unknown as CanvasRenderingContext2D,
        viewport,
        canvas: canvas as unknown as HTMLCanvasElement,
      }).promise
    } catch (err) {
      console.error('[pdf] renderPdfPageToBlob: page.render failed', err)
      return null
    }

    try {
      const blob = await canvas.convertToBlob({ type: 'image/webp', quality: 0.82 })
      if (!blob) {
        console.error('[pdf] renderPdfPageToBlob: convertToBlob returned null')
        return null
      }
      return { blob, width: w, height: h }
    } catch (err) {
      console.error('[pdf] renderPdfPageToBlob: convertToBlob threw', err)
      return null
    }
  })
}

export function extractPdfText(
  file: File,
  options: { maxPages?: number; maxChars?: number } = {},
): Promise<{ text: string; pageCount: number; pagesRead: number } | null> {
  const { maxPages = 5, maxChars = 20_000 } = options
  return (async () => {
    let doc: pdfjs.PDFDocumentProxy | null = null
    try {
      const buffer = await file.arrayBuffer()
      doc = await pdfjs.getDocument({ data: buffer, verbosity: PDFJS_VERBOSITY_ERRORS, ...workerSafeDocOptions, ...pdfjsOptions }).promise
      const pageCount = doc.numPages
      if (pageCount === 0) return null

      const pagesToRead = Math.min(maxPages, pageCount)
      const parts: string[] = []
      let total = 0

      for (let i = 1; i <= pagesToRead; i++) {
        const page = await doc.getPage(i)
        try {
          const content = await page.getTextContent()
          const pageText = content.items
            .map((item) => ('str' in item ? item.str : ''))
            .filter((s) => s.length > 0)
            .join(' ')
          if (pageText) {
            parts.push(pageText)
            total += pageText.length
          }
          if (total >= maxChars) break
        } finally {
          page.cleanup()
        }
      }

      const text = parts.join('\n\n').replace(/\s+/g, ' ').trim().slice(0, maxChars)
      return { text, pageCount, pagesRead: pagesToRead }
    } catch (err) {
      console.error('[pdf] extractPdfText failed:', err)
      return null
    } finally {
      doc?.destroy()
    }
  })()
}
