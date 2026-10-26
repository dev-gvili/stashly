/**
 * Indexes one uploaded file for search.
 *
 * ```
 * readingMetadata ── nothing to save (a zip, an unknown binary) ──→ indexed
 * readingMetadata → savingMetadata ─┬─ has chunks ─→ embeddingChunks → savingVectors ─┐
 *                                   ├─ scanned PDF ─────────────────────────────────┐ │
 *                                   └─ neither ─→ indexed                           │ │
 *                                                       choosingNextStep ←──────────┼─┘
 *                                                         ├─ scanned PDF → transcribingScannedPdf
 *                                                         └─ else → indexed | indexedWithoutVectors
 * ```
 *
 * The two server writes retry twice, 800 ms apart. Reading the file and running
 * the models do not: a file that can't be read or embedded once won't be on a
 * second try. A vector failure never fails the file — its chunks are already
 * saved and searchable by keyword, and `useEmbeddingBackfill` fills in missing
 * vectors later — so it ends in `indexedWithoutVectors` instead.
 *
 * Spawned by `indexing-queue.machine.ts`. Reports with `emit` (see
 * `IndexItemEmitted`) so it can be tested on its own.
 */
import { setup, assign, emit } from 'xstate'
import {
  readMetadataFromFile,
  saveMetadataToServer,
  embedChunksOnGpu,
  saveVectorsToServer,
  transcribeScannedPdf,
} from './indexing.actors'
import { hasMetadataToSave, type MediaMetadata } from '@/utils/media-metadata'
import type {
  IndexItemContext,
  IndexItemEmitted,
  IndexItemInput,
  IndexItemOutput,
  IndexOutcome,
  SearchChunkDraft,
} from './indexing.types'

/** Retries per server write before giving up on it. */
const MAX_ATTEMPTS = 2

/** Pause before retrying a server write: long enough to outlast a 5xx blip. */
const RETRY_DELAY_MS = 800

/** Reads an invoke's `output` from a done event inside a named guard or action. */
const outputOf = <T>(event: unknown) => (event as { output: T }).output

/** Reads an invoke's `error` from an error event, as a readable string. */
const errorOf = (event: unknown) => {
  const error = (event as { error?: unknown }).error
  return error instanceof Error ? error.message : String(error)
}

