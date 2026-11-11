# Upload: S3 multipart and item creation

How a dropped file becomes bytes in the user's bucket and an `Item` row. The
working rules for changing this code are in the `stashly-upload-xstate` skill;
this page is the map.

## Pieces

| Piece | File | Role |
|---|---|---|
| Upload manager | `app/machines/upload/upload.machine.ts` | One actor for the app (`upload` in `app/hooks/useUpload.ts`). Queues files, caps concurrency at `maxConcurrentUploads` (default 100, `app/schemas/machine.schemas.ts`), spawns a file actor per file and a `dbMachine` per finished upload |
| File machine | `app/machines/reviset/file.machine.ts` | The per-file actor (the folder name is historical). Quota pre-check, multipart create, part upload, complete, abort |
| Multipart helpers | `app/machines/multipart/s3.mulipart.utils.ts`, `s3.multipart.stream.ts` | Fetch wrappers for the upload route, `streamParts` (the part worker pool), `createPartUrls`, `retryFetch`. `s3.multipart.concurrent.ts` now only supplies `PauseController` |
| Quota pre-check | `app/machines/quota/quota.actors.ts` | `checkQuota`, invoked by the file machine. `quota.machine.ts` beside it is not spawned by anything |
| Row writer | `app/machines/db/db.machine.ts` | `idle → hashing → building → posting → classifying`, then one of `created` / `refused` / `rejected` / `sessionExpired` / `failed`. Never throws |
| Upload route | `app/routes/api/upload.ts` | Registered as `/api/s3/upload` and `/api/s3/multipart`. JSON body with an `action` discriminator |
| Item route | `app/routes/api/items.ts` | `create_upload_item` and `resolve_upload_folders` intents (form data) |
| Server actions | `app/.server/item-actions.ts`, `app/.server/s3.ts` | `createUploadedItem`, `insertUploadedItem`, `resolveFolderTree`, `assertCanUploadTo`, `assertKeyUnfiled`, `discardUploadedObject`, `headUploadedObject` |
| Panel | `app/components/upload/index.tsx` | `Upload`, `DropArea`, `Trigger`, `FileList`, `Total`, `CountDown`, `StatusText`, `Description`, `UploadPanel` |
| After-upload effects | `app/components/upload/upload-thumbnail-runner.tsx` | Mounted once from `app/routes/layout.tsx` |

## File machine

States: `pending`, `pendingPaused`, `checkingQuota`, `creatingUpload`,
`uploading` (with `active` / `paused`), `completingUpload`, `abortingUpload`,
`abortingFailedUpload`, `aborted`, `success`, `error`.

- `checkingQuota` asks `/api/quota` for the destination folder's drive. A
  denied answer goes to `error` before any multipart upload starts. This only
  saves the transfer; the real limit is enforced when the row is written.
- `creatingUpload` sends `create-multipart-upload` with `partCount`
  (`partCountFor(file.size)`) and gets back `uploadId` and the first 100 part URLs.
- `uploading` invokes `uploadParts`, which runs `streamParts`. Pause and resume
  are forwarded to it; a pause takes effect at the next part boundary.
- `completingUpload` sends `complete-multipart-upload`. On success the machine
  sends `upload.done` to the manager. A failed complete goes through
  `abortingFailedUpload` and ends in `error`.
- A user cancel, or a part that runs out of retries, goes through
  `abortingUpload` (runs `abortMultipartUpload`, unsignalled) and ends in
  `aborted` whether or not the abort succeeded. Tigris rejects an
  `AbortIncompleteMultipartUpload` lifecycle rule, so the client abort is what
  stops parts staying billed.
- `error` sends `upload.failed` to the manager, which marks the file `failed`,
  frees its slot and starts the next pending file.

## Upload route actions

