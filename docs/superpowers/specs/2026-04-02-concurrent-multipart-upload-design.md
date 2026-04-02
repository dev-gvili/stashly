# Concurrent Multipart Upload Design

**Date:** 2026-04-02
**Status:** Approved

---

## Problem

`streamParts` in `s3.multipart.stream.ts` uploads parts serially via a Web Streams pipeline:

```
ReadableStream → ProgressReportingTransformStream → WritableStream
```

The `WritableStream.write()` handler awaits each part's presign + PUT before pulling the next chunk. For a 2 GB file with 5 MB chunks (~410 parts), this means 820 sequential HTTP round trips. On a 50 Mbps connection, that's ~350 seconds of wall-clock time regardless of available bandwidth.

Both `reviset/file.machine.ts` and `upload/file.v2.machine.ts` share this bottleneck via the same `uploadParts` actor.

---

## Goal

Replace the serial pipeline with a concurrent worker-pool implementation that keeps N part uploads in flight at all times. Concurrency defaults to 5, configurable per call. Output contract is identical to `streamParts` so the existing `uploadParts` actor needs no changes.

---

## New File

`app/machines/multipart/s3.multipart.concurrent.ts`

The existing `s3.multipart.stream.ts` is left untouched. The `uploadParts` actor in `s3.mulipart.utils.ts` is updated to import `streamParts` from the new file.

---

## Interface

Same as `StreamPartsInput` with one optional addition:

```typescript
export interface StreamPartsInput {
  key: string
  file: File
  uploadId: string
  onProgress: (progress: UploadProgress) => void
  onDone: (parts: CompletedPart[]) => void
  abortController: AbortController
  concurrency?: number  // default: 5
}
```

The exported function signature is identical:

```typescript
export async function streamParts(input: StreamPartsInput): Promise<void>
```

Drop-in replacement — no changes needed at call sites.

---

## Algorithm

### 1. Slice chunks upfront

```
chunks = []
for offset = 0 to file.size step CHUNK_SIZE:
  chunks.push({ blob: file.slice(offset, offset + CHUNK_SIZE), partNumber: i + 1 })
```

`File.slice()` returns a `Blob` reference (zero-copy). Collecting ~410 references for a 2 GB file is negligible memory overhead.

### 2. Worker pool

```
results: CompletedPart[] = new Array(chunks.length)
taskIndex = 0   // shared counter, safe because JS is single-threaded

worker():
  while taskIndex < chunks.length:
    i = taskIndex++           // grab next slot before any await
    results[i] = await uploadPart(chunks[i])

await Promise.all(
  Array.from({ length: min(concurrency, chunks.length) }, worker)
)
```

`taskIndex++` executes synchronously before the first `await` inside `worker`, so there is no race condition. Each worker writes to its own `results[i]` slot.

### 3. Upload one part

```
uploadPart({ blob, partNumber }):
  if abortController.signal.aborted → throw AbortError

  presignedUrl = await retryFetch(POST /api/s3/upload, { action: 'get-presigned-url', key, uploadId, partNumber })
  response     = await retryFetch(presignedUrl, { method: PUT, body: blob, signal })

  bytesUploaded += blob.size
  reportProgress()

  return { ETag: parseEtag(response.headers.get('ETag')), PartNumber: partNumber }
```

Uses the same `retryFetch` implementation (5 retries, exponential backoff, `AbortError` pass-through) — duplicated into the new file since `s3.multipart.stream.ts` is left untouched and does not export it.

### 4. Completion

```
onDone(results)   // results already indexed correctly, no sort needed
```

Part ordering is guaranteed by index assignment (`results[i]`), not upload completion order.

---

## Progress Reporting

Progress fires after each part's PUT completes — bytes confirmed uploaded at S3, not bytes dispatched.

```typescript
function reportProgress() {
  const percentage = Math.round((bytesUploaded * 100) / file.size)
  const elapsed = (Date.now() - startTime) / 1000
  const speed = bytesUploaded / elapsed  // bytes/sec
  const remaining = (file.size - bytesUploaded) / speed

  onProgress({
    percentage,
    timeLeft: { hours, minutes, seconds },  // derived from remaining
    speed: { value, unit: 'KB/s' | 'MB/s' },
  })
}
```

Progress updates arrive in 5 MB steps (one per completed part). With 5 concurrent workers, up to 5 updates may fire in quick succession near part completion boundaries. This is acceptable — percentage and ETA are accurate because they reflect confirmed bytes, not bytes in-flight.

Same `UploadProgress` shape as the current implementation.

---

## Abort Behavior

Each `uploadPart` call checks `abortController.signal.aborted` at entry. The `signal` is also passed to all `retryFetch` calls. On abort:

1. In-flight `fetch` calls throw `AbortError`
2. Workers that haven't started yet check the flag at entry and throw `AbortError` immediately
3. `Promise.all` rejects
4. The caller (`uploadParts` actor in `s3.mulipart.utils.ts`) catches non-`AbortError` errors — same as today

---

## Integration

Only one change outside the new file: update the import in `s3.mulipart.utils.ts`:

```diff
- import { streamParts } from './s3.multipart.stream'
+ import { streamParts } from './s3.multipart.concurrent'
```

Both v1 (`reviset/file.machine.ts`) and v2 (`upload/file.v2.machine.ts`) benefit automatically since they both use the `uploadParts` actor.

---

## Expected Impact

| File size | Parts | Serial (50 Mbps) | Concurrent ×5 (50 Mbps) |
|-----------|-------|-----------------|--------------------------|
| 100 MB    | 20    | ~16s            | ~4s                      |
| 1 GB      | 205   | ~165s           | ~35s                     |
| 2 GB      | 410   | ~330s           | ~70s                     |

Actual gains depend on network latency to S3 and the presign endpoint. Presign round trips (~30–80ms each) are also parallelized, compounding the benefit.

---

## Out of Scope

- Byte-level intra-part progress (requires XHR; not worth the complexity given 5 MB parts)
- Retry with part resumption (existing `retryFetch` handles transient failures per part)
- Dynamic concurrency adjustment based on observed throughput
