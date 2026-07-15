import { fromCallback, fromPromise, type ExtractEvent } from 'xstate'
import { PauseController } from './s3.multipart.concurrent'
import type { CompletedPart } from '@aws-sdk/client-s3'
import type { MultipartEvents } from '@/types/machine.types'
import { streamParts } from './s3.multipart.stream'

interface BaseUploadArgs {
  key: string
  uploadId: string
}

export interface CreateMultipartUploadInput {
  key: string
  /** S3 object Content-Type — set at create time, immutable after. */
  contentType?: string
  metadata?: Record<string, string>
}
export interface GetPresignedUrlForPartInput extends BaseUploadArgs {
  partNumber: number
}
export interface CompleteMultipartUploadInput extends BaseUploadArgs {
  parts: CompletedPart[]
}
export interface AbortMultipartUploadInput extends BaseUploadArgs {}

export interface CreateMultipartUploadOutput {
  uploadId: string
}
export interface GetPresignedUrlForPartOutput {
  url: string
}
export interface CompleteMultipartUploadOutput {
  etag: string
  version?: string
}
export interface AbortMultipartUploadOutput {
  success: boolean
}


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
  ExtractEvent<MultipartEvents, '@multipart.upload.abort' | '@multipart.upload.pause' | '@multipart.upload.resume'>,
  UploadPartsInput
>(({ sendBack, receive, input }) => {
  const abortController = new AbortController()
  const pauseController = new PauseController()

  // Stream the parts to s3 storage, every part is presigned and uploaded.
  streamParts({
    ...input,
    abortController,
    pauseController,
    onDone: (parts) => {
      console.log('Multipart upload completed successfully', { parts })
      sendBack({ type: '@multipart.upload.done', parts })
    },
    onProgress: (progress) => {
      sendBack({ type: '@multipart.upload.progress', progress })
    },
  })
    // Catch any errors from the streaming upload process
    .catch((error) => {
      console.error('Error during multipart upload', { error })
      // An abort is not a true error, so don't forward it as one.
      if (error.name !== 'AbortError') {
        sendBack({ type: '@multipart.upload.error', error })
      }
    })

  receive(({ type }) => {
    if (type === '@multipart.upload.abort') {
      pauseController.resume() // unblock any waiting worker before aborting
      abortController.abort()
      sendBack({ type: '@multipart.upload.aborted' })
    } else if (type === '@multipart.upload.pause') {
      console.log('Pausing multipart upload...')
      pauseController.pause()
      sendBack({ type: '@multipart.upload.paused' })
    } else if (type === '@multipart.upload.resume') {
      console.log('Resuming multipart upload...')
      pauseController.resume()
      sendBack({ type: '@multipart.upload.resumed' })
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