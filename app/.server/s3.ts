import {
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  CreateBucketCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  type CompletedPart,
  PutBucketVersioningCommand,
  PutBucketCorsCommand,
  GetBucketCorsCommand,
  ListPartsCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { Upload } from '@aws-sdk/lib-storage'
import { customAlphabet } from 'nanoid'
// import { prisma } from '@/services/db.server'
import type { User } from 'better-auth'
import type { auth } from './auth'
import { toCategory } from '../utils/converters'

export interface UploadProgress {
  percentage: number
  timeLeft: {
    hours: number
    minutes: number
    seconds: number
  }
  speed: {
    value: number
    unit: 'KB/s' | 'MB/s'
  }
}
export const s3 = new S3Client({
  region: process.env.AWS_REGION!,
  endpoint: process.env.AWS_ENDPOINT_URL!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY!,
    secretAccessKey: process.env.AWS_SECRET_KEY!,
  },
})

export class S3Service {
  private s3Client: S3Client
  private bucketPrefix = 'stashly' // Your app prefix
  private bucket: string = ''

  /**
   * Initializes the S3Service.
   * @param bucketName Optional bucket name to initialize with.
   */
  constructor(bucketName?: string) {
    // Initialize S3 client with service account credentials
    this.s3Client = s3
    if (bucketName) {
      this.bucket = bucketName
    }
  }

  /**
   * Calculates the upload speed.
   * @param loadedDelta The number of bytes loaded since the last measurement.
   * @param timeDelta The time elapsed in seconds since the last measurement.
   * @returns The upload speed in bytes/sec and a formatted string.
   * @private
   */
  private toUploadSpeed(loadedDelta: number, timeDelta: number) {
    const speedBytesPerSec = loadedDelta / timeDelta
    const speedKBPerSec = speedBytesPerSec / 1024
    const speed =
      speedKBPerSec >= 1024
        ? { value: speedKBPerSec / 1024, unit: 'MB/s' as const }
        : { value: speedKBPerSec, unit: 'KB/s' as const }
    return { speedBytesPerSec, speed }
  }

  /**
   * Calculates the estimated time remaining for an upload.
   * @param secondsRemaining The estimated seconds remaining.
   * @returns An object with hours, minutes, and seconds.
   * @private
   */
  private toTimeLeft(secondsRemaining: number) {
    console.log('secondsRemaining', secondsRemaining)
    if (isNaN(secondsRemaining)) {
      return { hours: 0, minutes: 0, seconds: 0 }
    }
    const hours = Math.floor(secondsRemaining / 3600)
    const minutes = Math.floor((secondsRemaining % 3600) / 60)
    const seconds = Math.floor(secondsRemaining % 60)
    // if (hours === Infinity && isNaN(minutes) && isNaN(seconds)) {
    // 	return { hours: 0, minutes: 0, seconds: 0 }
    // }
    return { hours, minutes, seconds }
  }

  /**
   * Calculates the upload progress percentage.
   * @param loadedBytes The number of bytes loaded so far.
   * @param size The total size of the file.
   * @returns The progress percentage.
   * @private
   */
  private parseProgress(loadedBytes: number, size: number) {
    let progress = (loadedBytes / size) * 100
    return parseInt(progress.toFixed(0))
  }

  /**
   * Generates a unique bucket name based on user and random string
   * Format: stashly-{userId}-{username}-{random}
   * Ensures AWS S3 bucket naming rules compliance
   */
  generateUniqueBucketName(user: User): string {
    // Create nanoid with safe characters for S3 bucket names
    const nanoid = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 8)

