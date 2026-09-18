/**
 * Types for the XState thumbnail pipeline.
 *
 * Parallel track: this folder re-implements the *orchestration* of the
 * thumbnail pipeline as a manager machine + per-item child actors. The compute
 * itself is untouched — every actor wraps an existing export of
 * `@/utils/thumbnail-pipeline`.
 *
 * See `app/machines/thumbnail/README.md` for the why.
 */
import type { AnyActorRef } from 'xstate'
import type { ResizedThumbnail } from '@/utils/thumbnail-pipeline'

/**
 * What a card paints. Structurally identical to the `ThumbProgress` of the
 * legacy signal layer (`@/hooks/thumbnail-signal`) so `useLiveThumbnail`
 * consumers need no change when the flag flips.
 */
export interface ThumbProgress {
  stage: 1 | 2 | 3
  src: string
  width?: number
  height?: number
}

/**
 * Where a job came from, which decides its lane, its ordering, and how much of
 * the pipeline it runs.
 *
 * - `upload` — the original `File` is in memory. Runs every stage plus the
 *   indexing leg (metadata, embeddings, OCR). FIFO, because upload order is
 *   the order the user dropped the files in.
 * - `backfill` — the file must be re-downloaded first. Stops after stage 2 and
 *   skips indexing entirely (the item was already indexed at upload time).
 *   LIFO, because the newest request is the card the user just scrolled to.
 */
export type ThumbMode = 'upload' | 'backfill'

/** A unit of work waiting in the manager's queue. */
export interface ThumbJob {
  itemId: string
  mode: ThumbMode
  /** Present for `upload` jobs; `backfill` acquires its own. */
  file: File | null
}

// ── Item machine ───────────────────────────────────────────────────────────

export interface ThumbItemContext {
  itemId: string
  mode: ThumbMode
  /** Null until `acquiring` resolves, for backfill jobs. */
  file: File | null
  /** Stage-1 blob; also the frame stage 2 needs for video. */
  tinyBlob: Blob | null
  /** Object URL for `tinyBlob`, revoked once stage 2 has painted. */
  stage1ObjectUrl: string | null
  resized: ResizedThumbnail | null
  salient: Blob | null
  presign: { uploadUrl: string; viewUrls: Record<2 | 3, string> } | null
  /**
   * True once bytes for this item are reachable on S3. Drives the machine's
   * output, which is what tells the manager whether to add the item to the
   * never-try-again skip list.
   */
  thumbnailed: boolean
  /** Retry budget, consumed by whichever step is failing. */
  attempts: number
  /** Chunks returned by `save_media_metadata`, awaiting vectors. */
  chunks: { id: string; content: string }[]
  needsOcr: boolean
  error: string | null
}

export type ThumbItemInput = {
  itemId: string
  mode: ThumbMode
  file: File | null
}

export type ThumbItemEvent = { type: 'xstate.done' }

/**
 * Events a child emits outward. The manager subscribes with `actorRef.on(...)`
 * at spawn time.
 *
 * `emit` rather than `sendParent` on purpose: an emitted event needs no parent,
 * so the item machine can be unit-tested as a root actor with a plain `.on()`
 * subscription instead of a wrapper machine.
 */
export type ThumbItemEmitted =
  /** A stage is ready to paint. Fired the moment the bytes are reachable. */
  | { type: 'progress'; itemId: string; progress: ThumbProgress }
  /**
   * `save_media_metadata` landed. It writes *displayable* facets (page count,
   * dimensions, EXIF), so unlike the search-index writes it must still trigger
   * one route revalidation — see the runner's debounce.
   */
  | { type: 'metadataSaved'; itemId: string }
  | { type: 'failed'; itemId: string; reason: string }

/** Terminal report handed back to the manager so it can free the slot. */
export interface ThumbItemOutput {
  itemId: string
  /** False only when the item can never produce a thumbnail — the skip-list signal. */
  thumbnailed: boolean
}

// ── Manager machine ────────────────────────────────────────────────────────

export interface ThumbManagerContext {
  queue: ThumbJob[]
  /** itemId → running child, one per in-flight job. Also the dedup set. */
  running: Map<string, { mode: ThumbMode; ref: AnyActorRef }>
  /** Latest painted stage per item; this map *is* the UI signal. */
  progress: Map<string, ThumbProgress>
  /**
   * Items whose metadata POST landed but whose route has not been revalidated
   * yet. Buffered rather than signalled per item because a 500-file upload
   * would otherwise fire 500 loader runs.
   */
  metadataSaved: string[]
}

export type ThumbManagerEvent =
  | { type: 'enqueue'; job: ThumbJob }
  /** Drops a *queued* job. A running one is left to finish — see the machine. */
  | { type: 'cancel'; itemId: string }
  | { type: 'pauseBackfill' }
  | { type: 'resumeBackfill' }
  /**
   * "Something changed, the backfill lane may have room." Handled only in the
   * lane's `active` state, so a paused lane ignores it structurally rather than
   * by checking a flag.
   */
  | { type: 'tickBackfill' }
  /** The idle-frame follow-up to `tickBackfill`, where the spawning happens. */
  | { type: 'drainBackfillNow' }
  | { type: 'child.progress'; itemId: string; progress: ThumbProgress }
  | { type: 'child.metadataSaved'; itemId: string }
  | { type: 'child.settled'; itemId: string; thumbnailed: boolean }
  /** Clears the revalidation buffer once the runner has acted on it. */
  | { type: 'revalidationConsumed' }
