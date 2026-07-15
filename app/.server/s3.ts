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
  DeleteBucketCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { Upload } from '@aws-sdk/lib-storage'
import { customAlphabet } from 'nanoid'
import type { User } from 'better-auth'
import type { auth } from './auth'
import { toCategory } from '../utils/converters'
import { parseEtag } from '../utils/parsers'
import { StashlyError, StashlyErrorCode } from '@/utils/api.errors'

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
  // Don't auto-inject a CRC32 checksum on operations that don't require one.
  // Without this, presigned PutObject URLs include `x-amz-checksum-crc32=AAAAAA==`
  // (CRC32 of empty body) signed into the URL, so browser PUTs of any non-empty
  // blob fail with a checksum mismatch on Tigris/S3.
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
})

const BUCKET_PREFIX = 'stashly'

function toUploadSpeed(loadedDelta: number, timeDelta: number) {
  const speedBytesPerSec = loadedDelta / timeDelta
  const speedKBPerSec = speedBytesPerSec / 1024
  const speed =
    speedKBPerSec >= 1024
      ? { value: speedKBPerSec / 1024, unit: 'MB/s' as const }
      : { value: speedKBPerSec, unit: 'KB/s' as const }
  return { speedBytesPerSec, speed }
}

function toTimeLeft(secondsRemaining: number) {
  if (isNaN(secondsRemaining)) {
    return { hours: 0, minutes: 0, seconds: 0 }
  }
  const hours = Math.floor(secondsRemaining / 3600)
  const minutes = Math.floor((secondsRemaining % 3600) / 60)
  const seconds = Math.floor(secondsRemaining % 60)
  return { hours, minutes, seconds }
}

function parseProgressPercent(loadedBytes: number, size: number) {
  return parseInt(((loadedBytes / size) * 100).toFixed(0))
}

// ====================================================== //
// =================== Key Helpers ====================== //
// ====================================================== //

/**
 * Generates a unique, AWS-compliant S3 bucket name for a user.
 *
 * Format: `stashly-{sanitized-username}-{random8}`
 *
 * The username is lowercased, stripped of non-alphanumeric characters, and
 * capped at 16 characters to keep the final name within S3's 63-character limit.
 *
 * @example
 * generateUniqueBucketName({ name: 'John Doe', ...rest })
 * // → 'stashly-johndoe-a1b2c3d4'
 */
export function generateUniqueBucketName(user: User): string {
  const nanoid = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 8)
  const cleanUsername = user.name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 16)
  return `${BUCKET_PREFIX}-${cleanUsername}-${nanoid(8)}`
}

/**
 * Derives the S3 object key for a file upload.
 *
 * Key strategy (in priority order):
 * 1. Folder upload with workspace → `{workspaceId}/{webkitRelativePath}`
 * 2. Folder upload without workspace → `{webkitRelativePath}`
 * 3. Single file with workspace → `{workspaceId}/{file.name}`
 * 4. Single file without workspace → `{file.name}`
 *
 * @example
 * // Single file scoped to a workspace
 * generateFileKey('ws_abc123', new File([''], 'report.pdf'))
 * // → 'ws_abc123/report.pdf'
 *
 * @example
 * // Folder upload (webkitRelativePath is set by the browser)
 * generateFileKey('ws_abc123', fileWithRelativePath)
 * // → 'ws_abc123/myFolder/report.pdf'
 */
export function generateFileKey(
  workspaceId: string | undefined,
  file: File
): string {
  if (file.webkitRelativePath && workspaceId) {
    return `${workspaceId}/${file.webkitRelativePath}`
  }
  if (file.webkitRelativePath) {
    return file.webkitRelativePath
  }
  return workspaceId ? `${workspaceId}/${file.name}` : file.name
}

// ====================================================== //
// =================== Bucket Actions =================== //
// ====================================================== //

/**
 * Empties then permanently deletes an S3 bucket.
 *
 * Calls `emptyBucket` first to remove all objects (S3 requires a bucket to be
 * empty before it can be deleted), then issues `DeleteBucket`.
 *
 * @example
 * await deleteBucket('stashly-johndoe-a1b2c3d4')
 */
export async function deleteBucket(bucketName: string) {
  await emptyBucket(bucketName)
  try {
    await s3.send(new DeleteBucketCommand({ Bucket: bucketName }))
  } catch (error) {
    console.error('Error deleting bucket:', error)
    throw new StashlyError(
      StashlyErrorCode.DELETE_BUCKET_FAILED,
      'Failed to delete bucket'
    )
  }
}

