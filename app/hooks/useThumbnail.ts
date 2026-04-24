import { useState, useCallback } from 'react'
import type { ThumbnailStage } from '@/types/machine.types'
import { hashToColor, extractTinyThumbnail, canvasResize, dataUrlToBlob } from '@/utils/thumbnail'
import { generateVideoThumbnail } from '@/utils/video'
import { generateSalientCrop, generateCaption } from '@/workers/thumbnail.ai'

interface ThumbnailState {
  stage: ThumbnailStage
  /** null = use hex color from stage 0 (stored in `color`); string = API URL */
  src: string | null
  /** hex color, populated at stage 0 */
  color: string | null
}

export function useThumbnail() {
  const [state, setState] = useState<ThumbnailState>({
    stage: 0,
    src: null,
    color: null,
  })

  const run = useCallback(async (itemId: string, file: File) => {
    // ── Stage 0: color hash ──────────────────────────────────────────────
    const color = hashToColor(file.name, file.type)
    setState({ stage: 0, src: null, color })

    await fetch('/api/thumbnails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ itemId, url: color }).toString(),
    }).catch(() => {})

    // ── Stage 1: tiny preview ────────────────────────────────────────────
    let tinyDataUrl: string | null = null
    if (file.type.startsWith('image/')) {
      tinyDataUrl = await extractTinyThumbnail(file).catch(() => null)
    } else if (file.type.startsWith('video/')) {
      tinyDataUrl = await generateVideoThumbnail(file).catch(() => null)
    }

    if (tinyDataUrl) {
      const blob = dataUrlToBlob(tinyDataUrl)
      const fd1 = new FormData()
      fd1.append('stage', '1')
      fd1.append('content', blob, 'thumb.jpg')
      fd1.append('width', '8')
      fd1.append('height', '8')
      await fetch(`/api/thumbnails/${itemId}`, { method: 'PATCH', body: fd1 }).catch(() => {})
      setState({ stage: 1, src: `/api/thumbnails/${itemId}?v=1`, color })
    }

    // ── Stage 2: full resize ─────────────────────────────────────────────
    let resizedBlob: Blob | null = null
    if (file.type.startsWith('image/')) {
      resizedBlob = await canvasResize(file, 512).catch(() => null)
    } else if (file.type.startsWith('video/') && tinyDataUrl) {
      const frameFile = new File([dataUrlToBlob(tinyDataUrl)], 'frame.jpg', { type: 'image/jpeg' })
      resizedBlob = await canvasResize(frameFile, 512).catch(() => null)
    }

    if (resizedBlob) {
      const bitmap = await createImageBitmap(resizedBlob)
      const fd2 = new FormData()
      fd2.append('stage', '2')
      fd2.append('content', resizedBlob, 'thumb.jpg')
      fd2.append('width', String(bitmap.width))
      fd2.append('height', String(bitmap.height))
      bitmap.close()
      await fetch(`/api/thumbnails/${itemId}`, { method: 'PATCH', body: fd2 }).catch(() => {})
      setState({ stage: 2, src: `/api/thumbnails/${itemId}?v=2`, color })

      // ── Stage 3: saliency crop (WebGPU only — skipped silently otherwise) ─
      const croppedBlob = await generateSalientCrop(resizedBlob).catch(() => null)
      if (croppedBlob) {
        const bm3 = await createImageBitmap(croppedBlob)
        const fd3 = new FormData()
        fd3.append('stage', '3')
        fd3.append('content', croppedBlob, 'thumb.jpg')
        fd3.append('width', String(bm3.width))
        fd3.append('height', String(bm3.height))
        bm3.close()
        await fetch(`/api/thumbnails/${itemId}`, { method: 'PATCH', body: fd3 }).catch(() => {})
        setState({ stage: 3, src: `/api/thumbnails/${itemId}?v=3`, color })

        // ── Stage 4: VLM caption overlay ────────────────────────────────────
        const captionResult = await generateCaption(croppedBlob).catch(() => null)
        if (captionResult) {
          const bm4 = await createImageBitmap(captionResult.blob)
          const fd4 = new FormData()
          fd4.append('stage', '4')
          fd4.append('content', captionResult.blob, 'thumb.jpg')
          fd4.append('width', String(bm4.width))
          fd4.append('height', String(bm4.height))
          bm4.close()
          await fetch(`/api/thumbnails/${itemId}`, { method: 'PATCH', body: fd4 }).catch(() => {})
          setState({ stage: 4, src: `/api/thumbnails/${itemId}?v=4`, color })
        }
      }
    }
  }, [])

  return { ...state, run }
}
