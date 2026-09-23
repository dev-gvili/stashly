/**
 * Per-item thumbnail machine — one actor per file being thumbnailed.
 *
 * Two parallel regions, because the two legs are genuinely independent and
 * today's code hides that by firing one of them as an untracked `void` promise:
 *
 *   stages    what the card paints:  stage 1 blur → 512 resize → salient crop
 *   indexing  what search reads:     metadata → embeddings → OCR
 *
 * A `.zip` has no stages worth running but still has metadata worth saving; a
 * scanned PDF finishes its stages in seconds and its indexing minutes later.
 * Modelling them as one sequence would make each wait on the other.
 *
 * The machine is done when *both* regions reach a final state — which is what
 * lets the manager free the concurrency slot at the right moment rather than
 * when the thumbnail happens to paint.
 *
 * One machine covers both modes. A `backfill` job enters at `acquiring` (it has
 * to re-download the original), then joins the identical stage path with stage 3
 * and the whole indexing region skipped. That shared path is what removes the
 * near-duplicate orchestration between the old `useThumbnail` and the old
 * `backfill()`.
 */
import { setup, assign, emit, enqueueActions } from 'xstate'
import {
  acquireSourceActor,
  stage1Actor,
  stage2Actor,
  stage3Actor,
  presignActor,
  putStageActor,
  patchThumbnailActor,
  saveMetadataActor,
  embedChunksActor,
  ocrStreamActor,
} from './thumbnail.actors'
import { makeStageUrl } from '@/utils/thumbnail-pipeline'
import type {
  ThumbItemContext,
  ThumbItemInput,
  ThumbItemOutput,
  ThumbItemEmitted,
} from './thumbnail.types'

/**
 * Retries per failing step. Deliberately small: these are network and S3 blips,
 * and a file that genuinely can't be rendered should reach the skip list fast
 * rather than burn the queue slot three times over.
 */
const MAX_ATTEMPTS = 2

/**
 * Pause before a retry. Long enough to outlast a transient 5xx or a GPU that
 * needs a moment, short enough that the card doesn't visibly stall — the same
 * shape as the `waiting_to_retry` state in `pipeline.machine.ts`.
 */
const RETRY_DELAY_MS = 800

/** Stage 3 crops to a square, so its dimensions are known without measuring. */
const SALIENT_SIZE = 512

/**
 * Recovers which stage a persisted thumbnail URL represents.
 *
 * Stages 2 and 3 share one S3 key and are told apart only by the `?v=` cache
 * buster, so when another client hands us a finished URL that param is the only
 * evidence of how far they got. Defaults to 2 — the stage every thumbnailed
 * item has reached — rather than over-claiming a crop that may not exist.
 */
function stageFromUrl(url: string): 2 | 3 {
  return /[?&]v=3(?:&|$)/.test(url) ? 3 : 2
}

