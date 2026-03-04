/**
 * ASCII diagrams and visual representations of the V2 upload flow
 */

export const DIAGRAMS = `
╔════════════════════════════════════════════════════════════════════════════╗
║           UPLOAD V2: QUEUE-BASED ARCHITECTURE VISUAL GUIDE                ║
╚════════════════════════════════════════════════════════════════════════════╝


┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. OVERALL SYSTEM ARCHITECTURE                                              │
└─────────────────────────────────────────────────────────────────────────────┘

                        ┌──────────────────────────┐
                        │ uploadManagerMachine     │
                        │ (Config + Lifecycle)     │
                        └────────────┬─────────────┘
                                     │
                  ┌──────────────────┼──────────────────┐
                  │                  │                  │
                  ▼                  ▼                  ▼
        ┌──────────────────┐ ┌──────────────┐ ┌──────────────────┐
        │ quotaMachine     │ │ uploadWorker │ │ uploadQueueMachine
        │ (Validator)      │ │ (Worker)     │ │ (Orchestrator)   │
        └──────────────────┘ └──────────────┘ └──────────────────┘
                ▲                   ▲                  │
                │                   │                  │
                └───────────────────┴──────────────────┘
                   Communication via events


┌─────────────────────────────────────────────────────────────────────────────┐
│ 2. QUEUE STATE MACHINE LIFECYCLE                                            │
└─────────────────────────────────────────────────────────────────────────────┘

Initial: []  (empty)

@queue.add { item: { id, size } }
           │
           ▼
       pending: [1]  ← Item stored

checkQueue()  ← Automatic after state change
           │
           ▼
       pending: [1]  → validating.add(1)
       validating: [1]

quotaMachine @quota.check  ← Asks quota validator
           │
           ▼
       validation.result { itemId: 1, result: 'allowed' }
           │
           ├─ allowed → validating.delete(1) → active.add(1)
           │           sendTo worker { type: 'process' }
           │
           │ Upload happens in worker...
           │ worker.success event sent to queue
           │
           ▼
       active: [1] → active.delete(1) → completed.add(1)

           OR

       ├─ denied → validating.delete(1) → failed.add(1)
           │
           ▼
       failed: [1]


┌─────────────────────────────────────────────────────────────────────────────┐
│ 3. WORKER STATE MACHINE LIFECYCLE                                           │
└─────────────────────────────────────────────────────────────────────────────┘

idle
  │
  process event (from queue)
  │
  ▼
creating ─→ @s3.multipart.create
  │           │
  ├─ success ──→ SAVE_UPLOAD_ID
  │           │
  └─ error ───→ SAVE_ERROR → error state
               │
               ▼
          uploading ─→ START_UPLOAD_SERVICE
             │        │
             ├─ @multipart.upload.progress ─→ UPDATE_PROGRESS
             │        │
             ├─ @multipart.upload.done ───→ completingUpload
             │        │                      │
             └─ abort ──────────────────────→ ABORT_UPLOAD
                      │
                      ▼
                 completingUpload ─→ completeUpload()
                      │
                      ├─ success ─→ UPDATE_MEDIAFILE → success
                      │
                      └─ error ──→ SAVE_ERROR → error


┌─────────────────────────────────────────────────────────────────────────────┐
│ 4. FILE LIFECYCLE THROUGH QUEUE                                             │
└─────────────────────────────────────────────────────────────────────────────┘

User selects file.jpg (5MB)
│
├─ Generate ID: "file-123"
├─ Calculate size: 5000000 bytes = 5000000n
│
▼ Send event
queueSend({
  type: '@queue.add',
  item: { id: 'file-123', size: 5000000n }
})

│
├─ Queue stores in items map
├─ Queue adds 'file-123' to pending set
├─ Queue stats updated: { pending: 1, validating: 0, active: 0, ... }
│
▼ checkQueue automatically runs

│
├─ Calculate available slots: 5 (max) - 0 (active) - 0 (validating) = 5
├─ Pending items: 1
├─ Can process 5, have 1, so: process 1
│
▼ Raise validation.request

│
├─ Move file-123: pending → validating
├─ Send to quotaMachine: { @quota.check, itemId, dataSize: 5000000n }
├─ Queue stats updated: { pending: 0, validating: 1, active: 0, ... }
│
▼ quotaMachine checks user quota

│
├─ User quota: 100GB total, 80GB used, 20GB remaining
├─ File size: 5MB
├─ 20GB > 5MB? Yes → allowed
├─ Return: { validation.result, itemId: 'file-123', result: 'allowed' }
│
▼ Queue receives allowed

│
├─ Move file-123: validating → active
├─ Send to uploadWorkerMachine: { process, item: { ... } }
├─ Queue stats updated: { pending: 0, validating: 0, active: 1, ... }
│
▼ uploadWorkerMachine starts work

│
├─ Worker state: idle → creating
├─ Invoke createUpload (API call to backend)
├─ Receive uploadId: "upload-abc-123"
│
▼ Worker transitions to uploading

│
├─ Spawn S3 multipart upload service
├─ Start uploading chunks (Parts 1, 2, 3...)
├─ Emit progress events: 10%, 25%, 50%, 75%, 90%, 100%
│ (These could be sent back to UI for progress bar)
│
▼ All parts uploaded

│
├─ Worker transitions to completingUpload
├─ Invoke completeUpload with all ETags
├─ Receive confirmation from S3
│
▼ Worker transitions to success

│
├─ Send worker.success to queue
├─ Queue moves file-123: active → completed
├─ Queue stats updated: { pending: 0, validating: 0, active: 0, completed: 1 }
├─ checkQueue looks for more pending items
│
▼ Done!

File successfully uploaded and quota updated.


┌─────────────────────────────────────────────────────────────────────────────┐
│ 5. CONCURRENT UPLOADS EXAMPLE                                              │
└─────────────────────────────────────────────────────────────────────────────┘

Config: maxConcurrency = 3

Timeline:

T0: User adds files
    @queue.add { item: { id: '1', size: 5MB } }
    @queue.add { item: { id: '2', size: 3MB } }
    @queue.add { item: { id: '3', size: 7MB } }
    @queue.add { item: { id: '4', size: 2MB } }
    @queue.add { item: { id: '5', size: 4MB } }
    │
    Queue: pending: [1,2,3,4,5], active: [], stats.pending=5

T0: checkQueue runs
    Slots: 3 - 0 - 0 = 3 available
    Process: files 1, 2, 3
    │
    Queue: pending: [4,5], validating: [1,2,3], stats.pending=2, stats.validating=3

T1: Quota validates files 1, 2
    ✓ File 1: allowed  → active: [1]
    ✓ File 2: allowed  → active: [1, 2]
    │
    Queue: validating: [3], active: [1,2]

T1: File 3 quota check completes
    ✓ File 3: allowed → active: [1, 2, 3]
    │
    Queue: validating: [], active: [1,2,3], stats.active=3

T2-T5: Files 1, 2, 3 uploading in parallel
    File 1: 10%, 20%, 30%, 40%, 50%, 60%, 70%, 80%, 90%, 100% ✓
    File 2: 10%, 20%, 30%, 40%, 50%, 60%, 70%, 80%, 90%, 100% ✓
    File 3: 10%, 20%, 30%, 40%, 50%, 60%, 70%, 80%, 90%, 100% ✓
    │
    Files complete: worker.success for 1, 2, 3

T6: Files 1, 2, 3 complete
    active: [1,2,3] → completed: [1,2,3]
    Slots freed: 3
    │
    checkQueue runs with pending: [4,5]

T6: Files 4, 5 start processing
    pending: [4,5] → validating: [4,5]
    Quota validates 4, 5
    │
    active: [4,5]

T7-T10: Files 4, 5 uploading
    ...

T11: All complete
    completed: [1,2,3,4,5]
    Queue idle, waiting for more files


┌─────────────────────────────────────────────────────────────────────────────┐
│ 6. QUOTA DENIAL EXAMPLE                                                     │
└─────────────────────────────────────────────────────────────────────────────┘

User has 1GB remaining quota

Files added:
  file-1: 300MB
  file-2: 400MB
  file-3: 500MB

Timeline:

T0: All added
    Queue: pending: [1,2,3]

T1: checkQueue → validate all 3
    Queue: validating: [1,2,3]

T2: Quota checks file-1 (300MB)
    Quota: 1GB remaining, need 300MB
    Check: 1GB > 300MB? Yes → allowed
    │
    Result: allowed
    Queue: active: [1], validating: [2,3]

T3: Quota checks file-2 (400MB)
    Quota: 1GB - 300MB = 700MB remaining, need 400MB
    Check: 700MB > 400MB? Yes → allowed
    │
    Result: allowed
    Queue: active: [1,2], validating: [3]

T4: Quota checks file-3 (500MB)
    Quota: 700MB - 400MB = 300MB remaining, need 500MB
    Check: 300MB > 500MB? No → denied
    │
    Result: denied
    Queue: active: [1,2], failed: [3]

T5: checkQueue runs
    pending: [], nothing more to process

Result:
- Files 1, 2: Uploading
- File 3: In failed set (quota exceeded)
- UI shows: "Storage exceeded. Please upgrade or delete files."


┌─────────────────────────────────────────────────────────────────────────────┐
│ 7. EVENT FLOW DIAGRAM                                                       │
└─────────────────────────────────────────────────────────────────────────────┘

User          Queue           Quota          Worker        S3
 │             │               │               │             │
 ├─ @queue.add─→               │               │             │
 │             ├─ pending.add  │               │             │
 │             ├─ checkQueue   │               │             │
 │             ├─ validation.req──→            │             │
 │             │               ├─ quota check  │             │
 │             │               ├─ allowed/denied            │
 │             │             ←─┤               │             │
 │             ├─ validating→active            │             │
 │             ├─ process ────────────────→    │             │
 │             │               │         ├─ idle→creating    │
 │             │               │         ├─ createUpload─────→
 │             │               │         │                   ├─ uploadId
 │             │               │         │                 ←─┤
 │             │               │         ├─ uploading        │
 │             │               │         ├─ uploadParts──────→
 │             │               │         │      ↓ progress   │
 │◄─────────────────────────────────────┤◄─────┤            │
 │ progress update                      │      ↓            │
 │             │               │         ├─ 100% complete    │
 │             │               │         ├─ completingUpload │
 │             │               │         ├─ completeUpload───→
 │             │               │         │                   ├─ etag
 │             │               │         │                 ←─┤
 │             ├─ worker.success←─────────┤                   │
 │             ├─ completed.add │         │                   │
 │             ├─ checkQueue    │         │                   │
 │             │               │         │                   │
 │             ├─ @quota.update─→                            │
 │             │               ├─ quota updated
 │             │               ├─ send notification
 │◄─────────────────────────────┤                            │
 │ "Upload complete!"           │         │                   │
 │


┌─────────────────────────────────────────────────────────────────────────────┐
│ 8. CONTEXT STRUCTURE AT DIFFERENT TIMES                                     │
└─────────────────────────────────────────────────────────────────────────────┘

Initial:
uploadQueueContext = {
  items: Map {},
  pending: Set [],
  validating: Set [],
  active: Set [],
  completed: Set [],
  failed: Set [],
  stats: { pending: 0, validating: 0, active: 0, completed: 0, failed: 0 }
}

After @queue.add { item: { id: '1', size: 5MB } }:
uploadQueueContext = {
  items: Map { '1' → { id: '1', size: 5000000n } },
  pending: Set ['1'],
  validating: Set [],
  active: Set [],
  completed: Set [],
  failed: Set [],
  stats: { pending: 1, validating: 0, active: 0, completed: 0, failed: 0 }
}

After validation.result { itemId: '1', result: 'allowed' }:
uploadQueueContext = {
  items: Map { '1' → { ... } },
  pending: Set [],
  validating: Set [],
  active: Set ['1'],
  completed: Set [],
  failed: Set [],
  stats: { pending: 0, validating: 0, active: 1, completed: 0, failed: 0 }
}

After worker.success { itemId: '1' }:
uploadQueueContext = {
  items: Map { '1' → { ... } },
  pending: Set [],
  validating: Set [],
  active: Set [],
  completed: Set ['1'],
  failed: Set [],
  stats: { pending: 0, validating: 0, active: 0, completed: 1, failed: 0 }
}


╔════════════════════════════════════════════════════════════════════════════╗
║                             END OF DIAGRAMS                               ║
╚════════════════════════════════════════════════════════════════════════════╝
`

export default DIAGRAMS
