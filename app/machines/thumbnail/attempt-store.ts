/**
 * Bookkeeping for "don't try this one again".
 *
 * A backfill costs a full download of the original, so an item that can't
 * produce a thumbnail must be attempted once and then left alone — otherwise
 * every visit to a folder of un-thumbnailable files re-downloads all of them.
 *
 * Two layers, deliberately:
 *   • in-memory — covers this tab's lifetime, including client-side navigation
 *   • sessionStorage — carries *permanent* failures across a reload
 *
 * NOTE (parallel track): this duplicates the module-private bookkeeping inside
 * `app/hooks/useThumbnailBackfill.ts`. It is re-created here rather than
 * exported from there because that file must stay untouched until the machine
 * path is proven. Collapse the two at merge-back — including the storage key,
 * which is shared on purpose so a switch between the two implementations
 * inherits the other's skip list instead of re-downloading everything.
 */

/** Cap on the persisted skip list so sessionStorage can't grow unbounded. */
const MAX_REMEMBERED_FAILURES = 500

/** Shared with the legacy hook on purpose — see the note above. */
const FAILED_STORAGE_KEY = 'stashly:thumb-backfill-failed'

/** Items this tab has already handed to the queue, successful or not. */
const attempted = new Set<string>()

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

/** True when this tab has already queued work for the item. */
export function hasAttempted(itemId: string): boolean {
  return attempted.has(itemId)
}

/**
 * Marks an item as attempted.
 *
 * Called when a job actually *starts*, not when it is enqueued: a card that
 * scrolls back out of range before its slot opens is cancelled, and has to stay
 * re-triable.
 */
export function markAttempted(itemId: string): void {
  attempted.add(itemId)
}

/** True when the item is on the permanent skip list or already attempted here. */
export function shouldSkip(itemId: string): boolean {
  return attempted.has(itemId) || failedIds().has(itemId)
}

/** Test seam — resets both layers. */
export function resetAttemptStore(): void {
  attempted.clear()
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
