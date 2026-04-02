# Concurrent Multipart Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the serial Web Streams upload pipeline with a worker-pool implementation that keeps 5 parts in flight concurrently.

**Architecture:** A new `streamParts` function in `s3.multipart.concurrent.ts` slices the file into 5 MB `Blob` references, then runs N async workers that each loop over a shared task index — grabbing the next chunk, presigning, uploading, and reporting progress until no chunks remain. The existing `uploadParts` actor is updated to import from the new file; all machines benefit automatically.

**Tech Stack:** TypeScript, Fetch API, `@aws-sdk/client-s3` (`CompletedPart`), XState (`fromCallback`)

---

### Task 1: Create `s3.multipart.concurrent.ts`

**Files:**
- Create: `app/machines/multipart/s3.multipart.concurrent.ts`

- [ ] **Step 1: Create the file**

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add app/machines/multipart/s3.multipart.concurrent.ts
git commit -m "feat: add concurrent multipart upload with worker-pool (5 parallel parts)"
```

---

### Task 2: Swap the import in `s3.mulipart.utils.ts`

**Files:**
- Modify: `app/machines/multipart/s3.mulipart.utils.ts` (line 13)

- [ ] **Step 1: Update the import**

In `app/machines/multipart/s3.mulipart.utils.ts`, change:

```diff
- import { streamParts } from './s3.multipart.stream'
+ import { streamParts } from './s3.multipart.concurrent'
```

- [ ] **Step 2: Verify TypeScript is happy**

```bash
pnpm typecheck
```

Expected: no new errors related to `streamParts` or `s3.multipart.concurrent`.

- [ ] **Step 3: Commit**

```bash
git add app/machines/multipart/s3.mulipart.utils.ts
git commit -m "chore: wire uploadParts actor to concurrent streamParts implementation"
```