export const thumbnailItemMachine = setup({
  types: {
    context: {} as ThumbItemContext,
    input: {} as ThumbItemInput,
    output: {} as ThumbItemOutput,
    emitted: {} as ThumbItemEmitted,
  },
  actors: {
    acquireSource: acquireSourceActor,
    stage1: stage1Actor,
    stage2: stage2Actor,
    stage3: stage3Actor,
    presign: presignActor,
    putStage: putStageActor,
    patchThumbnail: patchThumbnailActor,
    saveMetadata: saveMetadataActor,
    embedChunks: embedChunksActor,
    ocrStream: ocrStreamActor,
  },
  guards: {
    isBackfill: ({ context }) => context.mode === 'backfill',
    skipIndexing: ({ context }) => context.mode !== 'upload',
    canRetry: ({ context }) => context.attempts < MAX_ATTEMPTS,
    /**
     * Stage 3 is images-only and upload-only. On a backfill it is skipped by
     * design: it is the most expensive stage and buys the least when the file
     * had to be re-downloaded to get here.
     */
    wantsStage3: ({ context }) =>
      context.mode === 'upload' && !!context.file?.type.startsWith('image/'),
    needsOcr: ({ context }) => context.needsOcr && context.file !== null,
    hasChunks: ({ context }) => context.chunks.length > 0,
  },
  actions: {
    /**
     * Clears the retry budget for the *next* step.
     *
     * Deliberately fired on success, never as a state's `entry`: a retry
     * re-enters the very state that is failing, so resetting on entry would
     * wipe the counter guarding it and loop forever. Steps are sequential, so
     * "reset when one succeeds" gives each its own full budget.
     */
    resetAttempts: assign({ attempts: 0 }),
    countAttempt: assign(({ context }) => ({ attempts: context.attempts + 1 })),

    revokeStage1: assign(({ context }) => {
      if (context.stage1ObjectUrl) URL.revokeObjectURL(context.stage1ObjectUrl)
      return { stage1ObjectUrl: null }
    }),

    emitStage2: emit(({ context }) => ({
      type: 'progress' as const,
      itemId: context.itemId,
      progress: {
        stage: 2 as const,
        src: makeStageUrl(context.presign!.publicUrl, 2),
        width: context.resized!.width,
        height: context.resized!.height,
      },
    })),

    emitStage3: emit(({ context }) => ({
      type: 'progress' as const,
      itemId: context.itemId,
      progress: {
        stage: 3 as const,
        src: makeStageUrl(context.presign!.publicUrl, 3),
        width: SALIENT_SIZE,
        height: SALIENT_SIZE,
      },
    })),

    emitMetadataSaved: emit(({ context }) => ({
      type: 'metadataSaved' as const,
      itemId: context.itemId,
    })),

    emitFailed: emit(({ context, event }) => {
      const err = (event as unknown as { error?: unknown }).error
      return {
        type: 'failed' as const,
        itemId: context.itemId,
        reason:
          err instanceof Error ? err.message : (context.error ?? 'unknown'),
      }
    }),
  },
}).createMachine({
  id: 'thumbnail-item',
  type: 'parallel',
  context: ({ input }) => ({
    itemId: input.itemId,
    mode: input.mode,
    file: input.file,
    tinyBlob: null,
    stage1ObjectUrl: null,
    resized: null,
    salient: null,
    presign: null,
    thumbnailed: false,
    attempts: 0,
    chunks: [],
    needsOcr: false,
    error: null,
  }),
  output: ({ context }) => ({
    itemId: context.itemId,
    thumbnailed: context.thumbnailed,
  }),

  states: {
    // ── What the card paints ────────────────────────────────────────────
    stages: {
      initial: 'deciding',
      states: {
        deciding: {
          always: [
            { guard: 'isBackfill', target: 'acquiring' },
            { target: 'stage1' },
          ],
        },

        /**
         * Backfill only. The server may answer that another client already
         * produced this thumbnail, in which case the correct amount of work to
         * do is none — paint theirs and stop.
         */
        acquiring: {
          invoke: {
            src: 'acquireSource',
            input: ({ context }) => ({ itemId: context.itemId }),
            onDone: [
              {
                guard: ({ event }) => event.output.kind === 'existing',
                target: 'existing',
                actions: [
                  assign({ thumbnailed: true }),
                  emit(({ context, event }) => {
                    const url = (
                      event.output as { kind: 'existing'; url: string }
                    ).url
                    return {
                      type: 'progress' as const,
                      itemId: context.itemId,
                      // Report the stage the other client actually reached,
                      // read back off the cache-buster, rather than assuming 2.
                      progress: { stage: stageFromUrl(url), src: url },
                    }
                  }),
                ],
              },
              {
                guard: ({ event }) => event.output.kind === 'file',
                target: 'stage1',
                actions: [
                  assign({
                    file: ({ event }) =>
                      (event.output as { kind: 'file'; file: File }).file,
                  }),
                  'resetAttempts',
                ],
              },
              // `unavailable` is the server declining — permission, size cap,
              // unsupported type. None of those improve on a retry.
              { target: 'unavailable' },
            ],
            onError: [
              {
                guard: 'canRetry',
                target: 'retryAcquire',
                actions: 'countAttempt',
              },
              { target: 'unavailable' },
            ],
          },
        },
        retryAcquire: { after: { [RETRY_DELAY_MS]: 'acquiring' } },

        /**
         * A failed blur is not a failed pipeline — it only costs a slightly
         * later first paint, so both outcomes walk on to stage 2.
         */
        stage1: {
          invoke: {
            src: 'stage1',
            input: ({ context }) => ({ file: context.file! }),
            onDone: {
              target: 'stage2',
              // Inline rather than a named action: the object URL has to be
              // created, stored *and* emitted from the same blob, and a named
              // `assign` would have to run before the `emit` could read it back.
              actions: enqueueActions(({ enqueue, context, event }) => {
                // Null is normal — plenty of types have no tiny producer.
                if (!event.output) return
                const url = URL.createObjectURL(event.output)
                enqueue.assign({ tinyBlob: event.output, stage1ObjectUrl: url })
                enqueue.emit({
                  type: 'progress',
                  itemId: context.itemId,
                  progress: { stage: 1, src: url },
                })
              }),
            },
            onError: { target: 'stage2' },
          },
        },

        stage2: {
          invoke: {
            src: 'stage2',
            input: ({ context }) => ({
              file: context.file!,
              videoFrame: context.tinyBlob,
            }),
            onDone: [
              {
                guard: ({ event }) => event.output !== null,
                target: 'presigning',
                actions: [
                  assign({ resized: ({ event }) => event.output }),
                  'resetAttempts',
                ],
              },
              // Null is a legitimate answer: this type has no stage-2 producer.
              // Retrying would only reproduce it.
              { target: 'noThumbnail' },
            ],
            onError: [
              {
                guard: 'canRetry',
                target: 'retryStage2',
                actions: 'countAttempt',
              },
              { target: 'noThumbnail' },
            ],
          },
        },
        retryStage2: { after: { [RETRY_DELAY_MS]: 'stage2' } },

        presigning: {
          invoke: {
            src: 'presign',
            input: ({ context }) => ({ itemId: context.itemId }),
            onDone: {
              target: 'putting2',
              actions: [
                assign({ presign: ({ event }) => event.output }),
                'resetAttempts',
              ],
            },
            onError: [
              {
                guard: 'canRetry',
                target: 'retryPresign',
                actions: 'countAttempt',
              },
              { target: 'failed' },
            ],
          },
        },
        retryPresign: { after: { [RETRY_DELAY_MS]: 'presigning' } },

        /**
         * The card paints the moment these bytes are reachable — the DB PATCH
         * that follows is bookkeeping, and making the user wait a round trip
         * for it would delay every sharpen in the gallery.
         */
        putting2: {
          invoke: {
            src: 'putStage',
            input: ({ context }) => ({
              uploadUrl: context.presign!.uploadUrl,
              blob: context.resized!.blob,
              itemId: context.itemId,
              stage: 2 as const,
            }),
            onDone: {
              target: 'patching2',
              actions: [
                'emitStage2',
                'revokeStage1',
                'resetAttempts',
                assign({ thumbnailed: true }),
              ],
            },
            onError: [
              {
                guard: 'canRetry',
                target: 'retryPut2',
                actions: 'countAttempt',
              },
              { target: 'failed' },
            ],
          },
        },
        retryPut2: { after: { [RETRY_DELAY_MS]: 'putting2' } },

        patching2: {
          invoke: {
            src: 'patchThumbnail',
            input: ({ context }) => ({
              itemId: context.itemId,
              stage: 2 as const,
              url: makeStageUrl(context.presign!.publicUrl, 2),
              width: context.resized!.width,
              height: context.resized!.height,
            }),
            onDone: [
              {
                guard: 'wantsStage3',
                target: 'stage3',
                actions: 'resetAttempts',
              },
              { target: 'complete' },
            ],
            onError: [
              {
                guard: 'canRetry',
                target: 'retryPatch2',
                actions: 'countAttempt',
              },
              // The bytes are on S3 and the card is painting them; only the row
              // is stale. Losing stage 3 on top of that helps nobody.
              { guard: 'wantsStage3', target: 'stage3' },
              { target: 'complete' },
            ],
          },
        },
        retryPatch2: { after: { [RETRY_DELAY_MS]: 'patching2' } },

        /**
         * Everything from here is an improvement on an item that already has a
         * good thumbnail, so every failure path targets `complete` rather than
         * `failed` — stage 3 is never worth reporting as a broken item.
         */
        stage3: {
          invoke: {
            src: 'stage3',
            input: ({ context }) => ({ file: context.file! }),
            onDone: [
              {
                guard: ({ event }) => event.output !== null,
                target: 'putting3',
                actions: assign({ salient: ({ event }) => event.output }),
              },
              { target: 'complete' },
            ],
            onError: { target: 'complete' },
          },
        },

        putting3: {
          invoke: {
            src: 'putStage',
            input: ({ context }) => ({
              uploadUrl: context.presign!.uploadUrl,
              blob: context.salient!,
              itemId: context.itemId,
              stage: 3 as const,
            }),
            onDone: { target: 'patching3', actions: 'emitStage3' },
            onError: { target: 'complete' },
          },
        },

        patching3: {
          invoke: {
            src: 'patchThumbnail',
            input: ({ context }) => ({
              itemId: context.itemId,
              stage: 3 as const,
              url: makeStageUrl(context.presign!.publicUrl, 3),
              width: SALIENT_SIZE,
              height: SALIENT_SIZE,
            }),
            onDone: { target: 'complete' },
            onError: { target: 'complete' },
          },
        },

        complete: { type: 'final', entry: 'revokeStage1' },
        /** No producer for this type — tells the manager to stop asking. */
        noThumbnail: { type: 'final', entry: 'revokeStage1' },
        /** Another client got there first. */
        existing: { type: 'final' },
        /** Server declined the source. Never retried. */
        unavailable: { type: 'final' },
        failed: { type: 'final', entry: ['emitFailed', 'revokeStage1'] },
      },
    },

    // ── What search reads ───────────────────────────────────────────────
    indexing: {
      initial: 'deciding',
      states: {
        deciding: {
          always: [
            // Backfill items were indexed at upload time; re-running it would
            // duplicate chunks for no gain.
            { guard: 'skipIndexing', target: 'skipped' },
            { target: 'extracting' },
          ],
        },

        extracting: {
          invoke: {
            src: 'saveMetadata',
            input: ({ context }) => ({
              itemId: context.itemId,
              file: context.file!,
            }),
            onDone: {
              target: 'embedding',
              actions: [
                assign({
                  chunks: ({ event }) => event.output.chunks,
                  needsOcr: ({ event }) => event.output.needsOcr,
                }),
                // Facets the user can see just changed, and a plain `fetch`
                // does not revalidate the route the way a fetcher would.
                'emitMetadataSaved',
              ],
            },
            onError: { target: 'indexFailed' },
          },
        },

        embedding: {
          always: [
            { guard: 'hasChunks', target: 'vectorizing' },
            { target: 'afterEmbed' },
          ],
        },

        vectorizing: {
          invoke: {
            src: 'embedChunks',
            input: ({ context }) => ({ chunks: context.chunks }),
            onDone: { target: 'afterEmbed' },
            // A chunk with text but no vector is still findable by keyword, so
            // this is a degradation rather than a failure of the leg.
            onError: { target: 'afterEmbed' },
          },
        },

        afterEmbed: {
          always: [{ guard: 'needsOcr', target: 'ocr' }, { target: 'indexed' }],
        },

        /**
         * Minutes of work, and — unlike before — a state the machine holds a
         * handle on. Stopping the actor stops the OCR run.
         */
        ocr: {
          invoke: {
            src: 'ocrStream',
            input: ({ context }) => ({
              itemId: context.itemId,
              file: context.file!,
            }),
            onDone: { target: 'indexed' },
            onError: { target: 'indexFailed' },
          },
        },

        indexed: { type: 'final' },
        skipped: { type: 'final' },
        indexFailed: { type: 'final' },
      },
    },
  },
})

export type ThumbnailItemMachine = typeof thumbnailItemMachine
