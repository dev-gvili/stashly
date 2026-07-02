---
name: stashly-upload-xstate
description: Stashly upload system (XState) — the parent/child actor pattern, S3 multipart flow, the itemCreated-vs-done creation gate, parentId derivation, post-upload pagination reset, and the AI machines. Load when working on file upload, the upload machines, or item creation from uploads in the Stashly repo.
---

# Stashly Upload Architecture (XState)

The upload system uses a parent-child actor pattern:
- `upload/upload.machine.ts` — parent, spawns one `file.machine` per file, manages the queue
- `reviset/file.machine.ts` — active upload actor: creates multipart upload, uploads chunks in parallel, verifies ETags
- `upload/file.machine.ts` — unused sibling (present but not imported by `upload.machine.ts`)
- `actors/queue.machine.ts` — controls concurrent upload slots
- `actors/quota.machine.ts` — tracks and enforces storage quota
- `actors/multipart.machine.ts` — multipart S3 coordination actor

Files upload via S3 multipart: frontend → `/api/s3/upload` → uploads directly to S3 bucket. **The `/api/s3/upload` route uses JSON body (`request.json()`) with an `action` discriminator — not form-encoded.**

**Item creation gate**: The thumbnail pipeline and `POST /api/items` must NOT fire on `status === 'done'` (S3 done, but DB row not yet written). Wait for `status === 'itemCreated'` — set by `markAsItemCreated` action in `upload.machine.ts` after `upload.createItem.success`. Firing on `'done'` causes FK violations on `Thumbnail.itemId`.

**`parentId` derivation**: `mediaFile.key.split('/')[0]` — the first segment of the S3 key is always the destination folder ID. Exception: directory drops get `parentId = rootId` (nested folders are not created — known gap).

**Post-upload pagination reset**: After `itemCreated`, call `navigate(location.pathname + location.search, { replace: true, state: { reset: true } })` to trigger `usePagination`'s reset detection. Do NOT use `useRevalidator` — it doesn't update `usePagination`.

## AI Machines

`app/machines/ai/` contains two actors:
- `ai.machine.ts` — coordinates AI inference jobs
- `caption.machine.ts` — generates captions for media items

AI API routes live under the `/api/ai/` prefix (see `app/routes.ts`).
