import { isSvgFile, SVG_MIME } from '@/utils/svg-raster'
import type {
  SvgRasterReady,
  SvgRasterRequest,
  SvgRasterResponse,
} from '@/workers/svg-raster.worker'
import type { ResizedThumbnail, ThumbnailProducer } from './types'

/**
 * A single render that runs this long is treated as hostile or hopeless: the
 * worker is terminated (the only way to stop a synchronous WASM render) and
 * the next SVG gets a fresh one. Starts when the SVG is handed over, so it
 * counts neither the WASM load nor the wait behind other SVGs.
 */
const RENDER_TIMEOUT_MS = 10_000

/** Budget for the worker to fetch and compile the WASM (2.5 MB) at start. */
const READY_TIMEOUT_MS = 60_000

type Rendered = NonNullable<SvgRasterResponse['result']>

interface Running {
  worker: Worker
  ready: Promise<boolean>
  /** The one render in flight; the worker gets one SVG at a time. */
  current: { id: number; resolve: (r: Rendered | null) => void } | null
}

let running: Running | null = null
let nextId = 1
/** Serialises renders so each one's timeout measures only itself. */
let queue: Promise<unknown> = Promise.resolve()

function start(): Running | null {
  if (typeof window === 'undefined') return null
  if (running) return running
  let worker: Worker
  try {
    worker = new Worker(
      new URL('../../workers/svg-raster.worker.ts', import.meta.url),
      { type: 'module' }
    )
  } catch (err) {
    console.error('[svg raster worker] failed to construct', err)
    return null
  }
  let markReady!: (ok: boolean) => void
  const ready = new Promise<boolean>((resolve) => {
    markReady = resolve
  })
  const entry: Running = { worker, ready, current: null }
  const readyTimer = setTimeout(() => {
    console.error('[svg raster worker] not ready in time')
    markReady(false)
    stop(entry)
  }, READY_TIMEOUT_MS)

  worker.onmessage = (e: MessageEvent<SvgRasterResponse | SvgRasterReady>) => {
    if ('ready' in e.data) {
      clearTimeout(readyTimer)
      if (!e.data.ready) console.error('[svg raster worker] init failed', e.data.error)
      markReady(e.data.ready)
      return
    }
    if (e.data.error) console.error('[svg raster worker]', e.data.error)
    if (entry.current?.id === e.data.id) {
      entry.current.resolve(e.data.result)
      entry.current = null
    }
  }
  worker.onerror = (e) => {
    console.error('[svg raster worker] error event', e.message)
    clearTimeout(readyTimer)
    markReady(false)
    stop(entry)
  }
  running = entry
  return entry
}

/** Terminates a worker mid-render and fails the render it still owed. */
function stop(r: Running) {
  r.worker.terminate()
  r.current?.resolve(null)
  r.current = null
  if (running === r) running = null
}

async function renderNow(file: File): Promise<Rendered | null> {
  const r = start()
  if (!r || !(await r.ready)) return null
  return new Promise((resolve) => {
    const id = nextId++
    const timer = setTimeout(() => {
      console.error(`[svg raster worker] render timed out after ${RENDER_TIMEOUT_MS}ms`)
      stop(r)
    }, RENDER_TIMEOUT_MS)
    r.current = {
      id,
      resolve: (result) => {
        clearTimeout(timer)
        resolve(result)
      },
    }
    const req: SvgRasterRequest = {
      id,
      svg: file.type === SVG_MIME ? file : new Blob([file], { type: SVG_MIME }),
      maxSize: 512,
      previewSize: 8,
    }
    r.worker.postMessage(req)
  })
}

function renderInWorker(file: File): Promise<Rendered | null> {
  const next = queue.then(() => renderNow(file))
  queue = next.catch(() => null)
  return next
}

/**
 * One render serves both stages: stage 1 asks first and stage 2 reuses the
 * answer for the same `File`.
 */
const renders = new WeakMap<File, Promise<Rendered | null>>()

function renderOnce(file: File): Promise<Rendered | null> {
  let p = renders.get(file)
  if (!p) {
    p = renderInWorker(file)
    renders.set(file, p)
  }
  return p
}

/**
 * An SVG's own size, for the image facet (`extractMediaMetadata`), where the
 * compute worker's `createImageBitmap` can't read it. Shares the render with
 * the thumbnail: indexing and the thumbnail get the same uploaded `File`.
 *
 * @returns Null when resvg can't parse the file (or it timed out); never a
 *   made-up size.
 *
 * @example
 * const size = await svgIntrinsicSize(file) // → { width: 1024, height: 1024 }
 */
export async function svgIntrinsicSize(
  file: File
): Promise<{ width: number; height: number } | null> {
  const r = await renderOnce(file)
  return r && r.naturalWidth > 0 && r.naturalHeight > 0
    ? { width: Math.round(r.naturalWidth), height: Math.round(r.naturalHeight) }
    : null
}

/**
 * SVG: rendered by resvg in its own worker (`svg-raster.worker.ts`). Ahead of
 * the image producer, whose compute worker decodes with `createImageBitmap`,
 * which rejects SVG, so every SVG used to get no thumbnail. No salient crop:
 * logos and icons have no subject to crop to.
 */
export const svgProducer: ThumbnailProducer = {
  name: 'svg',
  matches: isSvgFile,

  async preview(file) {
    return (await renderOnce(file))?.preview ?? null
  },

  async resize(file): Promise<ResizedThumbnail | null> {
    const r = await renderOnce(file)
    return r ? { blob: r.blob, width: r.width, height: r.height } : null
  },
}
