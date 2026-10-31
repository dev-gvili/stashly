/**
 * Types for search indexing of uploaded files.
 *
 * Indexing is what search reads: the file's metadata facets, its text split
 * into `SearchChunk` rows, a vector per chunk, and OCR text for scanned PDFs.
 * Three machines do it, one job each: metadata right after the row exists
 * (`indexing-item.machine.ts`), vectors (`embed.machine.ts`) and OCR
 * (`ocr.machine.ts`) once uploads are idle. The queue runs them in two lanes.
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

// ── Metadata machine (indexing-item.machine.ts) ────────────────────────────

export type IndexItemInput = IndexJob

export interface IndexItemContext {
  itemId: string
  file: File
  /** What `extractMediaMetadata` read from the file; null until it returns. */
  metadata: MediaMetadata | null
  /** Rows `save_media_metadata` created, each needing a vector from `embed.machine`. */
  chunks: SearchChunkDraft[]
  /** Retry budget for the metadata save. */
  attempts: number
  /** Why the machine ended in `failed`, for the console. */
  failureReason: string | null
  /** Set on entering a final state; becomes the machine's output. */
  outcome: IndexOutcome | null
}

/**
 * How a file's metadata step ended.
 *
 * - `indexed` — the metadata is saved, or the file had none to save (a zip).
 * - `failed` — the file could not be read, or the save never reached the server.
 */
export type IndexOutcome = 'indexed' | 'failed'

/**
 * What the metadata machine hands back to the queue when it finishes. The
 * queue turns `chunks` into an `embed.machine` job and `needsOcr` into an
 * `ocr.machine` job.
 */
export interface IndexItemOutput {
  itemId: string
  outcome: IndexOutcome
  /** Chunks the server cut the file's text into, waiting for vectors. */
  chunks: SearchChunkDraft[]
  /** A PDF with no text layer: its text has to come from OCR. */
  needsOcr: boolean
  /** The uploaded file, which OCR reads. */
  file: File
}

/**
 * Events the metadata machine emits outward. The queue subscribes with
 * `actorRef.on(...)` when it spawns the machine.
 *
 * `emit` rather than `sendParent`, so the machine can be unit-tested as a root
 * actor with a plain `.on()` subscription.
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

// ── Embed machine (embed.machine.ts) ───────────────────────────────────────

/** One set of chunks to embed: a file's text, or one OCR page. */
export interface EmbedJob {
  itemId: string
  chunks: SearchChunkDraft[]
}

export type EmbedInput = EmbedJob

export interface EmbedContext {
  itemId: string
  chunks: SearchChunkDraft[]
  /** One vector per chunk, in chunk order; null until embedding returns. */
  vectors: number[][] | null
  /** Retry budget for the vector save. */
  attempts: number
  outcome: EmbedOutcome | null
}

/**
 * How embedding ended.
 *
 * - `embedded` — every chunk has its vector.
 * - `withoutVectors` — embedding or the save gave up. The chunks stay
 *   keyword-searchable, and `useEmbeddingBackfill` re-embeds chunks with no
 *   vector later, so this is a degradation rather than a failure.
 */
export type EmbedOutcome = 'embedded' | 'withoutVectors'

export interface EmbedOutput {
  itemId: string
  outcome: EmbedOutcome
}

// ── OCR machine (ocr.machine.ts) ───────────────────────────────────────────

/** One scanned PDF to transcribe. */
export interface OcrJob {
  itemId: string
  file: File
}

export type OcrInput = OcrJob

export interface OcrContext {
  itemId: string
  file: File
  failureReason: string | null
  outcome: OcrOutcome | null
}

/** `transcribed` — every page OCR could read is saved. `failed` — OCR broke. */
export type OcrOutcome = 'transcribed' | 'failed'

export interface OcrOutput {
  itemId: string
  outcome: OcrOutcome
}

/** Sent to the OCR machine by its actor each time a page's text is saved. */
export type OcrEvent = { type: 'pageSaved'; chunks: SearchChunkDraft[] }

export type OcrEmitted =
  /** A page's text is saved; its chunks need vectors from `embed.machine`. */
  | { type: 'pageChunks'; itemId: string; chunks: SearchChunkDraft[] }
  /** The machine ended in `failed`; `reason` is for the console. */
  | { type: 'failed'; itemId: string; reason: string }

// ── Queue machine ──────────────────────────────────────────────────────────

/** GPU work for the deferred lane, which runs once uploads are idle. */
export type DeferredJob =
  | { kind: 'embed'; key: string; job: EmbedJob }
  | { kind: 'ocr'; key: string; job: OcrJob }

export interface IndexQueueContext {
  /** Files waiting for a metadata slot, oldest first. */
  queue: IndexJob[]
  /** itemId → running metadata machine. Doubles as the "already running" check. */
  running: Map<string, AnyActorRef>
  /**
   * Items whose metadata was saved since the page last reloaded. Collected
   * rather than signalled one by one, so a batch reloads the page once.
   */
  metadataSaved: string[]
  /** Embedding and OCR jobs waiting for the deferred lane, oldest first. */
  deferred: DeferredJob[]
  /** Job key → running embed or OCR machine. */
  deferredRunning: Map<string, AnyActorRef>
  /** Numbers embed jobs: a scanned PDF hands one per page for the same item. */
  deferredSeq: number
}

export type IndexQueueEvent =
  /** Add a file to the back of the queue, unless it is already queued or running. */
  | { type: 'enqueue'; job: IndexJob }
  /** A running metadata machine reported that its metadata was saved. */
  | { type: 'item.metadataSaved'; itemId: string }
  /** A metadata machine finished, whatever the outcome. Frees its slot. */
  | { type: 'item.finished'; output: IndexItemOutput }
  /** An OCR machine saved a page; its chunks need an embed job. */
  | { type: 'deferred.chunks'; itemId: string; chunks: SearchChunkDraft[] }
  /** An embed or OCR machine finished. Frees its slot. */
  | { type: 'deferred.finished'; key: string }
  /** Internal: jobs were added to the deferred lane. */
  | { type: 'deferred.added' }
  /** An upload is moving bytes: start no new GPU work. */
  | { type: 'pauseDeferred' }
  /** Uploads have been idle long enough: start GPU work again. */
  | { type: 'resumeDeferred' }
  /** The page reloaded; forget the saves collected so far. */
  | { type: 'revalidationDone' }
