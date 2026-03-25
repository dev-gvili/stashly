# S3 Multipart Upload

This document covers the full architecture and implementation of the S3 multipart upload system, including the XState state machine, actors, streaming utilities, UI components, backend endpoint, and deep-dive theory on each phase.

---

## Architecture Overview

The multipart upload system is composed of:

1. **XState Machine** (`s3.multipart.ts`) — orchestrates the overall upload lifecycle
2. **Actors / Utils** (`s3.mulipart.utils.ts`) — side-effect handlers for each operation
3. **Streaming** (`s3.multipart.stream.ts`) — Web Streams API implementation for chunked uploads
4. **UI Components** (`file-upload.tsx`) — React components connected to the upload manager actor
5. **Backend Endpoint** (`api/upload.ts`) — Remix resource route handling multipart actions

---

## State Machine

The XState machine in `s3.multipart.ts` orchestrates the full lifecycle:

```typescript
export const multipart = setup({ ... }).createMachine({
  id: 'multipart',
  on: { '@multipart.upload.abort': 'abort' },
  initial: 'create',
  states: {
    create:     // POST to backend → obtain uploadId from S3
    upload:     // Stream parts; fires progress/done/error events
    abort:      // POST abort-multipart-upload → clean up S3 parts
    complete:   // POST complete-multipart-upload → reassemble file in S3
    cancelled:  // Final state — upload stopped (error or user action)
    done:       // Final state — upload successfully completed
  },
})
```

**State transitions:**
- `create → upload` (on createUpload success)
- `create → abort` (on createUpload error)
- `upload → complete` (on all parts uploaded)
- `upload → cancelled` (on upload error)
- `complete → done` (on completion success)
- `complete → abort` (on completion error)
- Any state `→ abort` (on `@multipart.upload.abort` event)

---

## Actors

Defined in `s3.mulipart.utils.ts`, each actor wraps a fetch call to the backend:

```typescript
// Initiate multipart upload → returns { uploadId }
export const createUpload = fromPromise(async ({ input }) =>
  await createMultipartUpload(input)
)

// Get presigned URL for a specific part
export const presignedPartUrl = fromPromise(async ({ input }) =>
  await getPresignedUrlForPart(input)
)

// Abort — clean up all uploaded parts from S3
export const abortUpload = fromPromise(async ({ input }) =>
  await abortMultipartUpload(input)
)

// Complete — assemble parts into the final S3 object
export const completeUpload = fromPromise(async ({ input }) =>
  await completeMultipartUpload(input)
)

// Callback actor that streams parts and reports progress
export const uploadParts = fromCallback(({ sendBack, receive, input }) => {
  const abortController = new AbortController()
  streamParts({
    ...input,
    abortController,
    onDone: (parts) => sendBack({ type: '@multipart.upload.done', parts }),
    onProgress: (progress) => sendBack({ type: '@multipart.upload.progress.change', progress }),
  })
  receive(({ type }) => {
    if (type === '@multipart.upload.abort') {
      abortController.abort()
      sendBack({ type: '@multipart.upload.aborted' })
    }
  })
})
```

All API calls go to `POST /api/s3/upload` with an `action` discriminator field.

---

## Streaming Implementation

The `streamParts` function in `s3.multipart.stream.ts` uses the **Web Streams API** for flow-controlled, memory-efficient file chunking:

```
File
  → createChunkedFileStream(file, CHUNK_SIZE)   [ReadableStream<Blob>]
  → .pipeThrough(ProgressReportingTransformStream)
  → .pipeTo(uploadWritableStream)
```

**Chunk size:** `5 * 1024 * 1024` (5 MB — S3 minimum part size)

### `createChunkedFileStream`
Uses `File.slice()` to yield fixed-size `Blob` chunks without loading the full file into memory.

### `ProgressReportingTransformStream`
A `TransformStream<Blob, Blob>` that:
- Accumulates total bytes processed
- Calculates percentage, speed (KB/s or MB/s), and time remaining
- Passes chunks through unchanged

### `uploadWritableStream`
A `WritableStream` that for each chunk:
1. Fetches a presigned URL from the backend (`POST /api/s3/upload`, action: `get-presigned-url`)
2. PUTs the chunk directly to S3 via that URL
3. Collects the ETag from the S3 response
4. On stream close, calls `onDone(uploadedParts)`

**Abort support:** `AbortController` signal is passed to every `fetch` call.

---

## Alternative: XHR-based Streaming

