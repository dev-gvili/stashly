/**
 * Heals search chunks that were saved without an embedding.
 *
 * Embeddings are generated in the browser, and only *after* the chunk text has
 * been written server-side. Anything that ends that run early — closing the
 * tab on the green checkmark, navigating away, a WebGPU fault — leaves
 * `SearchChunk.vector` NULL. Nothing on the server ever fills it in, so those
 * passages stay invisible to semantic search permanently, with no error
 * anywhere to show for it.
 *
 * This closes the gap without paying for server-side inference: on a later
 * visit the client asks for its own unembedded chunks and runs them through
 * the same model the upload path uses. A document whose owner never returns
 * stays unembedded — covering that needs a server-side pass.
 *
 * Deliberately unobtrusive:
 *
 *   • **Once per tab** — a module flag, not per-mount, so remounting the
 *     layout during client navigation doesn't restart it.
 *   • **Idle-scheduled** — starts in `requestIdleCallback`, never on a frame
 *     the user is interacting with.
 *   • **Batched and capped** — {@link BATCH_LIMIT} chunks per request and at
 *     most {@link MAX_BATCHES} batches per load, so a large backlog is spread
 *     over several visits instead of pinning the GPU on one.
 *   • **Queued behind other AI** — `embedTexts` goes through the shared
 *     `ai-queue`, so upload-time work keeps priority.
 *   • **Silent on failure** — a browser without WebGPU simply does nothing;
 *     the backlog waits for a session that can handle it.
 */
import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { isConnectionTooSlow } from '@/utils/thumbnail-backfill'
import {
  DRAIN_ALL_BATCHES,
  EMBED_SUB_BATCH,
  MAX_BACKFILL_BATCHES,
  PENDING_EMBEDDING_BATCH,
  getBackfillServerState,
  getBackfillState,
  reportBackfill,
  shouldRequestAnotherBatch,
  subscribeBackfill,
  type BackfillState,
} from '@/utils/embedding-backfill'

/** Bound on how long a start may wait for an idle frame before forcing. */
const IDLE_TIMEOUT_MS = 5_000

/** Once per tab, not once per mount. */
let started = false

interface PendingChunk {
  id: string
  content: string
}

/**
 * Defer to an idle frame, or run straight away when the user asked for it.
 *
 * Idle scheduling is right for the automatic pass — nobody asked for it, so it
 * must not compete with interaction. It is wrong for "Run now": a button that
 * answers with "Queued — waiting for the browser to go idle" and then sits
 * there reads as broken, whatever it does five seconds later.
 *
 * @param fn - Work to schedule.
 * @param immediate - Skip idle scheduling and run synchronously; pass true for
 *   anything the user explicitly asked for.
 *
 * @example
 * // Automatic pass — waits for an idle frame, cancellable
 * const cancelIdle = whenIdle(() => drainBacklog(signal))
 *
 * @example
 * // "Run now" button — runs on the spot, cancel is a no-op
 * whenIdle(() => drainBacklog(signal), true)
 */
function whenIdle(fn: () => void, immediate = false): () => void {
  if (immediate) {
    fn()
    return () => {}
  }
  if (typeof requestIdleCallback === 'function') {
    const handle = requestIdleCallback(() => fn(), { timeout: IDLE_TIMEOUT_MS })
    return () => cancelIdleCallback(handle)
  }
  const handle = setTimeout(fn, IDLE_TIMEOUT_MS)
  return () => clearTimeout(handle)
}