/**
 * Deletes all objects inside a bucket, paginating through all pages until the
 * bucket is empty. Does not delete the bucket itself.
 *
 * Uses `ListObjectsV2` + `DeleteObjects` in a loop to handle buckets with more
 * than 1,000 objects.
 *
 * @example
 * await emptyBucket('stashly-johndoe-a1b2c3d4')
 */
export async function emptyBucket(bucketName: string) {
  let isTruncated = true
  let continuationToken: string | undefined

  while (isTruncated) {
    const listResponse = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucketName,
        ContinuationToken: continuationToken,
      })
    )
    const objects =
      listResponse.Contents?.map((obj) => ({ Key: obj.Key! })) ?? []
    if (objects.length > 0) {
      await s3.send(
        new DeleteObjectsCommand({
          Bucket: bucketName,
          Delete: { Objects: objects },
        })
      )
    }
    isTruncated = listResponse.IsTruncated ?? false
    continuationToken = listResponse.NextContinuationToken
  }
}

/**
 * Creates a private S3 bucket for a user and applies the default bucket policy
 * (permissive CORS for browser uploads via presigned URLs).
 *
 * The bucket name is generated via `generateUniqueBucketName` to ensure
 * global uniqueness and compliance with AWS naming rules. After the bucket is
 * created, `applyDefaultBucketPolicy` is called so the bucket is ready for
 * direct browser PUTs from any origin.
 *
 * @returns The name of the newly created bucket.
 *
 * @example
 * const bucket = await createUserBucket(user)
 * // → 'stashly-johndoe-a1b2c3d4'
 */
export async function createUserBucket(user: User): Promise<string> {
  const bucketName = generateUniqueBucketName(user)
  try {
    await s3.send(
      new CreateBucketCommand({ Bucket: bucketName, ACL: 'private' })
    )
    await applyDefaultBucketPolicy(bucketName)
    return bucketName
  } catch (error) {
    console.error('Error creating bucket:', error)
    throw new StashlyError(
      StashlyErrorCode.CREATE_BUCKET_FAILED,
      'Failed to create user bucket'
    )
  }
}

/**
 * Applies the default S3 bucket configuration used for newly-provisioned user
 * buckets during onboarding.
 *
 * The bucket itself is created as `ACL: 'private'` in `createUserBucket`; this
 * function layers a permissive CORS configuration on top so the browser can
 * `PUT` directly to presigned URLs from any origin.
 * - `AllowedOrigins: ['*']`
 * - `AllowedMethods: ['*']`
 * - `AllowedHeaders: ['*']`
 * - `ExposeHeaders: ['*']`
 * - `MaxAgeSeconds: 80000`
 *
 * Public-read access for thumbnails is NOT handled here. Tigris returns 501
 * `NotImplemented` for `PutBucketPolicy`, so per-prefix bucket policies are
 * unavailable. Instead, thumbnail uploads are signed with object-level
 * `ACL: 'public-read'` (see `getPresignedUrl` and the thumbnails-presign
 * route) — each thumbnail object is individually made public on PUT.
 *
 * @example
 * await applyDefaultBucketPolicy('stashly-johndoe-a1b2c3d4')
 */
export async function applyDefaultBucketPolicy(bucket: string) {
  return await s3.send(
    new PutBucketCorsCommand({
      Bucket: bucket,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedOrigins: ['*'],
            AllowedMethods: ['*'],
            AllowedHeaders: ['*'],
            ExposeHeaders: ['*'],
            ID: 'DefaultPolicy',
            MaxAgeSeconds: 80000,
          },
        ],
      },
    })
  )
}

/**
 * Enables object versioning on a bucket.
 *
 * Once enabled, S3 preserves every version of every object. Versioning cannot
 * be fully disabled after it is turned on — only suspended.
 *
 * @example
 * await enableBucketVersioning('stashly-johndoe-a1b2c3d4')
 */
export async function enableBucketVersioning(bucket: string) {
  return await s3.send(
    new PutBucketVersioningCommand({
      Bucket: bucket,
      VersioningConfiguration: { Status: 'Enabled', MFADelete: 'Disabled' },
    })
  )
}

/**
 * Returns the current CORS configuration for a bucket.
 *
 * Throws if no CORS rules have been set yet (S3 returns a `NoSuchCORSConfiguration` error).
 *
 * @example
 * const cors = await getBucketCors('stashly-johndoe-a1b2c3d4')
 * console.log(cors.CORSRules)
 */
export async function getBucketCors(bucket: string) {
  return await s3.send(new GetBucketCorsCommand({ Bucket: bucket }))
}

