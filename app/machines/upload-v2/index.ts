/**
 * Upload V2 - Queue-Based Architecture
 * Entry Point and Index
 * 
 * This folder contains a complete refactor of the upload system using
 * a generic queue orchestrator pattern with pluggable validators and workers.
 */

// ============================================================================
// CORE MACHINES
// ============================================================================

export { uploadManagerMachineV2 } from './upload-manager.machine'
export type { UploadManagerV2Context, UploadManagerV2Events } from './upload-manager.machine'

export { uploadQueueMachineV2 } from './upload-queue.machine'
export type { UploadQueueContext, UploadQueueEvents, UploadQueueInput } from './upload-queue.machine'

export { uploadWorkerMachine } from './upload-worker.machine'
export type { UploadWorkerContext, UploadWorkerEvents } from './upload-worker.machine'

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export { createUploadFlowV2 } from './INTEGRATION'

// ============================================================================
// DOCUMENTATION REFERENCES
// ============================================================================

/**
 * START HERE:
 * 
 * 1. README.md
 *    - Overview of the architecture
 *    - Quick start guide
 *    - Benefits and use cases
 * 
 * 2. ARCHITECTURE.md
 *    - Detailed design documentation
 *    - Component descriptions
 *    - Integration points
 * 
 * 3. COMPARISON.md
 *    - Visual comparison of V1 vs V2
 *    - State transitions and event flows
 * 
 * 4. DIAGRAMS.md
 *    - ASCII diagrams and visual flows
 *    - Timeline examples (concurrent, quota denial)
 * 
 * 5. EXAMPLES.md
 *    - 10 practical code examples
 *    - React integration patterns
 * 
 * 6. MIGRATION.md
 *    - Step-by-step migration from V1
 *    - API changes and state mapping
 * 
 * 7. INTEGRATION.ts
 *    - Integration helpers and patterns
 *    - Machine interactions
 * 
 * 8. SUMMARY.md
 *    - Quick reference
 *    - Integration checklist
 * 
 * 9. MANIFEST.md
 *    - Complete file listing
 *    - What was created and why
 */

// ============================================================================
// QUICK START
// ============================================================================

/**
 * Basic usage example:
 * 
 * import { useMachine } from '@xstate/react'
 * import { 
 *   uploadManagerMachineV2,
 *   uploadQueueMachineV2,
 * } from '@/machines/upload-v2'
 * 
 * function FileUploadComponent() {
 *   // Create machines
 *   const [manager, managerSend] = useMachine(uploadManagerMachineV2)
 *   const [queue, queueSend] = useMachine(uploadQueueMachineV2)
 *   
 *   // Initialize
 *   useEffect(() => {
 *     managerSend({
 *       type: 'upload.config',
 *       config: {
 *         user: currentUser,
 *         maxConcurrentUploads: 5,
 *         maxFileSize: 10000000000,
 *       }
 *     })
 *   }, [currentUser])
 *   
 *   // Add file
 *   const handleFileSelect = (file) => {
 *     queueSend({
 *       type: '@queue.add',
 *       item: {
 *         id: generateId(),
 *         size: BigInt(file.size)
 *       }
 *     })
 *   }
 *   
 *   // Monitor progress
 *   return (
 *     <div>
 *       <div>Pending: {queue.context.stats.pending}</div>
 *       <div>Active: {queue.context.stats.active}</div>
 *       <div>Completed: {queue.context.stats.completed}</div>
 *     </div>
 *   )
 * }
 */

// ============================================================================
// ARCHITECTURE OVERVIEW
// ============================================================================

/**
 * System Components:
 * 
 * uploadManagerMachine
 *   ├── Spawns: quotaMachine (validator)
 *   ├── Spawns: uploadWorkerMachine (worker)
 *   └── Spawns: uploadQueueMachine (orchestrator)
 * 
 * uploadQueueMachine
 *   ├── Manages: pending set
 *   ├── Manages: validating set
 *   ├── Manages: active set
 *   ├── Manages: completed set
 *   ├── Manages: failed set
 *   └── Sends: validation.request to quotaMachine
 *   └── Sends: process event to uploadWorkerMachine
 * 
 * quotaMachine
 *   ├── Receives: @quota.check from queue
 *   ├── Returns: validation.result (allowed/denied)
 *   └── Updates: user quota after upload
 * 
 * uploadWorkerMachine
 *   ├── Receives: process event from queue
 *   ├── Delegates: to multipart upload service
 *   ├── Tracks: file progress
 *   ├── Returns: worker.success/failure to queue
 *   └── Notifies: quota machine on completion
 * 
 * Flow:
 *   1. User adds file → @queue.add
 *   2. Queue stores in pending
 *   3. checkQueue → validation.request
 *   4. quotaMachine checks quota
 *   5. validation.result (allowed/denied)
 *   6. If allowed: sendTo worker
 *   7. Worker uploads via multipart
 *   8. worker.success/failure
 *   9. Queue moves to completed/failed
 *   10. checkQueue processes next pending
 */

