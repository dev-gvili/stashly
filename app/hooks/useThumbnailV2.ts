/**
 * React-Router-native version of `useThumbnail`.
 *
 * Every internal HTTP call to our own routes goes through `useFetcher` —
 * route loaders auto-revalidate after each submission, no manual
 * `useRevalidator()` needed.
 *
 * Trade-offs vs the original:
 *   + Free revalidation after each successful POST/PATCH/load
 *   + Consistent with the rest of the codebase (color-mode, buttons,
 *     collection-card, etc. all use `useFetcher`)
 *   + Loading state per role observable via `fetcher.state` if a UI
 *     ever wants to surface it
 *   - `fetcher.submit()` is fire-and-forget; awaiting it requires a
 *     polling wrapper backed by `useRef` because React Router doesn't
 *     expose an imperative `await submit(...)` API
 *   - Multiple `useFetcher()` calls per hook instance — heavier than
 *     one shared fetcher, but each instance is per-file in practice
 *
 * S3 PUTs (stage 2/3/4 binary uploads) stay as raw `fetch` — they go
 * to a different origin (Tigris) so they aren't a React Router route.
 */
import { useCallback, useRef, useState } from 'react'
import { useFetcher } from 'react-router'
import type { ThumbnailStage } from '@/types/machine.types'
import { hashToColor, dataUrlToBlob } from '@/utils/thumbnail'
import { generateVideoThumbnail, getVideoMetadata } from '@/utils/video'
import exifr from 'exifr'
import type {
  ComputeRequest,
  ComputeResponse,
} from '@/workers/thumbnail.compute.worker'

interface ThumbnailState {
  stage: ThumbnailStage
  src: string | null
  color: string | null
}

// ── Compute worker singleton (same as v1) ────────────────────────────────

let computeWorker: Worker | null = null
let nextRequestId = 1
const pending = new Map<number, (msg: ComputeResponse) => void>()

function getComputeWorker(): Worker | null {
  if (typeof window === 'undefined') return null
  if (computeWorker) return computeWorker

  try {
    computeWorker = new Worker(
      new URL('../workers/thumbnail.compute.worker.ts', import.meta.url),
      { type: 'module' },
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
    console.error('[thumbnail compute worker] error event', e.message, e.filename, e.lineno)
  }
  return computeWorker
}

const COMPUTE_TIMEOUT_MS = 60_000

function compute<TKind extends ComputeRequest['kind']>(
  req: Omit<Extract<ComputeRequest, { kind: TKind }>, 'id'>,
): Promise<Extract<ComputeResponse, { kind: TKind | 'error' }>> {
  return new Promise((resolve) => {
    const worker = getComputeWorker()
    if (!worker) {
      resolve({ id: 0, kind: 'error', message: 'no worker available' } as never)
      return
    }
    const id = nextRequestId++
    const timer = setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id)
        console.error(`[thumbnail compute] timeout waiting for ${req.kind} (id=${id})`)
        resolve({ id, kind: 'error', message: `timeout: ${req.kind}` } as never)
      }
    }, COMPUTE_TIMEOUT_MS)
    pending.set(id, (msg) => {
      clearTimeout(timer)
      resolve(msg as never)
    })
    worker.postMessage({ ...req, id } as ComputeRequest)
  })
}

// ── Fetcher wait helpers ─────────────────────────────────────────────────
//
// `fetcher.submit()` and `fetcher.load()` return void. To await completion
// from inside an async `useCallback`, we poll `fetcher.state` via a ref so
// the polling loop reads the latest fetcher value each render-cycle tick.
// Without the ref, the closure would capture the stale fetcher object.

const POLL_MS = 16

function waitForIdle(
  fetcherRef: { current: { state: 'idle' | 'loading' | 'submitting' } },
  timeoutMs = 30_000,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now()
    // First, wait for the submission to actually start (state leaves 'idle').
    // Then, wait for it to return to 'idle'.
    let sawNonIdle = false
    const tick = () => {
      const state = fetcherRef.current.state
      if (Date.now() - start > timeoutMs) {
        reject(new Error('fetcher wait timeout'))
        return
      }
      if (state !== 'idle') sawNonIdle = true
      if (sawNonIdle && state === 'idle') {
        resolve()
        return
      }
      setTimeout(tick, POLL_MS)
    }
    tick()
  })
}

