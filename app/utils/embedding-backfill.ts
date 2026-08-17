/**
 * Policy for the search-embedding backfill, kept free of fetch/DOM so both
 * sides can share it and it can be unit tested.
 *
 * The effects live in `app/hooks/useEmbeddingBackfill.ts` (client) and the
 * `pending_search_embeddings` loader intent in `app/routes/api/items.ts`
 * (server). Mirrors the `thumbnail-backfill.ts` / `useThumbnailBackfill.ts`
 * split.
 */

/** Chunks per round trip. Batching matters: model warm-up dominates a call. */
export const PENDING_EMBEDDING_BATCH = 32

/** Ceiling on a client-supplied limit, so one request can't drain the table. */
export const PENDING_EMBEDDING_MAX = 100

/** Batches per page load. A large backlog heals across several visits. */
export const MAX_BACKFILL_BATCHES = 8

/**
 * Clamps a caller-supplied `limit` into `[1, PENDING_EMBEDDING_MAX]`, falling
 * back to the default batch for anything non-numeric.
 *
 * The value arrives as a URL query param, so it is untrusted: absent, empty,
 * `'abc'`, `'-5'` and `'1e9'` all have to land somewhere sane rather than
 * reaching the query as `LIMIT NaN` or `LIMIT 1000000000`.
 */
export function clampPendingLimit(raw: string | number | null | undefined): number {
  if (raw === null || raw === undefined || raw === '') return PENDING_EMBEDDING_BATCH
  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) return PENDING_EMBEDDING_BATCH
  const truncated = Math.trunc(parsed)
  if (truncated < 1) return 1
  return Math.min(truncated, PENDING_EMBEDDING_MAX)
}

/**
 * Whether the backfill should ask for another batch.
 *
 * A batch shorter than the requested limit means the backlog is drained, so
 * re-querying would just be a wasted round trip. The batch cap keeps one page
 * load from pinning the GPU on a very large backlog.
 */
export function shouldRequestAnotherBatch(params: {
  /** Chunks returned by the batch just processed. */
  received: number
  /** Limit that batch asked for. */
  limit: number
  /** Batches already completed, including the one just processed. */
  batchesRun: number
  maxBatches?: number
}): boolean {
  const { received, limit, batchesRun, maxBatches = MAX_BACKFILL_BATCHES } = params
  if (received <= 0) return false
  if (received < limit) return false
  return batchesRun < maxBatches
}

// ──────────────────────────────────────────────────────────────────────────
// Observable progress
//
// The backfill was built to be invisible: idle-scheduled, once per tab, and
// silent on failure. That is right for the happy path and useless the moment
// it *doesn't* work — a drive stuck at "0 embedded" gives no way to tell
// whether the run never started, was skipped, is mid-download, or threw.
//
// This is a module-level store rather than React state because the runner is
// a module-level singleton that outlives any component. Shaped for
// `useSyncExternalStore`, mirroring `report-degraded.ts`.
// ──────────────────────────────────────────────────────────────────────────

/** Where the runner is right now. */
export type BackfillPhase =
  /** Never armed this tab. */
  | 'idle'
  /** Armed, waiting for an idle frame. */
  | 'scheduled'
  /** Asking the server for the next batch of unembedded chunks. */
  | 'fetching'
  /** Loading the model / running inference. The slow one — first run downloads weights. */
  | 'embedding'
  /** Writing vectors back. */
  | 'saving'
  /** Backlog drained, or the per-load batch cap was reached. */
  | 'done'
  /** Deliberately not run — see `reason`. */
  | 'skipped'
  /** Threw — see `error`. */
  | 'failed'

export interface BackfillState {
  phase: BackfillPhase
  /** Chunks embedded since this tab armed the runner. */
  embedded: number
  /** Batches completed. */
  batches: number
  /** Chunks in the batch currently being embedded. */
  batchSize: number
  /** Why the runner declined to start. */
  reason: string | null
  /** Message from the last throw. */
  error: string | null
  startedAt: number | null
  updatedAt: number
}

const INITIAL: BackfillState = Object.freeze({
  phase: 'idle',
  embedded: 0,
  batches: 0,
  batchSize: 0,
  reason: null,
  error: null,
  startedAt: null,
  updatedAt: 0,
})

/**
 * Single frozen snapshot, replaced wholesale on every update.
 * `useSyncExternalStore` compares snapshots by identity and re-renders forever
 * if `getSnapshot` returns a fresh object each call, so this must be cached.
 */
let state: BackfillState = INITIAL

const listeners = new Set<() => void>()

export function getBackfillState(): BackfillState {
  return state
}

/** Stable server snapshot — the runner is browser-only. */
export function getBackfillServerState(): BackfillState {
  return INITIAL
}

export function subscribeBackfill(onChange: () => void): () => void {
  listeners.add(onChange)
  return () => {
    listeners.delete(onChange)
  }
}

/** Merge a patch into the snapshot and notify. Called by the runner only. */
export function reportBackfill(patch: Partial<BackfillState>): BackfillState {
  state = Object.freeze({ ...state, ...patch, updatedAt: Date.now() })
  for (const listener of listeners) listener()
  return state
}

/** Test seam. */
export function resetBackfillState() {
  state = INITIAL
  for (const listener of listeners) listener()
}

/**
 * Whether this browser can run the embedding model at all.
 *
 * The single most useful diagnostic when nothing is indexing: without WebGPU
 * the runner will always throw on its first inference, and no amount of
 * retrying changes that.
 */
export function hasWebGpu(): boolean {
  return typeof navigator !== 'undefined' && 'gpu' in navigator
}
