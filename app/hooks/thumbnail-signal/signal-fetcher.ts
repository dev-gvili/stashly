/**
 * Option B — Per-item keyed fetcher as the signal.
 *
 * Producer and consumer both call `useFetcher({ key: 'thumb:<id>' })`.
 * Stages 2/3 flow through the fetcher itself: the producer submits the
 * PATCH, the consumer reads `fetcher.formData?.get('url')` (available
 * immediately on submit) and `fetcher.data?.url` (after the PATCH lands).
 *
 * Stage 1 is local-only — no HTTP — so it rides in a tiny side map with
 * subscribers, mirroring the module-store approach but only for stage 1.
 */
import { useCallback, useSyncExternalStore } from 'react'
import { useFetcher } from 'react-router'
import type { ThumbProgress, ThumbnailPublisher } from './signal.types'

const stage1Map = new Map<string, { src: string }>()
const stage1Listeners = new Map<string, Set<() => void>>()

function emitStage1(id: string) {
  const set = stage1Listeners.get(id)
  if (!set) return
  for (const l of set) l()
}

function subscribeStage1(id: string, fn: () => void): () => void {
  let set = stage1Listeners.get(id)
  if (!set) {
    set = new Set()
    stage1Listeners.set(id, set)
  }
  set.add(fn)
  return () => {
    set!.delete(fn)
    if (set!.size === 0) stage1Listeners.delete(id)
  }
}

function patchKey(itemId: string) {
  return `thumb:${itemId}`
}

export function useThumbnailPublisher(itemId: string): ThumbnailPublisher {
  const patchFetcher = useFetcher({ key: patchKey(itemId) })

  const publishLocal = useCallback(
    ({ src }: { src: string }) => {
      stage1Map.set(itemId, { src })
      emitStage1(itemId)
    },
    [itemId],
  )

  const publishPersisted = useCallback(
    ({ stage, src, width, height }: { stage: 2 | 3; src: string; width: number; height: number }) => {
      const fd = new FormData()
      fd.append('stage', String(stage))
      fd.append('url', src)
      fd.append('width', String(width))
      fd.append('height', String(height))
      patchFetcher.submit(fd, { method: 'patch', action: `/api/thumbnails/${itemId}` })
    },
    [itemId, patchFetcher],
  )

  return { publishLocal, publishPersisted }
}

export function useLiveThumbnail(itemId: string): ThumbProgress | null {
  const fetcher = useFetcher({ key: patchKey(itemId) })

  const stage1 = useSyncExternalStore(
    (cb) => subscribeStage1(itemId, cb),
    () => stage1Map.get(itemId),
    () => undefined,
  )

  // Read from the keyed fetcher first — covers stage 2/3 across mount/unmount
  // of any single consumer, because RR retains keyed-fetcher state globally.
  const live = fetcher.formData ?? fetcher.data
  const submittedUrl = fetcher.formData?.get('url')
  if (typeof submittedUrl === 'string') {
    const stage = Number(fetcher.formData?.get('stage')) as 2 | 3
    const width = Number(fetcher.formData?.get('width'))
    const height = Number(fetcher.formData?.get('height'))
    return { stage, src: submittedUrl, width, height }
  }
  const dataUrl = (live as { url?: string; stage?: number; width?: number; height?: number } | undefined)?.url
  if (typeof dataUrl === 'string') {
    const d = live as { url: string; stage: number; width?: number; height?: number }
    return { stage: (d.stage as 2 | 3) ?? 2, src: d.url, width: d.width, height: d.height }
  }

  if (stage1) return { stage: 1, src: stage1.src }
  return null
}
