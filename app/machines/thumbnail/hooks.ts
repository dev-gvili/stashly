/**
 * React surface for the machine-backed thumbnail pipeline.
 *
 * Every hook here matches the signature of the one it stands in for, so the
 * barrel can swap implementations without a single call site changing shape:
 *
 *   useThumbnail          ← app/hooks/useThumbnail.ts
 *   useThumbnailBackfill  ← app/hooks/useThumbnailBackfill.ts
 *   useLiveThumbnail      ← app/hooks/thumbnail-signal
 *
 * The hooks are thin by design. All the state lives in the module-scope
 * manager, which is what lets a pipeline survive the component that started it.
 */
import { useCallback } from 'react'
import { useSelector } from '@xstate/react'
import {
  thumbnailManager,
  enqueueUpload,
  enqueueBackfill,
  cancelJob,
} from './client'
import { shouldSkip } from './attempt-store'
import { useItemCard } from '@/hooks/useItemCard'
import {
  canBackfillThumbnail,
  isConnectionTooSlow,
} from '@/utils/thumbnail-backfill'
import type { ThumbProgress } from './thumbnail.types'

/** How far outside the viewport a card starts its backfill. */
const ROOT_MARGIN = '300px 0px'

// ── Upload path ────────────────────────────────────────────────────────────

/**
 * Queues the full pipeline for one uploaded file.
 *
 * Unchanged in shape from the hook it replaces, but not in nature: `run` now
 * hands the work to a scheduler that outlives this component, so unmounting
 * mid-pipeline no longer abandons anything.
 *
 * @example
 * const { run } = useThumbnail(itemId)
 * useEffect(() => { void run(file) }, [itemId])
 */
export function useThumbnail(itemId: string) {
  const run = useCallback((file: File) => enqueueUpload(itemId, file), [itemId])
  return { run }
}

// ── Consumer ───────────────────────────────────────────────────────────────

/**
 * The freshest stage published for one item, or null if nothing yet.
 *
 * Reads the manager's own context — pipeline state and broadcast state are the
 * same thing now, where the old code kept them in two places behind
 * `ACTIVE_SIGNAL`. The reference comparator is load-bearing: without it every
 * card in a 500-item gallery re-renders each time any one item sharpens.
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

// ── Backfill path ──────────────────────────────────────────────────────────

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
        if (entry.isIntersecting) enqueueBackfill(watch.itemId)
        else cancelJob(watch.itemId)
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
 * Arms viewport-gated thumbnail backfill for the surrounding `ItemCard`.
 *
 * Returns a callback ref for whatever element represents the card's thumbnail
 * area. Items that already have a thumbnail, aren't files, are too large, or
 * have no renderer are never observed at all — the eligibility test is the
 * cheapest guard available, made from data the card already holds.
 *
 * The scheduling that used to live in this hook (LIFO queue, concurrency cap,
 * idle scheduling, pause/resume) is now the manager's job; what stays here is
 * the part that genuinely needs the DOM.
 *
 * @example
 * const backfillRef = useThumbnailBackfill()
 * return <div ref={backfillRef}>…</div>
 */
export function useThumbnailBackfill() {
  const { id, name, type, size, thumbnails, file } = useItemCard()

  const eligible =
    !shouldSkip(id) &&
    canBackfillThumbnail({
      type,
      name,
      size: Number(size ?? 0),
      mimeType: file?.mimeType,
      thumbnailUrls: thumbnails?.map((t) => t.url),
    }) &&
    !onSlowConnection()

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
        cancelJob(id)
      }
    },
    [eligible, id]
  )
}

// ── Upload coordination ────────────────────────────────────────────────────

export { pauseBackfill, resumeBackfill } from './client'
