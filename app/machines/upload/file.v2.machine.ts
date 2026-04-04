// app/machines/file.machine.ts - Using Parallel States
import {
  assign,
  setup,
  assertEvent,
  enqueueActions,
  log,
  type ErrorActorEvent,
  type DoneActorEvent,
  sendTo,
  fromPromise,
} from 'xstate'
import type {
  MediaFileData,
  MediaFileStatus,
  MediaFileEvents,
  MediaFileInput,
  MediaFile,
  ProcessingStatus,
} from '@/types/machine.types'
import { toCategory } from '@/utils/converters'
import {
  abortUpload,
  completeUpload,
  createUpload,
  uploadParts,
} from '@/machines/multipart/s3.mulipart.utils'
import { StashlyAI } from '../../.client/stashly-ai'
// import { encodeImage, encodeText } from '@/utils/embeddings'
// import { imageToText } from '../../root'

const fileMachine = setup({
  types: {
    input: {} as MediaFileInput,
    context: {} as MediaFileData,
    events: {} as MediaFileEvents,
    output: {} as {
      mediaFile: MediaFile
      uploadId: string
    },
  },
  actors: {
    create: createUpload,
    upload: uploadParts,
    abort: abortUpload,
    complete: completeUpload,
    // imageCaption: imageCaptionMachine,
    presignUrl: fromPromise<{ url: string }, { bucket: string; key: string }>(
      async ({ input }) => {
        let formData = new FormData()
        formData.append('intent', 'presign-get-url')
        formData.append('bucket', input.bucket)
        formData.append('key', input.key)
        // Call our API to get a presigned URL for the uploaded file
        let response = await fetch('/api/s3/presigned', {
          method: 'POST',
          body: formData,
        })
        // Parse the response, expecting a JSON with { url: string }
        let data = (await response.json()) as { url: string }
        return data
      }
    ),
    imageCaption: fromPromise<{ caption: string }, { url: string }>(
      async ({ input }) => {
        let caption = await StashlyAI.caption(input.url)
        // let formData = new FormData()
        // formData.append('intent', 'caption-image')
        // // Get the presigned URL of the corrent loaded item ( if item category is image ).
        // formData.append('url', input.url)
        // // Call the captioning API
        // let response = await fetch('/api/ai/caption', {
        //   method: 'POST',
        //   body: formData,
        // })
        // // Parse the response, expecting a JSON with { description: string }
        // let data = (await response.json()) as { caption: string }
        return { caption }
      }
    ),
    // captionImage: fromPromise<{ caption: string }, { url: string }>(
    //   async ({ input }) => {
    //     let formData = new FormData()
    //     formData.append('intent', 'caption-image')
    //     // Get the presigned URL of the corrent loaded item ( if item category is image ).
    //     formData.append('url', input.url)
    //     // Call the captioning API
    //     let response = await fetch('/api/ai/caption', {
    //       method: 'POST',
    //       body: formData,
    //     })
    //     // Parse the response, expecting a JSON with { description: string }
    //     let data = (await response.json()) as { caption: string }
    //     return data
    //   }
    // ),
    transcribe: fromPromise<{ transcription: string }, { url: string }>(
      async ({ input }) => {
        let formData = new FormData()
        formData.append('intent', 'transcribe-file')
        formData.append('url', input.url)
        formData.append('model', 'base.en')
        formData.append('queue', '10')
        formData.append('language', 'auto')
        formData.append('stream', 'false')
        // Call the transcription API
        let response = await fetch('/api/ai/transcribe', {
          method: 'POST',
          body: formData,
        })

        let data = (await response.json()) as { transcription: string }
        return data
      }
    ),
    summarize: fromPromise<{ summary: string }, { content: string }>(
      async ({ input }) => {
        let formData = new FormData()
        formData.append('intent', 'summarize-text')
        formData.append('text', input.content)
        // Call the summarization API
        let response = await fetch('/api/ai/summarize', {
          method: 'POST',
          body: formData,
        })
        let data = (await response.json()) as { summary: string }
        return data
      }
    ),
    processAudio: fromPromise<
      { transcription: string; summary: string },
      { url: string }
    >(async ({ input }) => {
      let formData = new FormData()
      formData.append('intent', 'process-audio')
      formData.append('url', input.url)
      formData.append('stream', 'false')
      // Call the audio processing API
      let response = await fetch('/api/ai/transcribe', {
        method: 'POST',
        body: formData,
      })
      let data = (await response.json()) as {
        transcription: string
        summary: string
      }
      return data
    }),
  },

  actions: {
    // Upload region actions
    UPDATE_UPLOAD_PROGRESS: assign(({ context, event }) => {
      assertEvent(event, '@multipart.upload.progress')
      return {
        mediaFile: {
          ...context.mediaFile,
          progress: event.progress,
        },
      }
    }),

    SAVE_PRESIGNED_URL: assign({
      presignedUrl: ({ event }) => {
        return (event as unknown as DoneActorEvent<{ url: string }>).output.url
      },
    }),

    SEND_PARENT_UPLOAD_PROGRESS: enqueueActions(
      ({ context, event, enqueue }) => {
        assertEvent(event, '@multipart.upload.progress')
        enqueue.sendParent({
          type: 'progress.change',
          mediaFileId: context.mediaFile.id,
          progress: event.progress,
        })
      }
    ),

    SAVE_UPLOAD_ID: assign({
      uploadId: ({ event }) => {
        return (event as unknown as DoneActorEvent<{ uploadId: string }>).output
          .uploadId
      },
    }),

    UPDATE_MEDIAFILE_UPLOAD: assign({
      mediaFile: ({ context, event }) => {
        return {
          ...context.mediaFile,
          ...(
            event as unknown as DoneActorEvent<{
              etag: string
              versionId: string
            }>
          ).output,
          status: 'done' as MediaFileStatus,
        }
      },
    }),

    START_UPLOAD_SERVICE: enqueueActions(({ context, event, enqueue }) => {
      enqueue.assign(({ spawn }) => {
        const actor = spawn('upload', {
          id: '@s3.multipart.upload',
          input: {
            file: context.mediaFile.file,
            key: context.mediaFile.key,
            uploadId: context.uploadId,
          },
        })
        return { worker: actor }
      })
    }),

    // AI Actions
    // will be extracted to a separate machine later.
    SAVE_CAPTION: assign({
      mediaFile: ({ context, event }) => {
        const output = (event as unknown as DoneActorEvent<{ caption: string }>)
          .output
        return {
          ...context.mediaFile,
          caption: output.caption,
        }
      },
    }),
    SAVE_TRANSCRIPTION: assign({
      mediaFile: ({ context, event }) => {
        const output = (
          event as unknown as DoneActorEvent<{ transcription: string }>
        ).output
        return {
          ...context.mediaFile,
          transcription: output.transcription,
        }
      },
    }),
    SAVE_SUMMARY: assign({
      mediaFile: ({ context, event }) => {
        const output = (event as unknown as DoneActorEvent<{ summary: string }>)
          .output
        return {
          ...context.mediaFile,
          summary: output.summary,
        }
      },
    }),
    SAVE_AUDIO_PROCESSING: assign({
      mediaFile: ({ context, event }) => {
        const output = (
          event as unknown as DoneActorEvent<{
            transcription: string
            summary: string
          }>
        ).output
        return {
          ...context.mediaFile,
          transcription: output.transcription,
          summary: output.summary,
        }
      },
    }),
    SAVE_TRANSCRIPTION_ERROR: enqueueActions(({ context, event, enqueue }) => {
      const error = (event as unknown as ErrorActorEvent<unknown, string>)
        .error as string
      console.error('[file.v2.machine] Audio transcribing failed:', error)
      // Log the error but don't fail the upload—transcribing is optional
      enqueue.assign({
        mediaFile: ({}) => ({
          ...context.mediaFile,
          caption: '', // Leave caption empty if processing fails
          processingError: `Transcription generation failed: ${error}`,
        }),
      })
    }),

    // Save embedding results, embedding generation is for semantic search later.
    SAVE_EMBEDDING: assign({
      mediaFile: ({ context, event }) => {
        let { embedding } = (
          event as unknown as DoneActorEvent<{
            embedding: number[]
          }>
        ).output
        return {
          ...context.mediaFile,
          embedding: embedding || [], // Ensure embedding is always an array
          processingStatus: 'COMPLETED',
        }
      },
    }),

    SAVE_PROCESSING_ERROR: assign({
      mediaFile: ({ context, event }) => {
        return {
          ...context.mediaFile,
          processingStatus: 'FAILED',
          processingError: (
            event as unknown as ErrorActorEvent<unknown, string>
          ).error as string,
        }
      },
      error: ({ event }) => {
        return (event as unknown as ErrorActorEvent<unknown, string>)
          .error as string
      },
    }),

    SAVE_CAPTION_ERROR: enqueueActions(({ context, event, enqueue }) => {
      const error = (event as unknown as ErrorActorEvent<unknown, string>)
        .error as string
      console.error('[file.v2.machine] Image captioning failed:', error)
      // Log the error but don't fail the upload—captioning is optional
      enqueue.assign({
        mediaFile: ({}) => ({
          ...context.mediaFile,
          caption: '', // Leave caption empty if processing fails
          processingError: `Caption generation failed: ${error}`,
        }),
      })
    }),

    // START_PROCESSING_SERVICE: enqueueActions(({ context, event, enqueue }) => {
    //   enqueue.assign(({ spawn }) => {
    //     const actor = spawn('processImage', {
    //       id: '@image.processing',
    //       input: {
    //         file: context.mediaFile.file,
    //       },
    //     })
    //     return { processingRef: actor }
    //   })
    // }),

    // Shared actions
    NOTIFY_QUOTA: sendTo(
      ({ system }) => system.get('quota'),
      ({ context, event }) => ({
        ...event,
      })
    ),

    SEND_PARENT_UPLOAD_DONE: enqueueActions(({ context, enqueue }) => {
      enqueue.sendParent({
        type: 'upload.done',
        mediaFile: context.mediaFile,
      })
    }),

    SEND_PARENT_UPLOAD_STARTED: enqueueActions(({ context, enqueue }) => {
      enqueue.sendParent({
        type: 'upload.started',
        mediaFileId: context.mediaFile.id,
      })
    }),

    SEND_PARENT_UPLOAD_ABORTED: enqueueActions(({ context, enqueue }) => {
      enqueue.sendParent({
        type: 'upload.aborted',
        mediaFile: context.mediaFile,
      })
    }),

    ABORT_UPLOAD: enqueueActions(({ context, enqueue }) => {
      enqueue.sendTo(context.worker!, {
        type: '@multipart.upload.abort',
      })
    }),

    ABORT_PROCESSING: enqueueActions(({ context, enqueue }) => {
      enqueue.sendTo(context.quota!, {
        type: 'PROCESSING.ABORT',
      })
    }),

    CHANGE_STATUS_TO_UPLOADING: assign(({ context }) => ({
      mediaFile: {
        ...context.mediaFile,
        status: 'uploading' as MediaFileStatus,
      },
    })),

    CHANGE_STATUS_TO_DONE: assign(({ context }) => {
      return {
        mediaFile: {
          ...context.mediaFile,
          status: 'done' as MediaFileStatus,
        },
      }
    }),

    CHANGE_STATUS_TO_ABORTED: assign(({ context }) => ({
      mediaFile: {
        ...context.mediaFile,
        status: 'aborted' as MediaFileStatus,
      },
    })),

    SAVE_ERROR: assign({
      error: ({ event }) => {
        return (event as unknown as ErrorActorEvent<unknown, string>)
          .error as string
      },
    }),
  },
  guards: {
    isImageFile: ({ context }) => {
      let category = toCategory(context.mediaFile.file)
      let isImage =
        category === 'image' || context.mediaFile.file.type.startsWith('image/')
      return isImage
    },
    isAudioFile: ({ context }) => {
      let category = toCategory(context.mediaFile.file)
      let isAudio =
        category === 'audio' || context.mediaFile.file.type.startsWith('audio/')
      return isAudio
    },
    isVideoFile: ({ context }) => {
      let category = toCategory(context.mediaFile.file)
      let isVideo =
        category === 'video' || context.mediaFile.file.type.startsWith('video/')
      return isVideo
    },
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QDMCWAbMA6ADmAdhKvlAMSwAuAhgE4UDaADALqKg4D2sqFqH+bEAA9EARgBs4rACZpAVkkAWcXIAco5QE4A7ABoQAT0TiAzFO3STcxRemML2uQF8n+tJizEepCP2zEANw4Aa2wAAVgTLABbAFd0XhxaCiwAYxowKgowJlYkEE5uXn5BEQQ5RyxRTVETRTqTRjkFPUNERWltKo6TS3FGGsbnVxB3f3xvMBoaDhpcdCzkWeisCKi4hNQkujSMrJyWQUKePgF8soq5KsH6+qaW-SMEcWlNLG1GcVFGXs7rRU0LjcGGwsRw6A4VCIJFIYQ2iWSWDBEKhuBmUAysFguSOXBOJXOiFUilEWCszVE8lEcmkqjkmkeiFeV1UL2pH3EikY0mUQNGIKR4Mh0LIVAARrMGId8sdimdQGVVDosKYTNVtI0TI56YyEHZGGSLKJVNJjZpLKptIo+WNBSiRbD4VtEcjhVhxZLIDiZXi5aUxNTpFg5OrlJTtJyarqTKoDa9WYoudolRJhsCPK6ocQyHD4gidpmIFhfPgDnl2L7Tv6EKJA8HQ19OpHRLqAYosDpLc0Y45NPUTDaBakONFwWBeCQAKpCqE+PyefBBUKrSIxPPOnbD0eYbLeitFKuEmsRrpqEx1TSqdTScR96PUlX0pXaK30iqJwceLdjidQaf20gphmOZwUWZYV3WddthSb8dzLXEDwJBUxBPYNVHPAEr0pW9FFbS0Oy+Xp+hsSwBxGW0PToSBSCESh9ndZBshoAAKD5GAASlICiJSoiA9wKSskOEMRaXbSQ6TPE1k0pXV1DJSRxCvH5jXDUQXBGfAOAgOBBDGBD8XlYSEAAWnEXVjKuTQrOsmzrIqT9sDwQhs30v0jw6XUXlUDtGGvPsQyvByFx4VzD2QvVTENI1axsUQI05TzamDTlk3UZpzWkILCxcn1EMMxVKSwDo6WpWMeVpVong6INNAUOLfLUDpfKC2Dx2zf9hVCoSyg0apgxJOpY1vOQrDMtoEFirATUYRhvh0OrZqCyjsggLr8rEEk3msWpFCG2rRujSQis0XyLHpF97FqoLYFiVJUjgeBcoM6s7B5KaPgqv5Zq1aNKhNGlOWaToMqCoDZjWl7uXbS1uUtL7akq4wOjJH4TUtTlMMBdSgA */
  id: 'file',
  context: ({ input }) => ({
    ...input,
    uploadId: '',
    error: '',
    uploadRef: undefined,
    processingRef: undefined,
  }),
  initial: 'pending',
  states: {
    pending: {
      on: {
        start: {
          target: 'init',
        },
      },
    },
    init: {
      invoke: {
        id: '@s3.multipart.create',
        src: 'create',
        input: ({ context }) => ({
          metadata: {
            mimeType: context.mediaFile.file.type,
            subscriptionId: context.user.subscriptionId,
            storagePlanId: context.user.storagePlanId,
            uploadedById: context.user.id,
            rootId: context.user.rootId,
            category: toCategory(context.mediaFile.file),
          },
          key: context.mediaFile.key,
          bucket: context.user.bucket,
        }),
        onDone: {
          target: 'uploading',
          actions: 'SAVE_UPLOAD_ID',
        },
        onError: {
          target: 'error',
          actions: 'SAVE_ERROR',
        },
      },
    },
    uploading: {
      entry: [
        'CHANGE_STATUS_TO_UPLOADING',
        'START_UPLOAD_SERVICE',
        'SEND_PARENT_UPLOAD_STARTED',
      ],
      on: {
        '@multipart.upload.progress': {
          actions: ['UPDATE_UPLOAD_PROGRESS', 'SEND_PARENT_UPLOAD_PROGRESS'],
        },
        abort: {
          actions: ['ABORT_UPLOAD'],
        },
        '@multipart.upload.aborted': {
          target: 'aborted',
          actions: 'CHANGE_STATUS_TO_ABORTED',
        },
        '@multipart.upload.done': {
          target: 'completingUpload',
        },
      },
    },
    completingUpload: {
      invoke: {
        id: '@s3.multipart.complete',
        src: 'complete',
        input: ({ context, event }) => {
          assertEvent(event, '@multipart.upload.done')
          return {
            parts: event.parts,
            key: context.mediaFile.key,
            uploadId: context.uploadId,
          }
        },
        onDone: {
          target: 'success',
          actions: [
            'UPDATE_MEDIAFILE_UPLOAD',
            'CHANGE_STATUS_TO_DONE',
            'SEND_PARENT_UPLOAD_DONE',
            'NOTIFY_QUOTA',
          ],
        },
        onError: {
          target: 'error',
          actions: 'SAVE_ERROR',
        },
      },
    },

    aborted: {
      after: {
        700: {
          target: 'pending',
        },
      },
      entry: 'SEND_PARENT_UPLOAD_ABORTED',
    },
    success: {
      type: 'final', // This region is done
      output: ({ context }) => ({
        mediaFile: context.mediaFile,
        uploadId: context.uploadId,
      }),
    },
    error: {
      type: 'final',
      // entry: 'CONSOLE_LOG',
    },
  },
})

export { fileMachine }