/**
 * SSR-safe read of the Network Information API — true on a metered or slow
 * connection, where an unrequested backfill shouldn't spend the user's data.
 * False on the server and in browsers without the API.
 *
 * @example
 * // Decline the automatic run on a metered connection
 * if (!force && onSlowConnection()) {
 *   reportBackfill({ phase: 'skipped', reason: 'Connection is metered or too slow' })
 * }
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
 * Asks the server for one batch of the caller's own chunks that were saved
 * without a vector, capped at {@link PENDING_EMBEDDING_BATCH}. A failed or
 * non-OK response yields an empty batch, which ends the drain quietly.
 *
 * @param signal - Abort signal tying the request to the current run.
 *
 * @example
 * // One batch per loop iteration; empty means the backlog is clear
 * const chunks = await fetchPending(signal)
 * if (chunks.length === 0) break
 *
 * @example
 * // Aborting the controller cancels the in-flight request
 * const controller = new AbortController()
 * void fetchPending(controller.signal)
 * controller.abort()
 */
async function fetchPending(signal: AbortSignal): Promise<PendingChunk[]> {
  const res = await fetch(
    `/api/items?intent=pending_search_embeddings&limit=${PENDING_EMBEDDING_BATCH}`,
    { signal }
  )
  if (!res.ok) return []
  const body = (await res.json().catch(() => null)) as {
    chunks?: PendingChunk[]
  } | null
  return body?.chunks ?? []
}

/**
 * Writes a batch of freshly computed vectors back to their chunks via the
 * `save_search_chunk_embeddings` intent. Pairs by index, so `vectors[i]` must
 * belong to `chunks[i]` — the caller checks the lengths match first.
 *
 * @param chunks - The chunks that were embedded, in the order they were sent.
 * @param vectors - One vector per chunk, index-aligned with `chunks`.
 * @param signal - Abort signal tying the request to the current run.
 *
 * @example
 * // Stop the drain when the server rejects a batch
 * if (!(await saveVectors(chunks, vectors, signal))) {
 *   reportBackfill({ phase: 'failed', error: 'Server rejected the vectors' })
 * }
 *
 * @example
 * // Only call it once the counts line up
 * if (vectors.length === chunks.length) await saveVectors(chunks, vectors, signal)
 */
async function saveVectors(
  chunks: PendingChunk[],
  vectors: number[][],
  signal: AbortSignal
): Promise<boolean> {
  const fd = new FormData()
  fd.append('intent', 'save_search_chunk_embeddings')
  fd.append(
    'embeddings',
    JSON.stringify(
      chunks.map((chunk, i) => ({ chunkId: chunk.id, vector: vectors[i] }))
    )
  )
  const res = await fetch('/api/items', { method: 'POST', body: fd, signal })
  return res.ok
}

/**
 * Runs batches until the backlog is empty, the cap is hit, or anything fails,
 * reporting each phase so status UI can follow along. The count of chunks
 * embedded comes back out for the caller's logs and tests.
 *
 * @param signal - Abort signal; checked between phases so a cancelled run stops
 *   without writing a partial batch.
 *
 * @example
 * // The automatic pass, with failures surfaced rather than swallowed
 * drainBacklog(controller.signal).catch((e) => {
 *   reportBackfill({ phase: 'failed', error: String(e) })
 * })
 *
 * @example
 * // In a test — assert how much a run actually healed
 * const embedded = await drainBacklog(new AbortController().signal)
 */
