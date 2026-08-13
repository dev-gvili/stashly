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
import { useEffect } from 'react'
import { isConnectionTooSlow } from '@/utils/thumbnail-backfill'
import {
  MAX_BACKFILL_BATCHES,
  PENDING_EMBEDDING_BATCH,
  shouldRequestAnotherBatch,
} from '@/utils/embedding-backfill'

/** Bound on how long a start may wait for an idle frame before forcing. */
const IDLE_TIMEOUT_MS = 5_000

/** Once per tab, not once per mount. */
let started = false

interface PendingChunk {
  id: string
  content: string
}

function whenIdle(fn: () => void): () => void {
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

    const chunks = await fetchPending(signal)
    if (chunks.length === 0) break

    // Imported lazily so a session with no backlog never pulls in the model
    // wrapper — and never triggers its multi-megabyte weight download.
    const { embedTexts } = await import('@/workers/embedding.ai')
    const vectors = await embedTexts(chunks.map((chunk) => chunk.content))

    if (vectors.length !== chunks.length) {
      console.error(
        '[embedding backfill] vector count mismatch',
        vectors.length,
        chunks.length
      )
      break
    }

    if (signal.aborted) break
    if (!(await saveVectors(chunks, vectors, signal))) break

    embedded += chunks.length

    const more = shouldRequestAnotherBatch({
      received: chunks.length,
      limit: PENDING_EMBEDDING_BATCH,
      batchesRun: batch + 1,
    })
    if (!more) break
  }

  return embedded
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
    if (!enabled || started) return
    if (typeof window === 'undefined') return
    if (onSlowConnection()) return

    started = true
    const controller = new AbortController()

    const cancelIdle = whenIdle(() => {
      drainBacklog(controller.signal).catch((e) => {
        if (controller.signal.aborted) return
        // A browser without WebGPU lands here. Nothing to surface: search
        // still works, the backlog just waits for a capable session.
        console.error('[embedding backfill]', e)
      })
    })

    return () => {
      cancelIdle()
      controller.abort()
    }
  }, [enabled])
}
