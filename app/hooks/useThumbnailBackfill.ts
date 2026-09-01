/**
 * On-the-fly thumbnail generation for items that never got one.
 *
 * Upload-time generation can fail (deeply nested folders in a huge upload,
 * a tab closed mid-run, a compute timeout). Those items fall back to a
 * category icon forever, because the pipeline only ever runs from the upload
 * queue where the original `File` is in memory. This hook closes that gap: it
 * re-downloads the original and runs stage 2 of the same pipeline.
 *
 * A backfill costs a full download, so the whole thing is deliberately lazy —
 * the guards are the feature:
 *
 *   • **Viewport-gated** — one shared IntersectionObserver; work starts only
 *     for cards at or near the viewport, never for the 500 below the fold.
 *   • **LIFO** — the newest request runs first. Scrolling fast past 200 cards
 *     leaves the ones you actually stopped on at the top of the stack.
 *   • **Capped** — {@link MAX_CONCURRENT} jobs at a time, and each job's heavy
 *     compute already serializes inside the thumbnail compute worker.
 *   • **Idle-scheduled** — jobs start in `requestIdleCallback`, so a backfill
 *     never begins on a frame the user is scrolling or typing in.
 *   • **Yields to uploads** — `pauseBackfill()` while an upload is in flight;
 *     fresh uploads own the pipeline and the bandwidth.
 *   • **Attempted once** — successes and permanent failures are remembered so
 *     a file that can't produce a thumbnail is never downloaded twice.
 *
 * Stage 3 (the ViT saliency crop) is intentionally skipped: it is the most
 * expensive stage and buys the least on a backfill.
 */
import { useCallback, useEffect, useRef } from 'react'
import {
  generateStage1Preview,
  generateStage2Resize,
  putThumbnailToS3,
  makeStageUrl,
} from '@/utils/thumbnail-pipeline'
import { useThumbnailPublisher } from '@/hooks/thumbnail-signal'
import { useItemCard } from '@/hooks/useItemCard'
import { canBackfillThumbnail, isConnectionTooSlow } from '@/utils/thumbnail-backfill'

/** Concurrent backfills. Low on purpose — this is background work. */
const MAX_CONCURRENT = 2

/** How far outside the viewport a card starts its backfill. */
const ROOT_MARGIN = '300px 0px'

/** Upper bound on how long a job may wait for an idle frame before forcing. */
const IDLE_TIMEOUT_MS = 2_000

/** Cap on the persisted skip list so sessionStorage can't grow unbounded. */
const MAX_REMEMBERED_FAILURES = 500

const FAILED_STORAGE_KEY = 'stashly:thumb-backfill-failed'

// ── Attempt bookkeeping ────────────────────────────────────────────────────
// In-memory covers this tab's lifetime (survives client-side navigation);
// sessionStorage carries permanent failures across a reload so a folder full
// of un-thumbnailable files isn't re-downloaded on every visit.

const attempted = new Set<string>()

let failedCache: Set<string> | null = null

/**
 * The persisted skip list of items that can never produce a thumbnail, read
 * once from `sessionStorage` and cached in memory afterwards. Corrupt or
 * unavailable storage degrades to an empty set rather than throwing.
 *
 * @example
 * // Skip anything already known to fail
 * if (failedIds().has(item.id)) return
 *
 * @example
 * // Cheap on repeat calls — the parse happens once per tab
 * const skipped = failedIds().size
 */
