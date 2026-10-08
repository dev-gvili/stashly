# S3 Multipart Upload

This document covers the full architecture and implementation of the S3 multipart upload system, including the XState state machine, actors, streaming utilities, UI components, backend endpoint, and deep-dive theory on each phase.

---

## Architecture Overview

The multipart upload system is composed of:

1. **Parent machine** (`app/machines/upload/upload.machine.ts`) — orchestrates the queue and concurrency (`maxConcurrentUploads`), spawns one file actor per file, runs the post-upload `createDbItem` actor
2. **File machine** (`app/machines/reviset/file.machine.ts`) — the active per-file actor: checks quota, creates the multipart upload, uploads chunks in parallel (with pause/resume), completes the upload, emits `upload.done`
3. **Multipart utils** (`app/machines/multipart/s3.mulipart.utils.ts`, `s3.multipart.stream.ts`, `s3.multipart.concurrent.ts`) — side-effect handlers + streaming
4. **Quota** (`app/machines/quota/quota.machine.ts`, `quota/quota.actors.ts`) — quota machine spawned by the parent, plus the `checkQuota` fetch actor invoked by the file machine. Quota is *charged* on the server, in `createUploadedItem`
5. **Backend endpoint** (`app/routes/api/upload.ts`, registered as both `/api/s3/upload` and `/api/s3/multipart`) — handles multipart actions

> `upload/file.machine.ts` is an unused sibling — `upload.machine.ts` imports the file actor from `app/machines/reviset/file.machine.ts`. The machines in `app/machines/actors/` (`multipart.machine.ts`, `queue.machine.ts`, `quota.machine.ts`) are abandoned prototypes that nothing imports.

---

## State Machine

There is no standalone `multipart` machine — the lifecycle lives in the per-file machine (`app/machines/reviset/file.machine.ts`, id `fileUpload`), which invokes the multipart actors:

```typescript
export const fileMachine = setup({ ... }).createMachine({
  id: 'fileUpload',
  initial: 'pending',
  states: {
    pending:          // waits for `start` from the manager (respects concurrency limit)
    checkingQuota:    // invoke checkQuota → guard isQuotaCheckPassed
    creatingUpload:   // invoke createMultipartUpload → obtain uploadId from S3
    uploading:        // invoke `multipart` (uploadParts); substates: active | paused
    completingUpload: // invoke completeMultipartUpload → reassemble file in S3
    aborted:          // final — upload cancelled by the user
    success:          // final — upload complete (`upload.done` sent on the transition in)
    error:            // final — failure at any phase
  },
})
```

**State transitions:**
- `pending → creatingUpload` (on `start` when `skipQuotaCheck === true` — batch/folder uploads pre-check quota for the whole batch)
- `pending → checkingQuota` (on `start` otherwise)
- `checkingQuota → creatingUpload` (guard `isQuotaCheckPassed`, i.e. `quotaCheckResult.result === 'allowed'`) / `→ error`
- `creatingUpload → uploading` (on createMultipartUpload success) / `→ error`
- `uploading.active ↔ uploading.paused` (on `pause` / `resume`, forwarded to the multipart actor as `@multipart.upload.pause` / `@multipart.upload.resume`)
- `uploading → completingUpload` (on `@multipart.upload.done`)
- `uploading → aborted` (on `abort` / `@multipart.upload.aborted`)
- `completingUpload → success` (on completion success, sending `upload.done` to the parent) / `→ error`

Progress is not held in this machine: `@multipart.upload.progress` from the multipart actor is forwarded straight to the manager as `progress.change`.

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
  const pauseController = new PauseController()
  streamParts({
    ...input,
    abortController,
    pauseController,
    onDone: (parts) => sendBack({ type: '@multipart.upload.done', parts }),
    onProgress: (progress) => sendBack({ type: '@multipart.upload.progress', progress }),
  }).catch((error) => {
    // An abort is not a true error, so don't forward it as one.
    if (error.name !== 'AbortError') sendBack({ type: '@multipart.upload.error', error })
  })
  receive(({ type }) => {
    if (type === '@multipart.upload.abort') {
      pauseController.resume() // unblock any waiting worker before aborting
      abortController.abort()
      sendBack({ type: '@multipart.upload.aborted' })
    } else if (type === '@multipart.upload.pause') {
      pauseController.pause()
      sendBack({ type: '@multipart.upload.paused' })
    } else if (type === '@multipart.upload.resume') {
      pauseController.resume()
      sendBack({ type: '@multipart.upload.resumed' })
    }
  })
})
```

`file.machine.ts` invokes only three of these: `createUpload` (as `createMultipartUpload`), `uploadParts` (as `multipart`), and `completeUpload` (as `completeMultipartUpload`). `presignedPartUrl` and `abortUpload` are referenced only by the unused `upload/file.machine.ts` — on the live path presigning happens inside `streamParts`, and aborting is done by tripping the `AbortController`.

All API calls go to `POST /api/s3/upload` with an `action` discriminator field. **The route accepts JSON body (`request.json()`), not form-encoded data** — this is the only API route in the project that does so. Every other mutating route uses `parseFormData` + an `intent` discriminator.

---

## Streaming Implementation

The `streamParts` function in `s3.multipart.stream.ts` runs a **worker pool** over `File.slice()` ranges — memory-efficient without ever materialising the whole file:

```
File
  → totalParts = ceil(file.size / CHUNK_SIZE)
  → N workers pull part indices off a shared cursor (taskIndex++)
      → POST /api/s3/upload { action: 'get-presigned-url', partNumber }
      → PUT blob directly to S3 (retryFetch)
      → results[i] = { ETag, PartNumber }
  → await Promise.all(workers) → onDone(results)
