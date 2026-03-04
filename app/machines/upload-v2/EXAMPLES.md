/**
 * PRACTICAL EXAMPLES: How to use Upload V2 in your app
 */

```tsx
==═══════════════════════════════════════════════════════════════════════════════
EXAMPLE 1: Basic Setup
═══════════════════════════════════════════════════════════════════════════════

import { useMachine } from '@xstate/react'
import { uploadManagerMachineV2 } from '@/machines/upload-v2'
import { quotaMachine } from '@/machines/quota'
import { uploadWorkerMachine } from '@/machines/upload-v2'
import { uploadQueueMachineV2 } from '@/machines/upload-v2'

function FileUploadComponent() {
  const [manager, managerSend] = useMachine(uploadManagerMachineV2)
  const [queue, queueSend] = useMachine(uploadQueueMachineV2)
  
  // Initialize with user config
  useEffect(() => {
    managerSend({
      type: 'upload.config',
      config: {
        user: currentUser,
        maxConcurrentUploads: 5,
        maxFileSize: 10000000000,
      }
    })
  }, [currentUser])
  
  // When queue is ready
  useEffect(() => {
    if (manager.value === 'ready') {
      managerSend({ type: 'upload.initialized' })
    }
  }, [manager.value])
  
  return <div>Upload Manager Ready</div>
}


═══════════════════════════════════════════════════════════════════════════════
EXAMPLE 2: Adding Files
═══════════════════════════════════════════════════════════════════════════════

function FileDropZone() {
  const [queue, queueSend] = useMachine(uploadQueueMachineV2)
  
  const handleFilesSelected = (files: File[]) => {
    files.forEach(file => {
      // Add each file to queue
      // Queue will validate quota before uploading
      queueSend({
        type: '@queue.add',
        item: {
          id: generateId(file.name),
          size: BigInt(file.size)
        }
      })
    })
  }
  
  return (
    <div 
      onDrop={(e) => handleFilesSelected(Array.from(e.dataTransfer.files))}
    >
      Drop files here
    </div>
  )
}


═══════════════════════════════════════════════════════════════════════════════
EXAMPLE 3: Displaying Queue Progress
═══════════════════════════════════════════════════════════════════════════════

function UploadProgressDisplay() {
  const [queue, queueSend] = useMachine(uploadQueueMachineV2)
  
  const { stats } = queue.context
  const total = Object.values(stats).reduce((a, b) => a + b, 0)
  const processed = stats.completed + stats.failed
  const progress = total > 0 ? (processed / total) * 100 : 0
  
  return (
    <div>
      <div>Total: {total}</div>
      <div>Pending: {stats.pending}</div>
      <div>Validating: {stats.validating}</div>
      <div>Uploading: {stats.active}</div>
      <div>Completed: {stats.completed}</div>
      <div>Failed: {stats.failed}</div>
      
      <ProgressBar value={progress} />
      
      <p>{processed}/{total} files processed</p>
    </div>
  )
}


═══════════════════════════════════════════════════════════════════════════════
EXAMPLE 4: Handling Validation Failures (Quota Exceeded)
═══════════════════════════════════════════════════════════════════════════════

function UploadList() {
  const [queue, queueSend] = useMachine(uploadQueueMachineV2)
  
  const failedDueToQuota = Array.from(queue.context.failed).map(
    id => queue.context.items.get(id)
  )
  
  return (
    <div>
      <h3>Active Uploads</h3>
      <ul>
        {Array.from(queue.context.active).map(id => (
          <li key={id}>{id} - Uploading...</li>
        ))}
      </ul>
      
      <h3>Pending</h3>
      <ul>
        {Array.from(queue.context.pending).map(id => (
          <li key={id}>{id} - Waiting...</li>
        ))}
      </ul>
      
      <h3>Quota Issues</h3>
      <ul>
        {failedDueToQuota.map(item => (
          <li key={item?.id}>
            {item?.id} - Quota exceeded ({item?.size} bytes)
            <button onClick={() => upgradeQuota()}>
              Upgrade Plan
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}


═══════════════════════════════════════════════════════════════════════════════
EXAMPLE 5: Real-time Upload Progress per File
═══════════════════════════════════════════════════════════════════════════════

function FileProgressItem({ fileId }) {
  const [worker, workerSend] = useMachine(uploadWorkerMachine)
  
  const file = worker.context.mediaFile
  const { progress } = file
  
  // Listen for events
  useEffect(() => {
    const handleProgress = (event) => {
      if (event.type === '@multipart.upload.progress') {
        workerSend({
          type: '@multipart.upload.progress',
          progress: event.progress
        })
      }
    }
    
    // Subscribe to worker progress
    
    return () => {
      // Cleanup
    }
  }, [worker])
  
  return (
    <div>
      <div>{file.id}</div>
      <ProgressBar 
        value={progress?.percentage || 0} 
      />
      <div>
        {(progress?.percentage || 0).toFixed(1)}%
      </div>
      {progress?.speed && (
        <div>{progress.speed.value} {progress.speed.unit}</div>
      )}
      {progress?.timeLeft && (
        <div>
          {progress.timeLeft.hours}h {progress.timeLeft.minutes}m {progress.timeLeft.seconds}s remaining
        </div>
      )}
    </div>
  )
}


═══════════════════════════════════════════════════════════════════════════════
EXAMPLE 6: Handling Worker Success/Failure
═══════════════════════════════════════════════════════════════════════════════

function UploadManager() {
  const [queue, queueSend] = useMachine(uploadQueueMachineV2)
  const [worker, workerSend] = useMachine(uploadWorkerMachine)
  
  // When worker completes
  useEffect(() => {
    if (worker.matches('success')) {
      // Notify queue of success
      queueSend({
        type: 'worker.success',
        itemId: worker.context.mediaFile.id
      })
    }
  }, [worker.value])
  
  // When worker fails
  useEffect(() => {
    if (worker.matches('error')) {
      // Notify queue of failure
      queueSend({
        type: 'worker.failure',
        itemId: worker.context.mediaFile.id
      })
      
      // Show error notification
      showNotification({
        type: 'error',
        message: `Upload failed: ${worker.context.error}`
      })
    }
  }, [worker.value, worker.context.error])
  
  return <div>Upload Manager</div>
}


═══════════════════════════════════════════════════════════════════════════════
EXAMPLE 7: Quota Machine as Validator
═══════════════════════════════════════════════════════════════════════════════

// The quotaMachine receives validation.request from queue

// quotaMachine expects:
const quotaCheck = {
  type: '@quota.check',
  itemId: 'file-1',
  dataSize: 5000000n  // BigInt in bytes
}

// quotaMachine responds with:
const validationResult = {
  type: 'validation.result',
  itemId: 'file-1',
  result: 'allowed' | 'denied'  // Based on quota check
}

// Example quotaMachine check implementation:
function checkUserQuota(userId, dataSize) {
  const quota = getUserQuota(userId)
  if (quota.remaining >= dataSize) {
    return { result: 'allowed' }
  } else {
    return { result: 'denied' }
  }
}


═══════════════════════════════════════════════════════════════════════════════
EXAMPLE 8: Canceling an Upload
═══════════════════════════════════════════════════════════════════════════════

function FileRow({ fileId }) {
  const [queue, queueSend] = useMachine(uploadQueueMachineV2)
  
  const handleCancel = () => {
    queueSend({
      type: '@queue.cancel',
      itemId: fileId
    })
    
    // Also abort worker if active
    if (queue.context.active.has(fileId)) {
      // Send abort to worker
      workerSend({ type: 'abort' })
    }
  }
  
  return (
    <div>
      <span>{fileId}</span>
      <button onClick={handleCancel}>Cancel</button>
    </div>
  )
}


═══════════════════════════════════════════════════════════════════════════════
EXAMPLE 9: Statistics Dashboard
═══════════════════════════════════════════════════════════════════════════════

function UploadStatsDashboard() {
  const [queue, queueSend] = useMachine(uploadQueueMachineV2)
  
  const { stats } = queue.context
  
  return (
    <div className="grid grid-cols-5 gap-4">
      <StatCard 
        label="Pending" 
        value={stats.pending}
        color="gray"
      />
      <StatCard 
        label="Validating" 
        value={stats.validating}
        color="blue"
      />
      <StatCard 
        label="Uploading" 
        value={stats.active}
        color="yellow"
      />
      <StatCard 
        label="Done" 
        value={stats.completed}
        color="green"
      />
      <StatCard 
        label="Failed" 
        value={stats.failed}
        color="red"
      />
    </div>
  )
}


═══════════════════════════════════════════════════════════════════════════════
EXAMPLE 10: Integration with File Upload Dialog
═══════════════════════════════════════════════════════════════════════════════

function UploadDialog() {
  const [queue, queueSend] = useMachine(uploadQueueMachineV2)
  const fileInputRef = useRef(null)
  
  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files || [])
    
    for (const file of files) {
      // Generate unique ID for file
      const fileId = `${file.name}-${Date.now()}`
      
      // Add to queue
      queueSend({
        type: '@queue.add',
        item: {
          id: fileId,
          size: BigInt(file.size)
        }
      })
      
      // Store file reference somewhere for worker to access
      // (could be in a separate context or passed via event)
      setStoredFiles(prev => ({
        ...prev,
        [fileId]: file
      }))
    }
  }
  
  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />
      <button onClick={() => fileInputRef.current?.click()}>
        Select Files ({queue.context.stats.pending} pending)
      </button>
      
      <UploadProgressDisplay queue={queue} />
    </div>
  )
}
`

export default EXAMPLES