// ── saveMediaMetadata + embedAndPersistChunks (use fetchers) ─────────────

async function saveMediaMetadata(
  itemId: string,
  file: File,
  metadataFetcher: { submit: (data: FormData, opts: { method: 'post'; action: string }) => void },
  metadataFetcherRef: { current: { state: 'idle' | 'loading' | 'submitting'; data: unknown } },
) {
  const fd = new FormData()
  fd.append('intent', 'save_media_metadata')
  fd.append('itemId', itemId)

  if (file.type.startsWith('image/')) {
    const dimsRes = await compute({ kind: 'imageDimensions', file })
    if (dimsRes.kind === 'imageDimensions' && dimsRes.result) {
      fd.append('imageWidth', String(dimsRes.result.width))
      fd.append('imageHeight', String(dimsRes.result.height))
    }
    const exif = await exifr.parse(file, {
      pick: ['Make', 'Model', 'ISO', 'FNumber', 'ExposureTime', 'FocalLength', 'DateTimeOriginal'],
    }).catch(() => null)
    if (exif) {
      if (exif.Make) fd.append('cameraMake', exif.Make)
      if (exif.Model) fd.append('cameraModel', exif.Model)
      if (exif.ISO != null) fd.append('iso', String(exif.ISO))
      if (exif.FNumber != null) fd.append('fNumber', String(exif.FNumber))
      if (exif.ExposureTime != null) fd.append('exposureTime', String(exif.ExposureTime))
      if (exif.FocalLength != null) fd.append('focalLength', String(exif.FocalLength))
      if (exif.DateTimeOriginal) fd.append('takenDateTime', new Date(exif.DateTimeOriginal).toISOString())
    }
    const gps = await exifr.gps(file).catch(() => null)
    if (gps) {
      fd.append('latitude', String(gps.latitude))
      fd.append('longitude', String(gps.longitude))
    }
  } else if (file.type.startsWith('video/')) {
    const meta = await getVideoMetadata(file)
    if (meta) {
      fd.append('videoWidth', String(meta.width))
      fd.append('videoHeight', String(meta.height))
      fd.append('duration', String(meta.duration))
    }
  } else if (file.type === 'application/pdf') {
    const textRes = await compute({ kind: 'pdfText', file })
    if (textRes.kind === 'pdfText' && textRes.result) {
      if (textRes.result.text) fd.append('documentText', textRes.result.text)
      fd.append('documentPageCount', String(textRes.result.pageCount))
    }
  }

  metadataFetcher.submit(fd, { method: 'post', action: '/api/items' })
  await waitForIdle(metadataFetcherRef).catch((e) => console.error('[saveMediaMetadata] wait', e))

  const data = metadataFetcherRef.current.data as
    | { success: boolean; chunks?: { id: string; ord: number; content: string }[] }
    | undefined
  return data?.chunks ?? []
}

async function embedAndPersistChunks(
  chunks: { id: string; content: string }[],
  embeddingFetcher: { submit: (data: FormData, opts: { method: 'post'; action: string }) => void },
  embeddingFetcherRef: { current: { state: 'idle' | 'loading' | 'submitting'; data: unknown } },
) {
  const { embedTexts } = await import('@/workers/embedding.ai')
  const vectors = await embedTexts(chunks.map((c) => c.content))
  if (vectors.length !== chunks.length) {
    console.error('[embed chunks] vector count mismatch', vectors.length, chunks.length)
    return
  }
  const payload = chunks.map((c, i) => ({ chunkId: c.id, vector: vectors[i] }))

  const fd = new FormData()
  fd.append('intent', 'save_search_chunk_embeddings')
  fd.append('embeddings', JSON.stringify(payload))
  embeddingFetcher.submit(fd, { method: 'post', action: '/api/items' })
  await waitForIdle(embeddingFetcherRef).catch((e) => console.error('[embed chunks] wait', e))
}