```

**Chunk size:** `5 * 1024 * 1024` (5 MB — S3 minimum part size)
**Concurrency:** `DEFAULT_CONCURRENCY = 10` (overridable via the `concurrency` input)

### Part slicing
`file.slice(offset, offset + CHUNK_SIZE)` per part index; `partNumber = i + 1`. `results` is a pre-sized array indexed by part, so parts stay ordered regardless of which worker finishes first.

### Why a `Blob` body, not a stream
S3 requires `Content-Length` on every PUT. Browsers treat `Content-Length` as a forbidden header and won't set it for a `ReadableStream` body — that returns 411. Passing a `Blob` lets the browser derive it from `blob.size`. Consequently there is **no in-flight byte progress**: `sharedState.bytesUploaded` is incremented after each chunk completes and `onProgress` reports percentage, speed, and time remaining at chunk granularity. `createChunkedFileStream` and `ProgressReportingTransformStream` still exist in the module but are not on this path.

### Retry
`retryFetch` wraps both the presign POST and the S3 PUT (5 attempts, 2500 ms base delay, exponential backoff factor 3 for presign / 2 for the PUT), and every call carries the `AbortController` signal.

**Pause support:** a `PauseController` is awaited at the top of each worker loop (`waitIfPaused()`), so a pause takes effect at the next chunk boundary rather than mid-PUT.

---

## Alternative: XHR-based Streaming (not implemented)

No code in the repo uses `XMLHttpRequest` for uploads today — the sketch below is kept as the design note for the one thing the current `fetch` + `Blob` path cannot do: report bytes *within* a chunk. `XMLHttpRequest` is the only browser API that natively exposes upload progress:

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

The `app/components/upload/index.tsx` module exports a compound component system. The singleton actor lives in `app/hooks/useUpload.ts`, not in the component module:

```typescript
// app/hooks/useUpload.ts — created once at module level
export const upload = createActor(uploadMachine, { id: 'uploadManager' })
upload.start()
```

**Exported components:**
- `Upload` — root; calls `configure({ user })` from `useUpload()` on mount
- `DropArea` — drag-and-drop zone; spreads `dragHandlers`, or `makeDropHandler(folderId)` for a folder-targeted drop
- `Trigger` — file input label; calls `add` / `addBatch` on file selection
- `FileList` — renders queued files from `useUploadFileIds()`
- `Total` — displays total file count (`useUploadCounts()`)
- `CountDown` — shows time remaining per file
- `StatusText` — shows upload status per file
- `Description`, `EmptyOutline`, `UploadPanel` — panel chrome

Per-file row internals (`Item`, `Progress`, `FileIcon`, `FileName`, `FileSize`, `Cancel`, `Dismiss`, `PauseResume`) are module-private.

State is read via `useSelector(upload, ...)` with `shallowEqual` for performance. Crucially, no component subscribes to the whole `mediaFiles` map: those objects get a fresh identity on every progress tick, and a broad selector re-rendered every consumer — with 20+ concurrent uploads that render storm re-fired Radix's Popper anchor effect until React threw "Maximum update depth exceeded". Subscribe through the narrow hooks (`useUploadFileIds`, `useUploadCounts`, `useUploadFileMeta`, `useUploadProgress`, `useUploadStatus`) instead.

---

## Backend Endpoint

`app/routes/api/upload.ts` — a React Router resource route that handles all multipart actions:

```typescript
const defaults = z.object({ key: z.string(), uploadId: z.string() })

