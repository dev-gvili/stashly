// types.ts
export interface FileUpload {
  id: string
  name: string
  size: number
  type: string
  lastModified: number
}

export interface UploadProgress {
  uploadedBytes: number
  totalBytes: number
  percentage: number
  timeLeft: number // in seconds
  speed: number // bytes per second
}

export interface UserQuota {
  userId: string
  totalSpace: number // in bytes
  usedSpace: number // in bytes
  freeSpace: number // in bytes
  plan: 'free' | 'pro' | 'enterprise'
}

export interface UploadQueueItem {
  fileId: string
  status: 'pending' | 'active' | 'completed' | 'skipped' | 'canceled'
  priority: number
  addedAt: Date
}

export interface S3MultipartUpload {
  uploadId: string
  parts: Array<{
    partNumber: number
    etag: string
  }>
  key: string
}
