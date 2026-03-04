/**
 * FOLDER STRUCTURE CREATED
 * 
 * p:\Projects\stashly\app\machines\upload-v2\
 */

export const FOLDER_STRUCTURE = `
📁 upload-v2/
├── 📄 upload-manager.machine.ts
│   └── Top-level upload manager
│       - Spawns quota, worker, and queue machines
│       - Manages configuration
│       - Handles session lifecycle
│
├── 📄 upload-queue.machine.ts
│   └── Generic queue orchestrator
│       - Manages: pending → validating → active → completed/failed
│       - Enforces concurrency limits
│       - Coordinates validator (quota) and worker
│       - Includes checkQueue logic for slot management
│
├── 📄 upload-worker.machine.ts
│   └── Worker for individual file uploads
│       - States: idle → creating → uploading → completing → success/error
│       - Handles multipart upload delegation
│       - Notifies quota on completion
│       - Supports abort and progress tracking
│
├── 📄 README.md
│   └── Overview and quick start guide
│       - Architecture overview
│       - File descriptions
│       - Quick start examples
│       - Benefits and use cases
│       - Testing guidance
│       - Migration path
│
├── 📄 ARCHITECTURE.md
│   └── Detailed architecture documentation
│       - Component descriptions
│       - Event flow explanation
│       - Advantages over V1
│       - Integration points
│
├── 📄 COMPARISON.md
│   └── Visual V1 vs V2 comparison
│       - Architectural diagrams
│       - State transition comparisons
│       - Event flow comparison
│       - Performance analysis
│       - Error handling comparison
│       - Extensibility comparison
│
├── 📄 MIGRATION.md
│   └── Step-by-step migration guide
│       - Overview of changes
│       - API differences
│       - Component integration patterns
│       - State mapping
│       - Event type mapping
│       - Rollback strategy
│       - Testing approach
│
├── 📄 INTEGRATION.ts
│   └── Integration patterns and helpers
│       - Helper functions for setup
│       - Component integration examples
│       - Integration notes
│       - Machine interactions
│
├── 📄 EXAMPLES.md
│   └── 10 practical code examples
│       1. Basic setup
│       2. Adding files
│       3. Displaying progress
│       4. Handling validation failures
│       5. Per-file progress tracking
│       6. Worker success/failure
│       7. Quota machine as validator
│       8. Canceling uploads
│       9. Statistics dashboard
│       10. File upload dialog integration
│
└── 📄 This file
    └── Overview of all created files
`

export const KEY_DIFFERENCES = `
KEY DIFFERENCES: V2 vs V1
=========================

INSTEAD OF:
  uploadMachine (parent) → fileMachine[] (children) → multipart

NOW USE:
  uploadManagerMachine → uploadQueueMachine
                      ├→ quotaMachine (validator)
                      └→ uploadWorkerMachine (worker)
                         └→ multipart

CONCURRENCY:
  V1: Parent tracks active count, manual spawning
  V2: Queue enforces slots, automatic allocation

VALIDATION:
  V1: Done during upload (in fileMachine init)
  V2: Done before upload (in queue validating state)

PROGRESS:
  V1: Per-file sendParent events to parent
  V2: Queue stats + per-worker progress context

STATE MANAGEMENT:
  V1: Many spawned actors (memory grows with files)
  V2: 3 constant actors (manager, queue, worker)

ERROR HANDLING:
  V1: fileMachine.error state (final)
  V2: Queue.failed set for retry logic

EXTENSIBILITY:
  V1: Modify fileMachine for new behavior
  V2: Swap validator or worker, modify queue as needed
`

export const INTEGRATION_CHECKLIST = `
INTEGRATION CHECKLIST
=====================

Before Integration:
□ Review ARCHITECTURE.md to understand flow
□ Check COMPARISON.md to see V1 vs V2 differences
□ Read EXAMPLES.md for practical code patterns
□ Plan rollback strategy (keep V1 in parallel)

Integration Steps:
□ Create upload-v2 folder (DONE ✓)
□ Add upload-manager.machine.ts
□ Add upload-queue.machine.ts
□ Add upload-worker.machine.ts
□ Create index.ts exporting all machines
□ Update machine.types.ts if needed
□ Create integration tests
□ Add to one route/component first (canary)
□ Test file uploads with different sizes
□ Verify quota blocking works
□ Check progress tracking
□ Monitor for memory leaks
□ Test concurrent uploads
□ Test abort/cancel functionality
□ Test quota updates
□ Gradually migrate more routes
□ Remove V1 machines when confident

Testing:
□ Unit tests for each machine
□ Integration tests with all machines
□ E2E tests with real uploads
□ Load tests with many concurrent files
□ Memory profiling
□ Performance benchmarks vs V1

Monitoring:
□ Track upload success rate
□ Monitor queue depth
□ Watch memory usage
□ Check validation error rates
□ Verify quota accuracy
`