export const indexingItemMachine = setup({
  types: {
    context: {} as IndexItemContext,
    input: {} as IndexItemInput,
    output: {} as IndexItemOutput,
    emitted: {} as IndexItemEmitted,
  },

  actors: {
    readMetadataFromFile,
    saveMetadataToServer,
    embedChunksOnGpu,
    saveVectorsToServer,
    transcribeScannedPdf,
  },

  delays: {
    /** See `RETRY_DELAY_MS`. */
    retryDelay: RETRY_DELAY_MS,
  },

  guards: {
    /** The failing server write still has retries left. */
    canRetry: ({ context }) => context.attempts < MAX_ATTEMPTS,
    /**
     * The file gave nothing for `save_media_metadata` (a zip, an unknown
     * binary) and needs no OCR, so there is no request to make. Reads the done
     * event: a guard runs before `storeMetadata` assigns.
     */
    nothingToSave: ({ event }) => {
      const metadata = outputOf<MediaMetadata>(event)
      return !hasMetadataToSave(metadata) && metadata.needsOcr !== true
    },
    /** The server cut the file's text into at least one chunk. */
    serverReturnedChunks: ({ event }) =>
      outputOf<SearchChunkDraft[]>(event).length > 0,
    /** A PDF with no text layer: its text has to come from OCR. */
    isScannedPdf: ({ context }) => context.metadata?.needsOcr === true,
    /**
     * Embedding returned exactly one vector per chunk. Vectors are matched to
     * chunks by position, so anything else would save the wrong vectors.
     */
    oneVectorPerChunk: ({ context, event }) =>
      outputOf<number[][]>(event).length === context.chunks.length,
    /** Embedding or saving the vectors gave up earlier in this run. */
    vectorsMissing: ({ context }) => context.missingVectors,
  },

  actions: {
    storeMetadata: assign({
      metadata: ({ event }) => outputOf<IndexItemContext['metadata']>(event),
    }),
    storeChunks: assign({
      chunks: ({ event }) => outputOf<SearchChunkDraft[]>(event),
    }),
    storeVectors: assign({
      vectors: ({ event }) => outputOf<number[][]>(event),
    }),
    /** Records that the vectors won't be saved; logs the reason. */
    markVectorsMissing: assign(({ context, event }) => {
      const reason =
        (event as { error?: unknown }).error !== undefined
          ? errorOf(event)
          : 'vector count did not match chunk count'
      console.warn('[indexing] no vectors for', context.itemId, reason)
      return { missingVectors: true }
    }),
    /** Starts the next server write with a full retry budget. */
    resetAttempts: assign({ attempts: 0 }),
    countAttempt: assign(({ context }) => ({ attempts: context.attempts + 1 })),
    storeFailureReason: assign({
      failureReason: ({ event }) => errorOf(event),
    }),
    /**
     * Tells the queue the page's facets changed, so it can reload the page once
     * the batch is done.
     */
    announceMetadataSaved: emit(({ context }) => ({
      type: 'metadataSaved' as const,
      itemId: context.itemId,
    })),
    announceFailure: emit(({ context }) => ({
      type: 'failed' as const,
      itemId: context.itemId,
      reason: context.failureReason ?? 'unknown',
    })),
    recordOutcome: assign((_, params: { outcome: IndexOutcome }) => ({
      outcome: params.outcome,
    })),
  },
}).createMachine({
  id: 'indexingItem',
  description:
    'Indexes one uploaded file for search: metadata facets, text chunks, a vector per chunk, and OCR for scanned PDFs.',
  context: ({ input }) => ({
    itemId: input.itemId,
    file: input.file,
    metadata: null,
    chunks: [],
    vectors: null,
    missingVectors: false,
    attempts: 0,
    failureReason: null,
    outcome: null,
  }),
  output: ({ context }) => ({
    itemId: context.itemId,
    outcome: context.outcome ?? 'failed',
  }),
  initial: 'readingMetadata',

  states: {
    readingMetadata: {
      description:
        'Reads metadata out of the file in the compute worker: image dimensions and EXIF, PDF text and page count, markdown facets, audio tags. Local only, no request.',
      invoke: {
        src: 'readMetadataFromFile',
        input: ({ context }) => ({ file: context.file }),
        onDone: [
          {
            guard: 'nothingToSave',
            target: 'indexed',
            actions: 'storeMetadata',
          },
          { target: 'savingMetadata', actions: 'storeMetadata' },
        ],
        onError: { target: 'failed', actions: 'storeFailureReason' },
      },
    },

    savingMetadata: {
      description:
        "POST /api/items save_media_metadata. Saves the facets and the file's text; the server answers with the SearchChunk rows it cut the text into.",
      invoke: {
        src: 'saveMetadataToServer',
        input: ({ context }) => ({
          itemId: context.itemId,
          metadata: context.metadata!,
        }),
        onDone: [
          {
            guard: 'serverReturnedChunks',
            target: 'embeddingChunks',
            actions: ['storeChunks', 'resetAttempts', 'announceMetadataSaved'],
          },
          {
            guard: 'isScannedPdf',
            target: 'transcribingScannedPdf',
            actions: ['resetAttempts', 'announceMetadataSaved'],
          },
          {
            target: 'indexed',
            actions: ['resetAttempts', 'announceMetadataSaved'],
          },
        ],
        onError: [
          {
            guard: 'canRetry',
            target: 'waitingToRetryMetadataSave',
            actions: 'countAttempt',
          },
          { target: 'failed', actions: 'storeFailureReason' },
        ],
      },
    },

    waitingToRetryMetadataSave: {
      description: 'The metadata save failed; waits 800 ms and tries again.',
      after: { retryDelay: 'savingMetadata' },
    },

    embeddingChunks: {
      description:
        "Turns every chunk's text into a 768-dimension vector on the GPU, through the shared WebGPU queue (ai-queue.ts), 16 chunks per GPU call.",
      invoke: {
        src: 'embedChunksOnGpu',
        input: ({ context }) => ({ chunks: context.chunks }),
        onDone: [
          {
            guard: 'oneVectorPerChunk',
            target: 'savingVectors',
            actions: 'storeVectors',
          },
          { target: 'choosingNextStep', actions: 'markVectorsMissing' },
        ],
        onError: { target: 'choosingNextStep', actions: 'markVectorsMissing' },
      },
    },

    savingVectors: {
      description:
        'POST /api/items save_search_chunk_embeddings. Stores each vector against its chunk.',
      invoke: {
        src: 'saveVectorsToServer',
        input: ({ context }) => ({
          chunks: context.chunks,
          vectors: context.vectors!,
        }),
        onDone: { target: 'choosingNextStep', actions: 'resetAttempts' },
        onError: [
          {
            guard: 'canRetry',
            target: 'waitingToRetryVectorSave',
            actions: 'countAttempt',
          },
          { target: 'choosingNextStep', actions: 'markVectorsMissing' },
        ],
      },
    },

    waitingToRetryVectorSave: {
      description: 'The vector save failed; waits 800 ms and tries again.',
      after: { retryDelay: 'savingVectors' },
    },

    choosingNextStep: {
      description:
        'Decides, without waiting, what comes after the vectors: OCR for a scanned PDF, otherwise done.',
      always: [
        { guard: 'isScannedPdf', target: 'transcribingScannedPdf' },
        { guard: 'vectorsMissing', target: 'indexedWithoutVectors' },
        { target: 'indexed' },
      ],
    },

    transcribingScannedPdf: {
      description:
        'Reads a PDF with no text layer page by page with the OCR model, saving and embedding each page as it is read. Can take minutes.',
      invoke: {
        src: 'transcribeScannedPdf',
        input: ({ context }) => ({
          itemId: context.itemId,
          file: context.file,
        }),
        onDone: [
          { guard: 'vectorsMissing', target: 'indexedWithoutVectors' },
          { target: 'indexed' },
        ],
        onError: { target: 'failed', actions: 'storeFailureReason' },
      },
    },

    indexed: {
      description:
        'Everything the file had is saved: metadata, chunks and vectors. A file with nothing to save (a zip) ends here without a request.',
      type: 'final',
      entry: { type: 'recordOutcome', params: { outcome: 'indexed' } },
    },

    indexedWithoutVectors: {
      description:
        'Metadata and chunks are saved and searchable by keyword. Vectors are missing; useEmbeddingBackfill can add them later.',
      type: 'final',
      entry: {
        type: 'recordOutcome',
        params: { outcome: 'indexedWithoutVectors' },
      },
    },

    failed: {
      description:
        'The file could not be read, its metadata never reached the server after retries, or OCR broke. Logged by the queue.',
      type: 'final',
      entry: [
        { type: 'recordOutcome', params: { outcome: 'failed' } },
        'announceFailure',
      ],
    },
  },
})

export type IndexingItemMachine = typeof indexingItemMachine
