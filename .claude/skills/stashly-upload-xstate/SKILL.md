---
name: stashly-upload-xstate
description: Stashly upload system (XState) — the parent/child actor pattern, S3 multipart flow, the itemCreated-vs-done creation gate, parentId derivation, post-upload pagination reset, and the AI machines. Load when working on file upload, the upload machines, or item creation from uploads in the Stashly repo.
---

# Stashly Upload Architecture (XState)

The upload system uses a parent-child actor pattern:
- `upload/upload.machine.ts` — parent, spawns one `file.machine` per file, manages the queue
- `reviset/file.machine.ts` — active upload actor: creates multipart upload, uploads chunks in parallel, verifies ETags
- `upload/file.machine.ts` — unused sibling (present but not imported by `upload.machine.ts`)
- `quota/quota.machine.ts` — spawned by the parent; tracks and enforces storage quota. `reviset/file.machine.ts` also invokes `checkQuota`/`updateQuota` from `quota/quota.actors.ts`.

Concurrency is gated **inside `upload.machine.ts` itself** via `maxConcurrentUploads` (default 100, see `schemas/machine.schemas.ts`) — there is no separate queue actor in the live path.

> Do not reach for `actors/queue.machine.ts`, `actors/quota.machine.ts`, `actors/multipart.machine.ts`, `queue/queue.machine.1.ts` or `reviset/queue.machine.ts` — they are abandoned prototypes with no importers. Editing them changes nothing at runtime.

Files upload via S3 multipart: frontend → `/api/s3/upload` → uploads directly to S3 bucket. **The `/api/s3/upload` route uses JSON body (`request.json()`) with an `action` discriminator — not form-encoded.**

**Item creation gate**: The thumbnail pipeline and `POST /api/items` must NOT fire on `status === 'done'` (S3 done, but DB row not yet written). Wait for `status === 'itemCreated'` — set by `markAsItemCreated` action in `upload.machine.ts` after `upload.createItem.success`. Firing on `'done'` causes FK violations on `Thumbnail.itemId`.

**`parentId` derivation**: the first segment of the S3 key is the destination folder ID, but the client does **not** decide the final parent. `createUploadedItem` (`.server/item-actions.ts`) splits the whole key: segment 0 is the root, the middle segments are the folder path, and the last is the filename. Any middle segments are resolved through `findOrCreateFolderPath` inside the same transaction, so the item is parented to the **leaf** folder.

Directory drops therefore keep their hierarchy: the browser sets `webkitRelativePath`, which is baked into the S3 key (`.server/s3.ts`, `utils/converters.ts`), and the intermediate folders are created server-side. (Older docs described these drops as flattened to the root — that gap is closed.)

**Post-upload pagination reset**: After `itemCreated`, call `navigate(location.pathname + location.search, { replace: true, state: { reset: true } })` to trigger `usePagination`'s reset detection. Do NOT use `useRevalidator` — it doesn't update `usePagination`.

## AI Machines

`app/machines/ai/` contains two actors — `ai.machine.ts` and `caption.machine.ts` — but **neither is imported anywhere**; they are abandoned experiments, not the live AI path. The running pipeline is `machines/pipeline/` plus the workers in `app/workers/`. Check the importers before assuming a machine under `app/machines/` is wired up.

AI API routes live under the `/api/ai/` prefix (see `app/routes.ts`).
