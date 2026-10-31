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
import { createHash, createHmac, type BinaryLike } from 'node:crypto'
import { customAlphabet } from 'nanoid'
import type { User } from 'better-auth'
import type { auth } from './auth'
import { toCategory } from '../utils/converters'
import { parseEtag } from '../utils/parsers'
import { StashlyError, StashlyErrorCode } from '@/utils/api.errors'
import { log } from '@/services/log'

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
    log.error('S3 bucket delete failed', { bucket: bucketName, error })
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
 * Per-object ACLs stay **off** (Tigris's default). Nothing in the bucket is
 * public: every read — thumbnails included — goes through a presigned GET.
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
    log.error('S3 bucket create failed', { error })
    throw new StashlyError(
      StashlyErrorCode.CREATE_BUCKET_FAILED,
      'Failed to create user bucket'
    )
  }
}

/**
 * Sends a SigV4-signed request to Tigris's bucket-settings API.
 *
 * This is **not** part of the S3 API — it is Tigris's own bucket-configuration
 * endpoint, served from the same host and signed with the same credentials
 * (`service: 's3'`, `region: 'auto'`). The official `@tigrisdata/storage` SDK
 * talks to it the same way; we sign by hand so the SDK isn't a new dependency.
 *
 * @param method - `'GET'` to read bucket metadata, `'PATCH'` to update settings.
 * @param bucket - The bucket name, used as the request path.
 * @param options.query - Query params. Signed sorted by key, as SigV4 requires,
 *   and sent in that same order so the signature matches.
 * @param options.body - JSON request body for `PATCH`.
 */