// ── Hook ─────────────────────────────────────────────────────────────────

/**
 * V2 of `useThumbnail` — same pipeline, but every mutation to our own
 * routes goes through `useFetcher` so revalidation fires automatically.
 *
 * @example
 * const { stage, src, color, run } = useThumbnailV2()
 * useEffect(() => { run(itemId, file) }, [itemId])
 */
export function useThumbnailV2() {
  const [state, setState] = useState<ThumbnailState>({
    stage: 0,
    src: null,
    color: null,
  })

  // One fetcher per role. Each useThumbnailV2 instance is per-file in
  // practice, so cross-file parallelism is preserved at the hook level
  // (each instance has its own set of fetcher hooks).
  const colorFetcher = useFetcher()         // stage 0 POST
  const presignFetcher = useFetcher<{ uploadUrl: string; publicUrl: string }>()
  const patchFetcher = useFetcher()         // stages 2/3/4 PATCH (sequential)
  const metadataFetcher = useFetcher()      // saveMediaMetadata POST
  const embeddingFetcher = useFetcher()     // chunk embedding POST

  // Refs for the polling waiter — read latest fetcher state each render.
  const presignRef = useRef(presignFetcher)
  const patchRef = useRef(patchFetcher)
  const metadataRef = useRef(metadataFetcher)
  const embeddingRef = useRef(embeddingFetcher)
  presignRef.current = presignFetcher
  patchRef.current = patchFetcher
  metadataRef.current = metadataFetcher
  embeddingRef.current = embeddingFetcher

  const run = useCallback(async (itemId: string, file: File, onReady?: () => void) => {
    const color = hashToColor(file.name, file.type)

    // ── Stage 0: color hash via fetcher ─────────────────────────────────
    colorFetcher.submit(
      { itemId, url: color },
      { method: 'post', action: `/api/thumbnails/${itemId}` },
    )
    setState({ stage: 0, src: null, color })

    // ── Stage 1: tiny preview, local objectURL only ─────────────────────
    let tinyBlob: Blob | null = null
    if (file.type.startsWith('image/')) {
      const res = await compute({ kind: 'tinyImage', file })
      if (res.kind === 'tinyImage') tinyBlob = res.blob
    } else if (file.type === 'application/pdf') {
      const res = await compute({ kind: 'tinyPdf', file })
      if (res.kind === 'tinyPdf') tinyBlob = res.blob
    } else if (file.type.startsWith('video/')) {
      const dataUrl = await generateVideoThumbnail(file).catch(() => null)
      if (dataUrl) tinyBlob = dataUrlToBlob(dataUrl)
    }

    let stage1ObjectUrl: string | null = null
    if (tinyBlob) {
      stage1ObjectUrl = URL.createObjectURL(tinyBlob)
      setState({ stage: 1, src: stage1ObjectUrl, color })
      onReady?.()
    }

    // ── Stage 2: full resize + persist ──────────────────────────────────
    let resizedBlob: Blob | null = null
    let resizedDims: { width: number; height: number } | null = null
    if (file.type.startsWith('image/')) {
      const res = await compute({ kind: 'resizeImage', file })
      if (res.kind === 'resizeImage' && res.result) {
        resizedBlob = res.result.blob
        resizedDims = { width: res.result.width, height: res.result.height }
      }
    } else if (file.type === 'application/pdf') {
      const res = await compute({ kind: 'resizePdf', file })
      if (res.kind === 'resizePdf' && res.result) {
        resizedBlob = res.result.blob
        resizedDims = { width: res.result.width, height: res.result.height }
      }
    } else if (file.type.startsWith('video/') && tinyBlob) {
      const frameFile = new File([tinyBlob], 'frame.webp', { type: 'image/webp' })
      const res = await compute({ kind: 'resizeImage', file: frameFile })
      if (res.kind === 'resizeImage' && res.result) {
        resizedBlob = res.result.blob
        resizedDims = { width: res.result.width, height: res.result.height }
      }
    }

    if (resizedBlob && resizedDims) {
      const stage2Url = await persistStage(
        itemId,
        2,
        resizedBlob,
        resizedDims.width,
        resizedDims.height,
        presignRef,
        patchFetcher,
        patchRef,
      )
      if (stage2Url) {
        if (stage1ObjectUrl) {
          URL.revokeObjectURL(stage1ObjectUrl)
          stage1ObjectUrl = null
        }
        setState({ stage: 2, src: stage2Url, color })

        // Fire-and-forget metadata + chunked indexing pipeline.
        ;(async () => {
          const chunks = await saveMediaMetadata(itemId, file, metadataFetcher, metadataRef)
            .catch((e) => { console.error('[saveMediaMetadata]', e); return [] })
          if (chunks.length > 0) {
            await embedAndPersistChunks(chunks, embeddingFetcher, embeddingRef)
              .catch((e) => console.error('[embed chunks]', e))
          }
        })()

        // ── Stages 3 + 4 (images only) ──────────────────────────────────
        if (file.type.startsWith('image/')) {
          const { generateSalientCrop, generateCaption } = await import('@/workers/thumbnail.ai')
          const salientBlob = await generateSalientCrop(file).catch(() => null)
          if (salientBlob) {
            const stage3Url = await persistStage(
              itemId, 3, salientBlob, 512, 512,
              presignRef, patchFetcher, patchRef,
            )
            if (stage3Url) setState({ stage: 3, src: stage3Url, color })

            const captionResult = await generateCaption(salientBlob).catch(() => null)
            if (captionResult) {
              const stage4Url = await persistStage(
                itemId, 4, captionResult.blob, 512, 512,
                presignRef, patchFetcher, patchRef,
              )
              if (stage4Url) setState({ stage: 4, src: stage4Url, color })
            }
          }
        }
      }
    }
  }, [colorFetcher, patchFetcher, metadataFetcher, embeddingFetcher])

  return { ...state, run }
}

