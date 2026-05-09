import { useState, useCallback } from 'react'
import type { ThumbnailStage } from '@/types/machine.types'
import {
  hashToColor,
  extractTinyThumbnail,
  canvasResize,
  dataUrlToBlob,
} from '@/utils/thumbnail'
import { generateVideoThumbnail, getVideoMetadata } from '@/utils/video'
import { useFetcher } from 'react-router'
import exifr from 'exifr'

interface ThumbnailState {
  stage: ThumbnailStage
  /** null = use hex color from stage 0 (stored in `color`); string = public URL */
  src: string | null
  /** hex color, populated at stage 0 */
  color: string | null
}

async function saveMediaMetadata(itemId: string, file: File) {
  const fd = new FormData()
  fd.append('intent', 'save_media_metadata')
  fd.append('itemId', itemId)

  if (file.type.startsWith('image/')) {
    const bitmap = await createImageBitmap(file)
    fd.append('imageWidth', String(bitmap.width))
    fd.append('imageHeight', String(bitmap.height))
    bitmap.close()

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
  }

  const res = await fetch('/api/items', { method: 'POST', body: fd }).catch((e) => { console.error('[saveMediaMetadata] fetch failed', e); return null })
  if (res && !res.ok) console.error('[saveMediaMetadata] server error', res.status, await res.text().catch(() => ''))
}

/**
 * Runs the 5-stage thumbnail pipeline for a newly uploaded file.
 * Stages: 0 = color hash placeholder → 1 = tiny 8×8 WebP preview →
 * 2 = 512px resize → 3 = ViT salient crop → 4 = Florence-2 caption overlay.
 * Each stage persists to S3 via presigned URL and patches `/api/thumbnails/:id`.
 *
 * @returns `{ stage, src, color, run }` — current pipeline state + the `run` trigger.
 *
 * @example
 * // Start the pipeline after a file is uploaded
 * const { stage, src, color, run } = useThumbnail()
 * useEffect(() => { run(itemId, file) }, [itemId])
 * return src ? <img src={src} /> : <div style={{ background: color }} />
 *
 * @example
 * // Use from useUpload which calls run automatically on itemCreated
 * const { runThumbnail } = useUpload()
 * runThumbnail(mediaFile.id, mediaFile.file, () => navigate(location.pathname))
 *
 * @example
 * // Show a loading state while pipeline is in progress (stage < 2)
 * const { stage } = useThumbnail()
 * if (stage < 2) return <Skeleton />
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

    // ── Stage 1: tiny preview ────────────────────────────────────────────
    let tinyDataUrl: string | null = null
    if (file.type.startsWith('image/')) {
      tinyDataUrl = await extractTinyThumbnail(file).catch(() => null)
    } else if (file.type.startsWith('video/')) {
      tinyDataUrl = await generateVideoThumbnail(file).catch(() => null)
    }

    if (tinyDataUrl) {
      const blob = dataUrlToBlob(tinyDataUrl)
      const presignRes = await fetch(`/api/thumbnails/${itemId}/presign`).catch(
        () => null
      )
      const presign = presignRes ? await presignRes.json().catch(() => null) : null
      if (presign?.uploadUrl && presign?.publicUrl) {
        await fetch(presign.uploadUrl, {
          method: 'PUT',
          body: blob,
          headers: { 'Content-Type': 'image/webp' },
        }).catch(() => {})

        const fd1 = new FormData()
        fd1.append('stage', '1')
        fd1.append('url', presign.publicUrl)
        fd1.append('width', '8')
        fd1.append('height', '8')
        await fetch(`/api/thumbnails/${itemId}`, {
          method: 'PATCH',
          body: fd1,
        }).catch(() => {})
        setState({ stage: 1, src: presign.publicUrl, color })
        onReady?.()
      }
    }

    // ── Stage 2: full resize ─────────────────────────────────────────────
    let resizedBlob: Blob | null = null
    if (file.type.startsWith('image/')) {
      resizedBlob = await canvasResize(file, 512).catch(() => null)
    } else if (file.type.startsWith('video/') && tinyDataUrl) {
      const frameFile = new File([dataUrlToBlob(tinyDataUrl)], 'frame.jpg', {
        type: 'image/jpeg',
      })
      resizedBlob = await canvasResize(frameFile, 512).catch(() => null)
    }

    if (resizedBlob) {
      const bitmap = await createImageBitmap(resizedBlob)
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

        const fd2 = new FormData()
        fd2.append('stage', '2')
        fd2.append('url', presign.publicUrl)
        fd2.append('width', String(bitmap.width))
        fd2.append('height', String(bitmap.height))
        bitmap.close()
        await fetch(`/api/thumbnails/${itemId}`, {
          method: 'PATCH',
          body: fd2,
        }).catch(() => {})
        setState({ stage: 2, src: presign.publicUrl, color })

        // Fire-and-forget: save real media dimensions + EXIF to the Image/Video facet
        saveMediaMetadata(itemId, file).catch((e) => console.error('[saveMediaMetadata]', e))

        // ── Stage 3: ViT saliency crop ──────────────────────────────────────
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
              const fd3 = new FormData()
              fd3.append('stage', '3')
              fd3.append('url', presign3.publicUrl)
              fd3.append('width', '512')
              fd3.append('height', '512')
              await fetch(`/api/thumbnails/${itemId}`, { method: 'PATCH', body: fd3 }).catch(() => {})
              setState({ stage: 3, src: presign3.publicUrl, color })
            }

            // ── Stage 4: Florence-2 caption overlay ────────────────────────
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
                const fd4 = new FormData()
                fd4.append('stage', '4')
                fd4.append('url', presign4.publicUrl)
                fd4.append('width', '512')
                fd4.append('height', '512')
                await fetch(`/api/thumbnails/${itemId}`, { method: 'PATCH', body: fd4 }).catch(() => {})
                setState({ stage: 4, src: presign4.publicUrl, color })
              }
            }
          }
        }
      } else {
        bitmap.close()
      }
    }
  }, [fetcher])

  return { ...state, run }
}
