/**
 * Pure pipeline helpers for the progressive thumbnail flow.
 *
 * No React, no fetchers — just compute + raw `fetch` for S3 PUTs.
 * The orchestrator hook composes these with route-fetcher calls.
 */
import { dataUrlToBlob } from '@/utils/thumbnail'
import { generateVideoThumbnail, getVideoMetadata } from '@/utils/video'
import exifr from 'exifr'
import type {
  ComputeRequest,
  ComputeResponse,
} from '@/workers/thumbnail.compute.worker'

// ── Compute worker singleton ─────────────────────────────────────────────

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

export function compute<TKind extends ComputeRequest['kind']>(
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

// ── Stage producers ──────────────────────────────────────────────────────

export async function generateStage1Preview(file: File): Promise<Blob | null> {
  if (file.type.startsWith('image/')) {
    const res = await compute({ kind: 'tinyImage', file })
    return res.kind === 'tinyImage' ? res.blob : null
  }
  if (file.type === 'application/pdf') {
    const res = await compute({ kind: 'tinyPdf', file })
    return res.kind === 'tinyPdf' ? res.blob : null
  }
  if (file.type.startsWith('video/')) {
    const dataUrl = await generateVideoThumbnail(file).catch(() => null)
    return dataUrl ? dataUrlToBlob(dataUrl) : null
  }
  return null
}

export interface ResizedThumbnail {
  blob: Blob
  width: number
  height: number
}

export async function generateStage2Resize(
  file: File,
  videoFrame?: Blob | null,
): Promise<ResizedThumbnail | null> {
  if (file.type.startsWith('image/')) {
    const res = await compute({ kind: 'resizeImage', file })
    if (res.kind === 'resizeImage' && res.result) {
      return { blob: res.result.blob, width: res.result.width, height: res.result.height }
    }
    return null
  }
  if (file.type === 'application/pdf') {
    const res = await compute({ kind: 'resizePdf', file })
    if (res.kind === 'resizePdf' && res.result) {
      return { blob: res.result.blob, width: res.result.width, height: res.result.height }
    }
    return null
  }
  if (file.type.startsWith('video/') && videoFrame) {
    const frameFile = new File([videoFrame], 'frame.webp', { type: 'image/webp' })
    const res = await compute({ kind: 'resizeImage', file: frameFile })
    if (res.kind === 'resizeImage' && res.result) {
      return { blob: res.result.blob, width: res.result.width, height: res.result.height }
    }
    return null
  }
  return null
}

export async function generateStage3Salient(file: File): Promise<Blob | null> {
  if (!file.type.startsWith('image/')) return null
  const { generateSalientCrop } = await import('@/workers/thumbnail.ai')
  return generateSalientCrop(file).catch((e) => {
    console.error('[generateSalientCrop]', e)
    return null
  })
}

// ── S3 PUT ───────────────────────────────────────────────────────────────

export async function putThumbnailToS3(
  uploadUrl: string,
  blob: Blob,
  itemId: string,
  stage: number,
): Promise<boolean> {
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    body: blob,
    headers: {
      'Content-Type': 'image/webp',
      'x-amz-acl': 'public-read',
    },
  }).catch((err) => {
    console.error(`[stage ${stage} PUT] network error`, itemId, err)
    return null
  })
  if (!res || !res.ok) {
    console.error(`[stage ${stage} PUT] non-ok`, itemId, res?.status)
    return false
  }
  return true
}

export function makeStageUrl(publicUrl: string, stage: 2 | 3): string {
  return `${publicUrl}?v=${stage}`
}

// ── Metadata extraction (pure, no fetcher) ───────────────────────────────

export interface MediaMetadata {
  imageWidth?: number
  imageHeight?: number
  cameraMake?: string
  cameraModel?: string
  iso?: number
  fNumber?: number
  exposureTime?: number
  focalLength?: number
  takenDateTime?: string
  latitude?: number
  longitude?: number
  videoWidth?: number
  videoHeight?: number
  duration?: number
  documentText?: string
  documentPageCount?: number
}

export async function extractMediaMetadata(file: File): Promise<MediaMetadata> {
  const meta: MediaMetadata = {}

  if (file.type.startsWith('image/')) {
    const dimsRes = await compute({ kind: 'imageDimensions', file })
    if (dimsRes.kind === 'imageDimensions' && dimsRes.result) {
      meta.imageWidth = dimsRes.result.width
      meta.imageHeight = dimsRes.result.height
    }
    const exif = await exifr.parse(file, {
      pick: ['Make', 'Model', 'ISO', 'FNumber', 'ExposureTime', 'FocalLength', 'DateTimeOriginal'],
    }).catch(() => null)
    if (exif) {
      if (exif.Make) meta.cameraMake = exif.Make
      if (exif.Model) meta.cameraModel = exif.Model
      if (exif.ISO != null) meta.iso = exif.ISO
      if (exif.FNumber != null) meta.fNumber = exif.FNumber
      if (exif.ExposureTime != null) meta.exposureTime = exif.ExposureTime
      if (exif.FocalLength != null) meta.focalLength = exif.FocalLength
      if (exif.DateTimeOriginal) meta.takenDateTime = new Date(exif.DateTimeOriginal).toISOString()
    }
    const gps = await exifr.gps(file).catch(() => null)
    if (gps) {
      meta.latitude = gps.latitude
      meta.longitude = gps.longitude
    }
  } else if (file.type.startsWith('video/')) {
    const v = await getVideoMetadata(file)
    if (v) {
      meta.videoWidth = v.width
      meta.videoHeight = v.height
      meta.duration = v.duration
    }
  } else if (file.type === 'application/pdf') {
    const textRes = await compute({ kind: 'pdfText', file })
    if (textRes.kind === 'pdfText' && textRes.result) {
      if (textRes.result.text) meta.documentText = textRes.result.text
      meta.documentPageCount = textRes.result.pageCount
    }
  }

  return meta
}

export function buildMediaMetadataFormData(itemId: string, meta: MediaMetadata): FormData {
  const fd = new FormData()
  fd.append('intent', 'save_media_metadata')
  fd.append('itemId', itemId)
  for (const [k, v] of Object.entries(meta)) {
    if (v != null) fd.append(k, String(v))
  }
  return fd
}
