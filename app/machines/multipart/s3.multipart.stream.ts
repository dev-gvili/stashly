// app/machines/multipart/s3.multipart.stream.ts
import type { CompletedPart } from '@aws-sdk/client-s3'
import type { UploadProgress } from '@/types/machine.types'
import { parseEtag } from '@/utils/parsers'
import { PauseController } from './s3.multipart.concurrent'

const CHUNK_SIZE = 5 * 1024 * 1024 // 5 MB — S3 minimum part size
const DEFAULT_CONCURRENCY = 10
/** Part URLs asked for per request; the route signs at most 100 (500 MiB). */
const PART_URL_WINDOW = 100
/** How far ahead of the part being sent the next window is requested. */
const PART_URL_PREFETCH = 20

/** How many parts `streamParts` cuts a file of `size` bytes into. */
export function partCountFor(size: number): number {
  return Math.ceil(size / CHUNK_SIZE)
}

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

export interface PartUrlsInput {
  key: string
  uploadId: string
  totalParts: number
  /** URLs for parts 1…n, as `create-multipart-upload` returned them. */
  initial?: string[]
  signal: AbortSignal
}

/**
 * Hands each part its presigned URL, signed a window at a time. Every part
 * used to ask `/api/s3/upload` for its own URL right before its PUT: 20 of a
 * 100 MB upload's 54 requests (tech-debt item 39). The first window comes back
 * with `create-multipart-upload`; the next is requested `PART_URL_PREFETCH`
 * parts before it is needed, and workers waiting on the same window share
 * one request.
 *
 * `refresh` signs one part again. A URL signed ahead can expire (an hour)
 * before its part is sent, after a long pause or on a slow link.
 */
export function createPartUrls({
  key,
  uploadId,
  totalParts,
  initial = [],
  signal,
}: PartUrlsInput) {
  const urls = new Map<number, string>()
  initial.forEach((url, i) => urls.set(i + 1, url))
  const signing = new Map<number, Promise<void>>()
  let requestedThrough = initial.length

  function sign(from: number, count: number): Promise<void> {
    const request = retryFetch(
      '/api/s3/upload',
      {
        method: 'POST',
        priority: 'low',
        body: JSON.stringify({
          key,
          uploadId,
          from,
          count,
          action: 'get-presigned-urls',
        }),
        headers: { 'Content-Type': 'application/json' },
        signal,
      },
      5,
      2500,
      3,
      signal
    )
      .then((res) => res.json() as Promise<{ urls: string[] }>)
      .then(({ urls: signed }) => {
        signed.forEach((url, i) => urls.set(from + i, url))
      })
    // A prefetch nobody awaits yet must not surface as an unhandled
    // rejection; the part that needs it awaits `request` and sees the error.
    request.catch(() => {})
    for (let n = from; n < from + count; n++) signing.set(n, request)
    return request
  }

  function requestThrough(partNumber: number) {
    const through = Math.min(totalParts, partNumber)
    while (requestedThrough < through) {
      const from = requestedThrough + 1
      const count = Math.min(PART_URL_WINDOW, totalParts - requestedThrough)
      requestedThrough += count
      sign(from, count)
    }
  }

  function signed(partNumber: number): string {
    const url = urls.get(partNumber)
    if (!url) throw new Error(`No presigned URL for part ${partNumber}`)
    return url
  }

  return {
    async get(partNumber: number): Promise<string> {
      requestThrough(partNumber + PART_URL_PREFETCH)
      if (!urls.has(partNumber)) await signing.get(partNumber)
      // The server signs fewer than asked only past its own cap.
      if (!urls.has(partNumber)) await sign(partNumber, 1)
      return signed(partNumber)
    },
    async refresh(partNumber: number): Promise<string> {
      urls.delete(partNumber)
      await sign(partNumber, 1)
      return signed(partNumber)
    },
  }
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
  /** URLs for the first parts, from `create-multipart-upload`. */
  partUrls?: string[]
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
  partUrls: initialPartUrls,
  onProgress,
  onDone,
  abortController,
  pauseController,
  concurrency = DEFAULT_CONCURRENCY,
}: StreamPartsInput): Promise<void> {
  if (file.size === 0) {
    throw new Error('Cannot upload an empty file')
  }

  const totalParts = partCountFor(file.size)
  const results: CompletedPart[] = new Array(totalParts)
  const partUrls = createPartUrls({
    key,
    uploadId,
    totalParts,
    initial: initialPartUrls,
    signal: abortController.signal,
  })
  const putPart = (url: string, blob: Blob) =>
    retryFetch(
      url,
      { method: 'PUT', body: blob, signal: abortController.signal },
      5,
      2500,
      2,
      abortController.signal
    )

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

      // 1. This part's presigned URL, usually signed already
      const presignedUrl = await partUrls.get(partNumber)

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
      let uploadResponse: Response
      try {
        uploadResponse = await putPart(presignedUrl, blob)
      } catch (error) {
        // An expired URL answers 403. Sign this part again, once: a 403 that
        // isn't expiry (access gone, upload aborted) fails the retry too.
        if ((error as { status?: number }).status !== 403) throw error
        uploadResponse = await putPart(await partUrls.refresh(partNumber), blob)
      }

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
