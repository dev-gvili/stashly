/**
 * Saves one uploaded file's metadata, right after its row exists.
 *
 * ```
 * readingMetadata ── nothing to save (a zip, an unknown binary) ──→ indexed
 * readingMetadata → savingMetadata ⇄ waitingToRetryMetadataSave → indexed | failed
 * ```
 *
 * Metadata only. Vectors (`embed.machine.ts`) and OCR (`ocr.machine.ts`) used
 * to run in this machine after the save, holding one of the queue's two slots
 * through the GPU work, so a file's facets waited behind every earlier file's
 * embeddings and OCR, and a reload before its turn left it with none
 * (tech-debt item 53). The output carries what those two need: the chunks the
 * server cut, and whether the PDF needs OCR.
 *
 * The save retries twice, 800 ms apart. Reading the file doesn't: a file that
 * can't be read once won't be on a second try.
 *
 * Spawned by `indexing-queue.machine.ts`. Reports with `emit` (see
 * `IndexItemEmitted`) so it can be tested on its own.
 */
import { setup, assign, emit } from 'xstate'
import { readMetadataFromFile, saveMetadataToServer } from './indexing.actors'
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
export const MAX_ATTEMPTS = 2

/** Pause before retrying a server write: long enough to outlast a 5xx blip. */
export const RETRY_DELAY_MS = 800

/** Reads an invoke's `output` from a done event inside a named guard or action. */
export const outputOf = <T>(event: unknown) => (event as { output: T }).output

/** Reads an invoke's `error` from an error event, as a readable string. */
export const errorOf = (event: unknown) => {
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
  },

  delays: {
    /** See `RETRY_DELAY_MS`. */
    retryDelay: RETRY_DELAY_MS,
  },

  guards: {
    /** The metadata save still has retries left. */
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
  },

  actions: {
    storeMetadata: assign({
      metadata: ({ event }) => outputOf<IndexItemContext['metadata']>(event),
    }),
    storeChunks: assign({
      chunks: ({ event }) => outputOf<SearchChunkDraft[]>(event),
    }),
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
    "Saves one uploaded file's metadata facets and text right after its row exists. Vectors and OCR follow later, in their own machines.",
  context: ({ input }) => ({
    itemId: input.itemId,
    file: input.file,
    metadata: null,
    chunks: [],
    attempts: 0,
    failureReason: null,
    outcome: null,
  }),
  output: ({ context }) => ({
    itemId: context.itemId,
    outcome: context.outcome ?? 'failed',
    chunks: context.chunks,
    needsOcr:
      context.outcome === 'indexed' && context.metadata?.needsOcr === true,
    file: context.file,
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
        "POST /api/items save_media_metadata. Saves the facets and the file's text; the server answers with the SearchChunk rows it cut the text into, which embed.machine gives vectors later.",
      invoke: {
        src: 'saveMetadataToServer',
        input: ({ context }) => ({
          itemId: context.itemId,
          metadata: context.metadata!,
        }),
        onDone: {
          target: 'indexed',
          actions: ['storeChunks', 'announceMetadataSaved'],
        },
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

    indexed: {
      description:
        'The metadata and text are saved. A file with nothing to save (a zip) ends here without a request.',
      type: 'final',
      entry: { type: 'recordOutcome', params: { outcome: 'indexed' } },
    },

    failed: {
      description:
        'The file could not be read, or its metadata never reached the server after retries. Logged by the queue.',
      type: 'final',
      entry: [
        { type: 'recordOutcome', params: { outcome: 'failed' } },
        'announceFailure',
      ],
    },
  },
})
