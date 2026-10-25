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
import { formatSize } from '@/utils/formaters'

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

    // Keeps the quota check's answer. Must be `assign`: a plain action's return
    // value is discarded, which left this unset and the guard unable to pass.
    assignQuotaCheckResult: assign(
      (_, params: { itemId: string; result: 'allowed' | 'denied' }) => ({
        quotaCheckResult: params,
      })
    ),
    // The reason a denied file shows in the upload panel.
    assignQuotaDenied: assign({
      error: ({ context }) =>
        `Not enough storage: this file needs ${formatSize('byte', 'unit', context.mediaFile.file.size)}.`,
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
    // Whether the quota check allowed the file. Reads the done event, not
    // context: a transition's guard runs before its actions assign anything.
    isQuotaCheckPassed: ({ event }) =>
      (event as unknown as DoneActorEvent<{ result: 'allowed' | 'denied' }>)
        .output?.result === 'allowed',
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QDMCWAbMBVADug9gIYQB0OYAdhKhVAMSwAuhATowNoAMAuoqDvlipGqfBT4gAHogCMANjkkATJ1UAWAMxq5GzgE45nJQBoQAT0RyZekgA559pQHYlMtdbUBfT6bSZcBMRklNS0DMxs7DK8SCACQiJiEtII8ooq6lo6+oYm5ohKerYkqqVGnGp6Bt6+GNh4RKTkVDT0OIQArrBgXDH8gsKi4rEpMk7ppZraugZGphYI2jZ6kwYyMjN6NSB+9YFNIa0ACp3dEHQscB0Atj08EvGDSSOy48qTWTO584haTiROUquPRqFy2ThOba7AKNEgAYwAFmA4QBrVoARQ6+GYdAgYjAJBoADd8CiCYjkSjMdjCL0HgNEsNQCkXBoSGMAKwQzQaOROKp6H6LQokAx8tJODnaIwcqF1GFBCmojFYnF4igE4mk8lI1HU5hRPpxBlDZKIVnsyXcjS8-lVIX2Ei6VR-NS2G22PQaOX+BqK3Vo2j6wh0MAsFj4FhkdCERjISPXeEB4N02KPRlmhAuIUyVSKSW2bTu9a2OSynw7eV+0hwy6x1oK87qzUUElk+F1xhgACyHXQInabEbqf6CVNL1SbpkJSclT0KjUHMBs6FS84dk4hc0TicGg5Sg0th9e1htbA9dojdD4cj0dj8ZYibPsZ7fYHrEYw-uaZNz2ZsinGc5wXNcV3yRYOWnQxCzkRcPVLEFj0bEgOmrVoSEIOERCJMA6AAAWuN9UEHRgUOrMgIygS5YFgEdjTHP8pF+WximcSolCsLJbA4oUlGcf4lA5LdATkPQnFLOQkPI1D9nQzDsNwgiiJIsj9hIZs6PTcd-yzCoSDUJRKkLG15A0DZeNBNkhK0bQOS5DjEIraFpLQ2gMKw1AcLoQgACNIw4b9RyeJkmMWMtRTnWDIMlGRSw5XiZDskohK5cZxg5MSvCcqs1Jkxo5I8rylP7YiP1U2FfP8yBNN-EKWT0gyjJ5UzzPAg8NBsFitEPT1YqcDYpNy1yoHchT8MIkqVLyoIwwjFgaoYurzQawyimanRWoWPixhIOR3XcGQ+PEgzBthabQhG+TPNw9oujuI0tMYlJbIiqoos5WKy14zgNCUOwhLdVRDo5Ply1qX0htktyrq86ibnu+lFszaZ2Q0WduLGGUfrUHM9FzXaAf3LRbA5Q9TqCc6CrG4r3zYcqglus4FuCzMOrZMs5EMzRZn0Wwc3GKDNzUNRylgsswcrCGzuG0brvG5SyvOkg4duCBmYzCcet2va9syw6frcHMrD+uyYKEkFJW9bKpYpmXGcgC4rludXtNC1xpwyCpPhyGReN+9drKM37S15cnSEptz7fOSrIkC+iWYnIoAVKMzOESlYxLkXiD3zdx+W5w6iit8GT1tqGRqj+XJsV8iY67NW48epbdLUfTVuMsyNo0b69A5fT9q0dRCg4sP4Xwa48DAERL2rXF8UJVttTHifMC7Xtq6HasXae2Q9xsBQON5KKdG0CzRNFBR7HT8ZN0ha3S5rcfJ+nqAr1m288HvBNl+f18N8-LejdaqZg2BlbWh8FCLhPlnNqe51zjD2r9Pc-IXDeArBQfAEA4ASGcvsRGCcdIAFoYELEIX3AUFDKFiSUKPZoF18Eax0gZVcqh9KlBcAbbIUpaGHFoCcO6EAGGu2eroJ0VpnC-TcJKJwLD1wKD5HuYWeNwQyFHkqQMUBgxCJ3osURaN7K7lcKCJcvErC7QoQZSCFRcySXvshZ8L9GzaObrmEmM4uRaDslUcYfNwIg2KLuGy2gdC-SyiXZCEcoDOORjjcCbhWGLmEnZRKacth2JcuXWWOFokTkXDYVaXo4HyE3IKWBO5dpCx3MfUmND0mQ3ypHU4kAck6XnH7HQEVYp8U4HZYOain6rwbNWFpoUDDs05vZKw3EDylK2ouAOANAZ7SUIWUeddmk-iRonXc4DJldJmdnNxgkYIKBWKJNwo9YAdDhHCOA8BNkENCvIQyu0YpWA2F6OyeQ5kgjsHnKx9hQRiVHu-FgIzRghKdGjPaGxdz9U2gUZw+YOLun6h1Ay8g0GeCAA */
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
      description:
        'Checks if the user has enough storage space for the file. If not, the upload is denied and the file fails with a reason.',
      invoke: {
        id: 'checkQuota',
        src: 'checkQuota',
        input: ({ context }) => ({
          userId: context.user.id,
          itemId: context.mediaFile.id,
          dataSize: BigInt(context.mediaFile.file.size),
        }),
        onDone: [
          {
            guard: 'isQuotaCheckPassed',
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
          {
            // Denied: fail before any bytes move. The server refuses the row
            // anyway; this saves the transfer and says why.
            target: 'error',
            actions: [
              {
                type: 'assignQuotaCheckResult',
                params: ({ event }) => ({
                  itemId: event.output.itemId,
                  result: event.output.result,
                }),
              },
              'assignQuotaDenied',
              log('Quota check denied.'),
            ],
          },
        ],
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
        'The quota check failed or denied the file, or creating or completing the multipart upload failed (e.g. folder access was revoked). Tells the manager, which frees the slot and marks the file failed with the reason.',
    },
  },
})
