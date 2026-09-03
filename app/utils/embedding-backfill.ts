/**
 * Policy for the search-embedding backfill, kept free of fetch/DOM so both
 * sides can share it and it can be unit tested.
 *
 * The effects live in `app/hooks/useEmbeddingBackfill.ts` (client) and the
 * `pending_search_embeddings` loader intent in `app/routes/api/items.ts`
 * (server). Mirrors the `thumbnail-backfill.ts` / `useThumbnailBackfill.ts`
 * split.
 */

/**
 * Chunks per round trip.
 *
 * Sized for the *network*, not the GPU — the two were conflated at 32, which
 * meant a full fetch/embed/save round trip for every 32 passages with the GPU
 * idle across both requests. The fetch is the ordering point (a chunk stays in
 * the server's "unembedded" set until its vector lands, so the next fetch can't
 * be issued until the current batch is saved), so the way to spend less time in
 * it is to ask for more per trip. {@link EMBED_SUB_BATCH} keeps the GPU pass
 * the size it always was.
 */
export const PENDING_EMBEDDING_BATCH = 128

/**
 * Chunks per GPU forward pass.
 *
 * Deliberately unchanged from the old batch size: attention is quadratic in
 * sequence length and linear in batch, and chunks run right up against
 * `CHUNK_CHARS` (measured avg 1,456 / p95 1,500), so a wider pass is where a
 * modest GPU runs out of memory. It also bounds queue latency — `ai-queue`
 * cannot preempt a running job, so each sub-batch is enqueued separately and an
 * interactive search query waits for one pass, not the whole batch.
 */
export const EMBED_SUB_BATCH = 32

/** Ceiling on a client-supplied limit, so one request can't drain the table. */
export const PENDING_EMBEDDING_MAX = 256

/**
 * Batches per page load — now 128 chunks each, so 1,024 per arming rather than
 * the 256 this used to allow. A large backlog still heals across visits, but a
 * few thousand passages no longer needs a dozen of them.
 */
export const MAX_BACKFILL_BATCHES = 8

/**
 * Batch cap for an explicitly requested drain ("Embed all").
 *
 * The per-load cap exists so an *unrequested* background pass can't pin the
 * GPU. Someone who pressed a button asking for the backlog to be cleared has
 * made that trade themselves, so the cap becomes a runaway guard instead of a
 * policy — 1,000 batches is ~128,000 passages.
 */
export const DRAIN_ALL_BATCHES = 1_000

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
/**
 * Whether the runner is doing work right now.
 *
 * The distinction that matters is *working* versus *has ever started* — not
 * `phase !== 'idle'`, which stays true for `done`, `failed` and `skipped` and
 * so never turns anything back off. A poller keyed on that ran every five
 * seconds for the life of the tab, long after the backlog was cleared.
 *
 * `scheduled` counts: nothing is executing yet, but a run is committed and its
 * first report is imminent.
 *
 * @example
 * // Poll coverage only while there is something to watch
 * useIndexStats(pending > 0 || isBackfillActive(phase), stats, updatedAt)
 */
export function isBackfillActive(phase: BackfillPhase): boolean {
  return (
    phase === 'scheduled' ||
    phase === 'fetching' ||
    phase === 'embedding' ||
    phase === 'saving'
  )
}

export function hasWebGpu(): boolean {
  return typeof navigator !== 'undefined' && 'gpu' in navigator
}
