import { uploadManagerMachineV2 } from './upload-manager.machine'
import { uploadWorkerMachine } from './upload-worker.machine'
import { uploadQueueMachineV2 } from './upload-queue.machine'
import type { User } from '@/.server/auth.types';
import type { Config } from '../machine.types';

/**
 * Integration example showing how to use the V2 upload flow
 * 
 * This demonstrates how to:
 * 1. Initialize the upload manager
 * 2. Add files to the queue
 * 3. Monitor progress
 * 4. Handle completion
 */

export function createUploadFlowV2() {
  // 1. Create the main machines
  const machines = {
    manager: uploadManagerMachineV2,
    worker: uploadWorkerMachine,
    queue: uploadQueueMachineV2,
  }

  return {
    /**
     * Example: Initialize upload manager
     */
    initializeUploadManager: (user: User, config: Config) => {
      return {
        type: 'upload.config',
        config: {
          user,
          maxConcurrentUploads: config.maxConcurrentUploads || 5,
          maxFileSize: config.maxFileSize || 10000000000,
        },
      }
    },

    /**
     * Example: Add file to queue
     * The queue will automatically validate quota before uploading
     */
    addFileToQueue: (fileId: string, fileSize: bigint) => {
      return {
        type: '@queue.add',
        item: {
          id: fileId,
          size: fileSize,
        },
      }
    },

    /**
     * Example: Monitor queue statistics
     * Subscribe to context changes to track:
     * - pending.size
     * - validating.size
     * - active.size
     * - completed.size
     * - failed.size
     */
    getQueueStats: (queueContext: any) => {
      return {
        pending: queueContext.pending.size,
        validating: queueContext.validating.size,
        active: queueContext.active.size,
        completed: queueContext.completed.size,
        failed: queueContext.failed.size,
      }
    },

    /**
     * Example: Cancel an upload
     */
    cancelUpload: (fileId: string) => {
      return {
        type: '@queue.cancel',
        itemId: fileId,
      }
    },
  }
}

/**
 * Component integration example
 * 
 * Usage in a React component:
 * 
 * const [uploadManager, uploadManagerSend] = useMachine(uploadManagerMachineV2)
 * const [queue, queueSend] = useMachine(uploadQueueMachineV2, {
 *   input: {
 *     maxConcurrency: 5,
 *     validator: quotaMachineRef,
 *     worker: uploadWorkerRef,
 *   }
 * })
 * 
 * // Add file
 * queueSend({
 *   type: '@queue.add',
 *   item: { id: file.id, size: BigInt(file.size) }
 * })
 * 
 * // Monitor progress
 * useEffect(() => {
 *   console.log('Queue stats:', queue.context.stats)
 * }, [queue.context.stats])
 */

export const INTEGRATION_NOTES = `
Integration Guide: Upload V2
============================

1. Machine Setup
   - Create machines in desired order
   - Pass actor refs to parent/manager
   - Ensure system IDs match (e.g., 'quotaValidator')

2. Event Flow
   - User adds file → @queue.add event
   - Queue validates → validation.request to quota
   - Quota responds → validation.result
   - Queue sends to worker → process event
   - Worker uploads → worker.success/failure
   - Queue processes next item

3. State Subscriptions
   - Subscribe to uploadManager state for config
   - Subscribe to queue context for stats
   - Subscribe to worker context for progress
   - Listen to quota for quota status

4. Error Handling
   - Validators can deny items (quota exceeded)
   - Workers fail gracefully (moved to failed set)
   - Queue re-processes on failure
   - Manager can stop/reset flow

5. Progress Tracking
   - @multipart.upload.progress from worker
   - Queue stats show overall progress
   - Item counts in each queue state

Example Usage:
--------------

// Create actors
const managerRef = interpreter(uploadManagerMachineV2).start()
const workerRef = interpreter(uploadWorkerMachine).start()
const quotaRef = interpreter(quotaMachine).start()

// Spawn queue with refs
const queueRef = interpreter(uploadQueueMachineV2).start({
  input: {
    maxConcurrency: 5,
    validator: quotaRef,
    worker: workerRef,
  }
})

// Add file
queueRef.send({
  type: '@queue.add',
  item: { id: 'file-1', size: BigInt(1000000) }
})

// Monitor
queueRef.subscribe(state => {
  console.log('Queue stats:', state.context.stats)
})
`