// ============================================================================
// KEY TYPES
// ============================================================================

/**
 * UploadManagerV2Context
 *   - config: User config, max concurrent, max file size
 *   - queueActor: Reference to queue machine
 *   - quotaActor: Reference to quota machine
 *   - workerActor: Reference to worker machine
 * 
 * UploadQueueContext
 *   - items: Map of all items (id → { id, size })
 *   - pending: Set of pending item IDs
 *   - validating: Set of validating item IDs
 *   - active: Set of active upload item IDs
 *   - completed: Set of completed item IDs
 *   - failed: Set of failed item IDs
 *   - stats: Computed statistics
 * 
 * UploadWorkerContext
 *   - mediaFile: Current file being uploaded
 *   - user: User configuration
 *   - uploadId: S3 upload session ID
 *   - error: Error message if failed
 * 
 * Event Types:
 *   - @queue.add: Add file to queue
 *   - validation.request: Request quota check
 *   - validation.result: Quota decision
 *   - worker.success: Upload succeeded
 *   - worker.failure: Upload failed
 *   - process: Worker start signal
 *   - @multipart.upload.progress: Progress update
 *   - abort: Cancel upload
 */

// ============================================================================
// MIGRATION FROM V1
// ============================================================================

/**
 * V1 → V2 Changes:
 * 
 * V1 Structure:
 *   uploadMachine (parent) → fileMachine[] (children) → multipart
 *   
 * V2 Structure:
 *   uploadManagerMachine → uploadQueueMachine
 *                       ├→ quotaMachine
 *                       └→ uploadWorkerMachine → multipart
 * 
 * Key Differences:
 *   - V1: One actor per file
 *   - V2: Single queue manages all files
 *   
 *   - V1: Quota check during upload
 *   - V2: Quota check before upload
 *   
 *   - V1: Manual concurrency control
 *   - V2: Queue-managed concurrency
 *   
 *   - V1: Per-file progress events
 *   - V2: Global stats + per-file context
 * 
 * See MIGRATION.md for detailed step-by-step guide.
 */

// ============================================================================
// FILE STRUCTURE
// ============================================================================

/**
 * upload-v2/
 *   ├── upload-manager.machine.ts    (103 lines, core machine)
 *   ├── upload-queue.machine.ts      (206 lines, core machine)
 *   ├── upload-worker.machine.ts     (254 lines, core machine)
 *   ├── index.ts                     (this file)
 *   ├── README.md                    (overview)
 *   ├── ARCHITECTURE.md              (detailed design)
 *   ├── COMPARISON.md                (V1 vs V2)
 *   ├── DIAGRAMS.md                  (visual flows)
 *   ├── EXAMPLES.md                  (10 code examples)
 *   ├── MIGRATION.md                 (integration guide)
 *   ├── INTEGRATION.ts               (helpers)
 *   ├── SUMMARY.md                   (quick reference)
 *   └── MANIFEST.md                  (file listing)
 * 
 * All original V1 files remain untouched in their original locations.
 */

// ============================================================================
// NEXT STEPS
// ============================================================================

/**
 * 1. Read README.md for overview
 * 2. Study ARCHITECTURE.md for design details
 * 3. Check COMPARISON.md for V1 vs V2 differences
 * 4. Review EXAMPLES.md for practical code patterns
 * 5. Follow MIGRATION.md for step-by-step integration
 * 6. Reference DIAGRAMS.md for visual understanding
 * 7. Use INTEGRATION.ts for helper functions
 * 8. Test in a single route first (canary)
 * 9. Validate thoroughly before full rollout
 * 10. Gradually migrate remaining routes
 */

export const UPLOAD_V2_DOCUMENTATION = {
  overview: 'README.md',
  architecture: 'ARCHITECTURE.md',
  comparison: 'COMPARISON.md',
  diagrams: 'DIAGRAMS.md',
  examples: 'EXAMPLES.md',
  migration: 'MIGRATION.md',
  integration: 'INTEGRATION.ts',
  summary: 'SUMMARY.md',
  manifest: 'MANIFEST.md',
}

export default {
  documentation: UPLOAD_V2_DOCUMENTATION,
  message: 'Welcome to Upload V2! Start with README.md for an overview.',
}
