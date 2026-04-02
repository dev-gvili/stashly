// app/machines/multipart/s3.multipart.concurrent.ts
import type { CompletedPart } from '@aws-sdk/client-s3'
import type { UploadProgress } from '@/types/machine.types'
import { parseEtag } from '@/utils/parsers'

const CHUNK_SIZE = 5 * 1024 * 1024 // 5 MB — S3 minimum part size
const DEFAULT_CONCURRENCY = 5

async function retryFetch(
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
        console.warn(`Received 429 Too Many Requests. Retrying in ${delay / 1000}s...`)
        await new Promise((resolve) => setTimeout(resolve, delay))
        delay *= backoffFactor
        retries++
        continue
      }
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      return response
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
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

export interface StreamPartsInput {
  key: string
  file: File
  uploadId: string
  onProgress: (progress: UploadProgress) => void
  onDone: (parts: CompletedPart[]) => void
  abortController: AbortController
  concurrency?: number
}

export async function streamParts({
  file,
  uploadId,
  key,
  onProgress,
  onDone,
  abortController,
  concurrency = DEFAULT_CONCURRENCY,
}: StreamPartsInput): Promise<void> {
  // Slice file into Blob references — File.slice() is zero-copy
  const chunks: Array<{ blob: Blob; partNumber: number }> = []
  let offset = 0
  let partNumber = 1
  while (offset < file.size) {
    chunks.push({
      blob: file.slice(offset, Math.min(offset + CHUNK_SIZE, file.size)),
      partNumber: partNumber++,
    })
    offset += CHUNK_SIZE
  }

  const results: CompletedPart[] = new Array(chunks.length)
  let bytesUploaded = 0
  const startTime = Date.now()

  function reportProgress() {
    const percentage = Math.round((bytesUploaded * 100) / file.size)
    const elapsed = (Date.now() - startTime) / 1000
    const speed = elapsed > 0 ? bytesUploaded / elapsed : 0
    const timeLeftSeconds = speed > 0 ? (file.size - bytesUploaded) / speed : 0

    const hours = Math.floor(timeLeftSeconds / 3600)
    const minutes = Math.floor((timeLeftSeconds % 3600) / 60)
    const seconds = Math.floor(timeLeftSeconds % 60)

    let speedUnit: 'KB/s' | 'MB/s' = 'KB/s'
    let formattedSpeed = speed / 1024
    if (formattedSpeed > 1024) {
      formattedSpeed /= 1024
      speedUnit = 'MB/s'
    }

    onProgress({
      percentage,
      timeLeft: { hours, minutes, seconds },
      speed: { value: parseFloat(formattedSpeed.toFixed(2)), unit: speedUnit },
    })
  }

  async function uploadPart(chunk: { blob: Blob; partNumber: number }, index: number): Promise<void> {
    if (abortController.signal.aborted) {
      throw new DOMException('Upload aborted', 'AbortError')
    }

    // 1. Get presigned URL
    const presignResponse = await retryFetch(
      '/api/s3/upload',
      {
        method: 'POST',
        body: JSON.stringify({
          key,
          uploadId,
          partNumber: chunk.partNumber,
          action: 'get-presigned-url',
        }),
        headers: { 'Content-Type': 'application/json' },
        signal: abortController.signal,
      },
      5,
      1000,
      2,
      abortController.signal
    )

    const { url: presignedUrl } = (await presignResponse.json()) as { url: string }

    // 2. Upload chunk directly to S3
    const uploadResponse = await retryFetch(
      presignedUrl,
      {
        method: 'PUT',
        body: chunk.blob,
        signal: abortController.signal,
      },
      5,
      1000,
      2,
      abortController.signal
    )

    const etag = uploadResponse.headers.get('ETag')
    if (etag) {
      results[index] = {
        ETag: parseEtag(etag),
        PartNumber: chunk.partNumber,
      }
    }

    bytesUploaded += chunk.blob.size
    reportProgress()
  }

  // Worker pool — taskIndex++ is synchronous so no race condition in single-threaded JS
  let taskIndex = 0

  async function worker(): Promise<void> {
    while (taskIndex < chunks.length) {
      const i = taskIndex++
      await uploadPart(chunks[i], i)
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, chunks.length) }, worker)
  )

  onDone(results)
}
