/**
 * Gives one set of chunks their vectors: a file's text, or one OCR page.
 *
 * ```
 * embeddingChunks → savingVectors ⇄ waitingToRetryVectorSave → embedded
 *        └─ GPU error, wrong vector count, save gave up ──────→ withoutVectors
 * ```
 *
 * Vector embedding only. It runs in the indexing queue's deferred lane, which
 * starts once uploads have been idle for a moment, so the GPU work never holds
 * up a file's metadata (tech-debt item 53).
 *
 * The save retries twice, 800 ms apart; embedding doesn't, since a model that
 * fails once won't on a second try. Neither failure fails the file: its chunks
 * are saved and keyword-searchable, and `useEmbeddingBackfill` fills in missing
 * vectors later, so it ends in `withoutVectors`.
 */
import { setup, assign } from 'xstate'
import { embedChunksOnGpu, saveVectorsToServer } from './indexing.actors'
import {
  MAX_ATTEMPTS,
  RETRY_DELAY_MS,
  errorOf,
  outputOf,
} from './indexing-item.machine'
import type {
  EmbedContext,
  EmbedInput,
  EmbedOutcome,
  EmbedOutput,
} from './indexing.types'

export const embedMachine = setup({
  types: {
    context: {} as EmbedContext,
    input: {} as EmbedInput,
    output: {} as EmbedOutput,
  },

  actors: {
    embedChunksOnGpu,
    saveVectorsToServer,
  },

  delays: {
    /** See `RETRY_DELAY_MS`. */
    retryDelay: RETRY_DELAY_MS,
  },

  guards: {
    /** The vector save still has retries left. */
    canRetry: ({ context }) => context.attempts < MAX_ATTEMPTS,
    /**
     * Embedding returned exactly one vector per chunk. Vectors are matched to
     * chunks by position, so anything else would save the wrong vectors.
     */
    oneVectorPerChunk: ({ context, event }) =>
      outputOf<number[][]>(event).length === context.chunks.length,
  },

  actions: {
    storeVectors: assign({
      vectors: ({ event }) => outputOf<number[][]>(event),
    }),
    countAttempt: assign(({ context }) => ({ attempts: context.attempts + 1 })),
    /** Logs why the vectors won't be saved. */
    warnVectorsMissing: ({ context, event }) => {
      const reason =
        (event as { error?: unknown }).error !== undefined
          ? errorOf(event)
          : 'vector count did not match chunk count'
      console.warn('[indexing] no vectors for', context.itemId, reason)
    },
    recordOutcome: assign((_, params: { outcome: EmbedOutcome }) => ({
      outcome: params.outcome,
    })),
  },
}).createMachine({
  id: 'embed',
  description:
    "Turns one set of chunks into vectors on the GPU and saves them: a file's text, or one OCR page.",
  context: ({ input }) => ({
    itemId: input.itemId,
    chunks: input.chunks,
    vectors: null,
    attempts: 0,
    outcome: null,
  }),
  output: ({ context }) => ({
    itemId: context.itemId,
    outcome: context.outcome ?? 'withoutVectors',
  }),
  initial: 'embeddingChunks',

  states: {
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
          { target: 'withoutVectors', actions: 'warnVectorsMissing' },
        ],
        onError: { target: 'withoutVectors', actions: 'warnVectorsMissing' },
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
        onDone: 'embedded',
        onError: [
          {
            guard: 'canRetry',
            target: 'waitingToRetryVectorSave',
            actions: 'countAttempt',
          },
          { target: 'withoutVectors', actions: 'warnVectorsMissing' },
        ],
      },
    },

    waitingToRetryVectorSave: {
      description: 'The vector save failed; waits 800 ms and tries again.',
      after: { retryDelay: 'savingVectors' },
    },

    embedded: {
      description: 'Every chunk has its vector saved.',
      type: 'final',
      entry: { type: 'recordOutcome', params: { outcome: 'embedded' } },
    },

    withoutVectors: {
      description:
        'The chunks are saved and searchable by keyword, but have no vectors; useEmbeddingBackfill can add them later.',
      type: 'final',
      entry: { type: 'recordOutcome', params: { outcome: 'withoutVectors' } },
    },
  },
})
