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

/**
 * Notifies the stage-1 subscribers for one item. Only stage 1 needs this side
 * channel — stages 2 and 3 travel through the keyed fetcher itself, which React
 * Router already broadcasts.
 *
 * @param id - Item whose stage-1 listeners should fire.
 *
 * @example
 * // Called right after the local preview is stored
 * stage1Map.set(itemId, { src })
 * emitStage1(itemId)
 *
 * @example
 * // No listeners registered is a no-op
 * emitStage1('itm_offscreen')
 */
function emitStage1(id: string) {
  const set = stage1Listeners.get(id)
  if (!set) return
  for (const l of set) l()
}

/**
 * Registers a stage-1 listener for one item and hands back the unsubscribe,
 * dropping the empty set on teardown so the listener map stays bounded.
 *
 * @param id - Item to watch for a local preview.
 * @param fn - Called when that item's stage-1 blob URL is published.
 *
 * @example
 * // The `useSyncExternalStore` subscribe argument
 * useSyncExternalStore((cb) => subscribeStage1(itemId, cb), () => stage1Map.get(itemId))
 *
 * @example
 * // Manual use outside React
 * const off = subscribeStage1(itemId, () => console.debug('preview ready'))
 * off()
 */
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

/**
 * The React Router fetcher key that carries one item's thumbnail PATCH.
 * Producer and consumer must derive it identically — a keyed fetcher is the
 * whole broadcast channel in this implementation.
 *
 * @param itemId - Item the fetcher belongs to.
 *
 * @example
 * // Both sides open the same channel
 * const fetcher = useFetcher({ key: patchKey(itemId) })
 *
 * @example
 * patchKey('itm_123') // → 'thumb:itm_123'
 */
function patchKey(itemId: string) {
  return `thumb:${itemId}`
}

/**
 * Producer side of the keyed-fetcher signal (the active implementation).
 * `publishPersisted` submits the PATCH and nothing else — the submission itself
 * is the broadcast, since consumers read the same keyed fetcher's `formData`
 * the moment it goes out. `publishLocal` uses the stage-1 side map, because a
 * local blob URL never touches the network.
 *
 * @param itemId - Item whose thumbnail progress this publisher broadcasts.
 *
 * @example
 * // Stage 1 — instant preview from the file already in memory
 * const publisher = useThumbnailPublisher(itemId)
 * publisher.publishLocal({ src: URL.createObjectURL(tinyBlob) })
 *
 * @example
 * // Stage 2 — consumers see this before the PATCH resolves
 * publisher.publishPersisted({ stage: 2, src: stage2Url, width, height })
 */
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

/**
 * Consumer side of the keyed-fetcher signal. Reads the in-flight submission
 * first (`formData`, available the instant the PATCH is sent), then the settled
 * response, and only falls back to the stage-1 side map. The keyed fetcher wins
 * because React Router retains keyed state globally, so a card that unmounts and
 * remounts mid-pipeline still sees stages 2 and 3.
 *
 * @param itemId - Item to watch.
 *
 * @example
 * // Live progress beats the loader's persisted URL while the pipeline runs
 * const live = useLiveThumbnail(item.id)
 * <img src={live?.src ?? item.thumbnails?.[0]?.url} />
 *
 * @example
 * // Stage tells you how sharp the current image is
 * const live = useLiveThumbnail(item.id)
 * <img src={live?.src} className={cn(live?.stage === 1 && 'blur-sm')} />
 */
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