async function tigrisBucketRequest(
  method: 'GET' | 'PATCH',
  bucket: string,
  options: { query?: Record<string, string>; body?: string } = {}
) {
  const { query = {}, body } = options
  const endpoint = process.env.AWS_ENDPOINT_URL!.replace(/\/$/, '')
  const accessKeyId = process.env.AWS_ACCESS_KEY!
  const secretAccessKey = process.env.AWS_SECRET_KEY!
  const region = process.env.AWS_REGION ?? 'auto'

  const sha256Hex = (value: string) =>
    createHash('sha256').update(value).digest('hex')
  const hmac = (key: BinaryLike, value: string) =>
    createHmac('sha256', key).update(value).digest()

  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '')
  const date = amzDate.slice(0, 8)
  const payloadHash = sha256Hex(body ?? '')

  const headers: Record<string, string> = {
    host: new URL(endpoint).host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
    ...(body
      ? { 'content-type': 'application/json' }
      : { accept: 'application/json' }),
  }
  const sortedHeaderKeys = Object.keys(headers).sort()
  const signedHeaders = sortedHeaderKeys.join(';')
  const canonicalHeaders = sortedHeaderKeys
    .map((key) => `${key}:${headers[key]}\n`)
    .join('')
  const canonicalQuery = Object.keys(query)
    .sort()
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(query[key])}`)
    .join('&')

  const path = `/${bucket}`
  const canonicalRequest = [
    method,
    path,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n')
  const scope = `${date}/${region}/s3/aws4_request`
  const signingKey = hmac(
    hmac(hmac(hmac(`AWS4${secretAccessKey}`, date), region), 's3'),
    'aws4_request'
  )
  const signature = createHmac('sha256', signingKey)
    .update(
      ['AWS4-HMAC-SHA256', amzDate, scope, sha256Hex(canonicalRequest)].join('\n')
    )
    .digest('hex')
  headers.authorization = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

  const response = await fetch(
    `${endpoint}${path}${canonicalQuery ? `?${canonicalQuery}` : ''}`,
    { method, headers, body }
  )
  return { ok: response.ok, status: response.status, text: await response.text() }
}

/**
 * Reports whether per-object ACLs are enabled on a bucket.
 *
 * Reads Tigris's bucket metadata and returns `acl_settings.allow_object_acl`.
 * A bucket that has never had the setting applied omits the field entirely,
 * which reads as `false`. Returns `false` on any transport or parse error —
 * callers use this to decide whether to (re-)apply the setting, and re-applying
 * it is harmless.
 *
 * @example
 * if (!(await isObjectAclEnabled(user.bucket))) await enableObjectAcl(user.bucket)
 */
export async function isObjectAclEnabled(bucket: string): Promise<boolean> {
  const response = await tigrisBucketRequest('GET', bucket, {
    query: { metadata: '', 'with-size': 'false' },
  })
  if (!response.ok) return false
  try {
    return JSON.parse(response.text)?.acl_settings?.allow_object_acl === true
  } catch {
    return false
  }
}

/**
 * Turns per-object ACLs on or off for a bucket.
 *
 * **Nothing in the app needs this on.** Every read is a presigned GET, so no
 * object is ever public. It exists for the one-off sweep that turns the flag
 * back *off* on buckets provisioned while thumbnails were public-read — and as
 * the documented lever, since the setting is invisible over the S3 API:
 * `GetBucketAcl` reports a bucket with it on and one with it off identically.
 *
 * With the flag on, Tigris applies an `x-amz-acl` header from *any* presigned
 * PUT, signed or not (verified 2026-09-16), so a client could make objects
 * anonymously readable on its own. With it off, the ACL is stored but never
 * served: the anonymous GET 403s.
 *
 * There is no S3-native equivalent on Tigris (verified 2026-09-16):
 * `PutBucketPolicy` returns 501 `NotImplemented`, `PutBucketOwnershipControls`
 * with `ObjectWriter` is accepted but has no effect, and `PutBucketAcl` with
 * `public-read` works but exposes the whole bucket. This is the same call the
 * dashboard toggle and `@tigrisdata/storage`'s `updateBucket` make.
 *
 * @param bucket - The bucket to update.
 * @param enabled - `true` allows per-object ACLs, `false` ignores them on read.
 *
 * @throws {StashlyError} `CREATE_BUCKET_FAILED` if Tigris rejects the update.
 *
 * @example
 * await setObjectAclEnabled('stashly-johndoe-a1b2c3d4', false)
 */
export async function setObjectAclEnabled(
  bucket: string,
  enabled: boolean
): Promise<void> {
  const response = await tigrisBucketRequest('PATCH', bucket, {
    body: JSON.stringify({ acl_settings: { allow_object_acl: enabled } }),
  })
  if (!response.ok) {
    log.error('S3 object ACL setting failed', {
      bucket,
      status: response.status,
    })
    throw new StashlyError(
      StashlyErrorCode.CREATE_BUCKET_FAILED,
      'Failed to update object ACL setting on user bucket'
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
 * Nothing here grants public access, and nothing else does either: Tigris
 * returns 501 `NotImplemented` for `PutBucketPolicy`, and per-object ACLs stay
 * off. Thumbnails — the one prefix that used to be public — are read through
 * presigned GETs like every other object (see `signThumbnails` in
 * `thumbnail-actions.ts`).
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
      log.debug('no time elapsed, progress update skipped', { key })
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
    log.error('S3 upload failed', { key, error })
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
 * @param expiresIn - URL lifetime in seconds, counted from `signingDate` (default: 3600).
 * @param options.responseCacheControl - **`get` only.** Sent as
 *   `response-cache-control`, which Tigris honours, so the response carries an
 *   explicit `Cache-Control`. Objects are stored without one of their own.
 * @param options.responseContentDisposition - **`get` only.** Sent as
 *   `response-content-disposition`. It is part of the signature, so it also
 *   serves as the only safe cache-bust for a key that gets overwritten:
 *   a param appended to a finished URL (`url + '&v=2'`) is outside the
 *   signature and Tigris returns 403 (verified 2026-09-16).
 * @param options.signingDate - Pins `X-Amz-Date` (default: now). Two calls with
 *   the same date, key and params return byte-identical URLs, so the browser's
 *   HTTP cache can hit across re-renders instead of downloading again.
 * @returns A signed HTTPS URL string.
 *
 * @example
 * const downloadUrl = await getPresignedUrl(user.bucket, 'get', 'ws_abc/report.pdf')
 * const uploadUrl   = await getPresignedUrl(user.bucket, 'put', 'ws_abc/photo.jpg', 300)
 *
 * @example
 * // Stable, cacheable thumbnail read: identical for every render this hour,
 * // and distinct per stage because the disposition carries the stage.
 * const viewUrl = await getPresignedUrl(user.bucket, 'get', 'thumbnails/itm_123.webp', 7200, {
 *   responseContentDisposition: 'inline; filename="itm_123-s2.webp"',
 *   signingDate: new Date(Math.floor(Date.now() / 3_600_000) * 3_600_000),
 *   responseCacheControl: 'private, max-age=3600',
 * })
 */
export async function getPresignedUrl(
  bucket: string,
  type: 'get' | 'put',
  key: string,
  expiresIn = 3600,
  options?: {
    responseCacheControl?: string
    responseContentDisposition?: string
    signingDate?: Date
  }
) {
  const signOptions = {
    expiresIn,
    ...(options?.signingDate ? { signingDate: options.signingDate } : {}),
  }

  if (type === 'put') {
    return await getSignedUrl(
      s3,
      new PutObjectCommand({ Bucket: bucket, Key: key }),
      signOptions
    )
  }

  const endpoint = new URL(process.env.AWS_ENDPOINT_URL!)
  if (endpoint.protocol === 'https:' && VIRTUAL_HOSTABLE_BUCKET.test(bucket)) {
    const query: Record<string, string> = {}
    if (options?.responseCacheControl)
      query['response-cache-control'] = options.responseCacheControl
    if (options?.responseContentDisposition)
      query['response-content-disposition'] = options.responseContentDisposition
    return signGetObjectUrl(
      {
        accessKeyId: process.env.AWS_ACCESS_KEY!,
        secretAccessKey: process.env.AWS_SECRET_KEY!,
        region: process.env.AWS_REGION!,
        endpointHost: endpoint.host,
      },
      { bucket, key, expiresIn, date: options?.signingDate ?? new Date(), query }
    )
  }

  // Anything the fast path can't address the way the SDK would (a dotted
  // bucket, a plain-http endpoint) goes through the SDK unchanged.
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
    ResponseCacheControl: options?.responseCacheControl,
    ResponseContentDisposition: options?.responseContentDisposition,
  })

  return await getSignedUrl(s3, command, signOptions)
}

/**
 * Buckets the SDK addresses virtual-hosted style (`{bucket}.{endpoint}`).
 * A dot would break the TLS wildcard, so the SDK falls back to path style for
 * those — and so does `getPresignedUrl`, by not taking the fast path.
 */
const VIRTUAL_HOSTABLE_BUCKET = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/

/** RFC 3986 encoding, which is what SigV4 requires and `encodeURIComponent` falls short of. */
const sigv4Encode = (s: string) =>
  encodeURIComponent(s).replace(
    /[!'()*]/g,
    (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase()
  )

/** Signing keys, one per day/region — the four-HMAC derivation only changes daily. */
const signingKeys = new Map<string, Buffer>()

function signingKey(secret: string, day: string, region: string): Buffer {
  const id = `${day}/${region}`
  let key = signingKeys.get(id)
  if (!key) {
    const h = (k: Buffer | string, d: string) =>
      createHmac('sha256', k).update(d, 'utf8').digest()
    key = h(h(h(h('AWS4' + secret, day), region), 's3'), 'aws4_request')
    if (signingKeys.size > 8) signingKeys.clear()
    signingKeys.set(id, key)
  }
  return key
}

/**
 * Presigns a `GetObject` URL with SigV4 directly, bypassing the AWS SDK's
 * middleware stack.
 *
 * **Why this exists.** Signing is pure CPU with no I/O, so even though
 * `getSignedUrl` is async it runs to completion inside microtasks and holds
 * Node's event loop for its whole duration. Loaders sign one URL per
 * thumbnail, and that blocking is what starved the Postgres driver during
 * uploads (measured 2026-09-19: concurrent `SELECT 1` 1.1 ms → 697 ms) and
 * forced signed thumbnails to be reverted. This path is synchronous, cheaper
 * (0.114 ms vs 0.409 ms per URL, warm), and caches the daily signing key.
 *
 * **Correctness** is pinned by `__tests__/s3-presign.test.ts`, which asserts
 * the signature is identical to the SDK's for the same inputs — so Tigris
 * cannot tell the two apart. Output mirrors the SDK's query set, including
 * `x-id=GetObject` and `X-Amz-Content-Sha256=UNSIGNED-PAYLOAD`.
 *
 * @example
 * signGetObjectUrl(
 *   { accessKeyId, secretAccessKey, region: 'auto', endpointHost: 'fly.storage.tigris.dev' },
 *   { bucket: 'stashly-x', key: 'a/b.mp4', expiresIn: 3600, date: new Date(),
 *     query: { 'response-cache-control': 'no-store' } }
 * )
 */
export function signGetObjectUrl(
  config: {
    accessKeyId: string
    secretAccessKey: string
    sessionToken?: string
    region: string
    endpointHost: string
  },
  input: {
    bucket: string
    key: string
    expiresIn: number
    date: Date
    query?: Record<string, string>
  }
): string {
  const amzDate = input.date.toISOString().replace(/[:-]|\.\d{3}/g, '')
  const day = amzDate.slice(0, 8)
  const scope = `${day}/${config.region}/s3/aws4_request`
  const host = `${input.bucket}.${config.endpointHost}`
  const path = '/' + input.key.split('/').map(sigv4Encode).join('/')

  const params: Record<string, string> = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Content-Sha256': 'UNSIGNED-PAYLOAD',
    'X-Amz-Credential': `${config.accessKeyId}/${scope}`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(input.expiresIn),
    'X-Amz-SignedHeaders': 'host',
    'x-id': 'GetObject',
    ...input.query,
  }
  if (config.sessionToken) params['X-Amz-Security-Token'] = config.sessionToken

  const canonicalQuery = Object.keys(params)
    .map((k) => [sigv4Encode(k), sigv4Encode(params[k])] as const)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('&')

  const canonicalRequest = [
    'GET',
    path,
    canonicalQuery,
    `host:${host}\n`,
    'host',
    'UNSIGNED-PAYLOAD',
  ].join('\n')

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    scope,
    createHash('sha256').update(canonicalRequest).digest('hex'),
  ].join('\n')

  const signature = createHmac(
    'sha256',
    signingKey(config.secretAccessKey, day, config.region)
  )
    .update(stringToSign)
    .digest('hex')

  return `https://${host}${path}?${canonicalQuery}&X-Amz-Signature=${signature}`
}


