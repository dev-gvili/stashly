import { createMachine, sendTo, setup } from 'xstate'
import type { FileUpload } from './types'
import type { S3MultipartUpload, UploadProgress } from './types'

interface MultipartContext {
  file: FileUpload
  uploadId: string | null
  parts: Array<{ partNumber: number; etag: string }>
  uploadedParts: number
  totalParts: number
  progress: UploadProgress
  s3Upload: S3MultipartUpload | null
}

type MultipartEvent =
  | { type: 'START_UPLOAD' }
  | { type: 'UPLOAD_PART'; partNumber: number; data: ArrayBuffer }
  | { type: 'COMPLETE_UPLOAD' }
  | { type: 'CANCEL_UPLOAD' }
  | { type: 'UPDATE_PROGRESS'; progress: Partial<UploadProgress> }

export const multipartMachine = setup({
  types: {
    context: {} as MultipartContext,
    events: {} as MultipartEvent,
    input: {} as { file: FileUpload },
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QFsCuAbALgSwA4EMAnTAWlV3QHt8IA6bCdMAYgGUAVAQQCV2B9AKoAFADIB5TgBEA2gAYAuolC5KsbDkoA7JSAAeiACwAmWrLPmL5gIwGANCACeiKwA4AnLVcGA7AGZfRla+BmY2AL4R9pqUEHA6aFh4RKTkVDQ6Kmoa2kh6iCQArLRuJaVlpS4AbPZOCCSVppZNZt6RIAk4BMRkFNR0DEwZqurYWjr6CJUesi5Wsr5WBQUuPi7edo6IRgYGnm6VwVVGLgXH4WH2HUndqX20AMaUyBRgmJBDWaM5oBMGRfMFKxGAreWQFYxuFzBGqIXyyEyVbwuWRuAxuAqQk6+NpXLopXo0B74TT3MBMCAfEZjXK-DxGBbeAqyYy+fbeSouGEIWa0XyVRHwjn+Jm+AoRCJAA */
  id: 'multipart-upload',
  context: ({ input }) => ({
    file: input.file,
    uploadId: null,
    parts: [],
    uploadedParts: 0,
    totalParts: Math.ceil(input.file.size / (5 * 1024 * 1024)),
    progress: {
      uploadedBytes: 0,
      totalBytes: input.file.size,
      percentage: 0,
      timeLeft: 0,
      speed: 0,
    },
    s3Upload: null,
  }),
  initial: 'idle',
  states: {
    idle: {
      on: {
        START_UPLOAD: {
          // Start upload logic, e.g., initialize S3 multipart upload
          target: 'uploading',
          actions: [
            // actions to start upload
            sendTo(
              ({ system }) => system.get('upload-queue'),
              ({ context }) => ({
                type: 'START_UPLOAD',
                fileId: context.file.id,
              })
            ),
          ],
        },
      },
    },
    uploading: {
      on: {
        UPLOAD_PART: {
          // Upload part logic, e.g., upload a single part to S3
          target: 'uploading',
          actions: [
            /* actions to upload part */
            sendTo(
              ({ system }) => system.get('upload-queue'),
              ({ context }) => ({
                type: 'UPLOAD_PART',
                fileId: context.file.id,
                partNumber: context.uploadedParts + 1,
                data: context.file.slice(
                  context.uploadedParts * (5 * 1024 * 1024),
                  (context.uploadedParts + 1) * (5 * 1024 * 1024)
                ),
              })
            ),
            sendTo(
              ({ system }) => system.get('upload-queue'),
              ({ context }) => ({
                type: 'UPDATE_PROGRESS',
                fileId: context.file.id,
                uploadedBytes: context.progress.uploadedBytes,
                totalBytes: context.progress.totalBytes,
              })
            ),
          ],
        },
        COMPLETE_UPLOAD: {
          // Complete upload logic, e.g., finalize S3 multipart upload
          target: 'completed',
          actions: [
            /* actions to complete upload */
          ],
        },
        CANCEL_UPLOAD: {
          // Cancel upload logic, e.g., abort S3 multipart upload
          target: 'canceled',
          actions: [
            /* actions to cancel upload */
          ],
        },
      },
    },
    completed: {
      type: 'final',
      entry: [
        // Send completion message to quota manager
        sendTo(
          ({ system }) => system.get('quota-manager'),
          ({ context }) => ({
            type: 'UPDATE_QUOTA',
            delta: context.file.size,
          })
        ),
        // Send completion message to queue
        sendTo(
          ({ system }) => system.get('upload-queue'),
          ({ context }) => ({
            type: 'COMPLETE_UPLOAD',
            fileId: context.file.id,
          })
        ),
      ],
    },
    canceled: {
      type: 'final',
      entry: [
        // Send cancel message to queue
        sendTo(
          ({ system }) => system.get('upload-queue'),
          ({ context }) => ({
            type: 'CANCEL_UPLOAD',
            fileId: context.file.id,
          })
        ),
      ],
    },
  },
})