function failedIds(): Set<string> {
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
 * Records a permanent failure so the item is never re-downloaded, trimming the
 * list to {@link MAX_REMEMBERED_FAILURES} so `sessionStorage` can't grow
 * unbounded. A quota or private-mode write failure still leaves the in-memory
 * set correct for this tab.
 *
 * @param itemId - Item whose backfill attempt failed for good.
 *
 * @example
 * // Called from the job body when a backfill yields nothing
 * const result = await backfill(id)
 * if (!result) rememberFailure(id)
 *
 * @example
 * // Effect is visible immediately through the skip list
 * rememberFailure('itm_123')
 * failedIds().has('itm_123') // → true
 */
function rememberFailure(itemId: string) {
  const set = failedIds()
  set.add(itemId)
  if (typeof sessionStorage === 'undefined') return
  try {
    const ids = Array.from(set).slice(-MAX_REMEMBERED_FAILURES)
    failedCache = new Set(ids)
    sessionStorage.setItem(FAILED_STORAGE_KEY, JSON.stringify(ids))
  } catch {
    // Quota or private-mode failure — the in-memory set still holds for this tab.
  }
}

// ── Queue ──────────────────────────────────────────────────────────────────

interface Job {
  itemId: string
  run: () => Promise<void>
}

const queue: Job[] = []
let active = 0
let paused = false

/**
 * Runs `fn` on the next idle frame so a backfill never starts on a frame the
 * user is scrolling or typing in. Falls back to a near-immediate `setTimeout`
 * where `requestIdleCallback` is missing (Safari), and is bounded by
 * {@link IDLE_TIMEOUT_MS} so a permanently busy tab still makes progress.
 *
 * @param fn - Work to schedule.
 *
 * @example
 * // Start a queued job off the critical path
 * whenIdle(() => job.run().finally(next))
 *
 * @example
 * // Any deferrable side effect works
 * whenIdle(() => console.debug('[thumb backfill] queue drained'))
 */
function whenIdle(fn: () => void) {
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(() => fn(), { timeout: IDLE_TIMEOUT_MS })
    return
  }
  setTimeout(fn, 1)
}

/**
 * Fills the free concurrency slots from the queue, newest request first (LIFO)
 * so the cards the user actually stopped on win. Does nothing while paused, and
 * re-enters itself as each job settles.
 *
 * @example
 * // Kick the queue after enqueuing
 * queue.push(job)
 * drain()
 *
 * @example
 * // Also how a resume restarts stalled work
 * paused = false
 * drain()
 */
function drain() {
  while (!paused && active < MAX_CONCURRENT && queue.length > 0) {
    // Pop, not shift: the most recently requested card is the one most likely
    // still under the user's eyes.
    const job = queue.pop()!
    active++
    whenIdle(() => {
      job.run().finally(() => {
        active--
        drain()
      })
    })
  }
}

/**
 * Adds a job to the queue and immediately tries to start it. Enqueuing the same
 * item twice is a no-op, so a card that re-enters the observer margin while its
 * job is still waiting doesn't stack duplicates.
 *
 * @param job - The item id plus the async body to run for it.
 *
 * @example
 * // Queue a card's backfill when it scrolls into range
 * enqueue({ itemId: id, run: async () => { … } })
 *
 * @example
 * // Second call for the same id is ignored
 * enqueue({ itemId: id, run })
 * enqueue({ itemId: id, run }) // no-op
 */
function enqueue(job: Job) {
  if (queue.some((q) => q.itemId === job.itemId)) return
  queue.push(job)
  drain()
}

/**
 * Drops a not-yet-started job. In-flight jobs are left to finish and persist —
 * the download is already paid for, so throwing the result away would be worse
 * than keeping it.
 *
 * @param itemId - Item whose queued job should be dropped.
 *
 * @example
 * // Card scrolled back out of range before its slot opened
 * if (!entry.isIntersecting) cancel(watch.itemId)
 *
 * @example
 * // Also runs on unmount, from the callback ref's cleanup
 * return () => { io.unobserve(node); cancel(id) }
 */
function cancel(itemId: string) {
  const i = queue.findIndex((q) => q.itemId === itemId)
  if (i !== -1) queue.splice(i, 1)
}

/**
 * Suspends backfill while higher-priority work runs. Uploads call this so a
 * batch of fresh files owns the compute worker and the network.
 *
 * @example
 * // Yield the pipeline while an upload runs
 * pauseBackfill()
 * await uploadAll(files)
 * resumeBackfill()
 *
 * @example
 * // Safe to call when already paused — it just stays paused
 * pauseBackfill()
 * pauseBackfill()
 */