| `action` | Does |
|---|---|
| `create-multipart-upload` | `assertCanUploadTo` (write access on the key's first segment) and `assertKeyUnfiled` (409 when a `File` row already serves the key), then creates the upload and signs the first window of part URLs |
| `get-presigned-urls` | Signs `count` (≤ 100) part URLs starting at `from` |
| `get-presigned-url` | Signs one part. Kept, but the live path no longer calls it |
| `complete-multipart-upload` | Repeats both checks; a refusal aborts the upload so S3 drops the parts |
| `abort-multipart-upload` | Aborts; an upload already gone (`NoSuchUpload`) counts as done |

The route runs `authMiddleware` and reads the session from `sessionContext`; the
bucket is the session user's, never the request's.

## Part streaming

`streamParts` (`s3.multipart.stream.ts`) runs up to `DEFAULT_CONCURRENCY = 10`
workers over a shared part cursor. Each worker slices
`file.slice(offset, offset + CHUNK_SIZE)` (5 MB, the S3 minimum), takes the
part's URL from `createPartUrls`, PUTs the `Blob` to S3 and stores
`{ ETag, PartNumber }` in a pre-sized array, so parts stay ordered.

- **URL windows.** `createPartUrls` asks for the next 100 URLs
  (`PART_URL_WINDOW`) 20 parts before they are needed (`PART_URL_PREFETCH`),
  one request per window shared by all workers. A PUT answering 403 is
  re-signed once (Tigris answers an expired URL with 403); a second 403 fails
  the file.
- **Retries.** `retryFetch` retries 429, 5xx and network errors with
  exponential backoff (PUTs: 5 attempts, 2.5 s base, factor 2). Any other 4xx
  fails at once, so a revoked share fails the upload immediately.
- **Why a `Blob`.** S3 needs `Content-Length` on every PUT, and a browser won't
  set it for a `ReadableStream` body. So progress is reported per finished
  part, not per byte.
- **Priority.** Every request to our own server during an upload is sent with
  `priority: 'low'` (create, sign, complete, abort, and `postItem`), so it
  doesn't crowd out `save_media_metadata` on HTTP/1.1 (tech-debt item 53). Part
  PUTs go to S3 and keep the default.

## Keys and paths

`toMediaFile` (`app/utils/converters.ts`) builds two strings per file:

- `uploadPath`: `<rootId>/<folders…>/<name>`, where the file is going.
- `key`: the S3 object key, `toObjectKey(uploadPath, id)` =
  `<rootId>/<itemId>/<name>`. Every upload gets its own object, even with the
  same name. `createUploadedItem` refuses a key that doesn't match.

`File.uploadPath` keeps the path as it was at upload; it is not updated by a move.

Folder drops keep their structure through `webkitRelativePath`. The browser
fills it only for `<input webkitdirectory>`; for a drag-and-drop,
`collectFiles` in `useUpload.ts` copies the entry's `fullPath` onto the file
(`withEntryPath`).

## Item creation

1. On `upload.done` the manager's `triggerItemCreation` spawns a `dbMachine`
   and sends it `@db.item.create`.
2. The db machine hashes the file, builds the payload and posts it
   (`postItem` in `db.actors.ts`) to `POST /api/items` with
   `intent=create_upload_item`. The response is read as text and classified by
   `toOutcome` (`db.utils.ts`), because an expired session answers with a
   redirect that `fetch` follows to a 200 HTML page.
3. The route reads the stored object with `headUploadedObject` and charges its
   real `ContentLength` and ETag. The size and ETag in the form are only
   compared and logged.
4. `createUploadedItem` checks `write` access on the parent as the session
   user, then `insertUploadedItem` writes `Item`, `File`, `Permission`, the
   permission link and the quota charge (`stashly_charge_upload()`) in **one
   SQL statement**. A trashed or missing parent, or a file that doesn't fit,
   writes nothing; `refuseUploadedItem` then says why (404 / 507 / no quota).
5. If no row was written, the route calls `discardUploadedObject`, which deletes
   the bytes only when no `File` row points at them.
6. The db machine answers `upload.createItem.success { item }` or
   `upload.createItem.error`. Success sets the file's status to `itemCreated`;
   any failure sets `itemFailed` (bytes stored, no row).

Quota is charged to the **folder's** drive, so a collaborator's upload is paid
for by the folder's owner; `Item.ownerId` stays the uploader. Under load the
folder sizes, child count and quota charge go through a delta log applied by
`app/.server/size-rollup.ts`. See [quota-and-machines.md](quota-and-machines.md)
and CLAUDE.md → Development.

### Folders for a folder upload

`addBatch` (`useUpload.ts`) sends one `resolve_upload_folders` request before
its files start. `resolveFolderTree` finds or creates every folder, one query
per depth level and one insert for the missing ones, under one advisory lock
per uploader, then locks the root and the found folders in id order in one
statement. Each file then posts its leaf folder as `parentId`. A file without
one (a single-file `add`, a failed resolve) posts the root and
`createUploadedItem` resolves its path itself.

### The `itemCreated` gate

Anything that needs the row (thumbnails, indexing) must wait for
`status === 'itemCreated'`, not `done`. At `done` the bytes are in S3 but the
row may not exist, and a thumbnail write then fails on `Thumbnail.itemId`.

## After the row exists

`upload-thumbnail-runner.tsx`:

- For each file that reaches `itemCreated`, queues search indexing
  (`enqueueIndexing`) and holds the file for its thumbnail
  (`holdUploadedFile`), so the thumbnail is made from the local file instead of
  a download.
- While any file is in flight it pauses thumbnail downloads and deferred
  indexing (GPU work), and resumes them after the batch.
- New rows reach the folder page without a reload: `create_upload_item` answers
  with the item's listing row (`getCardItems`, `folderCardSelect`), the manager
  emits `items.created`, and `useCreatedItems` hands the rows to
  `usePagination.insertItems`. When the batch ends, the runner reloads the
  route once (`state: { reset: true }`) only if a created row could not be
  shown (`takeShownRows`).

## Panel performance

No component subscribes to the whole `mediaFiles` map, whose entries change
identity on every progress tick. Read through the narrow hooks in
`useUpload.ts`: `useUploadFileIds`, `useUploadCounts`, `useUploadFileMeta`,
`useUploadProgress`, `useUploadStatus`. `FileList` is windowed: only the rows in
view plus a few either side are mounted (tech-debt item 52).

## Tests

`app/machines/reviset/__tests__/` (quota check, part URLs, abort),
`app/machines/multipart/__tests__/` (part URLs, retry, stream contract),
`app/machines/upload/__tests__/` (concurrency, failed files),
`app/machines/db/__tests__/db.machine.test.ts`,
`app/routes/api/__tests__/upload-*.test.ts`, and the live-database tests
`upload-folder-tree`, `upload-item-safety`, `upload-quota-charge` in
`app/.server/__tests__/`.
