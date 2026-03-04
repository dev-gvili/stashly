# XState Machines — Overview

This folder contains the XState machines that model complex client-side flows in Stashly. The project uses an actor model pattern; there are manager/parent machines that spawn child machines (actors) for fine-grained control and parallelism.

Key machines and their responsibilities:

- `upload/upload.machine.ts`
  - Manager for overall upload lifecycle. Spawns `file.machine` actors and controls concurrency.
  - Maintains a `mediaFiles` map and a `queues` structure; handles `upload.start`, `upload.add`, `upload.abort`, etc.

- `upload/file.machine.ts`
  - Per-file actor machine. Handles chunked upload, retries, progress, and aborting.

- `queue/*`, `actors/*`
  - Queue management and actor utility helpers for scheduling uploads and other background processes.

- `quota/*`
  - Quota machine for tracking workspace/user quota and enforcing limits while uploading.

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