export function pauseBackfill() {
  paused = true
}

/**
 * Resumes backfill and immediately refills the concurrency slots. A no-op when
 * nothing paused it, so uploads finishing out of order can't over-resume.
 *
 * @example
 * // Hand the pipeline back once the upload queue drains
 * upload.subscribe((s) => { if (s.context.queues.active.size === 0) resumeBackfill() })
 *
 * @example
 * // Nothing happens if backfill was never paused
 * resumeBackfill() // no-op
 */
export function resumeBackfill() {
  if (!paused) return
  paused = false
  drain()
}

// ── Shared viewport observer ───────────────────────────────────────────────

interface Watch {
  itemId: string
  start: () => void
}

const watched = new WeakMap<Element, Watch>()
let observer: IntersectionObserver | null = null

/**
 * The single shared `IntersectionObserver` every card registers with — one
 * observer for a whole gallery instead of one per card. Created on first use and
 * null during SSR, where the API doesn't exist.
 *
 * @example
 * // Observe a card's thumbnail area
 * const io = getObserver()
 * if (io) io.observe(node)
 *
 * @example
 * // Same instance on every call — safe to grab per card
 * getObserver() === getObserver() // → true
 */
function getObserver(): IntersectionObserver | null {
  if (typeof IntersectionObserver === 'undefined') return null
  if (observer) return observer
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const watch = watched.get(entry.target)
        if (!watch) continue
        if (entry.isIntersecting) watch.start()
        else cancel(watch.itemId)
      }
    },
    { rootMargin: ROOT_MARGIN }
  )
  return observer
}

// ── Job body ───────────────────────────────────────────────────────────────

interface SourceResponse {
  status: 'ready' | 'exists' | 'unsupported'
  downloadUrl?: string
  mimeType?: string | null
  name?: string
  url?: string
}

interface Stage2Result {
  stage: 2
  src: string
  width: number
  height: number
}

/**
 * Downloads the original, renders a 512px thumbnail, and uploads it — stage 2
 * of the upload-time pipeline, run after the fact. Yields the persisted stage-2
 * descriptor, an already-existing URL another client produced, or null when this
 * item can never be thumbnailed. Stage 3 (the ViT saliency crop) is skipped: it
 * costs the most and buys the least on a backfill.
 *
 * @param itemId - Item to generate a thumbnail for.
 *
 * @example
 * // Job body — null means "never try this one again"
 * const result = await backfill(id)
 * if (!result) rememberFailure(id)
 *
 * @example
 * // Another client may have won the race while this one was downloading
 * const result = await backfill(id)
 * if (result && 'existing' in result) publisher.publishLocal({ src: result.existing })
 */
async function backfill(
  itemId: string
): Promise<Stage2Result | { existing: string } | null> {
  const sourceRes = await fetch(`/api/thumbnails/${itemId}?intent=source`).catch(() => null)
  if (!sourceRes?.ok) return null

  const source = (await sourceRes.json().catch(() => null)) as SourceResponse | null
  if (!source) return null
  if (source.status === 'exists' && source.url) return { existing: source.url }
  if (source.status !== 'ready' || !source.downloadUrl) return null

  const blobRes = await fetch(source.downloadUrl).catch(() => null)
  if (!blobRes?.ok) return null
  const blob = await blobRes.blob().catch(() => null)
  if (!blob) return null

  const file = new File([blob], source.name ?? itemId, {
    // The stored mime is authoritative; S3 often serves octet-stream for code.
    type: source.mimeType || blob.type,
  })

  // Video is the one type whose stage 2 needs a frame from stage 1 first.
  const frame = file.type.startsWith('video/')
    ? await generateStage1Preview(file).catch(() => null)
    : null

  const resized = await generateStage2Resize(file, frame).catch(() => null)
  if (!resized) return null

  const presignRes = await fetch(`/api/thumbnails/${itemId}?intent=presign`).catch(() => null)
  const presign = presignRes?.ok
    ? ((await presignRes.json().catch(() => null)) as {
        uploadUrl?: string
        publicUrl?: string
      } | null)
    : null
  if (!presign?.uploadUrl || !presign.publicUrl) return null

  const put = await putThumbnailToS3(presign.uploadUrl, resized.blob, itemId, 2)
  if (!put) return null

  return {
    stage: 2,
    src: makeStageUrl(presign.publicUrl, 2),
    width: resized.width,
    height: resized.height,
  }
}

