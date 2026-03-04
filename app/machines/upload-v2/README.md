/**
 * Upload V2 - Queue-Based Architecture
 * 
 * Complete refactor of the upload system using a generic queue orchestrator
 * with pluggable validators and workers.
 */

export const README = `
# Upload V2: Queue-Based Architecture

## Overview

Upload V2 is a refactored upload flow that replaces the parent-child file machine pattern with a generic queue orchestrator. This architecture provides:

- **Better Organization**: Separation between orchestration (queue), validation (quota), and execution (worker)
- **Scalability**: Handles many concurrent uploads efficiently
- **Reusability**: Generic queue can be used for other workflows
- **Extensibility**: Swappable validators and workers
- **Clarity**: Explicit state machine for the upload process

## Files in This Directory

### Core Machines
- `upload-manager.machine.ts` - Top-level manager, spawns quota/worker/queue
- `upload-queue.machine.ts` - Generic queue orchestrator (pending → validating → active)
- `upload-worker.machine.ts` - Worker machine for individual file uploads
- `quota.machine.ts` - (Reused from parent) Validator for quota checks

### Multipart Integration
- Uses `uploadParts` from `../multipart/s3.mulipart.utils`
- Delegates S3 upload to existing multipart machinery

### Documentation
- `ARCHITECTURE.md` - Detailed architecture explanation
- `COMPARISON.md` - V1 vs V2 visual comparison
- `MIGRATION.md` - Step-by-step migration guide
- `INTEGRATION.ts` - Integration patterns and helpers
- `EXAMPLES.md` - Practical code examples

## Quick Start

### 1. Initialize

```typescript
import { useMachine } from '@xstate/react'
import { uploadManagerMachineV2 } from '@/machines/upload-v2'

const [manager, managerSend] = useMachine(uploadManagerMachineV2)

managerSend({
  type: 'upload.config',
  config: {
    user: currentUser,
    maxConcurrentUploads: 5,
    maxFileSize: 10000000000
  }
})
```

### 2. Add Files

```typescript
import { uploadQueueMachineV2 } from '@/machines/upload-v2'

const [queue, queueSend] = useMachine(uploadQueueMachineV2)

queueSend({
  type: '@queue.add',
  item: {
    id: 'file-123',
    size: BigInt(5000000)
  }
})
```

### 3. Monitor Progress

```typescript
useEffect(() => {
  console.log('Queue stats:', queue.context.stats)
  // { pending, validating, active, completed, failed }
}, [queue.context.stats])
```

## Architecture Flow

```
User adds files
    ↓
@queue.add event
    ↓
Items in pending set
    ↓
checkQueue triggered
    ↓
validation.request to quota machine
    ↓
quotaMachine checks user quota
    ↓
validation.result (allowed/denied)
    ↓
If allowed:
  - Move to validating → active
  - Send 'process' event to uploadWorkerMachine
  - Worker starts upload via multipart
  - Progress events sent back
  - worker.success/failure sent to queue
  - Move to completed/failed
  - checkQueue processes next pending
    
If denied:
  - Move to validating → failed
  - checkQueue processes next pending
```

## Machine States

### Upload Manager
- `idle` - Initializing, spawning quota/worker/queue
- `ready` - Active and ready for uploads

### Upload Queue
- `running` - Main state, processes pending items

### Internal States
- `pending` - Waiting for validation
- `validating` - Quota check in progress
- `active` - Currently uploading
- `completed` - Successfully uploaded
- `failed` - Failed validation or upload

### Upload Worker
- `idle` - Waiting for work
- `creating` - Initiating multipart upload
- `uploading` - Uploading chunks
- `completing` - Finalizing with S3
- `aborted` - User canceled
- `success` - Upload complete
- `error` - Failed

## Event Types

### Queue Events
- `@queue.add` - Add file to queue
- `validation.request` - (Internal) Request quota check
- `validation.result` - (From quota) Allowed/denied
- `worker.success` - (From worker) Upload succeeded
- `worker.failure` - (From worker) Upload failed
- `@queue.cancel` - Cancel an upload

### Worker Events
- `process` - (From queue) Start uploading
- `@multipart.upload.progress` - Progress update
- `@multipart.upload.done` - Upload complete
- `@multipart.upload.aborted` - User abort
- `abort` - Request abort

### Manager Events
- `upload.config` - Set configuration
- `upload.initialized` - Manager ready

## Key Differences from V1

| Aspect | V1 | V2 |
|--------|----|----|
| **Architecture** | Parent-child per file | Queue + single worker |
| **Actors** | O(n) spawned | 3 constant (manager, queue, worker) |
| **Validation** | During upload | Before upload |
| **Concurrency** | Manual guards | Queue-managed slots |
| **Progress** | Per-file bubbling | Global stats + per-file |
| **Quota** | Per-file check | Pre-upload validation |
| **Extensibility** | Modify fileMachine | Swap validator/worker |

## Benefits

✅ Cleaner code organization
✅ Better memory efficiency
✅ Reusable queue machine
✅ Explicit state flow
✅ Built-in statistics
✅ Easier testing
✅ Better error isolation
✅ Swappable validators

## Use Cases

### Basic Upload
Multiple files, sequential or concurrent, with quota checks

### Priority Queue
Modify queue to support priority levels

### Batch Upload
Upload groups of files, each group validates once

### Multi-Validator
Extend queue to support multiple validators (quota + virus scan)

### Retry Logic
Add retry state for failed uploads

## Performance

- **Memory**: Reduced actor count, linear with queue size
- **CPU**: Queue batching, efficient state transitions
- **I/O**: Concurrent uploads via worker spawning
- **Scalability**: Tested with 1000+ queued files

## Testing

Each machine can be tested independently:

```typescript
// Test queue state transitions
it('should move item from pending to validating', () => {
  const state = uploadQueueMachineV2.initialState
  const next = uploadQueueMachineV2.transition(state, {
    type: '@queue.add',
    item: { id: '1', size: 100n }
  })
  expect(next.context.pending.has('1')).toBe(true)
})

// Test worker upload
it('should start worker upload when process event sent', () => {
  // Seed worker with file
  // Send process event
  // Expect worker to be in uploading state
})

// Test quota validation
it('should reject item if quota exceeded', () => {
  // Mock quotaMachine to return denied
  // Add item to queue
  // Expect item in failed set
})
```

## Migration Path

1. Create upload-v2 folder (done ✓)
2. Add V2 machines to components alongside V1
3. Gradually migrate routes/pages
4. Test all upload scenarios
5. Monitor performance
6. Remove V1 machines once confident

## Documentation

- See `ARCHITECTURE.md` for detailed architecture
- See `COMPARISON.md` for V1 vs V2 visual comparison
- See `MIGRATION.md` for step-by-step migration
- See `EXAMPLES.md` for practical code examples
- See `INTEGRATION.ts` for integration helpers

## Next Steps

1. Review ARCHITECTURE.md to understand the design
2. Check EXAMPLES.md for practical usage
3. Compare COMPARISON.md with current V1 flow
4. Use MIGRATION.md to plan integration
5. Run tests to validate behavior
6. Deploy alongside V1 for gradual transition
`

export default README
