/**
 * Visual comparison and flow diagrams for V1 vs V2
 */

export const V1_V2_COMPARISON = `
┌─────────────────────────────────────────────────────────────────────────────┐
│                        ARCHITECTURE COMPARISON                              │
└─────────────────────────────────────────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════════════════════
V1 ARCHITECTURE: Parent-Child with Direct Multipart
═══════════════════════════════════════════════════════════════════════════════

                         ┌─────────────────────┐
                         │  uploadMachine      │
                         │  (Parent)           │
                         └──────────┬──────────┘
                                    │
                 ┌──────────────────┼──────────────────┐
                 │                  │                  │
                 ▼                  ▼                  ▼
            ┌────────────┐    ┌────────────┐    ┌────────────┐
            │ fileMachine│    │ fileMachine│    │ fileMachine│
            │  (Child 1) │    │  (Child 2) │    │  (Child N) │
            └─────┬──────┘    └─────┬──────┘    └─────┬──────┘
                  │                 │                 │
        ┌─────────┴─────────┐       │       ┌─────────┴──────────┐
        │                   │       │       │                    │
        ▼                   ▼       ▼       ▼                    ▼
   ┌─────────┐         ┌────────┐  ...  ┌─────────┐        ┌────────┐
   │ multipart│         │ quota  │      │ multipart│       │ quota  │
   │ create   │         │ notify │      │ create   │       │ notify │
   └────┬────┘         └────────┘      └─────┬────┘       └────────┘
        │                                      │
        ▼                                      ▼
   ┌──────────────┐                    ┌──────────────┐
   │ S3 upload    │                    │ S3 upload    │
   │ (parallel)   │                    │ (parallel)   │
   └──────────────┘                    └──────────────┘

Flow:
1. Upload.add → spawn fileMachine per file
2. fileMachine init → createUpload
3. fileMachine uploading → uploadParts
4. fileMachine completing → completeUpload
5. fileMachine success → sendParent progress.change
6. Parent tracks all files in mediaFiles map

Issues:
- Many actors spawned (one per file)
- Each file independently manages quota
- No explicit queue or concurrency control
- Progress bubbles up per file
- Hard to see global upload state


═══════════════════════════════════════════════════════════════════════════════
V2 ARCHITECTURE: Queue-Orchestrated with Generic Workers
═══════════════════════════════════════════════════════════════════════════════

     ┌───────────────────────────────────────┐
     │    uploadManagerMachine               │
     │    (Config & Lifecycle)               │
     └────────────┬────────────────┬────┬────┘
                  │                │    │
          ┌───────▼────┐    ┌──────▼──┐ └────┬────────┐
          │ spawn quota│    │spawn    │      │        │
          │ machine    │    │ worker  │      │        │
          └────┬───────┘    └────┬────┘      │        │
               ▼                 ▼           ▼        ▼
         ┌─────────────┐  ┌────────────┐ ┌──────────────────┐
         │ quotaMachine│  │ uploadWorker│ │uploadQueueMachine│
         │(Validator)  │  │(Worker)    │ │(Orchestrator)    │
         └─────────────┘  └────────────┘ └──────────────────┘
                                               │
                        ┌──────────────────────┼──────────────────┐
                        │                      │                  │
                     pending            validating            active
                        │                      │                  │
                        ├──────────────────────┤                  │
                        │                      ▼                  │
                        │              quotaMachine               │
                        │              (validates)               │
                        │                      │                  │
                        │             allowed/denied              │
                        │                      │                  │
                        └──────────┬───────────┘                  │
                                   │ denied                      │
                                   ▼                              │
                                 failed                          │
                                                    allowed       │
                                                      │           │
                                                      ▼           │
                                              uploadWorkerMachine │
                                              (processes)         │
                                                      │           │
                                    ┌─────────────────┴───────┐  │
                                    │                         │  │
                                    ▼                         ▼  ▼
                              ┌──────────────┐        ┌───────────────┐
                              │ multipart    │        │  success/     │
                              │ upload       │        │  failure      │
                              └──────────────┘        └─────┬─────────┘
                                                            │
                                                    ┌───────┴────────┐
                                                    │                │
                                                    ▼                ▼
                                              completed          failed

Flow:
1. @queue.add → stored in pending
2. checkQueue → move to validating
3. quotaMachine.check → allowed/denied
4. If allowed: sendTo worker
5. uploadWorkerMachine processes (multipart)
6. worker.success/failure → move to completed/failed
7. checkQueue → process next pending


═══════════════════════════════════════════════════════════════════════════════
STATE TRANSITIONS COMPARISON
═══════════════════════════════════════════════════════════════════════════════

V1 File States:
pending ─┐
         ├─→ uploading ─→ done
         └─→ aborted

V2 Queue States:
pending ─→ validating ─┬─→ active ─→ completed
                       └─→ failed


═══════════════════════════════════════════════════════════════════════════════
EVENT FLOW COMPARISON
═══════════════════════════════════════════════════════════════════════════════

V1 ADD FILE:
upload.add
     ↓
addFile action
     ↓
mediaFiles.set(id, mediaFile)
     ↓
upload.spawn raised
     ↓
spawnAndAssign action
     ↓
fileMachine spawned


V2 ADD FILE:
@queue.add
     ↓
addItemToPending action
     ↓
items.set(id, item)
pending.add(id)
     ↓
checkQueue action
     ↓
validation.request raised
     ↓
sendToValidator action
     ↓
quotaMachine.check called


═══════════════════════════════════════════════════════════════════════════════
CONCURRENCY MANAGEMENT
═══════════════════════════════════════════════════════════════════════════════

V1:
- Uses guards: concurrentLessThenMax
- Checks: queues.active.size < maxConcurrentUploads
- Manual queue management in parent
- Each file increments active count

V2:
- Queue machine enforces limits
- Calculates slotsAvailable = maxConcurrency - active.size - validating.size
- Automatic slot allocation
- Files wait in pending until slot available
- More explicit and manageable


═══════════════════════════════════════════════════════════════════════════════
ERROR HANDLING
═══════════════════════════════════════════════════════════════════════════════

V1:
- fileMachine.error state (final)
- Errors stored in context
- Parent aware via sendParent

V2:
- quotaMachine can deny (validation error)
- uploadWorkerMachine can fail
- Both move items to failed set
- Queue can retry logic in future
- Parent error handling via manager


═══════════════════════════════════════════════════════════════════════════════
QUOTA INTEGRATION
═══════════════════════════════════════════════════════════════════════════════

V1:
- fileMachine init state invokes createUpload (includes quota check)
- If quota exceeded, upload fails
- No pre-check, waste of worker time

V2:
- Queue validation phase checks quota BEFORE worker
- quotaMachine rejects if exceeded
- Failed items never reach worker
- Better resource utilization
- Cleaner separation


═══════════════════════════════════════════════════════════════════════════════
PROGRESS TRACKING
═══════════════════════════════════════════════════════════════════════════════

V1:
- fileMachine sends progress.change to parent
- Parent updates mediaFiles[id].progress
- Per-file granular tracking
- Parent must aggregate for stats

V2:
- Queue tracks queue.stats: { pending, validating, active, completed, failed }
- Worker progress via context
- Global view available
- Built-in statistics
- Easy to show overall progress bar


═══════════════════════════════════════════════════════════════════════════════
MEMORY & PERFORMANCE
═══════════════════════════════════════════════════════════════════════════════

V1:
- Actor per file: O(n) where n = files
- Many sendParent calls
- Parent context grows with files
- GC pressure if many files

V2:
- Single queue + worker
- Actor count constant: 3 (manager, queue, worker)
- Queue stores items (small objects)
- Better scalability
- Lighter on memory


═══════════════════════════════════════════════════════════════════════════════
EXTENSIBILITY
═══════════════════════════════════════════════════════════════════════════════

V1:
- Hard to add validators
- Quota check tied to fileMachine
- Would need to modify fileMachine for virus scan, etc.

V2:
- Swappable validator
- Pass different quota/scan machine
- Queue can coordinate multiple validators
- Worker pattern reusable for other tasks
- Generic architecture
`

export default V1_V2_COMPARISON
