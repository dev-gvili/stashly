/**
 * React surface for the machine-backed thumbnail pipeline.
 *
 * Two hooks, both thin; all state lives in the module-scope manager, which is
 * what lets a job survive the card that started it:
 *
 *   useThumbnailWhenVisible  the only thing that starts thumbnail work
 *   useLiveThumbnail         what a card paints while work is in flight
 */
import { useCallback, useSyncExternalStore } from 'react'
import { useSelector } from '@xstate/react'
import {
  thumbnailManager,
  requestThumbnail,
  cancelQueuedThumbnail,
} from './client'
import { shouldSkip } from './attempt-store'
import { hasHeldFile, subscribeToHeldFiles } from './held-files'
import { useItemCard } from '@/hooks/useItemCard'
import {
  canBackfillThumbnail,
  canThumbnailFromMemory,
  isConnectionTooSlow,
} from '@/utils/thumbnail-backfill'
import type { ThumbProgress } from './thumbnail.types'

/** How far outside the viewport a card counts as visible. */
const ROOT_MARGIN = '300px 0px'

// ── What a card paints ─────────────────────────────────────────────────────

/**
 * The freshest stage published for one item, or null if nothing yet.
 *
 * Reads the manager's own context. The reference comparator is load-bearing:
 * without it every card in a 500-item gallery re-renders each time any one
 * item sharpens.
 *
 * @example
 * const live = useLiveThumbnail(item.id)
 * <img src={live?.src ?? persistedUrl} />
 */
export function useLiveThumbnail(itemId: string): ThumbProgress | null {
  return useSelector(
    thumbnailManager,
    (s) => s.context.progress.get(itemId) ?? null,
    (a, b) => a === b
  )
}

// ── What starts thumbnail work ─────────────────────────────────────────────

interface Watch {
  itemId: string
}

const watched = new WeakMap<Element, Watch>()
let observer: IntersectionObserver | null = null

/**
 * The single shared `IntersectionObserver` every card registers with — one for
 * a whole gallery rather than one per card. Null during SSR.
 */
function getObserver(): IntersectionObserver | null {
  if (typeof IntersectionObserver === 'undefined') return null
  if (observer) return observer
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const watch = watched.get(entry.target)
        if (!watch) continue
        if (entry.isIntersecting) requestThumbnail(watch.itemId)
        else cancelQueuedThumbnail(watch.itemId)
      }
    },
    { rootMargin: ROOT_MARGIN }
  )
  return observer
}

/**
 * SSR-safe read of the Network Information API — true on a metered or slow
 * connection, where a full download for a nicer thumbnail isn't worth it.
 */
function onSlowConnection(): boolean {
  if (typeof navigator === 'undefined') return false
  const nav = navigator as Navigator & {
    connection?: { saveData?: boolean; effectiveType?: string }
  }
  return isConnectionTooSlow(nav.connection)
}

/**
 * Makes the surrounding `ItemCard`'s thumbnail once the card comes on screen.
 *
 * This is the only trigger for thumbnail work: nothing is made for a card
 * nobody has seen, including fresh uploads. Returns a callback ref for the
 * card's thumbnail area. A card is watched only when a job could help it:
 * no thumbnail yet (stored, or painted in this tab), a type we can render,
 * and either
 *
 *   - its uploaded file is still held — made from memory, any size; or
 *   - the original can be downloaded — up to 16 MB, not on a slow connection,
 *     not already failed for good.
 *
 * It re-checks when an upload's file arrives, so a card already on screen
 * switches from "download" to "from memory" without a reload.
 *
 * @example
 * const thumbnailRef = useThumbnailWhenVisible()
 * return <div ref={thumbnailRef}>…</div>
 */
export function useThumbnailWhenVisible() {
  const { id, name, type, size, thumbnails, file } = useItemCard()
  const fileHeld = useSyncExternalStore(
    subscribeToHeldFiles,
    () => hasHeldFile(id),
    () => false
  )
  const live = useLiveThumbnail(id)
  const paintedThisTab = live?.stage === 2 || live?.stage === 3

  const candidate = {
    type,
    name,
    size: Number(size ?? 0),
    mimeType: file?.mimeType,
    thumbnailUrls: thumbnails?.map((t) => t.url),
  }
  // A thumbnail painted in this tab isn't in the loader's `thumbnails` until
  // the page reloads; without this check the card would ask for it again.
  const eligible =
    !paintedThisTab &&
    (fileHeld
      ? !shouldSkip(id, 'fromMemory') && canThumbnailFromMemory(candidate)
      : !shouldSkip(id, 'fromDownload') &&
        canBackfillThumbnail(candidate) &&
        !onSlowConnection())

  return useCallback(
    (node: Element | null) => {
      if (!node) return
      if (!eligible) return
      const io = getObserver()
      if (!io) return
      watched.set(node, { itemId: id })
      io.observe(node)
      return () => {
        io.unobserve(node)
        watched.delete(node)
        cancelQueuedThumbnail(id)
      }
    },
    // `fileHeld` is in the list so a card already on screen is observed
    // afresh when its file arrives; observing fires an initial entry, which
    // requests the job again, now from memory.
    [eligible, id, fileHeld]
  )
}

// ── Upload coordination ────────────────────────────────────────────────────

export { holdUploadedFile, pauseDownloads, resumeDownloads } from './client'
