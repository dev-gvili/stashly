import {
  assign,
  setup,
  assertEvent,
  enqueueActions,
  log,
  type ErrorActorEvent,
  type DoneActorEvent,
  sendTo,
} from 'xstate'
import type {
  MediaFileData,
  MediaFileStatus,
  MediaFileEvents,
  MediaFileInput,
  MediaFile,
} from '@/types/machine.types'
import { toCategory } from '@/utils/converters'
import {
  abortUpload,
  completeUpload,
  createUpload,
  uploadParts,
} from '@/machines/multipart/s3.mulipart.utils'

// ====================================================== //
// Machine                                                //
// ====================================================== //

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
  actions: {
    UPDATE_PROGRESS: assign(({ context, event }) => {
      assertEvent(event, '@multipart.upload.progress')
      return {
        mediaFile: {
          ...context.mediaFile,
          progress: event.progress,
        },
      }
    }),
    SEND_PARENT_PROGRESS_CHANGED: enqueueActions(
      ({ context, event, enqueue }) => {
        assertEvent(event, '@multipart.upload.progress')
        enqueue.sendParent({
          type: 'progress.change',
          mediaFileId: context.mediaFile.id,
          progress: event.progress,
        })
      }
    ),
    SEND_PARENT_UPLOAD_ABORTED: enqueueActions(({ context, enqueue }) => {
      enqueue.sendParent({
        type: 'upload.aborted',
        mediaFile: context.mediaFile,
      })
    }),
    NOTIFY_QUOTA: sendTo(
      ({ system }) => system.get('quotaService'),
      ({ context }) => ({
        type: '@quota.update',
        action: 'items-uploaded',
        dataSize: context.mediaFile.file.size,
      })
    ),
    // enqueue.sendParent({
    // 	type: 'upload.done',
    // 	mediaFile: context.mediaFile,
    // })
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
    // not in used, just an idea.
    notifyParent: enqueueActions(({ context, enqueue, event }) => {
      enqueue.sendParent({
        type: event.type,
        mediaFileId: context.mediaFile.id,
      })
    }),
    SEND_PARENT_REMOVE_UPLOAD: enqueueActions(({ context, enqueue }) => {
      enqueue.sendParent({
        type: 'upload.remove',
        id: context.mediaFile.id,
      })
    }),
    ABORT_UPLOAD: enqueueActions(({ context, enqueue }) => {
      enqueue.sendTo(context.uploadRef!, {
        type: '@multipart.upload.abort',
      })
    }),
    stopActor: enqueueActions(({ context, enqueue }) => {
      enqueue.stopChild(context.uploadRef!)
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
    SAVE_UPLOAD_ID: assign({
      uploadId: ({ event }) => {
        return (event as unknown as DoneActorEvent<{ uploadId: string }>).output
          .uploadId
      },
    }),
    // SAVE_UPLOAD_PARTS: assign({
    // 	parts: ({ event }) => {
    // 		return (
    // 			event as unknown as DoneActorEvent<{ parts: CompletedPart[] }>
    // 		).output.parts
    // 	},
    // }),
    SAVE_UPLOAD_URL: assign({
      mediaFile: ({ context, event }) => {
        return {
          ...context.mediaFile,
          url: (event as unknown as DoneActorEvent<{ url: string }>).output.url,
        }
      },
    }),
    UPDATE_MEDIAFILE: assign({
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
        let actor = spawn('upload', {
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
    CONSOLE_LOG: log(({ context, event }) => console.log({ context, event })),
  },
  actors: {
    create: createUpload,
    upload: uploadParts,
    abort: abortUpload,
    complete: completeUpload,
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QAoC2BDAxgCwJYDswBKAOgAcx8ICoBiWAF3QCcGBtABgF1FQyB7WLga5++XiAAeiAIwA2OSQBMSgKxzVATgAcmrUo4AWAOwAaEAE9ECgMwkbS43I7al24zJnbDAXx-m0LDxCUgJhWggxMBICADd+AGtogAFYO1QAVwAbETIWBhJMZjB0BjBOHiQQASERMQlpBFVjVRIZTRkbDo9NLrkzS0RDVTtjQzkbbVdjDh1jYz8AjBwCYhj8cLBmZn5mcizSgDNd1BJU9Ozc-MLi0vLuCRrhUXEqxubW9s7u9r6BqwQGkUNhkHHkck6hhsxj0ixAgRWIRIGTIWX46Go+DoyUyOVweVYyNR6Ig5B2UGKsFgFUegme9TeiG0NlaqgM420HGM2lUnnMAIcShI4zkSk0bghvVUIzhCOCaxRaIxNFo6AARrt2A8qk86q9QI1dMYSBMbDYOGKwYYlKL+YgDBx7MYVG4edaZhbZct5aRFSSVTjLvjrn6MSR1ZrIDSdXS9Q1ZDI2SReZpxRMZi67QhDBxFJoLc65PnPC0ZF6gqtfcTlVjaIG8QSCqHSZFCNG+LGXvGEJ4kym09CLSos2yZMnXO4OKptDJHDby4i1ph+KhUWARFiAKrViARKLreJJM5pEi4q6E5errLr+6VDu1LuMntOY3TmyGGcGXrDLNdVomX4xnUCFQV8fx4W9StChXNcNygbclV3LYdj2VEjhOY8Lgba5L1g29aQfBkDVkF9x3fT9ZnfVQRxkQxkw0Qx5C8TQWnfBcfXDDVWEgWhJEYO5w0OMpmGQD0iFoOUoIjbiIHbapOyIqRZDcOiFG0foZ26M1qMGBAZ3sBQPEca0WVTMDwPwfgIDgCRJJCAj6X1JSEAAWjkLM3PYqCKCoGgHLjJ9rSzDRWVnG0ITfaUvKRMIGH8x9iIQG07GhZ1aOtORJ0MYKczaTLvFnc0bV6aKFR3PyY0IpzDVnYUJSLXkPxsdzdMMQxNHoi1mShItmNUUrSFw684IQkl4sUxpaPaZNGNUDh5q8BQdIBdrtDqxicyUHMnGGAbOMjCBxuq2RGI61RZvmsF1I0X9ehIWY5scTR+g0HQ5D22AMkwTA4HgSrHO7AwVBIb9RU0D9HBLLMc0UN1EzGC0WNmMClgrJFkN2I7AaHEH3zBiGPBkf5rGhE0nC-C1zo4M0-D8IA */
  context: ({ input }) => ({
    ...input,
    uploadId: '',
    error: '',
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
          actions: ['UPDATE_PROGRESS', 'SEND_PARENT_PROGRESS_CHANGED'],
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
          actions: ['UPDATE_MEDIAFILE', 'NOTIFY_QUOTA'],
        },
        onError: {
          target: 'error',
          actions: 'SAVE_ERROR',
        },
      },
    },
    // creatingItem: {
    // 	invoke: {
    // 		id: 'db.create.item',
    // 		src: 'upload',
    // 		input: ({ context }) => ({
    // 			mediafile: {
    // 				...context.mediaFile,
    // 				ownerId: context.ownerId,
    // 			},
    // 		}),
    // 		onDone: {
    // 			target: 'success',
    // 			actions: 'CONSOLE_LOG',
    // 		},
    // 		onError: {
    // 			target: 'error',
    // 			actions: 'SAVE_ERROR',
    // 		},
    // 	},
    // },
    aborted: {
      after: {
        700: {
          target: 'pending',
        },
      },
      entry: 'SEND_PARENT_UPLOAD_ABORTED',
    },
    success: {
      entry: 'SEND_PARENT_UPLOAD_DONE',
      // type: 'final',
      output: ({ context }) => ({
        mediaFile: context.mediaFile,
        uploadId: context.uploadId,
      }),
    },
    error: {
      entry: 'CONSOLE_LOG',
      type: 'final',
    },
  },
})

export { fileMachine }
