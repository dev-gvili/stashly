# XState Machines — Overview

This folder contains the XState machines that model complex client-side flows in Stashly. The project uses an actor model pattern; there are manager/parent machines that spawn child machines (actors) for fine-grained control and parallelism.

This folder also holds several abandoned prototypes. Before editing anything here, check who imports it — several files that *look* canonical are dead, and two of them shadow the live implementation by name.

## Active machines

- `upload/upload.machine.ts`
  - Manager for overall upload lifecycle. Spawns per-file actors and controls concurrency (`maxConcurrentUploads`).
  - Maintains a `mediaFiles` map and a `queues` structure; handles `upload.config`, `upload.add`, `upload.spawn`, `upload.start`, `upload.abort`, `upload.pause`/`resume`, `upload.done`, `upload.dismiss`, etc.
  - On `upload.done` it spawns a `db/db.machine.ts` per file and sends it `@db.item.create`; on `upload.createItem.success` it flips the file's status to `itemCreated`, and on `upload.createItem.error` to `itemFailed`. A file machine that ends in `error` before its bytes are stored sends `upload.failed`, which marks the file `failed` and frees its slot.
  - Instantiated once in `app/hooks/useUpload.ts` (`createActor(uploadMachine, { id: 'uploadManager' })`).

- `db/db.machine.ts` + `db/db.actors.ts` + `db/db.utils.ts`
  - Writes the `Item` row for a finished upload: `idle → hashing → building → posting → classifying`, ending in one of `created` / `refused` / `rejected` / `sessionExpired` / `failed`.
  - **No path throws.** A spawned actor's unhandled rejection stops its parent, so the promise actor this replaced took the whole upload manager down when one file failed. Every ending is an event, and the machine returns to `idle`.
  - `postItem` reads the response body as **text**, never JSON: `POST /api/items` answers an expired session with a redirect that `fetch` follows, so the client gets a 200 carrying the sign-in page. `toOutcome` tells that apart from a real failure.

- `thumbnail/` — makes a card's thumbnail when the card comes on screen: a scheduler with a memory lane (uploaded file still held) and a download lane, plus its per-item machine. Thumbnails only. See its README.

- `indexing/` — search indexing for every upload: metadata, chunk vectors, OCR for scanned PDFs. Its own FIFO queue, two at a time, queued by `upload-thumbnail-runner.tsx` at `itemCreated`. See its README.

- `reviset/file.machine.ts` — **the per-file actor.** This is the one `upload.machine.ts` imports (`import { fileMachine } from '../reviset/file.machine'`). Handles quota check, multipart create, chunked upload with pause/resume/abort, completion, and the quota update.

- `quota/quota.actors.ts` + `quota/quota.utils.ts` — `reviset/file.machine.ts` invokes `checkQuota` directly as its pre-upload check. Quota is charged and enforced on the server, in `createUploadedItem`.

- `multipart/*` — not a machine: the S3 multipart actors (`s3.mulipart.utils.ts`) and the worker-pool chunk uploader (`s3.multipart.stream.ts`, `s3.multipart.concurrent.ts`).

- `pipeline/pipeline.machine.ts` + `pipeline.actors.ts` — runs inside `app/workers/stash.worker.ts`; the only machine with unit tests today.

- `confirm.machine.ts` (via `app/utils/confirm.ts`), `onboard/onboard.machine.ts` (via `app/.server/onboard.ts`), `selection/selection.machine.ts` (via `app/components/stash/selection.tsx`), `session/sessionStorage.machine.ts` (`sessionService`, via `app/hooks/usePagination.ts`).

## Abandoned / unimported

Nothing imports these. They are kept in-tree but are not the code that runs:

- `upload/file.machine.ts` — **unused sibling of the active `reviset/file.machine.ts`.** Its import in `upload.machine.ts` sits commented out (line 15). Referenced only by the equally-dead `queue/queue.machine.1.ts`.
- `actors/multipart.machine.ts`, `actors/queue.machine.ts`, `actors/quota.machine.ts` — early prototypes; the live paths are `multipart/*` and `quota/quota.actors.ts`.
- `quota/quota.machine.ts` — read-only quota machine (`@quota.check` / `verify` / `find`). The upload manager spawned it until 2026-10-26, but nothing ever sent it an event; it is no longer spawned and is kept for a possible shared quota actor.
- `actors/Uploader.tsx` — imports `@/machines/actors/system.machine.1`, a file that does not exist.
- `queue/queue.machine.1.ts`, `reviset/queue.machine.ts` — concurrency-queue experiments; queueing lives in `upload.machine.ts`'s `queues` context instead.
- `ai/ai.machine.ts`, `ai/caption.machine.ts`, `subscription/subscription.machine.ts`, `sidebar/sidebar.machine.ts`, `pagination/infinite-scroll.machine.ts` — defined but not currently wired into any component or route.

Design notes and best practices:

- Keep machines focused and small: the manager machine should orchestrate and spawn worker actors but not manage fine-grained per-file logic.
- Use `spawn` to create an actor per file. Use actor id mapping to reference and send messages.
- Keep side-effecting logic (S3 uploads, API calls) in actions invoked by machines; consider extracting to separate service functions to keep machines testable.

Testing:

- Machines are suitable for unit tests by using the `xstate` test helpers — assert state transitions and ensure side-effect behavior can be mocked.
- Integration E2E tests should cover concurrency, upload aborts, chunk errors and retry behavior.

Locations to explore:

- `app/machines/upload/*` — the upload manager and file machine
- `app/machines/actors/*` — shared actor helper utilities
- `app/components/upload` — UI that binds to these machines via `xstate` hooks

Questions/Follow-ups:

- Add an example test harness or story showing the upload actor interactions.
- Document common events and the shape of message payloads between manager and file actors.
