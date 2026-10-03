/**
 * Types for search indexing of uploaded files.
 *
 * Indexing is what search reads: the file's metadata facets, its text split
 * into `SearchChunk` rows, a vector per chunk, and OCR text for scanned PDFs.
 * It used to run as a parallel leg inside the thumbnail item machine, so a slow
 * embedding held a thumbnail slot and a backfill that won the race for an item
 * silently skipped indexing it. It is its own queue and machine now.
 *
 * See `app/machines/indexing/README.md`.
 */
import type { AnyActorRef } from 'xstate'
import type { MediaMetadata } from '@/utils/media-metadata'

/** A passage the server stored for a file, waiting for its vector. */
export interface SearchChunkDraft {
  id: string
  content: string
}

/** One file waiting to be indexed. Only uploads index, so the bytes are in memory. */
export interface IndexJob {
  itemId: string
  file: File
}

// ── Item machine ───────────────────────────────────────────────────────────

export type IndexItemInput = IndexJob

export interface IndexItemContext {
  itemId: string
  file: File
  /** What `extractMediaMetadata` read from the file; null until it returns. */
  metadata: MediaMetadata | null
  /** Rows `save_media_metadata` created, each needing a vector. */
  chunks: SearchChunkDraft[]
  /** One vector per chunk, in chunk order; null until embedding returns. */
  vectors: number[][] | null
  /**
   * True once embedding or saving the vectors has given up. The chunks stay
   * keyword-searchable, and `useEmbeddingBackfill` re-embeds chunks with no
   * vector later, so this is a degradation rather than a failure.
   */
  missingVectors: boolean
  /** Retry budget, consumed by whichever network step is failing. */
  attempts: number
  /** Why the machine ended in `failed`, for the console. */
  failureReason: string | null
  /** Set on entering a final state; becomes the machine's output. */
  outcome: IndexOutcome | null
}

/**
 * How a file's indexing ended.
 *
 * - `indexed` — metadata, chunks and vectors are all saved.
 * - `indexedWithoutVectors` — metadata and chunks are saved; vectors are not.
 * - `failed` — the metadata itself never reached the server, or OCR broke.
 */
export type IndexOutcome = 'indexed' | 'indexedWithoutVectors' | 'failed'

/** What the item machine hands back to the queue when it finishes. */
export interface IndexItemOutput {
  itemId: string
  outcome: IndexOutcome
}

/**
 * Events the item machine emits outward. The queue subscribes with
 * `actorRef.on(...)` when it spawns the machine.
 *
 * `emit` rather than `sendParent`, so the item machine can be unit-tested as a
 * root actor with a plain `.on()` subscription.
 */
export type IndexItemEmitted =
  /**
   * `save_media_metadata` landed. It writes facets the page shows (page count,
   * dimensions, EXIF), so the page has to reload once the batch drains — see
   * `useIndexingRevalidation`.
   */
  | { type: 'metadataSaved'; itemId: string }
  /** The machine ended in `failed`; `reason` is for the console. */
  | { type: 'failed'; itemId: string; reason: string }

// ── Queue machine ──────────────────────────────────────────────────────────

export interface IndexQueueContext {
  /** Files waiting for a slot, oldest first. */
  queue: IndexJob[]
  /** itemId → running item machine. Doubles as the "already running" check. */
  running: Map<string, AnyActorRef>
  /**
   * Items whose metadata was saved since the page last reloaded. Collected
   * rather than signalled one by one, so a batch reloads the page once.
   */
  metadataSaved: string[]
}

export type IndexQueueEvent =
  /** Add a file to the back of the queue, unless it is already queued or running. */
  | { type: 'enqueue'; job: IndexJob }
  /** A running item machine reported that its metadata was saved. */
  | { type: 'item.metadataSaved'; itemId: string }
  /** A running item machine finished, whatever the outcome. Frees its slot. */
  | { type: 'item.finished'; itemId: string; outcome: IndexOutcome }
  /** The page reloaded; forget the saves collected so far. */
  | { type: 'revalidationDone' }