/**
 * Applies a permissive CORS policy to a bucket, allowing direct browser uploads
 * via presigned URLs from any origin.
 *
 * Sets `AllowedOrigins: ['*']`, all methods, all headers, exposes all response
 * headers, and caches the preflight response for 24 hours.
 *
 * @example
 * await setBucketCors('stashly-johndoe-a1b2c3d4')
 */
export async function setBucketCors(bucket: string) {
  return await s3.send(
    new PutBucketCorsCommand({
      Bucket: bucket,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedOrigins: ['*'],
            AllowedMethods: ['*'],
            AllowedHeaders: ['*'],
            ExposeHeaders: ['*'],
            MaxAgeSeconds: 86400,
          },
        ],
      },
    })
  )
}

// ====================================================== //
// ==================== File Actions ==================== //
// ====================================================== //

/**
 * Uploads a file to S3 using the managed `@aws-sdk/lib-storage` Upload helper,
 * which automatically uses multipart upload for large files.
 *
 * Attaches user-scoped metadata and S3 object tags, and reports real-time
 * upload speed, percentage, and estimated time remaining via `onProgress`.
 *
 * @param bucket - The target S3 bucket name.
 * @param file - The `File` object to upload.
 * @param user - The authenticated session user (provides ownership metadata).
 * @param workspaceId - Optional workspace scope; used in the object key.
 * @param onProgress - Optional callback fired on each upload progress event.
 * @param abortController - Optional controller to cancel the upload mid-flight.
 * @returns `{ key, bucket, etag, versionId, metadata }` on success.
 *
 * @example
 * const result = await uploadFile(
 *   user.bucket,
 *   file,
 *   user,
 *   workspaceId,
 *   (p) => console.log(`${p.percentage}% at ${p.speed.value} ${p.speed.unit}`),
 *   abortController
 * )
 * // → { key: 'ws_abc/report.pdf', bucket: 'stashly-...', etag: 'abc123', ... }
 */
export async function uploadFile(
  bucket: string,
  file: File,
  user: typeof auth.$Infer.Session.user,
  workspaceId: string | undefined,
  onProgress?: (progress: UploadProgress) => void,
  abortController?: AbortController
) {
  const key = generateFileKey(workspaceId, file)
  let uploadStartTime = Date.now()
  let lastLoaded = 0
  let lastLoadedTime = uploadStartTime

  const metadata: Record<string, string> = {
    uploadedBy: user.id,
    driveId: user.driveId,
    storagePlanId: user.storagePlanId,
    subscriptionId: user.subscriptionId,
    category: toCategory(file),
  }
  if (workspaceId) metadata['workspaceId'] = workspaceId

  const upload = new Upload({
    client: s3,
    abortController,
    queueSize: 4,
    tags: [
      { Key: 'Category', Value: toCategory(file) },
      { Key: 'UploadedBy', Value: user.id },
      { Key: 'DriveId', Value: user.driveId },
      { Key: 'StoragePlanId', Value: user.storagePlanId },
      { Key: 'SubscriptionId', Value: user.subscriptionId },
    ],
    params: {
      Bucket: bucket,
      Key: key,
      Body: file.stream(),
      ContentType: file.type,
      ContentLength: file.size,
      Metadata: metadata,
    },
  })

  if (abortController) {
    abortController.signal.addEventListener('abort', () => upload.abort())
  }

  upload.on('httpUploadProgress', (progress) => {
    const currentTime = Date.now()
    const loadedDelta = progress?.loaded! - lastLoaded
    const timeDelta = (currentTime - lastLoadedTime) / 1000

    if (timeDelta <= 0) {
      console.warn(`No time elapsed for ${key}, skipping progress update`)
      return
    }

    const { speedBytesPerSec, speed } = toUploadSpeed(loadedDelta, timeDelta)

    const percentage = parseProgressPercent(progress.loaded!, file.size)
    const timeLeft = toTimeLeft(
      (file.size - progress.loaded!) / speedBytesPerSec
    )

    lastLoaded = progress.loaded!
    lastLoadedTime = currentTime

    onProgress?.({ percentage, timeLeft, speed })
  })

  try {
    if (abortController?.signal.aborted)
      throw new Error('Upload aborted by user')
    const response = await upload.done()
    return {
      key,
      bucket: response.Bucket,
      etag: parseEtag(response.ETag || ''),
      versionId: response.VersionId,
      metadata: response.$metadata,
    }
  } catch (error: unknown) {
    console.error(
      'Error uploading file:',
      error instanceof Error ? error.message : error
    )
    throw new Error(
      `Failed to upload file to S3: ${error instanceof Error ? error.message : error}`
    )
  }
}

