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

**Quota is charged in `dbMachine`, nowhere else**: its `chargingQuota` state (with `retryingQuota` backoff) runs `updateQuota` (`items-uploaded`) only after the POST returned a row. Every other ending (refused/rejected/sessionExpired/failed) skips it, so an `itemFailed` file is never billed. Do not add a charge back to `file.machine.ts` or to `createUploadedItem` — both existed until 2026-09-27 and billed every upload twice.

Concurrency is gated **inside `upload.machine.ts` itself** via `maxConcurrentUploads` (default 100, see `schemas/machine.schemas.ts`) — there is no separate queue actor in the live path.

> Do not reach for `actors/queue.machine.ts`, `actors/quota.machine.ts`, `actors/multipart.machine.ts`, `queue/queue.machine.1.ts` or `reviset/queue.machine.ts` — they are abandoned prototypes with no importers. Editing them changes nothing at runtime.

Files upload via S3 multipart: frontend → `/api/s3/upload` → uploads directly to S3 bucket. **The `/api/s3/upload` route uses JSON body (`request.json()`) with an `action` discriminator — not form-encoded.**

**Item creation runs in its own machine**: `machines/db/db.machine.ts`, spawned per file by `triggerItemCreation` on `upload.done`. It never throws — a spawned actor's unhandled rejection **stops the parent**, which is how one failed file used to cost a whole batch its rows. It answers `upload.createItem.success` or `upload.createItem.error` on every path. A failure sets status **`itemFailed`**, not `done`: the bytes are in S3 but the row is not, and the panel renders it as "failed" with the reason in a tooltip. Note `POST /api/items` answers an expired session with `throw redirect('/auth/sign-in')` and `fetch` follows redirects, so the client sees a **200 carrying HTML** — `postItem` reads the body as text and `toOutcome` classifies it, rather than letting `res.json()` throw.

**Item creation gate**: The thumbnail pipeline and `POST /api/items` must NOT fire on `status === 'done'` (S3 done, but DB row not yet written). Wait for `status === 'itemCreated'` — set by `markAsItemCreated` action in `upload.machine.ts` after `upload.createItem.success`. Firing on `'done'` causes FK violations on `Thumbnail.itemId`.

**`parentId` derivation**: the first segment of the S3 key is the destination folder ID, but the client does **not** decide the final parent. `createUploadedItem` (`.server/item-actions.ts`) splits the whole key: segment 0 is the root, the middle segments are the folder path, and the last is the filename. Any middle segments are resolved through `findOrCreateFolderPath` inside the same transaction, so the item is parented to the **leaf** folder.

**Filing never guesses, and a refusal cleans up.** `createUploadedItem` requires `write` access to segment 0 as the *session* user (the route ignores the form's `ownerId`). On the path, a trashed folder never matches, and two live folders with the same name refuse the file with a 409 that says which name and where, instead of picking one. When the row can't be created, the route calls `discardUploadedObject`, which deletes the bytes only if no `File` row points at them, and only in the user's own bucket (read from their row; the `default-bucket` placeholder counts as none). It does not require folder access, so a revoke mid-upload still cleans up. The route also files with the session's bucket, not the form's. Nothing retries a refused row, so without it the object stays in S3 for good. Tests: `app/.server/__tests__/upload-item-safety.test.ts`.

Directory drops therefore keep their hierarchy: the browser sets `webkitRelativePath`, which is baked into the S3 key (`.server/s3.ts`, `utils/converters.ts`), and the intermediate folders are created server-side. (Older docs described these drops as flattened to the root — that gap is closed.)

**Post-upload pagination reset**: After `itemCreated`, call `navigate(location.pathname + location.search, { replace: true, state: { reset: true } })` to trigger `usePagination`'s reset detection. Do NOT use `useRevalidator` — it doesn't update `usePagination`.

## AI Machines

`app/machines/ai/` contains two actors — `ai.machine.ts` and `caption.machine.ts` — but **neither is imported anywhere**; they are abandoned experiments, not the live AI path. The running pipeline is `machines/pipeline/` plus the workers in `app/workers/`. Check the importers before assuming a machine under `app/machines/` is wired up.

AI API routes live under the `/api/ai/` prefix (see `app/routes.ts`).