/**
 * Presigns a `GET` with extra signed query params and a fixed signing date.
 *
 * `getPresignedUrl` covers the plain case. This variant exists for thumbnails,
 * which need three things it can't do:
 *
 * - **`query`** params are added *before* signing, so they are part of the
 *   signature. A param appended afterwards (`url + '&v=2'`) makes Tigris
 *   return 403 (verified 2026-09-16), so a cache-bust has to be signed in.
 * - **`signingDate`** pins `X-Amz-Date`. Two calls with the same date, key and
 *   params return byte-identical URLs, so the browser's HTTP cache can hit
 *   across re-renders instead of downloading again.
 * - **`responseCacheControl`** is sent as `response-cache-control`. Tigris
 *   honours it, so the object is served with an explicit lifetime; objects are
 *   stored without a `Cache-Control` of their own.
 *
 * Signing is local HMAC work with no network call (0 requests across 1,000
 * signings; about 1.2–1.9 ms each).
 *
 * @param bucket - Bucket holding the object.
 * @param key - Object key.
 * @param options.expiresIn - Validity in seconds, counted from `signingDate`.
 * @param options.signingDate - Defaults to now.
 * @param options.query - Extra query params to sign into the URL.
 * @param options.responseCacheControl - `Cache-Control` value for the response.
 *
 * @example
 * await getPresignedGetUrl(bucket, 'thumbnails/itm_x.webp', {
 *   expiresIn: 7200,
 *   signingDate: new Date(Math.floor(Date.now() / 3_600_000) * 3_600_000),
 *   query: { v: '2' },
 *   responseCacheControl: 'private, max-age=3600',
 * })
 */
