import { fromCallback, fromPromise, type ExtractEvent } from 'xstate'
import type {
  AbortMultipartUploadInput,
  AbortMultipartUploadOutput,
  CompleteMultipartUploadInput,
  CompleteMultipartUploadOutput,
  CreateMultipartUploadInput,
  CreateMultipartUploadOutput,
  GetPresignedUrlForPartInput,
  GetPresignedUrlForPartOutput,
} from '@/.server/upload'
import type { MultipartEvents } from '../machine.types'
import { streamParts } from './s3.multipart.stream'

const FetchInit: RequestInit = {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
}

/**
 * Initiates a multipart upload on S3.
 * @param params - The input parameters for creating a multipart upload.
 * @returns A promise that resolves to the output of the create multipart upload operation, including the upload ID.
 */
export async function createMultipartUpload(
  params: CreateMultipartUploadInput
): Promise<CreateMultipartUploadOutput> {
  const res = await fetch('/api/s3/upload', {
    ...FetchInit,
    body: JSON.stringify({
      ...params,
      action: 'create-multipart-upload',
    }),
  })
  return await res.json()
}

/**
 * Retrieves a presigned URL for a specific part of a multipart upload.
 * @param params - The input parameters for getting a presigned URL for a part.
 * @returns A promise that resolves to the output of the get presigned URL for part operation, including the URL.
 */
export async function getPresignedUrlForPart(
  params: GetPresignedUrlForPartInput
): Promise<GetPresignedUrlForPartOutput> {
  const res = await fetch('/api/s3/upload', {
    ...FetchInit,
    body: JSON.stringify({
      ...params,
      action: 'get-presigned-url',
    }),
  })
  return await res.json()
}

/**
 * Completes a multipart upload on S3.
 * @param params - The input parameters for completing the multipart upload.
 * @returns A promise that resolves to the output of the complete multipart upload operation,
 *   including the key, bucket, ETag, and version ID of the completed object.
 */
export async function completeMultipartUpload(
  params: CompleteMultipartUploadInput
): Promise<CompleteMultipartUploadOutput> {
  let res = await fetch('/api/s3/upload', {
    ...FetchInit,
    body: JSON.stringify({
      ...params,
      action: 'complete-multipart-upload',
    }),
  })
  return await res.json()
}

/**
 * Aborts a multipart upload on S3.
 * @param params - The input parameters for aborting the multipart upload.
 * @returns A promise that resolves to the output of the abort multipart upload operation.
 */
export async function abortMultipartUpload(
  params: AbortMultipartUploadInput
): Promise<AbortMultipartUploadOutput> {
  let res = await fetch('/api/s3/upload', {
    ...FetchInit,
    body: JSON.stringify({
      ...params,
      action: 'abort-multipart-upload',
    }),
  })
  return await res.json()
}

// ====================================================== //
// ======================= Actors ======================= //
// ====================================================== //

export interface UploadPartsInput {
  file: File
  key: string
  uploadId: string
}

/**
 * XState actor that orchestrates the streaming and uploading of file parts to S3.
 * It uses `streamParts` to handle the chunking, presigning, and uploading,
 * and reports progress and completion back to the parent machine.
 */
export const uploadParts = fromCallback<
  ExtractEvent<MultipartEvents, '@multipart.upload.abort'>,
  UploadPartsInput
>(({ sendBack, receive, input }) => {
  const abortController = new AbortController()

  // Stream the parts to s3 storage, every part is presigned and uploaded.
  streamParts({
    ...input,
    abortController,
    onDone: (parts) => {
      sendBack({ type: '@multipart.upload.done', parts })
    },
    onProgress: (progress) => {
      sendBack({ type: '@multipart.upload.progress', progress })
    },
  })
    // Catch any errors from the streaming upload process
    .catch((error) => {
      // An abort is not a true error, so don't forward it as one.
      if (error.name !== 'AbortError') {
        sendBack({ type: '@multipart.upload.error', error })
      }
    })

  receive(({ type }) => {
    if (type === '@multipart.upload.abort') {
      // TODO: replace with proper logging
      console.error('Multipart upload aborted')
      abortController.abort() // Trigger abort on the controller
      sendBack({ type: '@multipart.upload.aborted' }) // Notify fileMachine that actor is aborted
    }
  })
})

/**
 * XState actor that creates a multipart upload on S3.
 * It uses `createMultipartUpload` to initiate the upload and returns the upload ID.
 */
export const createUpload = fromPromise<
  CreateMultipartUploadOutput,
  CreateMultipartUploadInput
>(async ({ input }) => await createMultipartUpload(input))

/**
 * XState actor that gets a presigned URL for a specific part of a multipart upload.
 * It uses `getPresignedUrlForPart` to obtain the URL.
 */
export const presignedPartUrl = fromPromise<
  GetPresignedUrlForPartOutput,
  GetPresignedUrlForPartInput
>(async ({ input }) => await getPresignedUrlForPart(input))

/**
 * XState actor that aborts a multipart upload on S3.
 * It uses `abortMultipartUpload` to cancel the upload.
 */
export const abortUpload = fromPromise<
  AbortMultipartUploadOutput,
  AbortMultipartUploadInput
>(async ({ input }) => await abortMultipartUpload(input))

/**
 * XState actor that completes a multipart upload on S3.
 * It uses `completeMultipartUpload` to finalize the upload.
 */
export const completeUpload = fromPromise<
  CompleteMultipartUploadOutput,
  CompleteMultipartUploadInput
>(async ({ input }) => await completeMultipartUpload(input))