/**
 * PATCH used when the card unmounted mid-job — persists without a fetcher.
 * A React Router fetcher belongs to a mounted component, so once the card is
 * gone the only way to save the work already done is a plain `fetch`.
 *
 * @param itemId - Item the thumbnail belongs to.
 * @param result - The stage-2 descriptor produced by {@link backfill}.
 *
 * @example
 * // Persist from a job whose card scrolled away mid-flight
 * if (mounted.current) publisher.publishPersisted(result)
 * else await patchDetached(id, result)
 *
 * @example
 * // Failures are logged, never thrown — a lost backfill must not break the page
 * await patchDetached(id, result) // resolves even if the PATCH fails
 */
async function patchDetached(itemId: string, result: Stage2Result) {
  const fd = new FormData()
  fd.append('stage', String(result.stage))
  fd.append('url', result.src)
  fd.append('width', String(result.width))
  fd.append('height', String(result.height))
  await fetch(`/api/thumbnails/${itemId}`, { method: 'PATCH', body: fd }).catch(
    (e) => console.error('[thumb backfill PATCH]', itemId, e)
  )
}

// ── Hook ───────────────────────────────────────────────────────────────────

/**
 * SSR-safe read of the Network Information API — true on a metered or slow
 * connection, where spending a full download on a nicer thumbnail isn't worth
 * it. False on the server and in browsers without the API.
 *
 * @example
 * // Part of the eligibility test for a card
 * const eligible = canBackfillThumbnail(item) && !onSlowConnection()
 *
 * @example
 * // Respects Data Saver, not just link speed
 * onSlowConnection() // → true when navigator.connection.saveData is set
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
 * Returns a callback ref to put on whatever element represents the card's
 * thumbnail area. Items that already have a thumbnail, aren't files, are too
 * large, or have no renderer are never observed at all.
 *
 * @example
 * const backfillRef = useThumbnailBackfill()
 * return <div ref={backfillRef}>…</div>
 */
export function useThumbnailBackfill() {
  const { id, name, type, size, thumbnails, file } = useItemCard()
  const publisher = useThumbnailPublisher(id)

  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const publisherRef = useRef(publisher)
  publisherRef.current = publisher

  const eligible =
    !attempted.has(id) &&
    !failedIds().has(id) &&
    canBackfillThumbnail({
      type,
      name,
      size: Number(size ?? 0),
      mimeType: file?.mimeType,
      thumbnailUrls: thumbnails?.map((t) => t.url),
    }) &&
    !onSlowConnection()

  const start = useCallback(() => {
    if (attempted.has(id)) return
    enqueue({
      itemId: id,
      // Marked here rather than at enqueue time: a card scrolled back out
      // before its slot opened is cancelled, and must stay re-triable.
      run: async () => {
        attempted.add(id)
        const result = await backfill(id).catch((e) => {
          console.error('[thumb backfill]', id, e)
          return null
        })

        if (!result) {
          rememberFailure(id)
          return
        }

        if ('existing' in result) {
          // Another client already produced it — paint it, nothing to persist.
          if (mounted.current) publisherRef.current.publishLocal({ src: result.existing })
          return
        }

        if (mounted.current) publisherRef.current.publishPersisted(result)
        else await patchDetached(id, result)
      },
    })
  }, [id])

  return useCallback(
    (node: Element | null) => {
      if (!node) return
      if (!eligible) return
      const io = getObserver()
      if (!io) return
      watched.set(node, { itemId: id, start })
      io.observe(node)
      return () => {
        io.unobserve(node)
        watched.delete(node)
        cancel(id)
      }
    },
    [eligible, id, start]
  )
}
