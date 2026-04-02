import { user } from '@/schemas/machine.schemas';
import {
  assign,
  setup,
  assertEvent,
  enqueueActions,
  log,
  type DoneActorEvent,
} from 'xstate'
import type {
  MediaFileData,
  MediaFileStatus,
  MediaFile,
  UploadProgress,
} from '@/types/machine.types'
import { toCategory, toMediaFile } from '@/utils/converters'
import {
  completeUpload,
  uploadParts,
  createUpload,
} from '@/machines/multipart/s3.mulipart.utils'
import type { User } from '@/services/auth.types'

/**
 * Upload Worker Machine - Handles individual file uploads
 *
 * This machine is spawned per file and manages:
 * - File upload initiation
 * - Progress tracking
 * - Multipart upload orchestration
 * - Quota updates on completion
 *
 * It integrates with the generic queue machine's worker interface.
 */

export interface UploadWorkerContext {
  mediaFile: MediaFile
  user: User
  uploadId: string
  error?: string
  uploadRef?: any
}

export type UploadWorkerEvents =
  | { type: 'process'; item: MediaFile, user: User}
  | { type: '@multipart.upload.progress'; progress: UploadProgress }
  | { type: '@multipart.upload.done'; parts: any[] }
  | { type: '@multipart.upload.aborted' }
  | { type: 'abort' }

