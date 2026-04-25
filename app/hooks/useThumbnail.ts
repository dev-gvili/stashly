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

  await fetch('/api/items', { method: 'POST', body: fd }).catch(() => {})
}

export function useThumbnail() {
  const [state, setState] = useState<ThumbnailState>({
    stage: 0,
    src: null,
    color: null,
  })

  const fetcher = useFetcher()

  const run = useCallback(async (itemId: string, file: File) => {
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
        saveMediaMetadata(itemId, file).catch(() => {})
      } else {
        bitmap.close()
      }
    }
  }, [fetcher])

  return { ...state, run }
}