    // Clean username - remove special chars, convert to lowercase
    const cleanUsername = user.name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 16) // max 16 chars for username part

    // Generate bucket name components
    const userPart = `${cleanUsername}`
    const randomPart = nanoid(8)

    // Combine parts with prefix
    const bucketName = `${this.bucketPrefix}-${userPart}-${randomPart}`
    this.bucket = bucketName // Store for later use
    return bucketName
  }

  /**
   * Generate a unique file key for S3 workspace id can be optional.
   * Format: {workspaceId}/{fileId}
   */
  generateFileKey(workspaceId: string | undefined, file: File): string {
    if (file.webkitRelativePath && workspaceId) {
      // If the file has a webkitRelativePath, use it as the key
      return `${workspaceId}/${file.webkitRelativePath}`
    }
    if (file.webkitRelativePath && !workspaceId) {
      // If the file has a webkitRelativePath but no workspaceId, use it directly
      return file.webkitRelativePath
    }

    return workspaceId ? `${workspaceId}/${file.name}` : file.name
  }

  // ====================================================== //
  // =================== Bucket Methods =================== //
  // ====================================================== //

  /**
   * Deletes all objects within a specified bucket.
   * @param bucketName The name of the bucket to empty.
   */
  async emptyBucket(bucketName: string) {
    let isTruncated = true
    let continuationToken: string | undefined = undefined

    while (isTruncated) {
      const listCommand: ListObjectsV2Command = new ListObjectsV2Command({
        Bucket: bucketName,
        ContinuationToken: continuationToken,
      })
      const listResponse = await this.s3Client.send(listCommand)

      const objects =
        listResponse.Contents?.map((obj) => ({ Key: obj.Key! })) || []

      if (objects.length > 0) {
        const deleteCommand = new DeleteObjectsCommand({
          Bucket: bucketName,
          Delete: { Objects: objects },
        })
        await this.s3Client.send(deleteCommand)
      }

      isTruncated = listResponse.IsTruncated ?? false
      continuationToken = listResponse.NextContinuationToken
    }
  }

  /**
   * Create a new bucket with the generated name
   */
  async createUserBucket(user: User) {
    const bucketName = this.generateUniqueBucketName(user)

    try {
      const command = new CreateBucketCommand({
        Bucket: bucketName,
        ACL: 'private',
      })
      await this.s3Client.send(command)
      return bucketName
    } catch (error) {
      console.error('Error creating bucket:', error)
      throw new Error('Failed to create user bucket')
    }
  }

  /**
   * Enables versioning on a bucket.
   * @param bucket The name of the bucket.
   */
  async creatBucketVersioning(bucket: string) {
    const command = new PutBucketVersioningCommand({
      Bucket: bucket,
      VersioningConfiguration: {
        Status: 'Enabled',
        MFADelete: 'Disabled',
      },
    })
    return await this.s3Client.send(command)
  }

  // ====================================================== //
  // ==================== File Methods ==================== //
  // ====================================================== //

  /**
   * Upload a file to S3 with workspace and file ID in the key.
   * Returns metadata including key, ETag, and version ID.
   */
  async uploadFile(
    file: File,
    user: typeof auth.$Infer.Session.user,
    workspaceId: string | undefined,
    onProgress?: (progress: UploadProgress) => void,
    abortController?: AbortController
  ) {
    // Generate unique key.
    const key = this.generateFileKey(workspaceId, file)
    let uploadStartTime = Date.now()
    let lastLoaded = 0
    let lastLoadedTime = uploadStartTime

    let metadata: Record<string, string> = {}
    metadata = {
      uploadedBy: user.id,
      driveId: user.driveId,
      storagePlanId: user.storagePlanId,
      subscriptionId: user.subscriptionId,
      category: toCategory(file),
    }
    if (workspaceId) {
      metadata['workspaceId'] = workspaceId
    }
    // Create a new upload instance
    const upload = new Upload({
      client: this.s3Client,
      abortController,
      // partSize: 50 * 1024 * 1024,
      queueSize: 1,
      tags: [
        { Key: 'Category', Value: toCategory(file) },
        { Key: 'UploadedBy', Value: user.id },
        { Key: 'DriveId', Value: user.driveId },
        { Key: 'StoragePlanId', Value: user.storagePlanId },
        { Key: 'SubscriptionId', Value: user.subscriptionId },
      ],
      params: {
        Bucket: this.bucket,
        Key: key,
        Body: file.stream(),
        ContentType: file.type,
        ContentLength: file.size,
        Metadata: metadata,
      },
    })

    // Handle cancellation
    if (abortController) {
      abortController.signal.addEventListener('abort', () => {
        upload.abort()
        console.log(`Upload for ${key} has been cancelled.`)
      })
    }
    // Track upload progress
    upload.on('httpUploadProgress', (progress) => {
      // progress.
      // if (!progress.loaded || !progress.total) {
      // 	console.warn(`No upload data available for ${key}`)
      // 	return
      // }

      const currentTime = Date.now()
      const elapsedTime = (currentTime - uploadStartTime) / 1000 // in seconds
      const loadedDelta = progress?.loaded! - lastLoaded
      const timeDelta = (currentTime - lastLoadedTime) / 1000 // in seconds

      // Calculate upload speed
      const { speedBytesPerSec, speed } = this.toUploadSpeed(
        loadedDelta,
        timeDelta
      )

      // If no time has passed, skip progress update
      if (timeDelta <= 0) {
        console.warn(`No time elapsed for ${key}, skipping progress update`)
        return
      }
      const percentage = this.parseProgress(progress.loaded!, file.size)

      // Calculate time
      const remainingBytes = file.size - progress.loaded!
      const remainingSeconds = remainingBytes / speedBytesPerSec
      const timeLeft = this.toTimeLeft(remainingSeconds)

      // Update progress tracking
      lastLoaded = progress.loaded!
      lastLoadedTime = currentTime

      // Call progress callback if provided
      onProgress!({
        percentage,
        timeLeft,
        speed,
      })

      // // Log progress
      // console.log(
      // 	`Upload Progress for ${key}:`,
      // 	`${percentage}% |`,
      // 	`Speed: ${speed.value.toFixed(2)} ${speed.unit} |`,
      // 	`Time left: ${timeLeft.hours}h ${timeLeft.minutes}m ${timeLeft.seconds}s`
      // )
    })

    try {
      // Check if already aborted before starting
      if (abortController?.signal.aborted) {
        // throw new Error('Upload aborted')
      }

      const response = await upload.done()

      return {
        key,
        etag: response.ETag,
        versionId: response.VersionId,
        metadata: response.$metadata,
      }
    } catch (error) {
      console.error('Error uploading file:', error)
      // throw new Error('Failed to upload file to S3')
    }
  }

  // get bucket cors
  async getBucketCors() {
    const command = new GetBucketCorsCommand({
      Bucket: this.bucket,
    })
    return await this.s3Client.send(command)
  } 

  /**
   * Sets a default CORS configuration on the bucket.
   */
  async setCorsOnBucket() {
    const command = new PutBucketCorsCommand({
      Bucket: this.bucket,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedOrigins: ['http://localhost:3000'],
            AllowedMethods: ['GET', 'PUT', 'POST', 'DELETE'],
            AllowedHeaders: ['*'],
            ExposeHeaders: [
              'ETag',
              'Content-Length',
              'Content-Type',
              'Content-Disposition',
              'Version',
            ],
            MaxAgeSeconds: 3000,
          },
        ],
      },
    })
    return await this.s3Client.send(command)
  }

  /**
   * Generates a presigned URL for getting or putting an object.
   * @param type The type of URL to generate ('get' or 'put').
   * @param key The key of the object.
   * @param expiresIn The expiration time in seconds for the URL. Defaults to 3600.
   * @returns A presigned URL.
   */
  async getPresignedUrl(type: 'get' | 'put', key: string, expiresIn = 3600) {
    const command =
      type === 'get'
        ? new GetObjectCommand({
            Bucket: this.bucket,
            Key: key,
          })
        : new PutObjectCommand({
            Bucket: this.bucket,
            Key: key,
          })
    return await getSignedUrl(this.s3Client, command, { expiresIn })
  }

  /**
   * Deletes a file from the S3 bucket.
   * @param key The key of the file to delete.
   */
  async deleteFile(key: string) {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    })

    try {
      await this.s3Client.send(command)
    } catch (error) {
      console.error('Error deleting file:', error)
      throw new Error('Failed to delete file from S3')
    }
  }

  /**
   * Checks if a file exists in the S3 bucket.
   * @param key The key of the file to check.
   * @returns True if the file exists, false otherwise.
   */
  async checkFileExists(key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      })
      await this.s3Client.send(command)
      return true
    } catch (error) {
      return false
    }
  }

  /**
   * Gets the metadata of a file without downloading its content.
   * @param key The key of the file.
   * @returns The file's metadata.
   */
  async getFileMetadata(key: string) {
    const command = new HeadObjectCommand({
      Bucket: this.bucket,
      Key: key,
    })

    try {
      const response = await this.s3Client.send(command)
      return {
        contentType: response.ContentType,
        contentLength: response.ContentLength,
        lastModified: response.LastModified,
        etag: response.ETag,
        metadata: response.Metadata,
      }
    } catch (error) {
      console.error('Error getting file metadata:', error)
      throw new Error('Failed to get file metadata from S3')
    }
  }

  // ========================================================= //
  // =================== Multipart Methods =================== //
  // ========================================================= //

  /**
   * Creates a new multipart upload.
   * @param key The key of the object to upload.
   * @param metadata Optional metadata to associate with the object.
   * @returns The multipart upload details.
   */
  async createMultipartUpload(key: string, metadata?: Record<string, string>) {
    const command = new CreateMultipartUploadCommand({
      Bucket: this.bucket,
      Key: key,
      Metadata: metadata,
      ContentType: metadata?.mimeType,
    })
    return await this.s3Client.send(command)
  }

  /**
   * Generates a presigned URL for uploading a part of a multipart upload.
   * @param key The key of the object.
   * @param uploadId The ID of the multipart upload.
   * @param partNumber The number of the part.
   * @param expiresIn The expiration time in seconds for the URL. Defaults to 3600.
   * @returns A presigned URL for the part.
   */
  async getPresignedUrlForPart(
    key: string,
    uploadId: string,
    partNumber: number,
    expiresIn: number = 3600
  ) {
    const command = new UploadPartCommand({
      Bucket: this.bucket,
      Key: key,
      UploadId: uploadId,
      PartNumber: partNumber,
    })
    return await getSignedUrl(this.s3Client, command, { expiresIn })
  }

  /**
   * Completes a multipart upload.
   * @param key The key of the object.
   * @param uploadId The ID of the multipart upload.
   * @param parts An array of completed parts.
   * @returns The result of the completed upload.
   */
  async completeMultipartUpload(
    key: string,
    uploadId: string,
    parts: CompletedPart[]
  ) {
    const command = new CompleteMultipartUploadCommand({
      Bucket: this.bucket,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: parts,
      },
    })
    return await this.s3Client.send(command)
  }

  /**
   * Aborts a multipart upload.
   * @param key The key of the object.
   * @param uploadId The ID of the multipart upload to abort.
   */
  async abortMultipartUpload(key: string, uploadId: string) {
    const command = new AbortMultipartUploadCommand({
      Bucket: this.bucket,
      Key: key,
      UploadId: uploadId,
    })
    return await this.s3Client.send(command)
  }

  /**
   * Lists the parts that have been uploaded for a specific multipart upload.
   * @param key The key of the object.
   * @param uploadId The ID of the multipart upload.
   * @returns A list of the uploaded parts.
   */
  async listMultipartUploadParts(key: string, uploadId: string) {
    const command = new ListPartsCommand({
      Bucket: this.bucket,
      Key: key,
      UploadId: uploadId,
    })
    return await this.s3Client.send(command)
  }
}