const uploadWorkerMachine = setup({
  types: {
    context: {} as UploadWorkerContext,
    events: {} as UploadWorkerEvents,
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
    SAVE_UPLOAD_ID: assign({
      uploadId: ({ event }) => {
        return (event as unknown as DoneActorEvent<{ uploadId: string }>).output
          .uploadId
      },
    }),
    SAVE_ERROR: assign({
      error: ({ event }) => {
        return (event as any).error?.message || 'Unknown error'
      },
    }),
    CHANGE_STATUS_TO_UPLOADING: assign(({ context }) => ({
      mediaFile: {
        ...context.mediaFile,
        status: 'uploading' as MediaFileStatus,
      },
    })),
    CHANGE_STATUS_TO_DONE: assign(({ context }) => ({
      mediaFile: {
        ...context.mediaFile,
        status: 'done' as MediaFileStatus,
      },
    })),
    CHANGE_STATUS_TO_ABORTED: assign(({ context }) => ({
      mediaFile: {
        ...context.mediaFile,
        status: 'aborted' as MediaFileStatus,
      },
    })),
    START_UPLOAD_SERVICE: enqueueActions(({ context, enqueue }) => {
      enqueue.assign(({ spawn }) => {
        const actor = spawn('uploadParts', {
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
    NOTIFY_QUOTA: enqueueActions(({ context, enqueue }) => {
      enqueue.sendTo('quotaValidator', {
        type: '@quota.update',
        action: 'items-uploaded',
        dataSize: context.mediaFile.file.size,
      })
    }),
    ABORT_UPLOAD: enqueueActions(({ context, enqueue }) => {
      if (context.uploadRef) {
        enqueue.sendTo(context.uploadRef, {
          type: 'abort',
        })
      }
    }),
    CONSOLE_LOG: log(({ context, event }) => ({
      context,
      event,
    })),
  },
  actors: {
    createUpload,
    uploadParts,
    completeUpload,
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QFcAOAbA9gQwgdUwCcBrMQgOgEsJ0wBiVQzAYzlgG0AGAXUVFUyxKAF0qYAdnxAAPRAEYAbAvIAmFQFYligCwBOOSoMAaEAE9E6gOydyndft26Fa9QA4FcgL6eTaLLgISMnJmQjBsUXEoOggJMCpxADdMUnIAAVgAZnIAW2R0UVRsQmEQsIiwLl4kEAEhUQkpWQQFbRVybUtNdRVMzMNNBRNzBEz9cldLS1dDXUs+7U5db18MHHwiUgpQ8MjosiYKDAiAMyIc9Kzc-MLi0p2Kqqk6kTFJGubW9s7u3v65QbDCyudTkaZyTicMYKTKQzKWFYgPzrQJbcjI3CUKJ0NJ5AqUIoldFrXDkRiYKBhWAcHjPQSvRofRAOWyZVwAhS6FRLXSdIEIFS6UHuFwKdlipYKREYjZBCgyrHRXE3Al3Yn+CDkWLiSq0movBrvUDNAxyXQTTjaM2WZxLTiWFT87TqOS2dSZTkadltVzabTSkmytEK7HK-GE0oy8jYABGRGEkCe+vphqa8lmFqtc1tuntjrMiEyLvIulcug9uc5vJU-p8SMDqOCIeisfjSf4KbeaYQTm0JbkXUsejLLpB-O5NnhajN8L69m0mQDGsb20wOQwYD2MTiCWSqQy2TxtyJzDXG4T7dqncZxvkk1c5AU8whThtNuc-P6fer0yFmTk2iuB6S4opswSnuutBbgcRBkugpznJch4qhGIRnlBurVB29RdkyCByPej7PpKb5KPmIx+n2ULODCKhAX6UIgQEYEUK2JSQHQ0iwMIFTRicCaEAAFNYnAAJR0DKK7RnG7EQJeBq4be+FFq6f6QuozoaZk-LsuQHpKGWnDOOyXJSoi4iYBAcBSJJLF0jhN4yIgAC0QwFggzmgo43k+T5wF1rZcpUDQYD2QyRpOQgbT8m435AdRkKWLyRZMUG4HlHsYWpnhdHKCCHi5uKVgetoMWco+0JjH6QptMsAUNix6rrIqWWKZFkzmpYBhcnYT5Cq0n5OHpPSCm0CicBocypVJEHni1yYORFJqAXlGjTCCXX2lYToqJYEy8nMI6li6-mrMujVsQmECtY5y3uBMa2uBtEKDp+5VWv0diaYKjjTY1sDIMwrDUjdS2IIYmRUTWX5lnIOifm45DqJaBH2BOLq7X9QUwYQoPdhDUMLjWsPw+5mh7QB1iQ9onIeou3ieEAA */
  id: 'uploadWorker',
  context: {
    mediaFile: {} as MediaFile,
    user: {} as User,
    uploadId: '',
  },
  initial: 'idle',
  states: {
    idle: {
      on: {
        process: {
          target: 'creating',
          actions: assign({
            mediaFile: ({ event }) => event.item,
            user: ({ event }) => event.user,
          }),
        },
      },
    },
    creating: {
      invoke: {
        id: '@s3.multipart.create',
        src: 'createUpload',
        input: ({ context, event }) => {
          assertEvent(event, 'process')
          return {
            bucket: context.user.bucket,
            key: event.item.key,
            metadata: {
              contentType: event.item.file.type,
              category: toCategory(event.item.file),
              ownerId: context.user.id,
              subscriptionId: context.user.subscriptionId,
              storagePlanId: context.user.storagePlanId,
              driveId: context.user.driveId,
              rootId: context.user.rootId,
            },
          }
        },
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
      entry: ['CHANGE_STATUS_TO_UPLOADING', 'START_UPLOAD_SERVICE'],
      on: {
        '@multipart.upload.progress': {
          actions: 'UPDATE_PROGRESS',
        },
        '@multipart.upload.done': {
          target: 'completing',
        },
        '@multipart.upload.aborted': {
          target: 'aborted',
          actions: 'CHANGE_STATUS_TO_ABORTED',
        },
        abort: {
          actions: 'ABORT_UPLOAD',
        },
      },
    },
    completing: {
      invoke: {
        id: '@s3.multipart.complete',
        src: 'completeUpload',
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
    aborted: {
      after: {
        700: {
          target: 'idle',
        },
      },
    },
    success: {
      type: 'final',
      output: ({ context }) => ({
        mediaFile: context.mediaFile,
        uploadId: context.uploadId,
      }),
    },
    error: {
      type: 'final',
      entry: 'CONSOLE_LOG',
    },
  },
})

export { uploadWorkerMachine }
