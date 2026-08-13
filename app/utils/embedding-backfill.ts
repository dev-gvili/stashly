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