const uploadSchema = z.discriminatedUnion('action', [
  z.object({ ...defaults.pick({ key: true }).shape, action: z.literal('create-multipart-upload'),
             metadata: z.record(z.string(), z.string()).optional(), contentType: z.string().optional() }),
  z.object({ ...defaults.shape, action: z.literal('complete-multipart-upload'),
             parts: z.array(z.object({ ETag: z.string(), PartNumber: z.number() })) }),
  z.object({ ...defaults.shape, action: z.literal('get-presigned-url'), partNumber: z.number() }),
  z.object({ ...defaults.shape, action: z.literal('abort-multipart-upload') }),
])

export async function action({ request }: Route.ActionArgs) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) throw redirect('/auth/sign-in')
  const { user } = session
  const { bucket } = user

  const values = uploadSchema.parse(await request.json())

  switch (values.action) {
    case 'create-multipart-upload': ...  // returns { uploadId }
    case 'get-presigned-url':       ...  // returns { url }
    case 'complete-multipart-upload': ... // { key, bucket, etag, version, location, metadata, verifiedKind, verifiedContentType }
    case 'abort-multipart-upload':  ...  // returns { success: true }
  }
}
```

The bucket comes off the session user; there is no `UploadService` / `fixCors()` call and no `upload-file` (single-shot) action.

**`.ts` content verification:** on `complete-multipart-upload`, if `isAmbiguousTsFile(key)` the route does a ranged `getObjectHead` (1 KB) and runs `sniffTsBytes` to distinguish TypeScript source from MPEG transport stream, returning `verifiedKind` / `verifiedContentType`. The client's `contentType` is only a claim; this server-side sniff is the trust boundary. It is best-effort — a failure is logged, never fails a completed upload. Note the in-code `TODO`: the verified MIME is **not yet persisted** onto the `Item` record.

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

---

## Post-Upload Chain — DB Item Creation

Completing the S3 upload only writes the binary. The DB row is created by the parent machine's `createDbItem` actor immediately after `upload.done`.

### Event Flow

```
reviset/file.machine.ts
  → sendUploadDoneToParent → upload.done event
upload/upload.machine.ts
  → markAsDone, removeFromActiveQueue, removeFromUploads, uploadPendingFiles
  → triggerItemCreation → spawnChild('createDbItem', {
        id: `create-item-${mediaFile.id}`,
        input: { mediaFile, user, parent: self },
      })
createDbItem (fromPromise actor in upload.machine.ts)
  → POST /api/items (FormData body, intent=create_upload_item)
  → on success: parent.send('upload.createItem.success')
  → on failure: parent.send('upload.createItem.error') and rethrow
app/routes/api/items.ts
  → parseFormData + itemsApiRouteInput schema
  → case 'create_upload_item' → createUploadedItem(data)
app/.server/item-actions.ts → createUploadedItem()
  → prisma.$transaction: findOrCreateFolderPath → item.create (nested file + permissions)
    → onItemsUploaded (quota delta, same tx) → createActivity (upload action)