export async function getPresignedGetUrl(
  bucket: string,
  key: string,
  options: {
    expiresIn: number
    signingDate?: Date
    queryParams?: Record<string, string>
    responseCacheControl?: string
  }
): Promise<string> {
  const { expiresIn, signingDate, queryParams, responseCacheControl } = options
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
    ResponseCacheControl: responseCacheControl,
  })

  if (queryParams && Object.keys(queryParams).length > 0) {
    // `build` runs before the presigner's signing step, so these params land
    // in the canonical query string and are covered by the signature.
    command.middlewareStack.add(
      (next) => async (args) => {
        const request = args.request as { query?: Record<string, string> }
        request.query = { ...request.query, ...queryParams }
        return next(args)
      },
      { step: 'build', name: 'stashlySignedQueryParams' }
    )
  }

  return await getSignedUrl(s3, command, { expiresIn, signingDate })
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
    log.error('S3 file delete failed', { error })
    throw new Error('Failed to delete file from S3')
  }
}

/** A key `deleteObjects` could not delete, with the reason S3 gave. */
export interface FailedDelete {
  key: string
  code?: string
  message?: string
}

/**
 * Permanently deletes objects from one bucket, 1,000 keys per `DeleteObjects`
 * call (the API's limit).
 *
 * `DeleteObjects` answers 200 even when some keys fail; the failures arrive in
 * the response's `Errors`. They are returned here, never dropped, and a call
 * that throws outright (network, auth) marks its whole batch as failed rather
 * than aborting the rest.
 *
 * @example
 * const { deleted, failed } = await deleteObjects('stashly-x', ['fld/a.pdf', 'thumbnails/item_1.webp'])
 */
export async function deleteObjects(
  bucket: string,
  keys: string[]
): Promise<{ deleted: number; failed: FailedDelete[] }> {
  let deleted = 0
  const failed: FailedDelete[] = []
  for (let i = 0; i < keys.length; i += 1000) {
    const batch = keys.slice(i, i + 1000)
    try {
      const res = await s3.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: true },
        })
      )
      const errors = res.Errors ?? []
      for (const e of errors) {
        failed.push({ key: e.Key ?? '', code: e.Code, message: e.Message })
      }
      deleted += batch.length - errors.length
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      for (const key of batch) failed.push({ key, code: 'RequestFailed', message })
    }
  }
  return { deleted, failed }
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
    log.error('S3 file metadata read failed', { error })
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
