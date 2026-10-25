// app/machines/multipart/s3.multipart.stream.ts
import type { CompletedPart } from '@aws-sdk/client-s3'
import type { UploadProgress } from '@/types/machine.types'
import { parseEtag } from '@/utils/parsers'
import { PauseController } from './s3.multipart.concurrent'

const CHUNK_SIZE = 5 * 1024 * 1024 // 5 MB — S3 minimum part size
const DEFAULT_CONCURRENCY = 10

/**
 * `fetch` with backoff for the part loop. Retries 429, 5xx and network errors;
 * any other 4xx fails on the first answer. A 403 (access revoked mid-upload)
 * or a 400 won't change on a retry, and five of them with this backoff kept a
 * doomed upload alive for minutes (tech-debt item 34).
 */
export async function retryFetch(
  url: RequestInfo,
  init: RequestInit,
  maxRetries: number = 5,
  delay: number = 1000,
  backoffFactor: number = 2,
  abortSignal: AbortSignal
): Promise<Response> {
  let retries = 0
  while (retries < maxRetries) {
    try {
      if (abortSignal.aborted) {
        throw new DOMException('Upload aborted', 'AbortError')
      }
      const response = await fetch(url, init)
      if (response.status === 429) {
        console.warn(
          `Received 429 Too Many Requests. Retrying in ${delay / 1000}s...`
        )
        await new Promise((resolve) => setTimeout(resolve, delay))
        delay *= backoffFactor
        retries++
        continue
      }
      if (response.status >= 400 && response.status < 500) {
        throw Object.assign(
          new Error(`HTTP error! status: ${response.status}`),
          { status: response.status, retryable: false }
        )
      }
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      return response
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw error
      }
      if ((error as { retryable?: boolean }).retryable === false) {
        throw error
      }
      console.error(`Fetch attempt failed: ${error}. Retrying...`)
      await new Promise((resolve) => setTimeout(resolve, delay))
      delay *= backoffFactor
      retries++
    }
  }
  throw new Error(`Failed to fetch ${url} after ${maxRetries} retries.`)
}

/**
 * Creates a ReadableStream from a File object, yielding fixed-size Blob chunks.
 * Kept as a utility — no longer used in the main upload path.
 */
export function createChunkedFileStream(
  file: File,
  chunkSize: number
): ReadableStream<Blob> {
  let offset = 0
  return new ReadableStream({
    async pull(controller) {
      if (offset < file.size) {
        const chunk = file.slice(offset, offset + chunkSize)
        controller.enqueue(chunk)
        offset += chunk.size
      } else {
        controller.close()
      }
    },
    cancel() {},
  })
}

/**
 * Progress state shared across all concurrent workers.
 * Since JS is single-threaded, mutations to `bytesUploaded` are safe without locks.
 */
interface SharedProgressState {
  bytesUploaded: number
  totalFileSize: number
  startTime: number
  onProgress: (p: UploadProgress) => void
}

function buildProgress(state: SharedProgressState): UploadProgress {
  const percentage = Math.round(
    (state.bytesUploaded * 100) / state.totalFileSize
  )
  const elapsed = (Date.now() - state.startTime) / 1000
  const speed = elapsed > 0 ? state.bytesUploaded / elapsed : 0
  const timeLeftSeconds =
    speed > 0 ? (state.totalFileSize - state.bytesUploaded) / speed : 0

  const hours = Math.floor(timeLeftSeconds / 3600)
  const minutes = Math.floor((timeLeftSeconds % 3600) / 60)
  const seconds = Math.floor(timeLeftSeconds % 60)

  let speedUnit: 'KB/s' | 'MB/s' = 'KB/s'
  let formattedSpeed = speed / 1024
  if (formattedSpeed > 1024) {
    formattedSpeed /= 1024
    speedUnit = 'MB/s'
  }

  return {
    percentage,
    timeLeft: { hours, minutes, seconds },
    speed: { value: parseFloat(formattedSpeed.toFixed(2)), unit: speedUnit },
  }
}

export interface StreamPartsInput {
  key: string
  file: File
  uploadId: string
  onProgress: (progress: UploadProgress) => void
  onDone: (parts: CompletedPart[]) => void
  abortController: AbortController
  pauseController?: PauseController
  concurrency?: number
}

/**
 * Orchestrates a concurrent multipart file upload to S3 using the Web Streams API.
 *
 * Each chunk gets its own ReadableStream pipeline:
 *   blob.stream() → ProgressReportingTransformStream → fetch PUT body
 *
 * Up to `concurrency` chunk-streams run simultaneously via a worker pool.
 * Chunk bytes flow directly from memory to S3 without intermediate buffering.
 */
export async function streamParts({
  file,
  uploadId,
  key,
  onProgress,
  onDone,
  abortController,
  pauseController,
  concurrency = DEFAULT_CONCURRENCY,
}: StreamPartsInput): Promise<void> {
  if (file.size === 0) {
    throw new Error('Cannot upload an empty file')
  }

  const totalParts = Math.ceil(file.size / CHUNK_SIZE)
  const results: CompletedPart[] = new Array(totalParts)

  // Shared across all concurrent chunk-streams so progress reflects the whole file
  const sharedState: SharedProgressState = {
    bytesUploaded: 0,
    totalFileSize: file.size,
    startTime: Date.now(),
    onProgress,
  }

  // taskIndex++ is synchronous — no race condition in single-threaded JS
  let taskIndex = 0

  async function worker(): Promise<void> {
    while (taskIndex < totalParts) {
      if (pauseController) await pauseController.waitIfPaused()
      if (abortController.signal.aborted) {
        throw new DOMException('Upload aborted', 'AbortError')
      }

      const i = taskIndex++
      const offset = i * CHUNK_SIZE
      const blob = file.slice(offset, Math.min(offset + CHUNK_SIZE, file.size))
      const partNumber = i + 1

      // 1. Get presigned URL for this part
      const presignResponse = await retryFetch(
        '/api/s3/upload',
        {
          method: 'POST',
          body: JSON.stringify({
            key,
            uploadId,
            partNumber,
            action: 'get-presigned-url',
          }),
          headers: { 'Content-Type': 'application/json' },
          signal: abortController.signal,
        },
        5,
        2500,
        3,
        abortController.signal
      )

      const { url: presignedUrl } = (await presignResponse.json()) as {
        url: string
      }

      if (abortController.signal.aborted) {
        throw new DOMException('Upload aborted', 'AbortError')
      }

      // 2. Upload the chunk to S3.
      // NOTE: S3 requires a Content-Length header on every PUT. Browsers treat
      // Content-Length as a forbidden header and will not set it for a streaming
      // body (ReadableStream), causing a 411 response. Passing a Blob lets the
      // browser set Content-Length automatically from blob.size.
      // ProgressReportingTransformStream is therefore used outside the fetch body
      // (see the class definition above) and progress is reported post-upload below.
      const uploadResponse = await retryFetch(
        presignedUrl,
        {
          method: 'PUT',
          body: blob,
          signal: abortController.signal,
        },
        5,
        2500,
        2,
        abortController.signal
      )

      const etag = uploadResponse.headers.get('ETag')
      if (!etag) {
        throw new Error(
          `Missing ETag for part ${partNumber} — S3 did not confirm the upload`
        )
      }

      results[i] = {
        ETag: parseEtag(etag),
        PartNumber: partNumber,
      }

      // Report progress after this chunk completes
      sharedState.bytesUploaded += blob.size
      sharedState.onProgress(buildProgress(sharedState))
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, totalParts) }, worker)
  )

  onDone(results)
}
