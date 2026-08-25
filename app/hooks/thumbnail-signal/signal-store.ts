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

/**
 * Notifies every subscriber watching one item that its progress changed.
 * Per-id subscriber sets are the point of the design: a gallery of 200 cards
 * must not re-render because one thumbnail advanced.
 *
 * @param id - Item whose subscribers should be notified.
 *
 * @example
 * // Called after every write
 * progress.set(id, next)
 * emit(id)
 *
 * @example
 * // No subscribers for that id is a no-op, not an error
 * emit('itm_never_rendered')
 */
function emit(id: string) {
  const set = listeners.get(id)
  if (!set) return
  for (const l of set) l()
}

/**
 * Stores the latest progress for an item and notifies its subscribers. The map
 * lives at module scope, so progress survives a card unmounting and remounting
 * (scrolling, client-side navigation) without a round trip.
 *
 * @param id - Item the progress belongs to.
 * @param next - The stage descriptor to publish.
 *
 * @example
 * // Stage 1 — a local blob URL, never persisted
 * write(itemId, { stage: 1, src: objectUrl })
 *
 * @example
 * // Stage 2 — persisted, with the dimensions the card needs to reserve space
 * write(itemId, { stage: 2, src: url, width: 512, height: 384 })
 */
function write(id: string, next: ThumbProgress) {
  progress.set(id, next)
  emit(id)
}

/**
 * Registers a listener for one item's progress and hands back the unsubscribe.
 * Empty subscriber sets are deleted on teardown so the map doesn't accumulate
 * an entry per item ever rendered.
 *
 * @param id - Item to watch.
 * @param fn - Called whenever that item's progress is written.
 *
 * @example
 * // The `useSyncExternalStore` subscribe argument
 * useSyncExternalStore((cb) => subscribe(itemId, cb), () => progress.get(itemId) ?? null)
 *
 * @example
 * // Manual use outside React
 * const off = subscribe(itemId, () => console.debug('thumb advanced'))
 * off()
 */
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

/**
 * Producer side of the module-store signal. `publishLocal` writes the stage-1
 * blob URL to the store only; `publishPersisted` fires the PATCH *and* writes,
 * so consumers paint the new stage without waiting for the round trip.
 *
 * @param itemId - Item whose thumbnail progress this publisher broadcasts.
 *
 * @example
 * // Stage 1 — instant local preview, no HTTP
 * const publisher = useThumbnailPublisher(itemId)
 * publisher.publishLocal({ src: URL.createObjectURL(tinyBlob) })
 *
 * @example
 * // Stage 2 — S3 PUT already done; this persists and broadcasts
 * publisher.publishPersisted({ stage: 2, src: stage2Url, width, height })
 */
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

/**
 * Consumer side of the module-store signal — the latest published stage for one
 * item, or null when nothing has been published. SSR-safe via
 * `useSyncExternalStore`'s server snapshot, which always reports null.
 *
 * @param itemId - Item to watch.
 *
 * @example
 * // Prefer live progress over the persisted URL from the loader
 * const live = useLiveThumbnail(item.id)
 * <img src={live?.src ?? item.thumbnails?.[0]?.url} />
 *
 * @example
 * // Reserve layout space once stage 2 reports its dimensions
 * const live = useLiveThumbnail(item.id)
 * <div style={{ aspectRatio: live?.width && live?.height ? live.width / live.height : 1 }} />
 */
export function useLiveThumbnail(itemId: string): ThumbProgress | null {
  return useSyncExternalStore(
    (cb) => subscribe(itemId, cb),
    () => progress.get(itemId) ?? null,
    () => null,
  )
}
