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
        return { uploadRef: actor }
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
      ({ system }) => system.get('quotaService'),
      ({ context }) => ({
        type: '@quota.update',
        action: 'items-uploaded',
        dataSize: context.mediaFile.file.size,
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
      enqueue.sendTo(context.uploadRef!, {
        type: '@multipart.upload.abort',
      })
    }),

    ABORT_PROCESSING: enqueueActions(({ context, enqueue }) => {
      enqueue.sendTo(context.processingRef!, {
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
  /** @xstate-layout N4IgpgJg5mDOIC5QDMCWAbMBiCB7AdmAHSwAuAhqcWpgNoAMAuoqAA66yqmoEsgAeiAIwB2egA4iAVnoixANilyATMoAsAZgA0IAJ7DlAX0M6axAK6t0uchCKsw+CKnxQsZcgCdSDZkhDsnNy8-oIIyvRCRPQAnPLyyjLyGjFSQmrKOvoI4uIiROIRkTFq4hpS6vLGphgWVjZ2Llw4BMQuAG64ANbEAAKwGkQAtubo3KxepEQAxp5glGC+fIFcPPh8YfKxRBkpckLpIuJSalmIx8rSGkIayoVqQvJqitUgZkSW1rZETaRYYJ5PLhPPZ0JRkMChkR+oMRmNUBNvDM5gslv4VsF1qFEFsYjtlHsRAc1EcTmcEDcjtJ6JohKonvIhOIYq93p8Gh96rYXG5enDxpNOV87KwgVA5rBYGi2BxViFQGE8lIiEIYjFjpFxDTmTFySJlFFcvRNTTEjcqiY3rUhRz2dzXFhyAAjYE+JjLWWYjaIGLXHZEkTyY5ScQ3GnkhL5ZSMx5KTSBjQaVnWu12VM8rB80YCpGpojO12QaUBT1rb0UpnyaKqqRKOIHNJCcnHQ2M+i167PaNGS1srlp-sZrPwxFTPN4QjFjFl7EV8RV4q1kT1oSN8mpKskmKByJCY2U5OYG3faa4IZWMDcVwAVX7LUIP3wnR60IGw2zCMFp-PmCoU9L8oCMIWr0EQKR5Lkap5HSmR6D6shEHESrRvOBq3IedTCjMZ4XleUC3sK-yAsCoLgpCr6wh+o7YT+l6LO66IAViCrAcaYHqkcOrQao5J0ho+SqoURJ0u2FTiBhx4ihKqBQPgPLXp46D3m0T7dH0b6inAMn4B8in-kEM4seEGjMtIDxqmoxoxKapxwQg8glEQIhSL6DlauIpQSXmmmcLJ8mKcpj7Pupgw+dpunoLQQh+DKBmAWEBKmScqolFZNm8caahEHc6QObI0aeb2Kb9vY0l+TeAUTipwUUaVWmyRFtDKDFJZxcxQHGUl5mpbE6V2TEdJEPEaqBsuy7yIGXklWF5X4QFAJAiCVhkZ4UIwnVvk6eYekMbFcrtQlJl4slFlpRktnZHuqQFDEyj1hoJK3OJRVHnm0zkKwmIZlVQVqdCqBDOQMAzB9X2uPp+3lp2eIOSSga7PxUgRk8KpBvQjJqJjJRSBaNSvSV72fWsGYLSRy2kBCq3-YDwOE2DUAQ16s7Q0NJRyE8BKI3qhTZeoGQcYjdJTVhpCeOQ+CwLMqBOt9rS-S+vTkOYzi4EQovi5LnjSzyjOGR1iXHd1lm9ed5KY5ciREmqiZpDj6TCxy6sS1LMsOqTS1ghT5GK8rPBq2Lzta67DO7a1kOzgbZkpcb1mm3ZygiIMFREpZ-F3dcUgO98sDmEMgNawAXrLD4dH9vRUPwUw53nXioEX4Oh9O8WICzsPswjzlm3c0QduoIaJw9SYvZhHLV-ndck8RHsrWtFdV7n4-1yHLVNwdLfpDDbPw5znd2ScVYHI8vqRBjWdSbg0xwJwrgAIK+7ggWlwrSsq6VF9XzrjdMVDG+s3DHOJl3pdTUYF+KdgJCSRIQ88Yj2+KKd+koeR3xVkRRapEvZUx9q-eBl9EENxXt-Zmv827b0AUjfqbE7iyHVBoegiQcbPRgZJfMLpvCQCwPwDwVB8zICoJ4AAFGIegABKLAfYsIFjYRAXWzcKTXEkJWI4ic+7qnIdkGQkgTguXnMuESt1jCWnwLgCAcA+BmA9G1csABaVU648TtmSEGDIRocbQKtPjYUFjw5GTurxec2UBqFHiI8BxIgz72EcM4VwXimZGTkOSNIlwXJpAuPOWhzxwm-BiXrBK24hqBkUM5LYBo1C6jsvOLKmhrhyH4lBSI4T0zRMYpY2cHkFxMgKgSE4iYmzlJJIhTQuRRDoy1CccJ35cLyX7Nk2R6QKg7GeC5ByuVaxlOyL6QYsRaEJE0E4qQbjxEchmnJCq6AZlr3CLIKIlkgl7gkBkdQ64mQ3QOAkCQ7yJDjNBsTJpe1Yn62coMfUTjhLlDyPICMPNUgVKePGbG4Snaa21r8sO-yErtlArEVZHkE6J0eOSO6khFCHAmnbVcGhcbuNgXYMetcl7nPLAnOIiEgwOX4iINQ+yCRm32SqcaBwtQJ1oZnYezCcEf1vvfBlEd2Y7GssNdUyROXrkSDsds9DayKAqOEyRVAIDSqMnMy4mNFBxAGoslyZs1TSAJOqTly4DRYvCTnaYuD4DNO8R1QeVYEiJnRo8Tljy7K3EGO5G5EQyg0g5eE92BqAW8uBR5UF-cIV2UPsqCoyQ7gjXiCGAxhggA */
  id: 'file',
  context: ({ input }) => ({
    ...input,
    uploadId: '',
    error: '',
    uploadRef: undefined,
    processingRef: undefined,
  }),
  initial: 'upload',
  states: {
    // Upload Region - Handles S3 multipart upload
    upload: {
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
              actions: [
                'UPDATE_UPLOAD_PROGRESS',
                'SEND_PARENT_UPLOAD_PROGRESS',
              ],
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
              target: 'presigningUrl',
              actions: ['UPDATE_MEDIAFILE_UPLOAD', 'NOTIFY_QUOTA'],
            },
            onError: {
              target: 'error',
              actions: 'SAVE_ERROR',
            },
          },
        },
        presigningUrl: {
          invoke: {
            id: '@s3.presign.url',
            src: 'presignUrl',
            input: ({ context }) => ({
              bucket: context.user.bucket,
              key: context.mediaFile.key,
            }),
            onDone: [
              {
                guard: 'isImageFile',
                target: 'captioning',
                actions: 'SAVE_PRESIGNED_URL',
              },
              {
                guard: 'isAudioFile',
                target: 'processingAudio',
                actions: 'SAVE_PRESIGNED_URL',
              },
              {
                guard: 'isVideoFile',
                target: 'processingAudio',
                actions: 'SAVE_PRESIGNED_URL',
              },
            ],
            onError: {
              target: 'error',
              actions: 'SAVE_ERROR',
            },
          },
        },
        captioning: {
          invoke: {
            id: '@image.captioning',
            src: 'imageCaption',
            // src: 'captionImage',
            input: ({ context }) => ({
              url: context.presignedUrl!,
            }),
            onDone: {
              target: 'success',
              actions: ['SAVE_CAPTION', 'CONSOLE_LOG'],
            },
            onError: {
              target: 'success',
              actions: ['SAVE_CAPTION_ERROR', 'CONSOLE_LOG'],
            },
          },
        },
        transcribing: {
          invoke: {
            id: '@audio.transcribing',
            src: 'transcribe',
            input: ({ context }) => ({
              url: context.presignedUrl!,
            }),
            onDone: {
              target: 'summarizing',
              actions: ['SAVE_TRANSCRIPTION', 'CONSOLE_LOG'],
            },
            onError: {
              target: 'success',
              actions: ['SAVE_TRANSCRIPTION_ERROR', 'CONSOLE_LOG'],
            },
          },
        },
        summarizing: {
          invoke: {
            id: '@text.summarizing',
            src: 'summarize',
            input: ({ context }) => ({
              content: context.mediaFile.caption!,
            }),
            onDone: {
              target: 'success',
              actions: ['SAVE_SUMMARY', 'CONSOLE_LOG'],
            },
            onError: {
              target: 'success',
              actions: ['SAVE_CAPTION_ERROR', 'CONSOLE_LOG'],
            },
          },
        },

        processingAudio: {
          invoke: {
            id: '@audio.processing',
            src: 'processAudio',
            input: ({ context }) => ({
              url: context.presignedUrl!,
            }),
            onDone: {
              target: 'success',
              actions: ['SAVE_AUDIO_PROCESSING', 'CONSOLE_LOG'],
            },
            onError: {
              target: 'success',
              actions: ['SAVE_CAPTION_ERROR', 'CONSOLE_LOG'],
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
        },
        error: {
          type: 'final',
          entry: 'CONSOLE_LOG',
        },
      },
    },

    // Processing Region - Handles AI image analysis
    // processing: {
    //   initial: 'idle',
    //   states: {
    //     idle: {
    //       on: {
    //         start: {
    //           guard: 'isImageFile',
    //           target: 'processing',
    //         },
    //       },
    //     },
    //     processing: {
    //       entry: 'START_PROCESSING_SERVICE',
    //       invoke: {
    //         id: '@image.processing',
    //         src: 'processImage',
    //         input: ({ context }) => ({
    //           file: context.mediaFile.file,
    //         }),
    //         onDone: {
    //           target: 'completed',
    //           actions: 'SAVE_PROCESSING_RESULTS',
    //         },
    //         onError: {
    //           target: 'failed',
    //           actions: 'SAVE_PROCESSING_ERROR',
    //         },
    //       },
    //       on: {
    //         'PROCESSING.ABORT': {
    //           target: 'aborted',
    //         },
    //       },
    //     },
    //     completed: {
    //       type: 'final', // This region is done
    //     },
    //     failed: {
    //       type: 'final',
    //     },
    //     aborted: {
    //       type: 'final',
    //     },
    //   },
    // },
  },

  // When both regions are done, the entire machine is done
  onDone: {
    actions: [
      'SEND_PARENT_UPLOAD_DONE',
      ({ context }) => {
        // File processing completed
      },
    ],
  },
})

export { fileMachine }
