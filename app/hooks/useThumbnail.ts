import { useState, useCallback } from 'react'
import type { ThumbnailStage } from '@/types/machine.types'
import { hashToColor, dataUrlToBlob } from '@/utils/thumbnail'
import { generateVideoThumbnail, getVideoMetadata } from '@/utils/video'
import { useFetcher } from 'react-router'
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
  if (res && !res.ok) console.error('[saveMediaMetadata] server error', res.status, await res.text().catch(() => ''))
}

/**
 * Runs the 5-stage thumbnail pipeline for a newly uploaded file.
 * Stages: 0 = color hash placeholder → 1 = tiny WebP local objectURL →
 * 2 = 512px resize (S3 + DB) → 3 = ViT salient crop → 4 = Florence-2 caption.
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
        await fetch(presign.uploadUrl, {
          method: 'PUT',
          body: resizedBlob,
          headers: { 'Content-Type': 'image/webp' },
        }).catch(() => {})

        // Cache-bust: stages share the same S3 key (`thumbnails/{itemId}.webp`),
        // so without a query param the browser keeps showing the prior stage.
        const stage2Url = `${presign.publicUrl}?v=2`
        const fd2 = new FormData()
        fd2.append('stage', '2')
        fd2.append('url', stage2Url)
        fd2.append('width', String(resizedDims.width))
        fd2.append('height', String(resizedDims.height))
        await fetch(`/api/thumbnails/${itemId}`, {
          method: 'PATCH',
          body: fd2,
        }).catch(() => {})
        if (stage1ObjectUrl) {
          URL.revokeObjectURL(stage1ObjectUrl)
          stage1ObjectUrl = null
        }
        setState({ stage: 2, src: stage2Url, color })

        // Fire-and-forget: save real media dimensions + EXIF / document text
        saveMediaMetadata(itemId, file).catch((e) => console.error('[saveMediaMetadata]', e))

        // ── Stage 3: ViT saliency crop (images only) ────────────────────
        if (file.type.startsWith('image/')) {
          const { generateSalientCrop, generateCaption } = await import('@/workers/thumbnail.ai')
          const salientBlob = await generateSalientCrop(file).catch(() => null)
          if (salientBlob) {
            const presign3Res = await fetch(`/api/thumbnails/${itemId}/presign`).catch(() => null)
            const presign3 = presign3Res ? await presign3Res.json().catch(() => null) : null
            if (presign3?.uploadUrl && presign3?.publicUrl) {
              await fetch(presign3.uploadUrl, {
                method: 'PUT',
                body: salientBlob,
                headers: { 'Content-Type': 'image/webp' },
              }).catch(() => {})
              const stage3Url = `${presign3.publicUrl}?v=3`
              const fd3 = new FormData()
              fd3.append('stage', '3')
              fd3.append('url', stage3Url)
              fd3.append('width', '512')
              fd3.append('height', '512')
              await fetch(`/api/thumbnails/${itemId}`, { method: 'PATCH', body: fd3 }).catch(() => {})
              setState({ stage: 3, src: stage3Url, color })
            }

            // ── Stage 4: Florence-2 caption overlay ────────────────────
            const captionResult = await generateCaption(salientBlob).catch(() => null)
            if (captionResult) {
              const presign4Res = await fetch(`/api/thumbnails/${itemId}/presign`).catch(() => null)
              const presign4 = presign4Res ? await presign4Res.json().catch(() => null) : null
              if (presign4?.uploadUrl && presign4?.publicUrl) {
                await fetch(presign4.uploadUrl, {
                  method: 'PUT',
                  body: captionResult.blob,
                  headers: { 'Content-Type': 'image/webp' },
                }).catch(() => {})
                const stage4Url = `${presign4.publicUrl}?v=4`
                const fd4 = new FormData()
                fd4.append('stage', '4')
                fd4.append('url', stage4Url)
                fd4.append('width', '512')
                fd4.append('height', '512')
                await fetch(`/api/thumbnails/${itemId}`, { method: 'PATCH', body: fd4 }).catch(() => {})
                setState({ stage: 4, src: stage4Url, color })
              }
            }
          }
        }
      }
    }
  }, [fetcher])

  return { ...state, run }
}
