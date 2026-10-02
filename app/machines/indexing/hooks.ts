/**
 * React surface for search indexing. All state lives in the queue in
 * `client.ts`; this only turns its "metadata saved" reports into a page reload.
 */
import { useEffect } from 'react'
import { useRevalidator } from 'react-router'
import { useSelector } from '@xstate/react'
import { useDebouncedCommit } from '@/hooks/useDebouncedCommit'
import { indexingQueue, markIndexingRevalidated } from './client'
import type { IndexQueueContext } from './indexing.types'

/** Quiet period after the queue drains before the page reloads. */
const REVALIDATE_DEBOUNCE_MS = 700

/**
 * True while any file is queued or being indexed.
 *
 * @param context - The indexing queue's context.
 * @returns Whether the queue still has work.
 *
 * @example
 * const busy = useSelector(indexingQueue, (s) => isIndexing(s.context))
 */
function isIndexing(context: IndexQueueContext): boolean {
  return context.queue.length > 0 || context.running.size > 0
}

/**
 * Reloads the page's data once per upload batch, after its metadata is saved.
 *
 * `save_media_metadata` writes facets the page shows (page count, dimensions,
 * EXIF), and indexing saves with a plain `fetch`, which reloads nothing. So
 * this waits until the queue is empty, then calls `revalidate()` once.
 * Files save their metadata seconds apart, so reloading per save ran the
 * folder loader once per file (64 times for a 64-file folder).
 *
 * `revalidate()`, never `navigate(<current URL>)`: if you are navigating when
 * it fires, `revalidate()` reloads the page you are going to, while a new
 * `navigate()` would cancel your navigation and keep you where you were.
 *
 * @example
 * // Mount once, high in the upload UI
 * useIndexingRevalidation()
 */
export function useIndexingRevalidation() {
  const savedCount = useSelector(
    indexingQueue,
    (s) => s.context.metadataSaved.length
  )
  const busy = useSelector(indexingQueue, (s) => isIndexing(s.context))
  const revalidator = useRevalidator()

  const { markCommitted } = useDebouncedCommit(
    savedCount,
    () => {
      markIndexingRevalidated()
      revalidator.revalidate()
    },
    { delayMs: REVALIDATE_DEBOUNCE_MS, enabled: savedCount > 0 && !busy }
  )

  // `markIndexingRevalidated` empties the list, so the count drops back to 0
  // right after a reload. Recording 0 as committed lets the next batch fire
  // even when it happens to reach the same count as the last one.
  useEffect(() => {
    if (savedCount === 0) markCommitted(0)
  }, [savedCount, markCommitted])
}
