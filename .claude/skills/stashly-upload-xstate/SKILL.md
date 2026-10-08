---
name: stashly-upload-xstate
description: Stashly upload system (XState) — the parent/child actor pattern, S3 multipart flow, the itemCreated-vs-done creation gate, parentId derivation, post-upload pagination reset, and the AI machines. Load when working on file upload, the upload machines, or item creation from uploads in the Stashly repo.
---

# Stashly Upload Architecture (XState)

The upload system uses a parent-child actor pattern:
- `upload/upload.machine.ts` — parent, spawns one `file.machine` per file, manages the queue
- `reviset/file.machine.ts` — active upload actor: creates multipart upload, uploads chunks in parallel, verifies ETags
- `upload/file.machine.ts` — unused sibling (present but not imported by `upload.machine.ts`)
- `quota/quota.machine.ts` — spawned by the parent; tracks and enforces storage quota. `reviset/file.machine.ts` also invokes `checkQuota` from `quota/quota.actors.ts` as the pre-upload gate.

**Quota is charged on the server, in `createUploadedItem`, nowhere else**: `onItemsUploaded` is the last statement of the transaction that creates the `Item`, so the row and the charge commit together or not at all (a user with no `Quota` row gets no row). No client code charges quota: `dbMachine` has no quota state, and `/api/quota` is read-only — `items-uploaded` and the other write actions answer 400. Do not add a client-side charge back. History: until 2026-09-27 both the file machine and `createUploadedItem` charged (twice per upload); `c6751b2` then kept a client charge in `dbMachine` (`chargingQuota`/`retryingQuota`), which a client could skip or forge; 2026-10-08 moved it back into the transaction. Test fixtures that call `createUploadedItem` need a `Quota` row for the uploader (see `upload-quota-charge.test.ts`).

Concurrency is gated **inside `upload.machine.ts` itself** via `maxConcurrentUploads` (default 100, see `schemas/machine.schemas.ts`) — there is no separate queue actor in the live path.

> Do not reach for `actors/queue.machine.ts`, `actors/quota.machine.ts`, `actors/multipart.machine.ts`, `queue/queue.machine.1.ts` or `reviset/queue.machine.ts` — they are abandoned prototypes with no importers. Editing them changes nothing at runtime.

Files upload via S3 multipart: frontend → `/api/s3/upload` → uploads directly to S3 bucket. **The `/api/s3/upload` route uses JSON body (`request.json()`) with an `action` discriminator — not form-encoded.**

**Item creation runs in its own machine**: `machines/db/db.machine.ts`, spawned per file by `triggerItemCreation` on `upload.done`. It never throws — a spawned actor's unhandled rejection **stops the parent**, which is how one failed file used to cost a whole batch its rows. It answers `upload.createItem.success` or `upload.createItem.error` on every path. A failure sets status **`itemFailed`**, not `done`: the bytes are in S3 but the row is not, and the panel renders it as "failed" with the reason in a tooltip. Note `POST /api/items` answers an expired session with `throw redirect('/auth/sign-in')` and `fetch` follows redirects, so the client sees a **200 carrying HTML** — `postItem` reads the body as text and `toOutcome` classifies it, rather than letting `res.json()` throw.

**Item creation gate**: The thumbnail pipeline and `POST /api/items` must NOT fire on `status === 'done'` (S3 done, but DB row not yet written). Wait for `status === 'itemCreated'` — set by `markAsItemCreated` action in `upload.machine.ts` after `upload.createItem.success`. Firing on `'done'` causes FK violations on `Thumbnail.itemId`.

**`parentId` derivation**: the first segment of the S3 key is the destination folder ID, but the client does **not** decide the final parent. `createUploadedItem` (`.server/item-actions.ts`) splits the whole key: segment 0 is the root, the middle segments are the folder path, and the last is the filename. Any middle segments are resolved through `findOrCreateFolderPath` inside the same transaction, so the item is parented to the **leaf** folder.

**Access is checked before any bytes move.** `assertCanUploadTo(userId, key)` (`write` on segment 0) runs in `/api/s3/upload` at `create-multipart-upload` and again at `complete-multipart-upload`, where a refusal aborts the multipart upload so S3 drops the parts. A refusal answers `{ error }` with its status; `readUploadResponse` in `s3.mulipart.utils.ts` throws that text. Part signing is not checked (one query per part).

**A file that fails before its bytes are stored reports it.** The file machine's `error` state (quota check, create or complete failed) sends `upload.failed { mediaFile, error }`. The manager marks the file **`failed`** (distinct from `itemFailed`: no bytes stay in S3), keeps the reason on `error`, frees its slot and starts the next pending file. Before this the file held its `queues.active` slot for good, and after `maxConcurrentUploads` failures nothing else could start. The panel shows both failure statuses as "failed" in the same colour as every other status, with the reason in a tooltip. Test: `app/machines/upload/__tests__/upload-failed.test.ts`.

**Filing never guesses, and a refusal cleans up.** `createUploadedItem` requires `write` access to segment 0 as the *session* user (the route ignores the form's `ownerId`). On the path, a trashed folder never matches, and two live folders with the same name refuse the file with a 409 that says which name and where, instead of picking one. When the row can't be created, the route calls `discardUploadedObject`, which deletes the bytes only if no `File` row points at them, and only in the user's own bucket (read from their row; the `default-bucket` placeholder counts as none). It does not require folder access, so a revoke mid-upload still cleans up. The route also files with the session's bucket, not the form's. Nothing retries a refused row, so without it the object stays in S3 for good. Tests: `app/.server/__tests__/upload-item-safety.test.ts`.

Directory drops therefore keep their hierarchy: the browser sets `webkitRelativePath`, which is baked into the S3 key (`.server/s3.ts`, `utils/converters.ts`), and the intermediate folders are created server-side. (Older docs described these drops as flattened to the root — that gap is closed.)

**Post-upload pagination reset**: After `itemCreated`, call `navigate(location.pathname + location.search, { replace: true, state: { reset: true } })` to trigger `usePagination`'s reset detection. Do NOT use `useRevalidator` — it doesn't update `usePagination`.

## AI Machines

There is no `app/machines/ai/` any more: its two unwired experiments (`ai.machine.ts`, `caption.machine.ts`) were deleted in `9133214`. The running pipeline is `machines/pipeline/` plus the workers in `app/workers/` (all inference funnels through `ai-queue.ts`). Check the importers before assuming a machine under `app/machines/` is wired up.

AI API routes live under the `/api/ai/` prefix (see `app/routes.ts`).
