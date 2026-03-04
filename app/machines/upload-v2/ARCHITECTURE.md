/**
 * ARCHITECTURE DIAGRAM: Upload Flow V2 with Generic Queue
 * 
 * ┌─────────────────────────────────────────────────────────────────┐
 * │                  Upload Manager Machine                          │
 * │  (Config management, Actor spawning, Session lifecycle)         │
 * └────────────┬────────────────────────────────────────┬──────────┘
 *              │                                        │
 *              ▼                                        ▼
 *    ┌──────────────────┐                    ┌──────────────────┐
 *    │  Queue Machine   │                    │  Quota Machine   │
 *    │  (Orchestration) │                    │  (Validator)     │
 *    └────────┬─────────┘                    └──────────────────┘
 *             │
 *      ┌──────┴────────┐
 *      │               │
 *      ▼               ▼
 *   Pending      Validating (via quotaMachine)
 *      │               │
 *      │               ▼
 *      │          Allowed/Denied
 *      │               │
 *      └───────┬───────┘
 *              ▼
 *            Active (sendTo uploadWorkerMachine)
 *              │
 *         ┌────┴────┐
 *         ▼         ▼
 *      Success    Failed
 *         │         │
 *      Completed   Failed
 *
 * FLOW:
 * 1. Files added via @queue.add
 * 2. Queue transitions: pending → validating → active → completed/failed
 * 3. Validating: quotaMachine checks user quota
 * 4. Active: uploadWorkerMachine processes file upload (multipart)
 * 5. Progress: Updated in real-time
 * 6. Completion: Worker notifies queue of success/failure
 *
 * ADVANTAGES OVER V1:
 * - Generic queue handles all sequencing logic
 * - Clear separation: orchestration (queue) vs execution (worker)
 * - Validator is swappable (quota, virus scan, etc.)
 * - Worker machine is simpler, focused on single upload
 * - Better concurrent upload management
 * - Easier to add new validators or workers
 *
 * INTEGRATION POINTS:
 * - quotaMachine: Validates items (quota check)
 * - uploadWorkerMachine: Processes items (file upload)
 * - uploadQueueMachine: Orchestrates the flow
 * - uploadManagerMachine: Provides config and lifecycle
 */

export const UPLOAD_V2_ARCHITECTURE = `
Upload Flow V2: Queue-Based Architecture
=========================================

Key Machines:
1. uploadManagerMachine - Top-level controller
   - Spawns quota validator, worker, and queue
   - Manages configuration
   - Handles session lifecycle

2. uploadQueueMachineV2 - Orchestrator
   - Manages pending/validating/active/completed states
   - Enforces concurrency limits
   - Coordinates validator and worker

3. quotaMachine - Validator (existing, repurposed)
   - Checks user storage quota
   - Can be replaced with other validators
   - Responds with allowed/denied

4. uploadWorkerMachine - Worker (new, simplified)
   - Processes single file upload
   - Delegates to multipart machine
   - Notifies quota on completion

5. uploadPartsMachine - Multipart handler (existing, unchanged)
   - Handles S3 multipart upload
   - Manages chunks and ETags
   - Reports progress

Flow:
-----
User adds files
       ↓
@queue.add event
       ↓
Stored in pending queue
       ↓
validation.request raised
       ↓
quotaMachine checks quota
       ↓
validation.result (allowed/denied)
       ↓
If allowed: sendTo worker with process event
If denied: Move to failed
       ↓
uploadWorkerMachine starts upload
       ↓
@multipart.upload.progress events
       ↓
@multipart.upload.done event
       ↓
Complete multipart upload
       ↓
worker.success/worker.failure event to queue
       ↓
Move to completed/failed
       ↓
checkQueue processes next pending item

Event Types:
-----------
Queue Events:
- @queue.add: Add file to queue
- validation.request: Request quota check (internal)
- validation.result: Quota decision (from validator)
- worker.success: Upload completed (from worker)
- worker.failure: Upload failed (from worker)
- @queue.cancel: Cancel upload

Worker Events:
- process: Start upload (from queue)
- @multipart.upload.progress: Upload progress
- @multipart.upload.done: Parts uploaded
- @multipart.upload.aborted: User abort
- abort: Request abort (from manager)

Quota Events:
- @quota.check: Check quota (from queue)
- @quota.update: Update quota (from worker)

Guards:
------
- allowed: Check validation result
- denied: Check validation result
- hasValidator: Config has validator
- hasWorker: Config has worker
`

export const COMPARISON = `
V1 vs V2 Architecture
=====================

V1 (Current):
- uploadMachine spawns fileMachine for each file
- fileMachine manages multipart upload directly
- No explicit queue management
- Parent-child for each file
- Progress bubbles up via events
- Concurrency handled via manual guards

V2 (Queue-based):
- uploadManagerMachine spawns queue, quota, worker
- Queue orchestrates file processing
- Explicit queue states: pending/validating/active/completed
- Pool of workers (or single worker with queuing)
- Validator intercepts before work starts
- Concurrency managed by queue machine

Pros of V2:
✓ Cleaner separation of concerns
✓ Generic queue reusable for other workflows
✓ Swappable validators
✓ Better error isolation
✓ Easier to add retry logic
✓ Statistics built-in (queue tracks counts)
✓ No need for parent-child actor management per file

Cons of V2:
- More indirection (queue → validator → worker)
- Slightly more verbose event passing
- Worker machine is less feature-rich initially
`