async function drainBacklog(
  signal: AbortSignal,
  maxBatches = MAX_BACKFILL_BATCHES
): Promise<number> {
  let embedded = 0
  let batchesRun = 0

  for (let batch = 0; batch < maxBatches; batch++) {
    if (signal.aborted) break

    reportBackfill({ phase: 'fetching' })
    const chunks = await fetchPending(signal)
    if (chunks.length === 0) {
      reportBackfill({ phase: 'done', batchSize: 0 })
      break
    }

    // Imported lazily so a session with no backlog never pulls in the model
    // wrapper — and never triggers its multi-megabyte weight download.
    const { embedTexts } = await import('@/workers/embedding.ai')

    // One fetched batch is embedded in {@link EMBED_SUB_BATCH}-sized passes,
    // and the save of one pass overlaps the inference of the next. That is safe
    // precisely because the chunk ids are already in hand: nothing inside this
    // loop consults the server's view of what is still unembedded. The *fetch*
    // does, which is why the next one waits for the last save to settle — and
    // why the fetch batch is large, so that ordering point is paid rarely.
    let inFlight: { save: Promise<boolean>; count: number } | null = null
    let failure: string | null = null

    for (let offset = 0; offset < chunks.length; offset += EMBED_SUB_BATCH) {
      if (signal.aborted) break
      const slice = chunks.slice(offset, offset + EMBED_SUB_BATCH)

      reportBackfill({ phase: 'embedding', batchSize: slice.length })
      // Explicitly background: nobody is waiting on a backfill batch, and a
      // search query issued mid-drain must not queue behind it.
      const vectors = await embedTexts(
        slice.map((chunk) => chunk.content),
        undefined,
        'background'
      )

      if (vectors.length !== slice.length) {
        console.error(
          '[embedding backfill] vector count mismatch',
          vectors.length,
          slice.length
        )
        failure = `Vector count mismatch: got ${vectors.length} for ${slice.length} chunks`
        break
      }

      // Settle the previous write before queueing another. Two writes in flight
      // would let a rejected one be overtaken by its successor, and the run
      // would report progress the server never accepted.
      if (inFlight) {
        if (!(await inFlight.save)) {
          failure = 'Server rejected the vectors'
          inFlight = null
          break
        }
        embedded += inFlight.count
        reportBackfill({ embedded })
        inFlight = null
      }

      if (signal.aborted) break

      reportBackfill({ phase: 'saving' })
      inFlight = {
        save: saveVectors(slice, vectors, signal),
        count: slice.length,
      }
    }

    // `embedded` only ever counts vectors the server confirmed, so the last
    // write has to land before the tally is final.
    if (inFlight) {
      if (await inFlight.save) {
        embedded += inFlight.count
        reportBackfill({ embedded })
      } else {
        failure ??= 'Server rejected the vectors'
      }
    }

    if (failure) {
      reportBackfill({ phase: 'failed', error: failure })
      break
    }
    if (signal.aborted) break

    batchesRun++
    reportBackfill({ batches: batchesRun, batchSize: 0 })

    const more = shouldRequestAnotherBatch({
      received: chunks.length,
      limit: PENDING_EMBEDDING_BATCH,
      batchesRun,
      maxBatches,
    })
    if (!more) {
      reportBackfill({ phase: 'done' })
      break
    }
  }

  return embedded
}

/**
 * Arms the runner. Extracted from the hook so it can also be triggered by
 * hand.
 *
 * @param force Bypass the once-per-tab latch. The latch means a run that
 *   failed — no WebGPU, a flaky model download — never retries for the life of
 *   the tab, which is exactly when a user wants to retry. Forcing also skips the
 *   idle wait and the slow-connection check.
 * @param maxBatches How many fetch batches this run may process before
 *   stopping. Defaults to the polite per-load cap; a user-requested drain
 *   passes {@link DRAIN_ALL_BATCHES}.
 *
 * @example
 * // Automatic arming — declines on a repeat call within the same tab
 * startEmbeddingBackfill()
 *
 * @example
 * // "Run now" from a status panel, bypassing the latch
 * startEmbeddingBackfill(true)
 *
 * @example
 * // Abort a run that is still scheduled or draining
 * const abort = startEmbeddingBackfill()
 * abort?.()
 */
