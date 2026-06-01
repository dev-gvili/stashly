/**
 * Option A — Module-level reactive store.
 *
 * A `Map<itemId, ThumbProgress>` plus per-id subscriber sets. Producer
 * writes; consumer reads via `useSyncExternalStore`. No XState, no
 * fetcher coupling. PATCH is fired-and-forgotten via `useFetcher`.
 */
import { useCallback, useSyncExternalStore } from 'react'
import { useFetcher } from 'react-router'
import type { ThumbProgress, ThumbnailPublisher } from './signal.types'

const progress = new Map<string, ThumbProgress>()
const listeners = new Map<string, Set<() => void>>()

function emit(id: string) {
  const set = listeners.get(id)
  if (!set) return
  for (const l of set) l()
}

function write(id: string, next: ThumbProgress) {
  progress.set(id, next)
  emit(id)
}

function subscribe(id: string, fn: () => void): () => void {
  let set = listeners.get(id)
  if (!set) {
    set = new Set()
    listeners.set(id, set)
  }
  set.add(fn)
  return () => {
    set!.delete(fn)
    if (set!.size === 0) listeners.delete(id)
  }
}

export function useThumbnailPublisher(itemId: string): ThumbnailPublisher {
  const patchFetcher = useFetcher()

  const publishLocal = useCallback(
    ({ src }: { src: string }) => {
      write(itemId, { stage: 1, src })
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
      write(itemId, { stage, src, width, height })
    },
    [itemId, patchFetcher],
  )

  return { publishLocal, publishPersisted }
}

export function useLiveThumbnail(itemId: string): ThumbProgress | null {
  return useSyncExternalStore(
    (cb) => subscribe(itemId, cb),
    () => progress.get(itemId) ?? null,
    () => null,
  )
}
