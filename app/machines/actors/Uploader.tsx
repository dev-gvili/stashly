// components/UploadManager.tsx
import React, { useState, useEffect, useRef } from 'react'
import { createActor } from 'xstate'
import { systemMachine } from '@/machines/actors/system.machine.1'
import type { UploadFile } from '@/types/machine.types'
import type { FileUpload, UploadProgress } from './types'

interface UploadItemProps {
  file: FileUpload
  progress: UploadProgress
  onCancel: () => void
}

const UploadItem: React.FC<UploadItemProps> = ({
  file,
  progress,
  onCancel,
}) => {
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatTime = (seconds: number): string => {
    if (seconds === 0) return 'Calculating...'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}m ${secs}s`
  }

  return (
    <div className="border border-gray-300 rounded-lg p-4 flex items-center gap-4">
      <div className="flex-1 flex flex-col">
        <span className="font-bold mb-1">{file.name}</span>
        <span className="text-gray-600 text-sm">{formatBytes(file.size)}</span>
      </div>

      <div className="flex-2 flex flex-col gap-1">
        <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 transition-all duration-300 ease-in-out"
            style={{ width: `${progress.percentage}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-600">
          <span>{progress.percentage}%</span>
          <span>{formatTime(progress.timeLeft)}</span>
        </div>
      </div>

      <button
        className={`px-4 py-2 rounded text-white ${
          progress.percentage === 100
            ? 'bg-gray-500 cursor-not-allowed'
            : 'bg-red-500 hover:bg-red-600'
        }`}
        onClick={onCancel}
        disabled={progress.percentage === 100}
      >
        Cancel
      </button>
    </div>
  )
}

interface UploadManagerProps {
  userId: string
  bucket: string
}

const UploadManager: React.FC<UploadManagerProps> = ({ userId, bucket }) => {
  const [files, setFiles] = useState<UploadFile[]>([])
  const [progressData, setProgressData] = useState<
    Record<string, UploadProgress>
  >({})
  const systemActorRef = useRef<ReturnType<typeof createActor> | null>(null)
  const progressSubscriptionsRef = useRef<Record<string, () => void>>({})

  // Initialize system actor
  useEffect(() => {
    systemActorRef.current = createActor(systemMachine, {
      input: { userId, bucket },
    })

    systemActorRef.current.start()

    // Listen for system events to track file additions
    const subscription = systemActorRef.current.subscribe((state) => {
      // Handle any system-level state changes if needed
    })

    return () => {
      // Cleanup all subscriptions
      Object.values(progressSubscriptionsRef.current).forEach((unsubscribe) => {
        if (unsubscribe) unsubscribe()
      })
      subscription.unsubscribe()
      systemActorRef.current?.stop()
    }
  }, [userId])

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || [])

    selectedFiles.forEach((file) => {
      const fileUpload: FileUpload = {
        id: `${file.name}-${Date.now()}-${Math.random()}`,
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified,
      }

      setFiles((prev) => [...prev, fileUpload])

      // Initialize progress data
      setProgressData((prev) => ({
        ...prev,
        [fileUpload.id]: {
          uploadedBytes: 0,
          totalBytes: fileUpload.size,
          percentage: 0,
          timeLeft: Math.round(fileUpload.size / (1024 * 1024)), // Simulate 1MB/s
          speed: 1024 * 1024,
        },
      }))

      // Send to system
      if (systemActorRef.current) {
        systemActorRef.current.send({
          type: 'UPLOAD_FILE',
          file: fileUpload,
        })
      }
    })
  }

  const handleCancelUpload = (fileId: string) => {
    if (systemActorRef.current) {
      systemActorRef.current.send({
        type: 'CANCEL_UPLOAD',
        fileId,
      })
    }
  }

  // Set up progress listener for a specific file
  const setupProgressListener = (fileId: string) => {
    if (!systemActorRef.current) return

    // Simulate real-time progress updates
    const interval = setInterval(() => {
      setProgressData((prev) => {
        const currentProgress = prev[fileId]
        if (!currentProgress || currentProgress.percentage >= 100) {
          return prev
        }

        const newPercentage = Math.min(100, currentProgress.percentage + 10)
        const uploadedBytes = Math.round(
          (currentProgress.totalBytes * newPercentage) / 100
        )
        const timeLeft = Math.max(0, currentProgress.timeLeft - 1)

        return {
          ...prev,
          [fileId]: {
            ...currentProgress,
            percentage: newPercentage,
            uploadedBytes,
            timeLeft,
          },
        }
      })
    }, 500)

    // Store cleanup function
    progressSubscriptionsRef.current[fileId] = () => {
      clearInterval(interval)
    }

    return () => {
      clearInterval(interval)
    }
  }

  // Set up progress listeners when files are added
  useEffect(() => {
    files.forEach((file) => {
      if (!progressSubscriptionsRef.current[file.id]) {
        setupProgressListener(file.id)
      }
    })

    return () => {
      // Cleanup any listeners for removed files
      const currentFileIds = new Set(files.map((f) => f.id))
      Object.keys(progressSubscriptionsRef.current).forEach((fileId) => {
        if (!currentFileIds.has(fileId)) {
          if (progressSubscriptionsRef.current[fileId]) {
            progressSubscriptionsRef.current[fileId]()
          }
          delete progressSubscriptionsRef.current[fileId]
        }
      })
    }
  }, [files])

  return (
    <div className="max-w-4xl mx-auto p-5">
      <div className="flex justify-between items-center mb-5">
        <h2 className="text-2xl font-bold">File Uploads</h2>
        <label className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded cursor-pointer">
          Select Files
          <input
            type="file"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
        </label>
      </div>

      <div className="flex flex-col gap-2.5">
        {files.length === 0 ? (
          <div className="text-center text-gray-600 p-10 border-2 border-dashed border-gray-300 rounded-lg">
            No files selected for upload
          </div>
        ) : (
          files.map((file) => (
            <UploadItem
              key={file.id}
              file={file}
              progress={
                progressData[file.id] || {
                  uploadedBytes: 0,
                  totalBytes: file.file.size,
                  percentage: 0,
                  timeLeft: Math.round(file.size / (1024 * 1024)),
                  speed: 1024 * 1024,
                }
              }
              onCancel={() => handleCancelUpload(file.id)}
            />
          ))
        )}
      </div>
    </div>
  )
}

export default UploadManager
