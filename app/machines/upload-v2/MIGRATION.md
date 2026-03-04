/**
 * Migration Guide: From Upload V1 to Upload V2
 */

export const MIGRATION_GUIDE = `
Migration Guide: V1 → V2
========================

## Overview
V2 replaces the parent-child file machine pattern with a generic queue orchestrator.
Instead of fileMachine per file, we use uploadWorkerMachine with a queue.

## Key Changes

### Before (V1)
\`\`\`typescript
// uploadMachine spawns fileMachine for each file
{
  fileActors: Map<fileId, fileMachineRef>
  mediaFiles: Map<fileId, MediaFile>
  queues: {
    active: Set<fileId>
    pending: Map<fileId, mediaFile>
    completed: Set<fileId>
  }
}

// Each file gets its own actor
spawn('fileMachine', {
  id: fileId,
  input: { user, mediaFile, parentRef }
})

// Progress bubbles up via parent events
fileMachine → sendParent('progress.change') → uploadMachine
\`\`\`

### After (V2)
\`\`\`typescript
// uploadManagerMachine spawns: quota, worker, queue
{
  queueActor: queueMachineRef
  quotaActor: quotaMachineRef
  workerActor: uploadWorkerRef
}

// Files added to queue, not spawned individually
queue.send({
  type: '@queue.add',
  item: { id, size }
})

// Queue coordinates validation and work
queue → quota (validation) → worker (upload)
\`\`\`

## API Changes

### Adding Files

**V1:**
\`\`\`typescript
uploadMachine.send({
  type: 'upload.add',
  mediaFile: { id, file, name }
})
\`\`\`

**V2:**
\`\`\`typescript
queue.send({
  type: '@queue.add',
  item: { id, size: BigInt(file.size) }
})
\`\`\`

### Monitoring Progress

**V1:**
\`\`\`typescript
uploadMachine.subscribe(state => {
  state.context.mediaFiles.forEach(file => {
    console.log(file.progress)
  })
})
\`\`\`

**V2:**
\`\`\`typescript
// Global stats
queue.subscribe(state => {
  console.log('Stats:', state.context.stats)
  // { pending, validating, active, completed, failed }
})

// Individual progress via worker events
worker.subscribe(state => {
  console.log(state.context.mediaFile.progress)
})
\`\`\`

### Quota Checking

**V1:**
Quota check happens during upload initiation, inside fileMachine

**V2:**
Quota check happens in validation phase, before worker spawns
- cleaner, earlier validation
- failed items never reach worker
- quota errors handled at queue level

## Component Integration

### React Hook (V1 Pattern)
\`\`\`typescript
const [uploadState, uploadSend] = useMachine(uploadMachine)

const addFile = (file: File) => {
  uploadSend({
    type: 'upload.add',
    mediaFile: { /* ... */ }
  })
}
\`\`\`

### React Hook (V2 Pattern)
\`\`\`typescript
const [managerState, managerSend] = useMachine(uploadManagerMachineV2)
const [queueState, queueSend] = useMachine(uploadQueueMachineV2)

const addFile = (file: File) => {
  queueSend({
    type: '@queue.add',
    item: { 
      id: file.id, 
      size: BigInt(file.size) 
    }
  })
}
\`\`\`

## State Mapping

### V1 Context
\`\`\`typescript
mediaFiles: Map<id, {
  id, file, name, status, progress, key
}>
queues: {
  active: Set<id>
  pending: Map<id, mediaFile>
  completed: Set<id>
}
\`\`\`

### V2 Context
\`\`\`typescript
// Queue context
items: Map<id, { id, size }>
pending: Set<id>
validating: Set<id>
active: Set<id>
completed: Set<id>
failed: Set<id>
stats: { pending, validating, active, completed, failed }

// Worker context (per file)
mediaFile: { id, file, status, progress }
uploadId: string
error?: string
\`\`\`

## Status Values

Both V1 and V2 use same MediaFileStatus:
- 'pending'
- 'uploading'
- 'done'
- 'aborted'

Plus queue adds: validating, failed

## Event Types Comparison

### V1 Upload Events
- upload.add
- upload.spawn
- upload.start
- upload.done
- upload.aborted
- upload.abort
- upload.remove
- progress.change
- upload.started

### V2 Queue Events
- @queue.add
- validation.request (internal)
- validation.result (from quota)
- worker.success
- worker.failure
- @queue.cancel
- worker.process (internal)

## Rollback Strategy

1. Keep V1 machines in original location
2. V2 machines in new upload-v2 folder
3. Components can import from either
4. Gradually migrate pages/routes
5. Remove V1 after full migration

## Testing

### V1 Tests
\`\`\`typescript
it('should add file and start upload', () => {
  const state = uploadMachine.initialState
  const nextState = uploadMachine.transition(
    state,
    { type: 'upload.add', mediaFile: ... }
  )
  expect(nextState.context.mediaFiles.size).toBe(1)
})
\`\`\`

### V2 Tests
\`\`\`typescript
it('should queue file and validate', () => {
  const state = uploadQueueMachineV2.initialState
  const nextState = uploadQueueMachineV2.transition(
    state,
    { type: '@queue.add', item: { id: '1', size: 100n } }
  )
  expect(nextState.context.pending.has('1')).toBe(true)
})
\`\`\`

## Performance Considerations

### V1
- Many spawned actors (one per file)
- Actor management overhead
- Parent broadcasts to all children

### V2
- Single queue manages all
- Single worker processes files sequentially
- Can spawn multiple workers if needed
- Lighter memory footprint

## Next Steps

1. Deploy V2 alongside V1
2. Test with same file upload scenarios
3. Verify quota behavior
4. Monitor performance
5. Gradually migrate routes
6. Remove V1 when confident
`

export default MIGRATION_GUIDE