export function startEmbeddingBackfill(
  force = false,
  maxBatches = MAX_BACKFILL_BATCHES
): (() => void) | null {
  if (typeof window === 'undefined') return null
  if (started && !force) return null

  if (!force && onSlowConnection()) {
    reportBackfill({
      phase: 'skipped',
      reason: 'Connection is metered or too slow',
    })
    return null
  }

  started = true
  const controller = new AbortController()

  reportBackfill({
    phase: 'scheduled',
    startedAt: Date.now(),
    error: null,
    reason: null,
  })

  const cancelIdle = whenIdle(() => {
    drainBacklog(controller.signal, maxBatches)
      .catch((e) => {
        if (controller.signal.aborted) return
        // A browser without WebGPU lands here. Search still works — this only
        // downgrades ranking — but it must be *visible*, not swallowed.
        console.error('[embedding backfill]', e)
        reportBackfill({
          phase: 'failed',
          error: e instanceof Error ? e.message : String(e),
        })
      })
      // Release the once-per-tab latch once the run is over, however it ended.
      // Holding it forever means a backlog that grows *after* this run — a new
      // upload, a re-index — has nothing left to pick it up.
      .finally(() => {
        started = false
      })
  }, force)

  return () => {
    cancelIdle()
    controller.abort()
  }
}

/**
 * Live view of the runner, for status UI. Backed by `useSyncExternalStore`, so
 * it is SSR-safe and every mounted panel sees the same phase.
 *
 * @example
 * const { phase, embedded, error } = useEmbeddingBackfillState()
 *
 * @example
 * // Drive a status line from the phase
 * const { phase, embedded } = useEmbeddingBackfillState()
 * {phase === 'embedding' && <p>Indexing… {embedded} passages done</p>}
 */
export function useEmbeddingBackfillState(): BackfillState {
  return useSyncExternalStore(
    subscribeBackfill,
    getBackfillState,
    getBackfillServerState
  )
}

/**
 * Imperative retry for a status panel's "Run now" button. Always forces, since
 * a user clicking retry has already seen that the automatic run didn't work.
 *
 * @example
 * // "Run now" button in the index-status panel
 * const retry = useRetryEmbeddingBackfill()
 * <Button onClick={retry}>Run now</Button>
 *
 * @example
 * // Disable it only while a run is genuinely active
 * const { phase } = useEmbeddingBackfillState()
 * const retry = useRetryEmbeddingBackfill()
 * <Button onClick={retry} disabled={phase === 'embedding' || phase === 'saving'}>Retry</Button>
 */
export function useRetryEmbeddingBackfill(): () => void {
  return useCallback(() => {
    startEmbeddingBackfill(true)
  }, [])
}

/**
 * "Embed all" — drains the whole backlog instead of stopping at the per-load
 * cap.
 *
 * The cap is a courtesy to a user who never asked for the backfill; it is the
 * wrong answer for one who is watching a coverage bar and wants it to reach
 * 100%. Before this, clearing a few thousand passages meant reloading the page
 * once per {@link MAX_BACKFILL_BATCHES}-batch run, which is what made a job of
 * minutes feel like an afternoon.
 *
 * @example
 * const drainAll = useDrainEmbeddingBacklog()
 * <Button onClick={drainAll}>Embed all</Button>
 */
export function useDrainEmbeddingBacklog(): () => void {
  return useCallback(() => {
    startEmbeddingBackfill(true, DRAIN_ALL_BATCHES)
  }, [])
}

/**
 * Arms the backfill for the surrounding authenticated layout. Mount once —
 * additional mounts are no-ops for the lifetime of the tab.
 *
 * @param enabled Pass false to opt a session out entirely.
 *
 * @example
 * function Layout() {
 *   useEmbeddingBackfill()
 *   return <Outlet />
 * }
 */
export function useEmbeddingBackfill(enabled = true) {
  useEffect(() => {
    if (!enabled) return
    startEmbeddingBackfill()
    // No cleanup on purpose. Returning the abort function deadlocked the
    // runner: React runs effects mount → cleanup → mount in StrictMode, so the
    // first pass armed the run and set the once-per-tab latch, the cleanup
    // aborted it, and the second pass was refused by its own latch. The phase
    // stayed `scheduled` for the life of the tab — and since `scheduled` reads
    // as active, the "Run now" button that could have rescued it was disabled.
    //
    // Letting the run outlive the mount is also what the once-per-tab contract
    // already promised: navigating between routes remounts this layout, and a
    // backfill that restarts or dies on every navigation is neither.
  }, [enabled])
}
