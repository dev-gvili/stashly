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
 * `downloadingOriginal`, then joins the identical path with stage 3 skipped.
 * A `fromMemory` job starts at `paintingBlurPreview` with the uploaded file.
 *
 * Every state has a `description`, which is what the Stately editor shows;
 * `__tests__/state-descriptions.test.ts` fails if one is missing.
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
import { stageViewUrl } from '@/utils/thumbnail-stages'
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
  description:
    "Makes one card's thumbnail: a blur preview, a 512px resize uploaded and saved, then a salient crop for images whose file is in memory. Ends in exactly one final state, which the manager reads to decide whether to ask again.",
  initial: 'choosingSource',
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
    choosingSource: {
      description:
        'Picks where the bytes come from. A `fromDownload` job has no file in memory and downloads the original first; a `fromMemory` job goes straight to the blur preview with the uploaded file.',
      always: [
        { guard: 'needsDownload', target: 'downloadingOriginal' },
        { target: 'paintingBlurPreview' },
      ],
    },

    downloadingOriginal: {
      description:
        "Asks the server for the original (`intent=source`) and downloads it. The server may answer that another client already made this thumbnail, which ends the job with theirs painted. A refusal (permission, size cap, unsupported type) is final; a network error retries.",
      invoke: {
        src: 'acquireSource',
        input: ({ context }) => ({ itemId: context.itemId }),
        onDone: [
          {
            guard: ({ event }) => event.output.kind === 'existing',
            target: 'alreadyThumbnailed',
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
                  // The stage the other client actually reached, reported by
                  // the server. A signed URL carries no cache-buster to read it
                  // off, and assuming 2 would under-report a crop.
                  progress: { stage, src: url },
                }
              }),
            ],
          },
          {
            guard: ({ event }) => event.output.kind === 'file',
            target: 'paintingBlurPreview',
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
          { target: 'sourceUnavailable' },
        ],
        onError: [
          {
            guard: 'canRetry',
            target: 'waitingToRetryDownload',
            actions: 'countAttempt',
          },
          { target: 'sourceUnavailable' },
        ],
      },
    },
    waitingToRetryDownload: {
      description: `Pauses ${RETRY_DELAY_MS} ms after a failed download, then tries again (at most ${MAX_ATTEMPTS} retries).`,
      after: { [RETRY_DELAY_MS]: 'downloadingOriginal' },
    },

    paintingBlurPreview: {
      description:
        'Makes a tiny blurred preview (stage 1) in the compute worker and paints it at once, from an object URL, while the real thumbnail is made. Types with no preview producer skip it, and a failure only delays the first paint, so every outcome moves on to the resize.',
      invoke: {
        src: 'stage1',
        input: ({ context }) => ({ file: context.file! }),
        onDone: {
          target: 'resizingThumbnail',
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
        onError: { target: 'resizingThumbnail' },
      },
    },

    resizingThumbnail: {
      description:
        "Renders the 512px thumbnail (stage 2) in the compute worker: images and PDFs from the file, videos from the preview frame, text by rendering it. A type with no producer ends in `noThumbnailForType`; a failure retries, then ends there too.",
      invoke: {
        src: 'stage2',
        input: ({ context }) => ({
          file: context.file!,
          videoFrame: context.tinyBlob,
        }),
        onDone: [
          {
            guard: ({ event }) => event.output !== null,
            target: 'requestingUploadUrl',
            actions: [
              assign({ resized: ({ event }) => event.output }),
              'resetAttempts',
            ],
          },
          // Null is a legitimate answer: this type has no stage-2 producer.
          // Retrying would only reproduce it.
          { target: 'noThumbnailForType' },
        ],
        onError: [
          {
            guard: 'canRetry',
            target: 'waitingToRetryResize',
            actions: 'countAttempt',
          },
          { target: 'noThumbnailForType' },
        ],
      },
    },
    waitingToRetryResize: {
      description: `Pauses ${RETRY_DELAY_MS} ms after a failed resize, then tries again.`,
      after: { [RETRY_DELAY_MS]: 'resizingThumbnail' },
    },

    requestingUploadUrl: {
      description:
        'Asks `/api/thumbnails` (`intent=presign`) for a short-lived PUT URL for `thumbnails/{itemId}.webp`, plus a signed GET per stage for the card to paint. Retries, then fails the job.',
      invoke: {
        src: 'presign',
        input: ({ context }) => ({ itemId: context.itemId }),
        onDone: {
          target: 'uploadingResizedThumbnail',
          actions: [
            assign({ presign: ({ event }) => event.output }),
            'resetAttempts',
          ],
        },
        onError: [
          {
            guard: 'canRetry',
            target: 'waitingToRetryUploadUrl',
            actions: 'countAttempt',
          },
          { target: 'failed' },
        ],
      },
    },
    waitingToRetryUploadUrl: {
      description: `Pauses ${RETRY_DELAY_MS} ms after a failed presign request, then tries again.`,
      after: { [RETRY_DELAY_MS]: 'requestingUploadUrl' },
    },

    uploadingResizedThumbnail: {
      description:
        'PUTs the stage-2 webp to S3. The card paints it the moment this succeeds; the database record that follows is bookkeeping, and waiting a round trip for it would delay every sharpen in the gallery. Retries, then fails the job.',
      invoke: {
        src: 'putStage',
        input: ({ context }) => ({
          uploadUrl: context.presign!.uploadUrl,
          blob: context.resized!.blob,
          itemId: context.itemId,
          stage: 2 as const,
        }),
        onDone: {
          target: 'savingResizedThumbnail',
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
            target: 'waitingToRetryResizedUpload',
            actions: 'countAttempt',
          },
          { target: 'failed' },
        ],
      },
    },
    waitingToRetryResizedUpload: {
      description: `Pauses ${RETRY_DELAY_MS} ms after a failed S3 PUT, then tries again.`,
      after: { [RETRY_DELAY_MS]: 'uploadingResizedThumbnail' },
    },

    savingResizedThumbnail: {
      description:
        "PATCHes the Thumbnail row with stage 2 and its size. Then crops the salient region if this job wants stage 3, or finishes. A failed save still goes on: the bytes are in S3 and painting, only the row is stale.",
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
            target: 'croppingSalientRegion',
            actions: 'resetAttempts',
          },
          { target: 'thumbnailed' },
        ],
        onError: [
          {
            guard: 'canRetry',
            target: 'waitingToRetryResizedSave',
            actions: 'countAttempt',
          },
          // The bytes are on S3 and the card is painting them; only the row
          // is stale. Losing stage 3 on top of that helps nobody.
          { guard: 'wantsStage3', target: 'croppingSalientRegion' },
          { target: 'thumbnailed' },
        ],
      },
    },
    waitingToRetryResizedSave: {
      description: `Pauses ${RETRY_DELAY_MS} ms after a failed stage-2 PATCH, then tries again.`,
      after: { [RETRY_DELAY_MS]: 'savingResizedThumbnail' },
    },

    croppingSalientRegion: {
      description:
        'Stage 3, images held in memory only: finds the salient region with a WebGPU model (through the shared AI queue) and crops a 512px square. An improvement on a thumbnail the item already has, so every failure from here ends in `thumbnailed`, never `failed`.',
      invoke: {
        src: 'stage3',
        input: ({ context }) => ({ file: context.file! }),
        onDone: [
          {
            guard: ({ event }) => event.output !== null,
            target: 'uploadingSalientCrop',
            actions: assign({ salient: ({ event }) => event.output }),
          },
          { target: 'thumbnailed' },
        ],
        onError: { target: 'thumbnailed' },
      },
    },

    uploadingSalientCrop: {
      description:
        'PUTs the stage-3 crop to S3 over the stage-2 object, with the same presigned URL, and paints it. A failure keeps the stage-2 thumbnail.',
      invoke: {
        src: 'putStage',
        input: ({ context }) => ({
          uploadUrl: context.presign!.uploadUrl,
          blob: context.salient!,
          itemId: context.itemId,
          stage: 3 as const,
        }),
        onDone: { target: 'savingSalientCrop', actions: 'emitStage3' },
        onError: { target: 'thumbnailed' },
      },
    },

    savingSalientCrop: {
      description:
        'PATCHes the Thumbnail row with stage 3. Either outcome finishes the job: the crop is already painting.',
      invoke: {
        src: 'patchThumbnail',
        input: ({ context }) => ({
          itemId: context.itemId,
          stage: 3 as const,
          url: stageViewUrl(context.presign!.viewUrls, 3),
          width: SALIENT_SIZE,
          height: SALIENT_SIZE,
        }),
        onDone: { target: 'thumbnailed' },
        onError: { target: 'thumbnailed' },
      },
    },

    thumbnailed: {
      type: 'final',
      entry: 'revokeStage1',
      description: 'The card has a stored thumbnail (stage 2, and stage 3 when it was wanted and worked).',
    },
    noThumbnailForType: {
      type: 'final',
      entry: 'revokeStage1',
      description:
        "This file's type has no thumbnail producer, or rendering it kept failing. Tells the manager to stop asking for this item.",
    },
    alreadyThumbnailed: {
      type: 'final',
      description: 'Another client made this thumbnail first; theirs is painted and no work was done.',
    },
    sourceUnavailable: {
      type: 'final',
      description:
        'The server declined to hand over the original (permission, size cap, unsupported type) or the download kept failing. Never retried in this tab.',
    },
    failed: {
      type: 'final',
      entry: ['emitFailed', 'revokeStage1'],
      description:
        'Getting an upload URL or storing the stage-2 thumbnail kept failing. Reports the reason; the card keeps its placeholder.',
    },
  },
})

export type ThumbnailItemMachine = typeof thumbnailItemMachine