```

### Available on `upload.done`

`event.mediaFile` shape:

| Field | Source |
|-------|--------|
| `id` | Pre-generated as `item_xxx` by `toMediaFile()` in `app/utils/converters.ts` |
| `key` | S3 object path from `toUploadFileKey()`: `${rootId}/${filename}`, or `${rootId}/${webkitRelativePath}` for directory drops (a `workspaceId` prefixes both when present) |
| `file` | Browser `File` object |
| `etag` | Returned from `complete-multipart-upload` |
| `ownerId` | Set by upload manager from config |
| `uploadId` | S3 multipart upload id, carried through to `Item.uploadId` |
| `status` | `'done'` at this point |

### Key Derivations

| Field | Source |
|-------|--------|
| `Item.id` | `mediaFile.id` (already `item_xxx` format) |
| `Item.parentId` | Posted as `mediaFile.key.split('/')[0]`, but the **server re-resolves it**: `createUploadedItem` splits the key and walks the intermediate segments through `findOrCreateFolderPath`, so the row is parented at the leaf folder (see below) |
| `Item.driveId` | `context.config.user.driveId` |
| `Item.ownerId` | `mediaFile.ownerId ?? user.id` |
| `Item.category` | `toCategory(mediaFile.file)` from `app/utils/converters.ts` |
| `Item.uploadId` | `mediaFile.uploadId ?? ''` |
| `File.id` | Generated server-side: `toObjectId(getPrefixForModel('File'))` |
| `File.bucket` | `context.config.user.bucket` |
| `File.extension` | Derived server-side from the name (`name.split('.').pop()`) |

### `createUploadedItem` signature

```typescript
// app/.server/item-actions.ts
export async function createUploadedItem(data: {
  id: string; name: string; key: string; size: bigint
  mimeType?: string; etag?: string; bucket: string
  driveId: string; parentId: string; ownerId: string
  uploadId: string; category?: string
})
```

In one Prisma transaction it resolves the folder path, creates `Item` (type=file, status=normal) + nested `File` facet + owner `Permission`, and applies the quota delta via `onItemsUploaded(..., { client: tx })`. Returns with `defaultItemSelect`. Activity records (for the file and for each folder created along the way) are written fire-and-forget via `createActivity`.

Schema lives in `app/schemas/api.schemas.ts` under `itemsApiRouteInput` (discriminated union on `intent`, includes `create_upload_item` with `z.coerce.bigint()` for size and a required `uploadId`).

### Directory Drops — Hierarchy Is Preserved

The nested folder structure **is** reconstructed. `createUploadedItem` splits the key into `[rootId, ...pathParts, filename]` and, when `pathParts` is non-empty, calls `findOrCreateFolderPath(pathParts, rootId, ownerId, driveId, tx)` to find-or-create each intermediate folder, then parents the file at the leaf.

| Drop type | Behavior |
|-----------|----------|
| Single file or batch into a folder | Key is `rootId/name` — no path parts, `parentId = rootId` |
| Directory drop (folder tree) | Key is `rootId/a/b/name` — folders `a` and `b` are found-or-created and the file lands in `b` |

**Concurrency guard:** every file under one directory uploads in its own transaction, so naive check-then-create let their `findFirst`s all miss and each create a duplicate folder (same name, different id, contents split across the copies). `findOrCreateFolderPath` therefore takes a transaction-scoped advisory lock keyed on `folder:{ownerId}:{parentId}:{name}` (`pg_advisory_xact_lock(hashtextextended(...))`, issued via `$executeRaw` because the function returns `void`) before the lookup, so a waiter sees the committed folder and reuses it. Files in unrelated folders don't contend.

### `itemCreated` Gate — Critical for Thumbnails

After `createDbItem` resolves, `markAsItemCreated` flips the file's `status` from `'done'` to `'itemCreated'`. The `'itemCreated'` status was added to `app/schemas/machine.schemas.ts` to fix a race condition: the thumbnail pipeline (and any downstream consumer that needs the DB row to exist) MUST gate on `'itemCreated'`, not `'done'`. Triggering on `'done'` produces FK violations on `Thumbnail.itemId` because the `Item` row hasn't been written yet.

```typescript
// app/schemas/machine.schemas.ts
export const status = z.enum([
  'aborted', 'done', 'uploading', 'paused', 'skipped',
  'pending', 'validating', 'queued', 'itemCreated',
])
```

### `UploadThumbnailRunner` — Post-Upload Effects

These effects no longer live in `useUpload.ts`. They are in `app/components/upload/upload-thumbnail-runner.tsx`, mounted once from `app/routes/layout.tsx`:

1. **Thumbnails.** `UploadThumbnailRunner` mounts one `<FileThumbnailWatcher>` per media file in the queue. Each watcher fires when its file reaches `status === 'itemCreated'`; a module-level `thumbnailedIds = new Set<string>()` guarantees once-per-file. Under the XState path (`USE_THUMBNAIL_MACHINE = true`) the watcher only enqueues, and the manager's upload lane owns the cap of 4 — the runner's `MAX_CONCURRENT_THUMBNAILS` semaphore is vestigial there and comes out at merge-back. Under the legacy path each watcher gets its own `useThumbnail()` instance, with its own React Router fetchers (presign, patch, metadata, embedding), its own broadcast channel keyed by itemId, and the runner's semaphore doing the capping — a 534-file upload would otherwise start 534 pipelines at once and bury the server. See [`docs/thumbnail-pipeline.md` §13](thumbnail-pipeline.md#13-xstate-scheduler).
2. **Route rerender**, so new items appear in the current view: `navigate(location.pathname + location.search, { replace: true, state: { reset: true } })`. The `state: { reset: true }` is detected by `usePagination` to reset its cursor. **Do NOT use `useRevalidator` here — it doesn't update `usePagination`.** This is now **debounced to one revalidation per burst** (`REVALIDATE_DEBOUNCE_MS = 700`, keyed on the count of files at `itemCreated`/`done`); previously each file navigated on its own, so a 534-file upload meant 534 loader runs pounding the DB.
3. **Backfill standoff.** While the queue is non-empty the runner calls `pauseBackfill()` (and `resumeBackfill()` when it drains) so on-demand thumbnail backfill of older items doesn't compete with fresh uploads for compute-worker slots and bandwidth.

See: [`docs/thumbnail-pipeline.md`](thumbnail-pipeline.md) for the full thumbnail flow.
