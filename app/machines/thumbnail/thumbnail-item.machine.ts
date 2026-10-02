/**
 * Per-item thumbnail machine — one actor per file being thumbnailed.
 *
 *   stage 1 blur → 512 resize → upload → save record → salient crop
 *
 * Only what the card paints. Search indexing (metadata, embeddings, OCR) used
 * to run here as a parallel region; it is its own machine now, in
 * `app/machines/indexing/`, so a slow embedding no longer holds a thumbnail
 * slot and a download job can no longer skip a file's indexing.
 *
 * One machine covers both kinds of job. A `fromDownload` job enters at
 * `acquiring` (it has to download the original), then joins the identical
 * stage path with stage 3 skipped. A `fromMemory` job starts at stage 1 with
 * the uploaded file.
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
} from './thumbnail.actors'
import { stageViewUrl } from '@/utils/thumbnail-pipeline'
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
  },
  guards: {
    /** No file in memory: the original has to be downloaded first. */
    needsDownload: ({ context }) => context.mode === 'fromDownload',
    canRetry: ({ context }) => context.attempts < MAX_ATTEMPTS,
    /**
     * Stage 3 is for images whose file is in memory. A download job skips it
     * by design: it is the most expensive stage and buys the least when the
     * file had to be downloaded to get here.
     */
    wantsStage3: ({ context }) =>
      context.mode === 'fromMemory' && !!context.file?.type.startsWith('image/'),
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
        src: stageViewUrl(context.presign!.viewUrls, 2),
        width: context.resized!.width,
        height: context.resized!.height,
      },
    })),

    emitStage3: emit(({ context }) => ({
      type: 'progress' as const,
      itemId: context.itemId,
      progress: {
        stage: 3 as const,
        src: stageViewUrl(context.presign!.viewUrls, 3),
        width: SALIENT_SIZE,
        height: SALIENT_SIZE,
      },
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
  initial: 'stages',
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
            { guard: 'needsDownload', target: 'acquiring' },
            { target: 'stage1' },
          ],
        },

        /**
         * Download jobs only. The server may answer that another client already
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
                    const { url, stage } = event.output as {
                      kind: 'existing'
                      url: string
                      stage: 2 | 3
                    }
                    return {
                      type: 'progress' as const,
                      itemId: context.itemId,
                      // The stage the other client actually reached, reported
                      // by the server. A signed URL carries no cache-buster to
                      // read it off, and assuming 2 would under-report a crop.
                      progress: { stage, src: url },
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
              url: stageViewUrl(context.presign!.viewUrls, 2),
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
              url: stageViewUrl(context.presign!.viewUrls, 3),
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
      // Any of the endings above ends the whole machine. `stages` stays a
      // nested state for now so this change doesn't rename every state;
      // the planned rewrite of this machine flattens it.
      onDone: { target: 'done' },
    },

    done: { type: 'final' },
  },
})

export type ThumbnailItemMachine = typeof thumbnailItemMachine
