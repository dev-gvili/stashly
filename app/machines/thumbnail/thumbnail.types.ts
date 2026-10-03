/**
 * Types for the thumbnail pipeline: a manager machine that schedules jobs and
 * one item machine per job. Every actor wraps a helper in
 * `@/utils/thumbnail-stages`; no compute lives in this folder.
 *
 * See `app/machines/thumbnail/README.md` for the why.
 */
import type { AnyActorRef } from 'xstate'
import type { ResizedThumbnail } from '@/utils/thumbnail-stages'

/** What a card paints for an item while its job runs: the latest stage. */
export interface ThumbProgress {
  stage: 1 | 2 | 3
  src: string
  width?: number
  height?: number
}

/**
 * Where a job's bytes come from, which decides its lane and how much of the
 * pipeline it runs. Every job starts the same way: its card became visible.
 *
 * - `fromMemory` — the file was uploaded in this tab and is still held (see
 *   `held-files.ts`). No download; runs every stage, including the salient
 *   crop for images.
 * - `fromDownload` — no file in memory, so the original is downloaded first.
 *   Stops after stage 2, since the crop buys the least for the most cost.
 *
 * Both lanes take the newest request first: that is the card the user just
 * scrolled to. Neither indexes for search; that is `app/machines/indexing/`,
 * queued separately for every upload.
 */
export type ThumbMode = 'fromMemory' | 'fromDownload'

/** A unit of work waiting in the manager's queue. */
export interface ThumbJob {
  itemId: string
  mode: ThumbMode
  /** The held upload for `fromMemory` jobs; null for `fromDownload`, which fetches its own. */
  file: File | null
}

// ── Item machine ───────────────────────────────────────────────────────────

export interface ThumbItemContext {
  itemId: string
  mode: ThumbMode
  /** For `fromDownload` jobs, null until `downloadingOriginal` has downloaded it. */
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
}

export type ThumbManagerEvent =
  /** A visible card asked for its thumbnail. Re-asking moves it to the front. */
  | { type: 'enqueue'; job: ThumbJob }
  /**
   * An upload's file just became available. A `fromDownload` job already
   * queued for that item becomes `fromMemory`, so it skips the download.
   */
  | { type: 'fileHeld'; itemId: string; file: File }
  /** The card left the screen: drop its *queued* job. A running one finishes. */
  | { type: 'cancel'; itemId: string }
  /** Uploads are moving bytes: stop starting downloads until they finish. */
  | { type: 'pauseDownloads' }
  /** No upload is moving bytes any more: downloads may start again. */
  | { type: 'resumeDownloads' }
  /**
   * "Something changed, the download lane may have room." Handled only while
   * that lane is `active`, so a paused lane ignores it by construction rather
   * than by checking a flag.
   */
  | { type: 'downloadSlotMaybeFree' }
  /** Sent on the next idle frame after `downloadSlotMaybeFree`; starts downloads. */
  | { type: 'startQueuedDownloads' }
  /** A running item machine painted a stage. */
  | { type: 'child.progress'; itemId: string; progress: ThumbProgress }
  /** A running item machine finished, whatever the outcome. Frees its slot. */
  | { type: 'child.settled'; itemId: string; thumbnailed: boolean }
