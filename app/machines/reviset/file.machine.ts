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
import { checkQuota } from '../quota/quota.actors'
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
      mediaFile: ({ context, event }) => {
        return {
          ...context.mediaFile,
          uploadId: (event as unknown as DoneActorEvent<{ uploadId: string }>)
            .output.uploadId,
        }
      },
    }),
    // Saves the error message to the context. Actors throw `Error`s, and the
    // manager's `upload.failed` schema wants the text, not the object.
    assignError: assign({
      error: ({ event }) => {
        const error = (event as unknown as ErrorActorEvent<unknown>).error
        return error instanceof Error ? error.message : String(error)
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
    // Tells the manager this file ended in `error`, so it frees the slot and
    // shows the reason. Without it the file held its slot for good.
    sendUploadFailedToParent: sendTo(
      ({ context }) => context.manager!,
      ({ context }) => ({
        type: 'upload.failed',
        mediaFile: { ...context.mediaFile, status: 'failed' as MediaFileStatus },
        error: context.error || 'Upload failed',
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
    // Returns a file to the queue after it was paused before ever starting.
    markAsPending: assign({
      mediaFile: ({ context }) => ({
        ...context.mediaFile,
        status: 'pending' as MediaFileStatus,
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
  /** @xstate-layout N4IgpgJg5mDOIC5QDMCWAbMBVADug9gIYQB0OYAdhKhVAMSwAuhATowNoAMAuoqDvlipGqfBT4gAHogCMADgBsJAEycZAZjnqZAFh0BWfZ3UAaEAE9ZOuQE4S+hcpvPltmaoUBfT2bSZcBMRklNS0DMxs7DK8SCACQiJiEtIIMgpKqhpaugZGphayaQDsJEU6CurOCnqcNgr63r4Y2HhEpORUNPQ4hACusGBcMfyCwqLisSnyGWqa2nqGxmaWqeqVpcrqRek7yg7qjSB+LYHtIV0ACn0DEHQscL0AtoM8EvFjSZOy2yqz2Qt5ZayZQyEqGORFCEyGxaGx6Q7HAJtEgAYwAFmAUQBrLoARV6+GYdAgYjAJBoADd8FiyejMVj8YTCEM3qNEhNQCkipsVDpnEUipoijZNvogakZPoZPZBcYiroNJxjAjmkignTsXiCUSwCwWPgWGR0IRGMgDY9URjsYzmCzYu92clENz1Lz+YKISL1GKCgg5NLOAZdDZKvobJx9OovD4jqrWur7iaumrbiSKGTKdTaYnGGAALK9dAiHpsFN2kYJcZO1Y6V02YXQ5SQmRpGzi8pKUH1hTy-SuPkHGOI+OkFE55Mjui6-WGvAms0sC1jsAm-OF4usRhl172tlVr41usNkXN1vi3T6HQkCOcOR3hRyPatlX+EckXojrokQgokQUsB0AAAo866oCWjDvm+OD6lA9ywLA5ZxHunycrIIrKCQ6g6L2jY2PoWhyOe0L6CQcg6MoejQmkTbpC+JzIh+pxfj+f4AcBoHgZBpwkGmLzDEhlYoVIiDKBRcgyjCticKorgCuergYWRaSKNsUpGDodEplxbTMb+qD-nQhAAEYGhwO4Vh8HLCQgqhKte7gaJsjjyMo56cIKJA9mUjh6Ep5SaW+jE6bQ356QZ7FFmBm7aUExmmZAiEOvuqE2WJEl3uGMkQkUREKJwnkCoGt63vWawBdxQXELprFASBkWcZVpDTgaiXIVZKSiZo6VSVlcm+jIxjiVKHgaDoLYtoOTSvhVn4hSx+kAT0-R8aygntSJSr5WoILqE5IKPuKeHSsN1hOHIEZ9kU5UMbNUChTVcFPCtu5rdW0L1r8j4KJKA0Cpo4qPnYWFFHkw0KOGcjXUEjXVQttUcdFjVkNcCXmQJllvSeGzYd9RVkfh4oPvlrgaOk8rWEGUOkDDc1hWxdUbmwMWkI9zwQK1r0Ho2GGCsDrjuT2jjipG0ogpeai1tycLRlN9HQ7dyPLbcrPPRZjpc2UJHKWsDgQuRQv9ZsdjuWoRiXthkqTbG003UxIVLTchkmZEaNJUJUwVBh30+dUgp8q5-WSiRTaA1KCpwlTzNfg7kDw-ViNvnFbCo-xbvralXX6MKGXSdJ2XilsV6ezYLZFMYUZYQ0Q5xtxKL4I8eBgCItApsSpLkhQVI0qi9eN7mBbx6WI4cxjB59uKILyKRcgOC2j63qJkPVzb6q95gzdQK3zWzsaprmj3Dfr2ug9bsPrttdWBsrNMroaPh99jY+VvDjNEBJrQNqEG36Yd13ZIfm-XMn8R7qxSo4DCkZ-RNl0ApMoE8NAlEqO4L651HAVEjgA9+UBP5Tj1AaI08596YKAdqZk59OZgNEvYTQ7hyawJ0BPNQ4lRK1GcCKGB5FvAxgoPgCAcAJAvzaKtUeKUAC0ChxSiJImwmRsjISRw6KEKAwjQHWXIuebCJRQQgyMKJLOYZlAKPOLQK4SsVHJTUeofK1hby2BFAYL0Ej+pbGscKPC6Q+Rh0McvOWo4rQ4g-qQ8x7tEC1msedDK9iDFRiItoTyUZajiybN42WWllxYJTME9OcISgwjqFY4w7k8I+mvrWcSAo9iqDKJoAcGDbpZLelnXJ6QQxYRnpweo+QVjaDsBUaS4YBSLA8XUu2d15r-gaVzZwroowkxDIKHRAdr5OE7B0vKZcckGBSdbXxUd7YowgJMlK1FpEtLWNYIwnT5KPhIHoXamt54OEjnXQ+TcJynCOdZPY7kSAl10J6ZsTYunAjDL8qUAyQQdKXqkwKOBAFaiZJ8lI2gtGBklMoPKvs+orEniUAw5FDDyHkDCGWOytJJ1zIcl6IivlGFyS2awwpAWCjciCew-pIyXXqGNDSPitKwF6CiFEcB4DUtUSkGeiltjgwqaJEEOVfQgmsGCu83J5TaKwpHbeSLED+nCbeCo+NazqMVbnUokqZ50s2PCLhQA */
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
        // A file can be paused before it ever gets a slot. `pause` used to be
        // handled only inside `uploading.active`, so the event was dropped
        // here and the file kept its `pending` status — which is exactly what
        // the manager fills free slots from, so it started anyway.
        pause: {
          target: 'pendingPaused',
          actions: ['markAsPaused', 'sendUploadPausedToParent'],
        },
      },
    },
    // Paused while still queued. Status is `paused`, not `pending`, so
    // `uploadPendingFiles` passes it over when a slot frees up; resuming puts
    // it back in the queue rather than starting it out of turn.
    pendingPaused: {
      on: {
        resume: {
          target: 'pending',
          actions: ['markAsPending', 'sendUploadResumedToParent'],
        },
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
          // Sets the S3 object's actual Content-Type header (what browsers/CDNs
          // respect on download). metadata.mimeType below only sets x-amz-meta-*.
          // file.type is already corrected by normalizeFile in useUpload.add.
          contentType: context.mediaFile.file.type,
          metadata: {
            mimeType: context.mediaFile.file.type,
            subscriptionId: context.user.subscriptionId,
            storagePlanId: context.user.storagePlanId,
            category: toCategory(context.mediaFile.file),
            rootId: context.user.rootId,
            ownerId: context.user.id,
            ownerEmail: context.user.email,
            uploadedAt: new Date().toISOString(), // This is the date the file was uploaded to S3.
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
          // All event in this state are forwarded to the multipart actor or send back to the parent manager. we only leave this state if we receive a `@multipart.upload.done / aborted / error` events from the multipart actor.
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
            // Forward an abort event from the parent to the multipart actor.
            abort: {
              actions: [
                sendTo(({ context }) => context.worker!, {
                  type: '@multipart.upload.abort',
                }),
                log('Aborting upload...'),
              ],
            },
            // Incoming event from the multipart actor after being aborted, move to the aborted state
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
            // Forward pause events from the parent to the multipart actor
            pause: {
              actions: [
                sendTo(({ context }) => context.worker!, {
                  type: '@multipart.upload.pause',
                }),
                log('Upload paused.'),
              ],
            },
            // Forward resume event from the parent to the multipart actor.
            resume: {
              actions: [
                sendTo(({ context }) => context.worker!, {
                  type: '@multipart.upload.resume',
                }),
                log('Upload resumed.'),
              ],
            },
            // The multipart actor sends this event when it has successfully paused.
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
        // Quota is not charged here: the bytes are in S3 but the Item is not
        // yet written. The server charges it in the transaction that creates
        // the row (`createUploadedItem`).
        onDone: {
          target: 'success',
          actions: [
            'markAsDone',
            'sendUploadDoneToParent',
            log('Multipart upload completed.'),
          ],
        },
        onError: {
          target: 'error',
          actions: ['assignError', log('Failed to complete multipart upload.')],
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
      entry: 'sendUploadFailedToParent',
      description:
        'The quota check, creating the multipart upload or completing it failed (e.g. folder access was revoked). Tells the manager, which frees the slot and marks the file failed with the reason.',
    },
  },
})