The `upload chunks using web stream.md` document describes an alternative `uploadFileInPartsStream` using `XMLHttpRequest` for per-chunk upload progress events (the `fetch` API doesn't natively expose upload progress):

```typescript
// XHR provides reliable upload progress events
xhr.upload.onprogress = (event) => {
  if (event.lengthComputable) {
    partProgress[currentPartNumber - 1] = event.loaded
    const totalLoaded = partProgress.reduce((acc, loaded) => acc + loaded, 0)
    const totalPercentage = Math.round((totalLoaded * 100) / file.size)
    onTotalProgress({ percentage: totalPercentage, ... })
  }
}
```

The XHR approach tracks per-part progress in a `partProgress[]` array, enabling smooth overall progress even with parallel uploads.

---

## UI Components

The `file-upload.tsx` module exports a compound component system connected to the singleton `uploadManagerActor`:

```typescript
// Singleton actor (created once at module level)
export const uploadManagerActor = createActor(uploadMachine, {
  systemId: 'uploadManager',
  id: 'uploadManager',
})
uploadManagerActor.start()
```

**Exported components:**
- `MediaUploadRoot` — configures the actor with bucketName/ownerId/user
- `DropArea` — drag-and-drop zone; sends `upload.add` event on drop
- `Trigger` — file input label; sends `upload.add` event on file selection
- `FileList` — renders all queued files from actor state
- `Total` — displays total file count
- `CountDown` — shows time remaining per file
- `StatusText` — shows upload status per file
- `Cancel` — sends `upload.cancel` event per file

State is read via `useSelector(uploadManagerActor, ...)` with `shallowEqual` for performance.

---

## Backend Endpoint

`api/upload.ts` — a Remix resource route that handles all multipart actions:

```typescript
const uploadFormData = z.discriminatedUnion('action', [
  z.object({ action: z.literal('create-multipart-upload'), key: z.string(), metadata: z.record(z.string()) }),
  z.object({ action: z.literal('get-presigned-url'), key: z.string(), uploadId: z.string(), partNumber: z.number() }),
  z.object({ action: z.literal('complete-multipart-upload'), key: z.string(), uploadId: z.string(), parts: z.array(...) }),
  z.object({ action: z.literal('abort-multipart-upload'), key: z.string(), uploadId: z.string() }),
  z.object({ action: z.literal('upload-file'), file: z.instanceof(File), workspaceId: z.string().optional() }),
])

export async function action({ request }: Route.ActionArgs) {
  const session = await auth.api.getSession(request)
  if (!session) throw redirect('/auth/sign-in')

  const data = await request.json()
  const values = uploadFormData.parse(data)
  const s3 = new UploadService({ s3Service: new S3Service(user.bucket), user })
  await s3.fixCors()

  switch (values.action) {
    case 'create-multipart-upload': ...  // returns { uploadId }
    case 'get-presigned-url':       ...  // returns { url }
    case 'complete-multipart-upload': ... // returns { key, bucket, etag, versionId }
    case 'abort-multipart-upload':  ...  // returns { success: true }
  }
}
```

---

## Deep Dive: Initiation Phase

The initiation phase creates an **upload session** before any data is transferred. This serves critical purposes:

### Why an Upload Session ID Matters

**Security:**
- The upload ID is tied to an authenticated user; subsequent requests are validated against the initial authorization
- Cryptographically random IDs (UUID v4 or CSPRNG) prevent ID guessing/hijacking
- Time-limited IDs reduce exposure if intercepted

**Resource Management:**
- The server allocates a temporary storage location per upload ID
- Multiple parts of the same file can be uploaded in parallel — each identified by `uploadId` + `partNumber`
- A scheduled cleanup process can find orphaned uploads by scanning for stale `IN_PROGRESS` records

**Resumable Uploads:**
- If an upload fails midway, the client can restart using the same session ID
- The server informs the client which parts were already received, so only missing parts are re-sent

**Scalability:**
- In distributed backends, the upload ID lets any backend server look up shared state in a centralized store (Redis, database), enabling horizontal scaling

---

## Deep Dive: Sending Chunks

### File Segmentation
- **`File.slice()`** (browser) creates a `Blob` for each byte range without loading the full file
- Fixed chunk size (5 MB minimum for S3)
- Each chunk assigned a sequential `partNumber` for reassembly ordering
- Benefits: resilience (only retry failed chunks), parallelization, memory efficiency, resume support

### Pre-signed URLs
The client should never hold long-term cloud credentials. Pre-signed URLs solve this:

1. Client requests a URL from **your backend** (authenticated)
2. Backend generates a **time-limited, scoped PUT URL** (specific key, uploadId, partNumber, expiry)
3. Client PUTs the chunk **directly to S3** — your backend is not in the data path
4. S3 responds with an ETag — client stores `{ ETag, PartNumber }` for the completion step

**Security benefits:** No credentials on client, fine-grained access, time-limited exposure
**Scalability benefits:** Server freed from proxying large file data

### Progress Tracking
- **`XMLHttpRequest.onprogress`:** Provides `event.loaded` and `event.total` per chunk. Track `partProgress[]` for each concurrent part; sum for overall percentage.
- **`TransformStream` + `fetch`:** Monitor byte writes through the transform stream (more complex, no native XHR progress events).

---

## Deep Dive: Handling Stops (Cancellation / Interruption)

### Stop Causes
1. **Client-initiated:** User cancels, closes browser tab, JavaScript crash
2. **Network interruption:** Loss of connectivity, firewall issues, timeout
3. **Server-side:** Backend crash, storage issues, security violations

### Graceful Abortion

**Client side:**
```javascript
const controller = new AbortController()
fetch(url, { signal: controller.signal })

cancelButton.addEventListener('click', () => {
  controller.abort()          // Terminate all in-flight fetch requests
  sendAbortSignalToBackend(uploadId) // Notify server explicitly
})
```

**Server side (on receiving `DELETE /uploads/{upload_id}`):**
1. Validate the upload ID belongs to the requesting user
2. Update status to `ABORTED` in the database
3. Trigger cleanup of all temporary S3 parts
4. Respond `204 No Content`

### Backend Resource Cleanup

**Immediate (on explicit abort):**
- Delete all S3 objects prefixed with the upload ID
- Mark database record as `ABORTED`

**Asynchronous / scheduled (for silent stops):**
- **S3 Lifecycle Policies:** Auto-delete incomplete multipart uploads after N days
- **Cron jobs:** Scan for `IN_PROGRESS` records not updated in 24–48 hours; mark as `FAILED` and delete parts

### Key Design Principles
- **Idempotency:** Calling abort multiple times has the same effect as calling it once
- **Robustness:** Never rely solely on client signals — implement server-side timeouts and scheduled cleanup
- **Observability:** Log aborted uploads; monitor orphaned resource counts