/**
 * Generates a presigned URL for either downloading (`get`) or uploading (`put`) an object.
 *
 * The URL is time-limited and signed with the service account credentials, allowing
 * the browser to access or write the object directly without exposing credentials.
 *
 * @param bucket - The S3 bucket containing the object.
 * @param type - `'get'` for a download URL, `'put'` for an upload URL.
 * @param key - The S3 object key.
 * @param expiresIn - URL lifetime in seconds (default: 3600).
 * @param options.acl - Optional canned ACL signed into a `put` URL. Set to
 *   `'public-read'` for thumbnails so the uploaded object is anonymously
 *   readable on a private bucket (Tigris doesn't support `PutBucketPolicy`,
 *   so per-object ACL is the only way to expose individual prefixes).
 *   Ignored for `get` URLs.
 * @returns A signed HTTPS URL string.
 *
 * @example
 * const downloadUrl = await getPresignedUrl(user.bucket, 'get', 'ws_abc/report.pdf')
 * const uploadUrl   = await getPresignedUrl(user.bucket, 'put', 'ws_abc/photo.jpg', 300)
 * const publicThumb = await getPresignedUrl(user.bucket, 'put', 'thumbnails/itm_123.webp', 300, { acl: 'public-read' })
 */
export async function getPresignedUrl(
  bucket: string,
  type: 'get' | 'put',
  key: string,
  expiresIn = 3600,
  options?: { acl?: 'public-read' | 'private' }
) {
  const command =
    type === 'get'
      ? new GetObjectCommand({ Bucket: bucket, Key: key })
      : new PutObjectCommand({ Bucket: bucket, Key: key, ACL: options?.acl })
  return await getSignedUrl(s3, command, { expiresIn })
}

/**
 * Permanently deletes a single object from a bucket.
 *
 * @param bucket - The S3 bucket containing the object.
 * @param key - The S3 object key to delete.
 *
 * @example
 * await deleteFile(user.bucket, 'ws_abc/old-report.pdf')
 */
export async function deleteFile(bucket: string, key: string) {
  try {
    await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
  } catch (error) {
    console.error('Error deleting file:', error)
    throw new Error('Failed to delete file from S3')
  }
}

/**
 * Checks whether an object exists in a bucket using a `HEAD` request.
 *
 * Does not download the object body. Returns `false` for any S3 error
 * (including 404), so callers should not rely on this for permission checks.
 *
 * @returns `true` if the object exists and is accessible, `false` otherwise.
 *
 * @example
 * const exists = await checkFileExists(user.bucket, 'ws_abc/report.pdf')
 * if (!exists) throw new Error('File not found')
 */
export async function checkFileExists(
  bucket: string,
  key: string
): Promise<boolean> {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
    return true
  } catch {
    return false
  }
}

/**
 * Returns metadata for an object without downloading its body.
 *
 * Uses `HeadObject` which is cheap (no data transfer). Useful for retrieving
 * content type, size, ETag, and custom metadata set at upload time.
 *
 * @returns `{ contentType, contentLength, lastModified, etag, metadata }`.
 *
 * @example
 * const meta = await getFileMetadata(user.bucket, 'ws_abc/report.pdf')
 * console.log(meta.contentType)   // 'application/pdf'
 * console.log(meta.contentLength) // 204800
 */
export async function getFileMetadata(bucket: string, key: string) {
  try {
    const response = await s3.send(
      new HeadObjectCommand({ Bucket: bucket, Key: key })
    )
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

/**
 * getObjectHead — ranged GET of the first N bytes, used by the
 *  complete-multipart-upload verification in the action route.
 * Pulls 1KB regardless of object size.
 */
export async function getObjectHead(
  bucket: string,
  key: string,
  bytes = 1024
): Promise<Uint8Array> {
  const res = await s3.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      Range: `bytes=0-${bytes - 1}`,
    })
  )
  return res.Body!.transformToByteArray()
}

/**
 * getObjectText — full-body GET of an object decoded as UTF-8 text.
 *
 * Unlike `getObjectHead` (a ranged read of the first N bytes), this reads the
 * entire object and decodes it to a string. Used for server-side loading of
 * text documents (e.g. the Markdown reader) so the content ships in the SSR
 * response instead of a separate browser → S3 round trip.
 *
 * @example
 * const md = await getObjectText(user.bucket, 'ws_abc/README.md')
 */
export async function getObjectText(bucket: string, key: string): Promise<string> {
  const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
  return res.Body!.transformToString('utf-8')
}

