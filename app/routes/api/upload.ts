import { authMiddleware } from '@/services/middleware/auth'
import { sessionContext } from '@/services/middleware/context'
import { assertCanUploadTo } from '@/services/item-actions'
import {
  abortMultipartUpload,
  completeMultipartUpload,
  createMultipartUpload,
  getObjectHead,
  getPresignedUrlForPart,
} from '@/services/s3'
import { isAmbiguousTsFile, sniffTsBytes, type TsKind } from '@/utils/sniff'
import { toErrorInfo } from '@/utils/api.errors'
import { data } from 'react-router'
import { z } from 'zod'
import type { Route } from './+types/upload'

// Resolves the session once and forwards the cache cookie it refreshed, which
// a bare `getSession` here would drop: an upload is a long run of API calls
// with no page load in between (tech-debt item 35).
export const middleware: Route.MiddlewareFunction[] = [authMiddleware]

/** S3's limit on parts per multipart upload. */
const MAX_PARTS = 10_000
/** 500 MiB of 5 MiB parts per answer, so no URL is signed long before use. */
const PART_URLS_PER_REQUEST = 100

/**
 * Presigned URLs for parts `from`…`from + count - 1`, capped at S3's last
 * part. Signing is a local HMAC: no S3 round trip, no database read.
 */
function signParts(
  bucket: string,
  key: string,
  uploadId: string,
  from: number,
  count: number
) {
  const n = Math.max(0, Math.min(count, MAX_PARTS - from + 1))
  return Promise.all(
    Array.from({ length: n }, (_, i) =>
      getPresignedUrlForPart(bucket, key, uploadId, from + i)
    )
  )
}

const defaults = z.object({
  key: z.string(),
  uploadId: z.string(),
})

const create_multipart_upload = z.object({
  ...defaults.pick({ key: true }).shape,
  action: z.literal('create-multipart-upload'),
  metadata: z.record(z.string(), z.string()).optional(),
  contentType: z.string().optional(),
  /** The file's part count: the answer carries the first parts' URLs. */
  partCount: z.number().int().min(0).max(MAX_PARTS).optional(),
})

const get_presigned_url = z.object({
  ...defaults.shape,
  action: z.literal('get-presigned-url'),
  partNumber: z.number(),
})

const get_presigned_urls = z.object({
  ...defaults.shape,
  action: z.literal('get-presigned-urls'),
  from: z.number().int().min(1).max(MAX_PARTS),
  count: z.number().int().min(1).max(PART_URLS_PER_REQUEST),
})

const complete_multipart_upload = z.object({
  ...defaults.shape,
  action: z.literal('complete-multipart-upload'),
  parts: z.array(z.object({ ETag: z.string(), PartNumber: z.number() })),
})

const abort_multipart_upload = z.object({
  ...defaults.shape,
  action: z.literal('abort-multipart-upload'),
})

const uploadSchema = z.discriminatedUnion('action', [
  create_multipart_upload,
  complete_multipart_upload,
  get_presigned_url,
  get_presigned_urls,
  abort_multipart_upload,
])

export async function action({ request, context }: Route.ActionArgs) {
  const session = context.get(sessionContext)
  const { user } = session
  const { bucket } = user

  const values = uploadSchema.parse(await request.json())

  /** A refusal the client reads as `{ error }`, with its real status. */
  const refuse = (e: unknown) => {
    const err = toErrorInfo(e)
    return data(
      { error: err.message ?? 'Upload refused' },
      { status: err.status ?? 500 }
    )
  }

  switch (values.action) {
    case 'create-multipart-upload': {
      // Before any bytes move: a user who lost access to the folder (revoked
      // mid-batch) stops here instead of uploading the file only to have the
      // row refused afterwards.
      try {
        await assertCanUploadTo(user.id, values.key)
      } catch (e) {
        return refuse(e)
      }
      const { UploadId: uploadId } = await createMultipartUpload(
        bucket,
        values.key,
        values.metadata,
        values.contentType
      )
      if (!uploadId) throw new Error('Failed to create multipart upload')
      // The first window of part URLs rides along, so a file of up to 500 MiB
      // makes no further presign request (tech-debt item 39).
      const partUrls = await signParts(
        bucket,
        values.key,
        uploadId,
        1,
        Math.min(values.partCount ?? 0, PART_URLS_PER_REQUEST)
      )
      return { uploadId, partUrls }
    }
    case 'get-presigned-urls': {
      const urls = await signParts(
        bucket,
        values.key,
        values.uploadId,
        values.from,
        values.count
      )
      return { urls }
    }
    case 'get-presigned-url': {
      const url = await getPresignedUrlForPart(
        bucket,
        values.key,
        values.uploadId,
        values.partNumber
      )
      return { url }
    }
    case 'complete-multipart-upload': {
      // Access revoked while the parts were uploading: abort instead of
      // completing, so S3 drops the parts and no object is ever assembled.
      try {
        await assertCanUploadTo(user.id, values.key)
      } catch (e) {
        await abortMultipartUpload(bucket, values.key, values.uploadId).catch(
          (abortError) =>
            console.error(
              `[upload] could not abort ${values.key} after a refused complete; the orphan sweep aborts stale uploads:`,
              abortError
            )
        )
        return refuse(e)
      }
      const { Key, Bucket, ETag, VersionId, Location, $metadata } =
        await completeMultipartUpload(
          bucket,
          values.key,
          values.uploadId,
          values.parts
        )

      // Authoritative server-side sniff for the ambiguous .ts extension.
      // The client's contentType is a claim; this ranged GetObject (1KB)
      // is the trust boundary. Persist the verified value on the Item
      // record and use it as the source of truth for downloads/previews.
      let verifiedKind: TsKind | undefined
      let verifiedContentType: string | undefined
      if (isAmbiguousTsFile(values.key)) {
        try {
          const head = await getObjectHead(bucket, values.key)
          const sniffed = sniffTsBytes(head)
          verifiedKind = sniffed.kind
          verifiedContentType = sniffed.contentType
          // TODO: persist on the Item record, e.g.
          // await prisma.item.update({
          //   where: { key: values.key },
          //   data: { mimeType: verifiedContentType },
          // })
        } catch (err) {
          // Verification is best-effort — don't fail a completed upload over it.
          console.error('Post-upload content verification failed', {
            key: values.key,
            err,
          })
        }
      }

      return {
        key: Key,
        bucket: Bucket,
        etag: ETag,
        version: VersionId,
        location: Location,
        metadata: $metadata,
        verifiedKind,
        verifiedContentType,
      }
    }
    case 'abort-multipart-upload': {
      // Already gone is done: a refused complete aborts on the server, and the
      // client then aborts the same upload again on its way to `error`.
      try {
        await abortMultipartUpload(bucket, values.key, values.uploadId)
      } catch (e) {
        if ((e as { name?: string }).name !== 'NoSuchUpload') throw e
      }
      return { success: true }
    }
  }
}