export const QUICK_REFERENCE = `
QUICK REFERENCE: V2 Upload Flow
================================

FILES:
│
├─ upload-manager.machine.ts
│  Types: UploadManagerV2Context, UploadManagerV2Events
│  Events: upload.config, upload.initialized
│  Spawns: quotaMachine, uploadWorkerMachine, uploadQueueMachine
│
├─ upload-queue.machine.ts
│  Types: UploadQueueContext, UploadQueueEvents, UploadQueueInput
│  States: running (with pending/validating/active/completed/failed)
│  Events: @queue.add, validation.request, validation.result, etc.
│
└─ upload-worker.machine.ts
   Types: UploadWorkerContext, UploadWorkerEvents
   States: idle, creating, uploading, completing, success, error, etc.
   Events: process, @multipart.upload.progress, abort, etc.

MACHINE CONNECTIONS:
uploadManagerMachine
  └─ spawn quotaMachine (validator)
  └─ spawn uploadWorkerMachine (worker)
  └─ spawn uploadQueueMachine
     ├─ sends validation.request to quotaMachine
     └─ sends process event to uploadWorkerMachine

DATA FLOW:
1. @queue.add → items.set(), pending.add()
2. checkQueue → validation.request raised
3. quotaMachine → validation.result (allowed/denied)
4. If allowed: sendTo worker with process event
5. Worker uploads → worker.success/failure
6. Queue moves to completed/failed
7. checkQueue processes next item

KEY CONTEXT VALUES:
Queue:
  - items: Map<id, { id, size }>
  - pending/validating/active/completed/failed: Set<id>
  - stats: { pending, validating, active, completed, failed }

Worker:
  - mediaFile: { id, file, status, progress, ... }
  - uploadId: string
  - error?: string

STATE TRANSITIONS:
Queue: idle → running
  Items: pending → validating → active → completed
                  → failed (if denied)

Worker: idle → creating → uploading → completing → success
                                    → error
                   → aborted (on user abort)

COMMON OPERATIONS:
Add file:
  queueSend({ type: '@queue.add', item: { id, size } })

Cancel file:
  queueSend({ type: '@queue.cancel', itemId })

Handle completion:
  Listen to queue context changes for stats updates

Handle progress:
  Subscribe to worker context.mediaFile.progress

Handle errors:
  Check queue.context.failed set or worker.context.error
`

export const EXISTING_V1_FILES = `
ORIGINAL V1 FILES (NOT MODIFIED)
=================================

These original machines remain in place:
- app/machines/upload/upload.machine.ts
- app/machines/upload/file.machine.ts
- app/machines/multipart/s3.multipart.ts
- app/machines/quota/quota.machine.ts
- app/machines/queue/queue.machine.1.ts

NEW V2 FILES CREATED IN:
app/machines/upload-v2/
  - upload-manager.machine.ts (NEW)
  - upload-queue.machine.ts (NEW)
  - upload-worker.machine.ts (NEW)
  - README.md (documentation)
  - ARCHITECTURE.md (documentation)
  - COMPARISON.md (documentation)
  - MIGRATION.md (documentation)
  - INTEGRATION.ts (documentation + helpers)
  - EXAMPLES.md (documentation + examples)

NO EXISTING FILES WERE MODIFIED OR DELETED!
This allows safe parallel development and gradual migration.
`

export const SUMMARY = `
✅ UPLOAD V2 FOLDER CREATED SUCCESSFULLY

What was created:
✓ upload-manager.machine.ts - Top-level orchestrator
✓ upload-queue.machine.ts - Generic queue with quota validation
✓ upload-worker.machine.ts - Individual file upload handler
✓ README.md - Overview and quick start
✓ ARCHITECTURE.md - Detailed design documentation
✓ COMPARISON.md - V1 vs V2 visual comparison
✓ MIGRATION.md - Step-by-step migration guide
✓ INTEGRATION.ts - Integration patterns and helpers
✓ EXAMPLES.md - 10 practical code examples
✓ FOLDER_STRUCTURE.md - This summary document

Location:
p:\\Projects\\stashly\\app\\machines\\upload-v2\\

Original V1 files remain untouched - safe parallel development!

Next Steps:
1. Review ARCHITECTURE.md to understand the design
2. Check EXAMPLES.md for practical usage patterns
3. Read COMPARISON.md to see differences from V1
4. Use INTEGRATION.ts for helper functions
5. Integrate into a test route to validate
6. Gradually migrate other routes
7. Monitor performance and stability
8. Remove V1 when migration complete

Queue-based architecture advantages:
✓ Generic queue reusable for other workflows
✓ Swappable validators (quota, virus scan, etc.)
✓ Better concurrency management
✓ Cleaner separation of concerns
✓ Built-in statistics tracking
✓ Reduced memory footprint
✓ Easier error handling and retry logic
`

export default {
  FOLDER_STRUCTURE,
  KEY_DIFFERENCES,
  INTEGRATION_CHECKLIST,
  QUICK_REFERENCE,
  EXISTING_V1_FILES,
  SUMMARY,
}