/**
 * Get a presigned URL via fetcher.load, PUT the blob to S3 (raw fetch —
 * different origin), then PATCH our route via fetcher.submit. Returns the
 * cache-busted URL on success, null on any failure.
 */
async function persistStage(
  itemId: string,
  stage: 2 | 3 | 4,
  blob: Blob,
  width: number,
  height: number,
  presignRef: { current: { load: (href: string) => void; state: 'idle' | 'loading' | 'submitting'; data: { uploadUrl: string; publicUrl: string } | undefined } },
  patchFetcher: { submit: (data: FormData, opts: { method: 'patch'; action: string }) => void },
  patchRef: { current: { state: 'idle' | 'loading' | 'submitting'; data: unknown } },
): Promise<string | null> {
  // 1) presign via fetcher.load (auto-revalidates loaders if needed)
  presignRef.current.load(`/api/thumbnails/${itemId}/presign`)
  await waitForIdle(presignRef).catch(() => null)
  const presign = presignRef.current.data
  if (!presign?.uploadUrl || !presign?.publicUrl) {
    console.error(`[stage ${stage}] presign missing uploadUrl/publicUrl`, itemId)
    return null
  }

  // 2) Raw PUT to S3 (different origin — can't be a fetcher)
  const putRes = await fetch(presign.uploadUrl, {
    method: 'PUT',
    body: blob,
    headers: { 'Content-Type': 'image/webp' },
  }).catch((err) => {
    console.error(`[stage ${stage} PUT] network error`, itemId, err)
    return null
  })
  if (!putRes || !putRes.ok) {
    console.error(`[stage ${stage} PUT] non-ok`, itemId, putRes?.status)
    return null
  }

  // 3) PATCH via fetcher.submit (auto-revalidates so the gallery picks up
  //    the new thumbnail URL without manual navigation)
  const stageUrl = `${presign.publicUrl}?v=${stage}`
  const fd = new FormData()
  fd.append('stage', String(stage))
  fd.append('url', stageUrl)
  fd.append('width', String(width))
  fd.append('height', String(height))
  patchFetcher.submit(fd, { method: 'patch', action: `/api/thumbnails/${itemId}` })
  await waitForIdle(patchRef).catch(() => null)

  return stageUrl
}
