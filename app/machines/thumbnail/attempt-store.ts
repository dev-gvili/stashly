/**
 * Bookkeeping for "don't try this one again".
 *
 * A `fromDownload` job costs a full download of the original, so an item that
 * can't produce a thumbnail must be attempted once and then left alone —
 * otherwise every visit to a folder of un-thumbnailable files re-downloads all
 * of them.
 *
 * Two layers, deliberately:
 *   • in-memory — covers this tab's lifetime, including client-side navigation
 *   • sessionStorage — carries *permanent* failures across a reload
 */
import type { ThumbMode } from './thumbnail.types'

/** Cap on the persisted skip list so sessionStorage can't grow unbounded. */
const MAX_REMEMBERED_FAILURES = 500

/**
 * Kept from the old backfill hook so skip lists already in open tabs still
 * apply; renaming it would re-download every known failure once.
 */
const FAILED_STORAGE_KEY = 'stashly:thumb-backfill-failed'

/**
 * Items this tab has already started a job for, kept per kind of job.
 *
 * Separate on purpose. A `fromMemory` attempt that fails (a compute timeout in
 * a big batch) must still leave one `fromDownload` attempt open; with a single
 * set, a failed upload-time thumbnail blocked the item for the rest of the tab.
 */
const attempted: Record<ThumbMode, Set<string>> = {
  fromMemory: new Set(),
  fromDownload: new Set(),
}

let failedCache: Set<string> | null = null

/**
 * The persisted skip list, read once from `sessionStorage` and cached in
 * memory afterwards. Corrupt or unavailable storage degrades to an empty set
 * rather than throwing — a redundant download beats a broken gallery.
 */
export function failedIds(): Set<string> {
  if (failedCache) return failedCache
  failedCache = new Set()
  if (typeof sessionStorage === 'undefined') return failedCache
  try {
    const raw = sessionStorage.getItem(FAILED_STORAGE_KEY)
    if (raw) for (const id of JSON.parse(raw) as string[]) failedCache.add(id)
  } catch {
    // Corrupt or unavailable storage — an empty skip list is a safe default.
  }
  return failedCache
}

/**
 * Records a permanent failure so the item is never re-downloaded, trimming to
 * {@link MAX_REMEMBERED_FAILURES}. A quota or private-mode write failure still
 * leaves the in-memory set correct for this tab.
 */
export function rememberFailure(itemId: string): void {
  const set = failedIds()
  set.add(itemId)
  if (typeof sessionStorage === 'undefined') return
  try {
    const ids = Array.from(set).slice(-MAX_REMEMBERED_FAILURES)
    failedCache = new Set(ids)
    sessionStorage.setItem(FAILED_STORAGE_KEY, JSON.stringify(ids))
  } catch {
    // Quota or private mode — the in-memory set still holds for this tab.
  }
}

/**
 * Marks that a job of this kind started for the item.
 *
 * Called when a job actually *starts*, not when it is queued: a card that
 * scrolls back out of range before its slot opens is cancelled, and has to stay
 * re-triable.
 *
 * @example
 * markAttempted(job.itemId, job.mode)
 */
export function markAttempted(itemId: string, mode: ThumbMode): void {
  attempted[mode].add(itemId)
}

/**
 * Whether a job of this kind should not be started for the item.
 *
 * `fromMemory`: already tried in this tab. `fromDownload`: already tried in
 * this tab, or on the permanent skip list, since every download attempt costs
 * the whole original.
 *
 * @example
 * if (shouldSkip(itemId, 'fromDownload')) return
 */
export function shouldSkip(itemId: string, mode: ThumbMode): boolean {
  if (attempted[mode].has(itemId)) return true
  return mode === 'fromDownload' && failedIds().has(itemId)
}

/** Test seam — resets both layers. */
export function resetAttemptStore(): void {
  attempted.fromMemory.clear()
  attempted.fromDownload.clear()
  failedCache = null
  // `typeof` rather than optional chaining: in a non-browser context the
  // identifier is undeclared, and `sessionStorage?.` would still throw.
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.removeItem(FAILED_STORAGE_KEY)
  } catch {
    // Nothing to clear.
  }
}

/**
 * Runs `fn` on the next idle frame so a backfill never starts on a frame the
 * user is scrolling or typing in. Falls back to a near-immediate `setTimeout`
 * where `requestIdleCallback` is missing (Safari), and is bounded so a
 * permanently busy tab still makes progress.
 */
const IDLE_TIMEOUT_MS = 2_000

export function whenIdle(fn: () => void): void {
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(() => fn(), { timeout: IDLE_TIMEOUT_MS })
    return
  }
  setTimeout(fn, 1)
}
