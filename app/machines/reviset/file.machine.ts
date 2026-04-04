// file.machine.ts
import {
  assign,
  setup,
  assertEvent,
  fromPromise,
  log,
  type AnyActorRef,
  type DoneActorEvent,
  sendTo,
  type ErrorActorEvent,
} from 'xstate'
import type {
  MediaFileData,
  MediaFileStatus,
  MediaFileEvents,
  MediaFileInput,
} from '@/types/machine.types'
import {
  completeUpload,
  createUpload,
  uploadParts as multipartActor,
} from '../multipart/s3.mulipart.utils'
import { checkQuota, updateQuota } from '../quota/quota.actors'
import { toCategory } from '../../utils'

// ====================================================== //
// =================== Custom Actors ==================== //
// ====================================================== //
// Actors are separated to allow for a clearer machine definition
// and easier testing/mocking.

// ====================================================== //
// Machine                                                //
// ====================================================== //

export const fileMachine = setup({
  types: {
    input: {} as MediaFileInput,
    context: {} as MediaFileData & {
      quotaCheckResult?: { itemId: string; result: 'allowed' | 'denied' }
    },
    events: {} as MediaFileEvents,
    output: {} as {
      mediaFile: MediaFileData['mediaFile']
      uploadId: string
    },
  },
  // Machine-specific actions
  actions: {
    // Saves the upload ID from the create multipart upload actor
    assignUploadId: assign({
      uploadId: ({ event }) => {
        return (event as unknown as DoneActorEvent<{ uploadId: string }>).output
          .uploadId
      },
    }),
    // Saves the error message to the context
    assignError: assign({
      error: ({ event }) => {
        return (event as unknown as ErrorActorEvent<unknown, string>)
          .error as string
      },
    }),
    // Assigns the multipart actor reference to the context
    setWorker: assign({
      worker: ({ spawn, context }) =>
        spawn('multipart', {
          id: `${context.mediaFile.id}`,
          input: {
            file: context.mediaFile.file,
            key: context.mediaFile.key,
            uploadId: context.uploadId!,
          },
        }),
    }),

    assignQuotaCheckResult: (
      _,
      params: { itemId: string; result: 'allowed' | 'denied' }
    ) => ({
      quotaCheckResult: params.result,
    }),

    // Removes the multipart actor from the context
    removeWorker: assign({
      worker: undefined,
    }),
    // Sends a 'upload.started' event to the parent manager.
    sendUploadStartedToParent: sendTo(
      ({ context }) => context.manager!,
      ({ context }) => ({
        type: 'upload.started',
        mediaFileId: context.mediaFile.id,
      })
    ),
    // Sends a 'upload.done' event to the parent manager.
    sendUploadDoneToParent: sendTo(
      ({ context }) => context.manager!,
      ({ context }) => ({
        type: 'upload.done',
        mediaFile: context.mediaFile,
      })
    ),
    // Sends an 'upload.aborted' event to the parent manager.
    sendUploadAbortedToParent: sendTo(
      ({ context }) => context.manager!,
      ({ context }) => ({
        type: 'upload.aborted',
        mediaFile: context.mediaFile,
      })
    ),
    // Marks the file status as 'uploading'
    markAsUploading: assign({
      mediaFile: ({ context }) => ({
        ...context.mediaFile,
        status: 'uploading' as MediaFileStatus,
      }),
    }),
    // Marks the file status as 'done' and updates metadata
    markAsDone: assign(({ context, event }) => {
      // assertEvent(event, 'completed')
      return {
        mediaFile: {
          ...context.mediaFile,
          ...(
            event as unknown as DoneActorEvent<{
              etag: string
              versionId: string
            }>
          ).output,
          progress: {
            ...context.mediaFile.progress,
            percentage: 100,
          },
          status: 'done' as MediaFileStatus,
        },
      }
    }),
    // Marks the file status as 'aborted'
    markAsAborted: assign({
      mediaFile: ({ context }) => ({
        ...context.mediaFile,
        status: 'aborted' as MediaFileStatus,
      }),
    }),
    // Marks the file status as 'paused'
    markAsPaused: assign({
      mediaFile: ({ context }) => ({
        ...context.mediaFile,
        status: 'paused' as MediaFileStatus,
      }),
    }),
    // Sends an 'upload.paused' event to the parent manager.
    sendUploadPausedToParent: sendTo(
      ({ context }) => context.manager!,
      ({ context }) => ({
        type: 'upload.paused',
        mediaFile: context.mediaFile,
      })
    ),
    sendUploadResumedToParent: sendTo(
      ({ context }) => context.manager!,
      ({ context }) => ({
        type: 'upload.resumed',
        mediaFile: context.mediaFile,
      })
    ),
  },

  // Machine-specific actors
  actors: {
    // Invokes the multipart actor to handle the actual upload
    multipart: multipartActor,
    // Invokes the check quota service
    checkQuota,
    // Invokes the update quota service
    updateQuota,
    // Invokes the create multipart upload service
    createMultipartUpload: createUpload,
    // Invokes the complete multipart upload service
    completeMultipartUpload: completeUpload,
  },
  guards: {
    // Guard to check if the quota check passed
    isQuotaCheckPassed: ({ context }) => {
      return context.quotaCheckResult?.result === 'allowed'
    },
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QDMCWAbMBVADug9gIYQB0OYAdhKhVAMSwAuhATowNoAMAuoqDvlipGqfBT4gAHogCMANhkkATEoCscuaoAsSrTIAcAZjkAaEAE9EcgOycSATi3Wl+6zOtb9nGVoC+vszRMXAJiMkpqWgZmNnYZXiQQASERMQlpBHlFFXVNHT0jUwtELXtrEkNPOU45Qw8tBXtVf0CMbDwiUgBjAAswLoBrGigARQBXfGY6CDEwEhoAN3wBud7+gfHJwi4E-kFhUXFEjI0tByVDH1VDexlOXTNLBE9FQ1Uyw313OX1VfV+WiAgu1Qt0+oNhpspmAWCx8CwyOhCIxkPCALYkNaDKHbHgSZIHNLHKxyM72C5XG53B7FBBfCoaGxKGSGe6cDxyQHAkKdTEsMDI4Y84jTWbzChLFZ8gWMMAAWTG6BEOFYjGFEB2+P2qSOoAyMhcqhI+hUNSaSjcRi0jysKmUtn+ZRkqms1n0fgCQLa6ulgto6roMLhCLwyNRLAxXX5yPliuVqvVmsSBJ16VkhuNprk5stlRtCAuchIekqSgU5by+i53o6YTGtciUBIhC6IgWYDoAAE0XHUCq2CR66CyHCoPzYLAk3sUoc05l9KSSHJdH99PZ7JpVFv8yzVHZrPYvIYLvYbpxbtXgg3Bw3hs3W6h212e0q+6qb8OZhQwFOktrZ8SBYyLcJA1Ncp7HrUSg7lodQOJwWjvEonDGLcjiXiCvJDp0d4tm2HaEAARvCHB4sm-5EnqsiOEoyinoayHyAh0G0gaLgkLYWicH8dTeKSMgYT62HELhD5Pt2vb9owH68kRJGQL+KYAVRQEgWBNyGJBx47pcRpfDUBjeJcHjNJ63LXsJjb3vhz6Se+lkkEG8KKRRupSIgzL0upEFltprHAYYHHyKSNxrrBgkWbetDWY+HYqmMsA-mR06Em5+o0XRx6-Ix1Q6DudxFgonCcO6lT8eSEXDpZok2eOYxoklux-jOlHuZkp72MWC6XAufwIR4+aHmcqjOrcFywYep6VVhUVNnhsW2a+UkyWE8WJRqyXNalc4GNmDgbtoZRgbYqj5kYenfAaV2-B6rRXlVs0xeJL7xgODl1Q1G1NUprX6r1oEyN8iFlG6aj5j85SA0dbouiV9jTXWj1rZAdAfY1WotWlsgQ8oXEHtmB56ChOmOMWx40e6eOaAjpDVdFyMQHQcmxJtP1Y5kLrDdYy48eyninaxlx2Ncxi-ChChfDTK1WQzi2vdJDnM7KX0Y9tgGeYo3mab5LFPNcwvOM4JWIcyNhS10+BongYAiP6Dait+4qSqslvW7KCpLQmDYuZjc6qLrHkGvoS7WKyLp3KyiGGObruYLbUABk5IZIii6KYrHNuxp7bCJqzrlzsuO6uIFxuePYKFONcpl3ZhiMQH6owTFMX5zIsyxzPW9eyjiPtqypy60aHLhuq49T6PmzJOMoujWCNBpjbPUudw3OKBrC8KImGafL93Te4t9+eAQPHFZSPrpaJ4E-3MHLIGrBNTLoDpmehQ+AQHAEjmaCqupoBAC0RQngANAsVUBYDQFuCluQKgwwf7KTanlWkpwOKHmqM4c0CFbpenuryLEQxaA4jgb9RAdRaLyB6m6Y8F9AbWHzA0RQwFy5uFKC8bMnIzI1mHFGGUQoGxEPZo6Y0Nhy58TcCZcGyFQI2CggYEa2Zo4cJwYjUEsDyK+0As6SR3gRq6S3CoH4dCPAOGqBaW4JoGjvCXo9ea7Z+E7VPEaIezpKannoTBEayh-jsgUNzWodQrEqPpoQBKkA7EaPUMHbRt8tz+zLOPVisFyjLm5u8bi64ywxytnHXh381F9zaiuOw1RaiaKoSoGCPh9qV3PAVUGViu6Qj3mElSxkKhmi8FxMCBgJ4GnKDUWCBgmizxGtYKWStQl5N-ipQpS4ai6QuLocp-luZLmZCoQGC5-j-ClrAMYXQuhwHgJM+BGRfiBQtKHbiyEnAXFobSZkfxZnZmZK6YCodRmKNrqQJOzS2r6SEa4Z0kERrniLrPMmnwND3EcI6fw-ggA */
  id: 'fileUpload',
  initial: 'pending',
  context: ({ input }) => ({
    ...input,
    uploadId: '',
    error: '',
    skipQuotaCheck: input.skipQuotaCheck ?? false,
    mediaFile: {
      ...input.mediaFile,
      status: 'pending' as MediaFileStatus,
    },
    uploadRef: undefined,
  }),
  states: {
    // Pending state: waits for the upload manager to send 'start' before proceeding.
    // This ensures the concurrency limit in the upload manager is respected — files
    // do not begin quota checking or uploading until a slot is available.
    pending: {
      on: {
        start: [
          {
            // Batch/folder uploads pre-check quota for the whole batch upfront,
            // so individual files skip the per-file quota check.
            guard: ({ context }) => context.skipQuotaCheck === true,
            target: 'creatingUpload',
          },
          {
            target: 'checkingQuota',
          },
        ],
      },
    },
    // CheckingQuota state: checks if the user has enough storage space
    checkingQuota: {
      entry: log('Checking quota...'),
      invoke: {
        id: 'checkQuota',
        src: 'checkQuota',
        input: ({ context }) => ({
          userId: context.user.id,
          itemId: context.mediaFile.id,
          dataSize: BigInt(context.mediaFile.file.size),
        }),
        onDone: {
          // guard: 'isQuotaCheckPassed',
          target: 'creatingUpload',
          actions: [
            {
              type: 'assignQuotaCheckResult',
              params: ({ event }) => ({
                itemId: event.output.itemId,
                result: event.output.result,
              }),
            },
            log('Quota check passed. Creating upload...'),
          ],
        },
        onError: {
          target: 'error',
          actions: ['assignError', log('Quota check failed.')],
        },
      },
    },
    // CreatingUpload state: initiates a multipart upload on S3 to get an upload ID
    creatingUpload: {
      invoke: {
        id: 'createMultipartUpload',
        src: 'createMultipartUpload',
        input: ({ context }) => ({
          bucket: context.user.bucket,
          key: context.mediaFile.key,
          metadata: {
            mimeType: context.mediaFile.file.type,
            subscriptionId: context.user.subscriptionId,
            storagePlanId: context.user.storagePlanId,
            category: toCategory(context.mediaFile.file),
            rootId: context.user.rootId,
            ownerId: context.user.id,
            ownerEmail: context.user.email,
            uploadedAt: new Date().toISOString(), // This is the date the file was uploaded to S3.
            itemKey: context.mediaFile.key,
          },
        }),
        onDone: {
          target: 'uploading',
          actions: [
            'assignUploadId',
            'setWorker',
            log('Multipart upload created.'),
          ],
        },
        onError: {
          target: 'error',
          actions: ['assignError', log('Failed to create multipart upload.')],
        },
      },
    },
    // Uploading state: compound state — handles the active upload and a paused sub-state.
    // entry/exit fire only when truly entering/leaving uploading (not on pause↔active transitions).
    uploading: {
      initial: 'active',
      entry: [
        log(({ context, event }) => ({ context, event }), 'Starting upload...'),
        'markAsUploading',
        'sendUploadStartedToParent',
      ],
      exit: ['removeWorker'],
      states: {
        active: {
          on: {
            // Forward progress events from the multipart actor to the parent manager
            '@multipart.upload.progress': {
              actions: sendTo(
                ({ context }) => context.manager!,
                ({ context, event }) => ({
                  type: 'progress.change',
                  mediaFileId: context.mediaFile.id,
                  progress: event.progress,
                })
              ),
            },
            // When the multipart actor completes, move to the next state
            '@multipart.upload.done': {
              target: '#fileUpload.completingUpload',
              actions: log('Multipart upload done. Completing...'),
            },
            // Handle an abort event from the parent
            abort: {
              actions: [
                sendTo(({ context }) => context.worker!, {
                  type: '@multipart.upload.abort',
                }),
                log('Aborting upload...'),
              ],
            },
            // When the multipart actor has been aborted, move to the aborted state
            '@multipart.upload.aborted': {
              target: '#fileUpload.aborted',
              actions: ['markAsAborted', log('Upload aborted by user.')],
            },
            // After all retries are exhausted the multipart actor sends this event.
            // Treat it as an abort so the parent can free the concurrency slot and
            // start the next pending file.
            '@multipart.upload.error': {
              target: '#fileUpload.aborted',
              actions: [
                'markAsAborted',
                log(
                  ({ event }) => event,
                  'Upload failed after max retries — treating as aborted.'
                ),
              ],
            },
            // Pause the upload — no new chunks will start until resumed
            pause: {
              actions: [
                sendTo(({ context }) => context.worker!, {
                  type: '@multipart.upload.pause',
                }),
                log('Upload paused.'),
              ],
            },

            resume: {
              actions: [
                sendTo(({ context }) => context.worker!, {
                  type: '@multipart.upload.resume',
                }),
                log('Upload resumed.'),
              ],
            },
            // Resume the paused upload
            '@multipart.upload.paused': {
              actions: [
                'markAsPaused',
                'sendUploadPausedToParent',
                log('Upload is paused. Waiting for resume...'),
              ],
            },
            // The multipart actor sends this event when it has successfully resumed.
            '@multipart.upload.resumed': {
              actions: [
                'markAsUploading',
                'sendUploadResumedToParent',
                log('Multipart upload resumed.'),
              ],
            },
          },
        },
        paused: {
          // entry: ['sendUploadPausedToParent'],
          on: {
            // Resume — unblocks the worker pool so chunks continue
            resume: {
              target: 'active',
              actions: [
                'markAsUploading',
                sendTo(({ context }) => context.worker!, {
                  type: '@multipart.upload.resume',
                }),
                log('Upload resumed.'),
              ],
            },
            // Allow aborting while paused
            abort: {
              actions: [
                sendTo(({ context }) => context.worker!, {
                  type: '@multipart.upload.abort',
                }),
                log('Aborting paused upload...'),
              ],
            },
            '@multipart.upload.aborted': {
              target: '#fileUpload.aborted',
              actions: ['markAsAborted', log('Paused upload aborted.')],
            },
          },
        },
      },
    },
    // CompletingUpload state: finalizes the multipart upload on S3
    completingUpload: {
      entry: log('Completing multipart upload...'),
      invoke: {
        id: 'completeMultipartUpload',
        src: 'completeMultipartUpload',
        input: ({ context, event }) => {
          assertEvent(event, '@multipart.upload.done')
          return {
            key: context.mediaFile.key,
            uploadId: context.uploadId!,
            parts: event.parts,
          }
        },
        onDone: {
          target: 'updatingQuota',
          actions: ['markAsDone', log('Multipart upload completed.')],
        },
        onError: {
          target: 'error',
          actions: ['assignError', log('Failed to complete multipart upload.')],
        },
      },
    },
    // UpdatingQuota state: updates the user's storage quota in the database
    updatingQuota: {
      entry: log('Updating quota...'),
      invoke: {
        id: 'updateQuota',
        src: 'updateQuota',
        input: ({ context }) => ({
          userId: context.user.id,
          action: 'items-uploaded',
          dataSize: context.mediaFile.file.size,
        }),
        onDone: {
          target: 'success',
          actions: [
            'sendUploadDoneToParent',
            log('Quota updated successfully.'),
          ],
        },
        onError: {
          target: 'error',
          actions: [
            'assignError',
            log(({ event }) => event, 'Failed to update quota.'),
          ],
        },
      },
    },
    // Aborted state: when the upload is intentionally cancelled
    aborted: {
      type: 'final',
      entry: [
        'sendUploadAbortedToParent',
        log(({ context, event }) => ({ context, event }), 'Upload aborted.'),
      ],
      description: 'The upload has been aborted.',
    },
    // Success state: final state after a successful upload
    success: {
      type: 'final',
      description: 'The upload and quota update are complete.',
    },
    // Error state: final state after a failure
    error: {
      type: 'final',
      description: 'An error occurred during the upload process.',
    },
  },
})