// ========================================================= //
// =================== Multipart Actions =================== //
// ========================================================= //

/**
 * Initiates a multipart upload and returns the S3 response (including `UploadId`).
 *
 * The `UploadId` must be passed to every subsequent `getPresignedUrlForPart`,
 * `completeMultipartUpload`, and `abortMultipartUpload` call for this upload.
 *
 * `mimeType` in `metadata` is read out and set as the object's `ContentType`.
 *
 * @example
 * const { UploadId } = await createMultipartUpload(
 *   user.bucket,
 *   'ws_abc/video.mp4',
 *   { mimeType: 'video/mp4', ownerId: user.id }
 * )
 */
export async function createMultipartUpload(
  bucket: string,
  key: string,
  metadata?: Record<string, string>,
  contentType?: string
) {
  return s3.send(
    new CreateMultipartUploadCommand({
      Bucket: bucket,
      Key: key,
      Metadata: metadata,
      ContentType: contentType ?? 'application/octet-stream',
    })
  )
}

/**
 * Generates a presigned URL that the browser uses to `PUT` a single part
 * directly to S3 without proxying through the server.
 *
 * Part numbers must be between 1 and 10,000. S3 requires each part (except the
 * last) to be at least 5 MB.
 *
 * @param bucket - The S3 bucket for the upload.
 * @param key - The S3 object key being assembled.
 * @param uploadId - The ID returned by `createMultipartUpload`.
 * @param partNumber - 1-based index of the chunk being uploaded.
 * @param expiresIn - URL lifetime in seconds (default: 3600).
 * @returns A signed HTTPS URL the client can `PUT` the chunk body to.
 *
 * @example
 * const url = await getPresignedUrlForPart(user.bucket, 'ws_abc/video.mp4', uploadId, 1)
 * await fetch(url, { method: 'PUT', body: chunk })
 */
export async function getPresignedUrlForPart(
  bucket: string,
  key: string,
  uploadId: string,
  partNumber: number,
  expiresIn = 3600
) {
  return await getSignedUrl(
    s3,
    new UploadPartCommand({
      Bucket: bucket,
      Key: key,
      UploadId: uploadId,
      PartNumber: partNumber,
    }),
    { expiresIn }
  )
}

/**
 * Finalizes a multipart upload by sending S3 the ordered list of ETags.
 *
 * S3 reassembles the parts into the complete object. Must be called after all
 * parts have been uploaded successfully. Calling this with a missing or
 * out-of-order part list will cause S3 to reject the request.
 *
 * @param bucket - The S3 bucket for the upload.
 * @param key - The S3 object key being assembled.
 * @param uploadId - The ID returned by `createMultipartUpload`.
 * @param parts - Array of `{ ETag, PartNumber }` collected from each part response.
 *
 * @example
 * await completeMultipartUpload(user.bucket, 'ws_abc/video.mp4', uploadId, [
 *   { ETag: '"abc123"', PartNumber: 1 },
 *   { ETag: '"def456"', PartNumber: 2 },
 * ])
 */
export async function completeMultipartUpload(
  bucket: string,
  key: string,
  uploadId: string,
  parts: CompletedPart[]
) {
  return await s3.send(
    new CompleteMultipartUploadCommand({
      Bucket: bucket,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: { Parts: parts },
    })
  )
}

/**
 * Cancels an in-progress multipart upload and instructs S3 to delete all
 * uploaded parts, freeing storage.
 *
 * Should be called whenever an upload fails or is cancelled by the user to
 * avoid accumulating orphaned parts (which are billed).
 *
 * @example
 * await abortMultipartUpload(user.bucket, 'ws_abc/video.mp4', uploadId)
 */
export async function abortMultipartUpload(
  bucket: string,
  key: string,
  uploadId: string
) {
  return await s3.send(
    new AbortMultipartUploadCommand({
      Bucket: bucket,
      Key: key,
      UploadId: uploadId,
    })
  )
}

/**
 * Lists the parts that have already been uploaded for a multipart upload.
 *
 * Useful for resuming interrupted uploads — compare the returned part numbers
 * against the expected set to determine which chunks still need to be sent.
 *
 * @example
 * const { Parts } = await listMultipartUploadParts(user.bucket, 'ws_abc/video.mp4', uploadId)
 * const uploadedPartNumbers = new Set(Parts?.map(p => p.PartNumber))
 */
export async function listMultipartUploadParts(
  bucket: string,
  key: string,
  uploadId: string
) {
  return await s3.send(
    new ListPartsCommand({ Bucket: bucket, Key: key, UploadId: uploadId })
  )
}
