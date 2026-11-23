/// <reference lib="webworker" />

/**
 * SVG raster worker: renders an SVG to a 512px WebP and an 8px preview with
 * resvg (WASM).
 *
 * Its own worker, not a kind in `thumbnail.compute.worker.ts`: a resvg render
 * is synchronous, so a hostile or huge SVG can't be interrupted from inside.
 * In the shared compute worker it would stall PDF, text and OCR jobs behind
 * it; here the caller (`thumbnail-stages/svg.ts`) terminates this worker on
 * timeout and starts a fresh one.
 *
 * Browsers can't do this natively off the main thread: `createImageBitmap`
 * rejects SVG (main thread and worker alike) and `ImageDecoder` doesn't
 * support it. resvg runs no script and fetches nothing: `<image href>` to
 * a URL is left unresolved, inline `data:` images still render. No fonts are
 * loaded, so `<text>` doesn't render.
 */

import { initWasm, Resvg } from '@resvg/resvg-wasm'
import wasmUrl from '@resvg/resvg-wasm/index_bg.wasm?url'
import { svgRasterSize } from '../utils/svg-raster'

export interface SvgRasterRequest {
  id: number
  svg: Blob
  maxSize: number
  previewSize: number
}

/** Posted once, before any response: the WASM is (or failed to get) ready. */
export interface SvgRasterReady {
  ready: boolean
  error?: string
}

export interface SvgRasterResponse {
  id: number
  result: {
    blob: Blob
    width: number
    height: number
    preview: Blob
    /** The SVG's own size (width/height attributes, else its viewBox). */
    naturalWidth: number
    naturalHeight: number
  } | null
  error?: string
}

let ready: Promise<void> | null = null

function init(): Promise<void> {
  ready ??= initWasm(fetch(wasmUrl))
  return ready
}

async function render(req: SvgRasterRequest): Promise<SvgRasterResponse['result']> {
  await init()
  const svg = new Uint8Array(await req.svg.arrayBuffer())
  const opts = { font: { loadSystemFonts: false } }

  // Parse once for the intrinsic size, then again fitted to the box: resvg
  // fixes the output size at construction.
  const probe = new Resvg(svg, opts)
  const naturalWidth = probe.width
  const naturalHeight = probe.height
  probe.free()
  const { width, height } = svgRasterSize(naturalWidth, naturalHeight, req.maxSize)

  const resvg = new Resvg(svg, {
    ...opts,
    fitTo: width >= height
      ? { mode: 'width', value: width }
      : { mode: 'height', value: height },
  })
  const image = resvg.render()
  const w = image.width
  const h = image.height
  const pixels = new Uint8ClampedArray(image.pixels)
  image.free()
  resvg.free()

  const canvas = new OffscreenCanvas(w, h)
  canvas.getContext('2d')!.putImageData(new ImageData(pixels, w, h), 0, 0)
  const blob = await canvas.convertToBlob({ type: 'image/webp', quality: 0.82 })

  // The preview is scaled down from the render rather than rendered again.
  const tiny = new OffscreenCanvas(req.previewSize, req.previewSize)
  tiny.getContext('2d')!.drawImage(canvas, 0, 0, req.previewSize, req.previewSize)
  const preview = await tiny.convertToBlob({ type: 'image/webp', quality: 0.5 })

  return { blob, width: w, height: h, preview, naturalWidth, naturalHeight }
}

function post(msg: SvgRasterResponse | SvgRasterReady) {
  ;(self as unknown as DedicatedWorkerGlobalScope).postMessage(msg)
}

// Load the WASM up front and say so: the caller's render timeout must not
// count a multi-second first fetch and compile.
init().then(
  () => post({ ready: true }),
  (err) => post({ ready: false, error: err instanceof Error ? err.message : String(err) })
)

self.onmessage = async (e: MessageEvent<SvgRasterRequest>) => {
  const { id } = e.data
  let msg: SvgRasterResponse
  try {
    msg = { id, result: await render(e.data) }
  } catch (err) {
    msg = { id, result: null, error: err instanceof Error ? err.message : String(err) }
  }
  post(msg)
}
