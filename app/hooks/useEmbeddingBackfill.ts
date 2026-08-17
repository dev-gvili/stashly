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

/** SSR-safe read of the Network Information API. */
function onSlowConnection(): boolean {
  if (typeof navigator === 'undefined') return false
  const nav = navigator as Navigator & {
    connection?: { saveData?: boolean; effectiveType?: string }
  }
  return isConnectionTooSlow(nav.connection)
}

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
 * Runs batches until the backlog is empty, the cap is hit, or anything fails.
 * Returns the number of chunks embedded, for the caller's logs and tests.
 */
async function drainBacklog(signal: AbortSignal): Promise<number> {
  let embedded = 0

  for (let batch = 0; batch < MAX_BACKFILL_BATCHES; batch++) {
    if (signal.aborted) break

    reportBackfill({ phase: 'fetching' })
    const chunks = await fetchPending(signal)
    if (chunks.length === 0) {
      reportBackfill({ phase: 'done', batchSize: 0 })
      break
    }

    // Imported lazily so a session with no backlog never pulls in the model
    // wrapper — and never triggers its multi-megabyte weight download.
    reportBackfill({ phase: 'embedding', batchSize: chunks.length })
    const { embedTexts } = await import('@/workers/embedding.ai')
    // Explicitly background: nobody is waiting on a backfill batch, and a
    // search query issued mid-drain must not queue behind it.
    const vectors = await embedTexts(
      chunks.map((chunk) => chunk.content),
      undefined,
      'background'
    )

    if (vectors.length !== chunks.length) {
      console.error(
        '[embedding backfill] vector count mismatch',
        vectors.length,
        chunks.length
      )
      reportBackfill({
        phase: 'failed',
        error: `Vector count mismatch: got ${vectors.length} for ${chunks.length} chunks`,
      })
      break
    }

    if (signal.aborted) break

    reportBackfill({ phase: 'saving' })
    if (!(await saveVectors(chunks, vectors, signal))) {
      reportBackfill({ phase: 'failed', error: 'Server rejected the vectors' })
      break
    }

    embedded += chunks.length
    reportBackfill({ embedded, batches: batch + 1, batchSize: 0 })

    const more = shouldRequestAnotherBatch({
      received: chunks.length,
      limit: PENDING_EMBEDDING_BATCH,
      batchesRun: batch + 1,
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
 *   the tab, which is exactly when a user wants to retry.
 * @returns An abort function, or null when the run was declined.
 */
export function startEmbeddingBackfill(force = false): (() => void) | null {
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
    drainBacklog(controller.signal)
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
 * Live view of the runner, for status UI.
 *
 * @example
 * const { phase, embedded, error } = useEmbeddingBackfillState()
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
 */
export function useRetryEmbeddingBackfill(): () => void {
  return useCallback(() => {
    startEmbeddingBackfill(true)
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
