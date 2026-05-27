import { useState, useCallback } from 'react'
import type { ThumbnailStage } from '@/types/machine.types'
import { hashToColor, dataUrlToBlob } from '@/utils/thumbnail'
import { generateVideoThumbnail, getVideoMetadata } from '@/utils/video'
import { useFetcher, useRevalidator } from 'react-router'
import exifr from 'exifr'
import type {
  ComputeRequest,
  ComputeResponse,
} from '@/workers/thumbnail.compute.worker'

interface ThumbnailState {
  stage: ThumbnailStage
  /** null = use hex color from stage 0 (stored in `color`); string = public URL */
  src: string | null
  /** hex color, populated at stage 0 */
  color: string | null
}

// ── Compute worker singleton ─────────────────────────────────────────────
//
// Heavy thumbnail compute (PDF.js parsing, canvas resize, image decoding) runs
// in a dedicated module worker so multiple parallel uploads can't freeze the
// main thread. The worker enforces its own concurrency cap (max 2). Video
// thumbnailing stays on main because it requires `<video>` DOM access.

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
    // No-op for unmatched ids — typically an orphan response from before
    // Vite HMR reset the `pending` Map.
  }
  computeWorker.onerror = (e) => {
    console.error('[thumbnail compute worker] error event', e.message, e.filename, e.lineno, e)
  }
  computeWorker.onmessageerror = (e) => {
    console.error('[thumbnail compute worker] messageerror', e)
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

async function saveMediaMetadata(itemId: string, file: File) {
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

  const res = await fetch('/api/items', { method: 'POST', body: fd }).catch((e) => { console.error('[saveMediaMetadata] fetch failed', e); return null })
  if (!res) return
  if (!res.ok) {
    console.error('[saveMediaMetadata] server error', res.status, await res.text().catch(() => ''))
    return
  }

  // If the server returned chunk records (PDF / future text formats), kick
  // off embedding generation. Fire-and-forget — the file is already usable
  // before its semantic-search index is populated.
  const body = await res.json().catch(() => null) as
    | { success: boolean; chunks?: { id: string; ord: number; content: string }[] }
    | null
  if (body?.chunks && body.chunks.length > 0) {
    embedAndPersistChunks(body.chunks).catch((e) =>
      console.error('[embed chunks]', e),
    )
  }
}

/**
 * Embed each SearchChunk content via the WebGPU embedding worker, then
 * POST the vectors back to the server for raw-SQL pgvector write.
 * Fire-and-forget — runs after `saveMediaMetadata` returns the chunk ids.
 */
async function embedAndPersistChunks(
  chunks: { id: string; content: string }[],
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
  await fetch('/api/items', { method: 'POST', body: fd }).catch((e) =>
    console.error('[embed chunks] fetch failed', e),
  )
}

/**
 * Runs the 4-stage thumbnail pipeline for a newly uploaded file.
 * Stages: 0 = color hash placeholder → 1 = tiny WebP local objectURL →
 * 2 = 512px resize (S3 + DB) → 3 = ViT salient crop.
 *
 * Heavy compute runs in `thumbnail.compute.worker.ts` (concurrency-capped).
 * Stage 0 is a small fetcher.submit. HTTP calls + React state updates run
 * here on main.
 */
export function useThumbnail() {
  const [state, setState] = useState<ThumbnailState>({
    stage: 0,
    src: null,
    color: null,
  })

  const fetcher = useFetcher()
  const { revalidate } = useRevalidator()

  const run = useCallback(async (itemId: string, file: File, onReady?: () => void) => {
    // ── Stage 0: color hash ──────────────────────────────────────────────
    const color = hashToColor(file.name, file.type)

    fetcher.submit(
      { itemId, url: color },
      { method: 'post', action: `/api/thumbnails/${itemId}` }
    )
    setState({ stage: 0, src: null, color })

    // ── Stage 1: tiny preview (LOCAL ONLY — never persisted to S3) ──────
    let tinyBlob: Blob | null = null
    if (file.type.startsWith('image/')) {
      const res = await compute({ kind: 'tinyImage', file })
      if (res.kind === 'tinyImage') tinyBlob = res.blob
    } else if (file.type === 'application/pdf') {
      const res = await compute({ kind: 'tinyPdf', file })
      if (res.kind === 'tinyPdf') tinyBlob = res.blob
    } else if (file.type.startsWith('video/')) {
      // Video needs `<video>` DOM access — can't run in the compute worker.
      const dataUrl = await generateVideoThumbnail(file).catch(() => null)
      if (dataUrl) tinyBlob = dataUrlToBlob(dataUrl)
    }

    let stage1ObjectUrl: string | null = null
    if (tinyBlob) {
      stage1ObjectUrl = URL.createObjectURL(tinyBlob)
      setState({ stage: 1, src: stage1ObjectUrl, color })
      onReady?.()
    }

    // ── Stage 2: full resize ─────────────────────────────────────────────
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
      // Reuse the tiny frame as the basis for stage 2 (kept main-thread).
      const frameFile = new File([tinyBlob], 'frame.webp', { type: 'image/webp' })
      const res = await compute({ kind: 'resizeImage', file: frameFile })
      if (res.kind === 'resizeImage' && res.result) {
        resizedBlob = res.result.blob
        resizedDims = { width: res.result.width, height: res.result.height }
      }
    }

    if (resizedBlob && resizedDims) {
      const presignRes = await fetch(`/api/thumbnails/${itemId}/presign`).catch(
        () => null
      )
      const presign = presignRes ? await presignRes.json().catch(() => null) : null
      if (presign?.uploadUrl && presign?.publicUrl) {
        // Don't write a URL to the DB if the S3 PUT didn't actually succeed —
        // otherwise the gallery shows a broken image. Stage 0 (color) remains
        // visible if PUT fails.
        const putRes = await fetch(presign.uploadUrl, {
          method: 'PUT',
          body: resizedBlob,
          headers: {
            'Content-Type': 'image/webp',
            'x-amz-acl': 'public-read',
          },
        }).catch((err) => {
          console.error('[stage 2 PUT] network error', itemId, err)
          return null
        })
        if (!putRes || !putRes.ok) {
          console.error('[stage 2 PUT] non-ok', itemId, putRes?.status, await putRes?.text().catch(() => '') ?? '')
          return
        }

        // Cache-bust: stages share the same S3 key (`thumbnails/{itemId}.webp`),
        // so without a query param the browser keeps showing the prior stage.
        const stage2Url = `${presign.publicUrl}?v=2`
        const fd2 = new FormData()
        fd2.append('stage', '2')
        fd2.append('url', stage2Url)
        fd2.append('width', String(resizedDims.width))
        fd2.append('height', String(resizedDims.height))
        const patchRes = await fetch(`/api/thumbnails/${itemId}`, {
          method: 'PATCH',
          body: fd2,
        }).catch((err) => {
          console.error('[stage 2 PATCH] network error', itemId, err)
          return null
        })
        if (!patchRes || !patchRes.ok) {
          console.error('[stage 2 PATCH] non-ok', itemId, patchRes?.status)
          return
        }
        if (stage1ObjectUrl) {
          URL.revokeObjectURL(stage1ObjectUrl)
          stage1ObjectUrl = null
        }
        setState({ stage: 2, src: stage2Url, color })
        // Trigger React Router to re-run loaders so the gallery picks up the
        // new thumbnail URL without a manual navigation. Raw fetch above
        // doesn't trigger this on its own.
        revalidate()

        // Fire-and-forget: save real media dimensions + EXIF / document text
        saveMediaMetadata(itemId, file).catch((e) => console.error('[saveMediaMetadata]', e))

        // ── Stage 3: ViT saliency crop (images only) ────────────────────
        if (file.type.startsWith('image/')) {
          const { generateSalientCrop } = await import('@/workers/thumbnail.ai')
          const salientBlob = await generateSalientCrop(file).catch(() => null)
          if (salientBlob) {
            const presign3Res = await fetch(`/api/thumbnails/${itemId}/presign`).catch(() => null)
            const presign3 = presign3Res ? await presign3Res.json().catch(() => null) : null
            if (presign3?.uploadUrl && presign3?.publicUrl) {
              const put3 = await fetch(presign3.uploadUrl, {
                method: 'PUT',
                body: salientBlob,
                headers: {
                  'Content-Type': 'image/webp',
                  'x-amz-acl': 'public-read',
                },
              }).catch((err) => {
                console.error('[stage 3 PUT] network error', itemId, err)
                return null
              })
              if (put3 && put3.ok) {
                const stage3Url = `${presign3.publicUrl}?v=3`
                const fd3 = new FormData()
                fd3.append('stage', '3')
                fd3.append('url', stage3Url)
                fd3.append('width', '512')
                fd3.append('height', '512')
                const patch3 = await fetch(`/api/thumbnails/${itemId}`, { method: 'PATCH', body: fd3 }).catch(() => null)
                if (patch3 && patch3.ok) {
                  setState({ stage: 3, src: stage3Url, color })
                  revalidate()
                }
              } else {
                console.error('[stage 3 PUT] non-ok', itemId, put3?.status)
              }
            }
          }
        }
      }
    }
  }, [fetcher, revalidate])

  return { ...state, run }
}
