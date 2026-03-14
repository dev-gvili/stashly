import {
  abortUpload,
  completeUpload,
  createUpload,
  uploadParts,
} from '@/machines/multipart/s3.mulipart.utils'
import { assertEvent, assign, log, sendTo, setup } from 'xstate'
import type {
  MultipartContext,
  MultipartEvents,
  MultipartInput,
  MultipartOutput,
} from '@/types/machine.types'

export const multipart = setup({
  types: {
    input: {} as MultipartInput,
    output: {} as MultipartOutput,
    context: {} as MultipartContext,
    events: {} as MultipartEvents,
  },
  actions: {
    setUploadId: assign({
      uploadId: ({ event }) => {
        assertEvent(event, '@multipart.upload.create')
        return event.uploadId
      },
    }),
    updateProgress: assign({
      progress: ({ event }) => {
        assertEvent(event, '@multipart.upload.progress')
        return event.progress
      },
    }),
    setParts: assign({
      parts: ({ event }) => {
        assertEvent(event, '@multipart.upload.done')
        return event.parts
      },
    }),
    setError: assign({
      error: ({ event }) => {
        assertEvent(event, '@multipart.upload.error')
        return event.error
      },
    }),
  },
  actors: {
    createUpload,
    abortUpload,
    completeUpload,
    uploadParts,
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QFsCuAbALgSwA4EMAnTAOgGNCx9MwBiCAewDswTsmA3Bga1YAE0WPEVIUqNANoAGALqJQuBrGw5m8kAA9EAVgDMukgE4A7AEYAHACZjAFks2bANmPGANCACeic1IPnTplLahlKO+qa62gC+Ue6COATE5JTUdGCEhAyEJLjo1ABmWcgkAhgJIsniYNJySCCKyqpM6loIegYmFtZ2Ds5unogOhiSWlobaDtqWjpYRpjFxZcJJqLkM+BC0pUKJpKvo6xAkjCw16g0q2Gp1raaWEyT+-qaOUsbaxjOW7l4I9lIkbQ+GzGQy6Ua+WbRWIgeLLPZrDZbOG7Ej7Q4kdKZQhnOoXJotRB3B5PAKvd6fUY-RCORzmEi+czGSzmGzgyK6GwLWFLVHopHbcorRFHXCZKCUWCwXEKJSXa6gVrmOkkAKmYxWYJBcHaakIOmOEhONmOAK6ULqxzclEVfmbQXwtEikj4ABGWUwMvqcoJN28PhIdI1+jehjuLj1WqMtjGnzDkSB1t5tpFyOTwoOGxd7uIkC9+KuzT9CGJNkeFjJbw+Xz15kM9MM02Mug1YamUkMSZ2FTdHvozFY7C4vBKNqSveI+Z9hcJfykoRIIbr2iBrx1tccZbMVcs4MsHdNXaFpAnmFoWKyOTymEKhGKDtRp6njRnxf3C6X41XkN1AwQ8aNKQbCCIE9A7ZUj0dMgGGQXIwBofsWDYTgeH4MdRBguDJFkc5pwVTREHfQ1PxXZUfz1UZhkCFsXm0GYpCsCJINRaDYPQeC0gyS9cgKIpR3TDC2I4595SLRVCPnYjzWXb91z-c0AT0GZgMMcZZlCGIYSYBgIDgdR0Nwl98NaABaRw9TMhl52smzrI+ZiKjEVJDNE2c7D1WwATpGw7hZXdRgCByM0OFzfXEhB3ksR4nBZZVtDuQwbF-X4NUNcYHHsOj61BXQgpPHNMFC19wtMeKy0iEI6ReUrHGS7wAhGcwW1eUrTHrNk8vITD2JoIrjKJMrFy1KrTTouqS3eQNPmZNkwxMXxOrIfAmDIMB2IgPqxIIv57gMfRdACQwwkS1TdD1TcAXMJrlUbW7ImMTqTjATbZ1GPRF3CNrjpsU69ReLcLBsKwpFKhxcs0oA */
  id: 'multipart',
  description:
    'This machine orchestrates the multipart upload process to S3. It handles the creation of the multipart upload, the uploading of individual parts, and the final completion or abortion of the upload.',
  context: ({ input }) => ({
    ...input,
    error: '',
    parts: [],
    progress: {
      percentage: 0,
      speed: { unit: 'KB/s', value: 0 },
      timeLeft: { hours: 0, minutes: 0, seconds: 0 },
    },
    uploadId: '',
    output: {
      etag: '',
      version: '',
    },
  }),
  initial: 'create',
  states: {
    create: {
      invoke: {
        id: '@multipart.create',
        src: 'createUpload',
        input: ({ context }) => ({
          key: context.key,
        }),
        onDone: {
          target: 'upload',
          actions: { type: 'setUploadId' },
        },
        onError: {
          target: 'canceled',
          actions: 'setError',
        },
      },
      description:
        'Invokes a service to create a multipart upload, obtaining a unique uploadId from the S3 API. This uploadId is essential for subsequent upload parts and for completing or aborting the multipart upload.',
    },
    upload: {
      invoke: {
        id: '@multipart.upload',
        src: 'uploadParts',
        input: ({ context }) => ({
          file: context.file,
          key: context.key,
          uploadId: context.uploadId,
        }),
      },
      on: {
        '@multipart.upload.done': {
          target: 'complete',
          actions: { type: 'setParts' },
        },
        '@multipart.upload.error': {
          target: 'canceled',
          actions: { type: 'setError' },
        },
        '@multipart.upload.progress': {
          actions: { type: 'updateProgress' },
        },
        '@multipart.upload.abort': {
          actions: log(({ event, self }) => console.log({ event, self })),
        },
        '@multipart.upload.aborted': {
          target: 'abort',
        },
      },
      description:
        'In this state, the file is divided into multiple parts, each of which is pre-signed and uploaded. All successfully uploaded parts are collected into an array, which will be used in the `complete` state to finalize the multipart upload.',
    },
    abort: {
      invoke: {
        id: '@multipart.abort',
        src: 'abortUpload',
        input: ({ context }) => ({
          key: context.key,
          uploadId: context.uploadId,
        }),
        onDone: {
          target: 'canceled',
        },
        onError: {
          target: 'canceled',
          actions: 'setError',
        },
      },
      description:
        'This state is entered if the multipart upload process needs to be stopped prematurely, either due to an error or a user-initiated cancellation. It sends a request to S3 to abort the multipart upload, which cleans up any uploaded parts and prevents incomplete files from being stored. This ensures that no partial or corrupted data remains on S3.',
    },
    complete: {
      invoke: {
        id: '@multipart.complete',
        src: 'completeUpload',
        input: ({ context }) => ({
          key: context.key,
          parts: context.parts,
          uploadId: context.uploadId,
        }),
        onDone: {
          target: 'done',
        },
        onError: {
          target: 'canceled',
        },
      },
      description:
        'After all parts of the file have been successfully uploaded, this state finalizes the multipart upload. It sends a request to S3 with the `uploadId` and the list of all uploaded parts (including their ETags and part numbers). S3 then reassembles these parts into the complete file. This state is critical for ensuring data integrity and for making the uploaded file accessible.',
    },
    canceled: {
      type: 'final',
      entry: [
        sendTo(
          ({ system }) => system.get('queue-service'),
          ({ context }) => ({
            type: '@queue.upload.canceled',
            itemId: context.id,
          })
        ),
      ],
      description:
        'This state indicates that the multipart upload process has been canceled, either due to a failure or user action. This state is a final state',
    },
    done: {
      type: 'final',
      entry: [
        sendTo(
          ({ system }) => system.get('queue-service'),
          ({ context }) => ({
            type: '@queue.upload.completed',
            itemId: context.id,
          })
        ),
        sendTo(
          ({ system }) => system.get('quota-service'),
          ({ context }) => ({
            type: '@quota.update',
            dataSize: context.file.size,
          })
        ),
      ],
      description:
        'This state indicates that the multipart upload has been successfully completed and the file is now accessible in S3. This state is a final state',
    },
  },
})
