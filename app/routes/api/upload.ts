import { auth } from '@/services/auth'
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
import { data, redirect } from 'react-router'
import { z } from 'zod'
import type { Route } from './+types/upload'

const defaults = z.object({
  key: z.string(),
  uploadId: z.string(),
})

const create_multipart_upload = z.object({
  ...defaults.pick({ key: true }).shape,
  action: z.literal('create-multipart-upload'),
  metadata: z.record(z.string(), z.string()).optional(),
  contentType: z.string().optional(),
})

const get_presigned_url = z.object({
  ...defaults.shape,
  action: z.literal('get-presigned-url'),
  partNumber: z.number(),
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
  abort_multipart_upload,
])

export async function action({ request }: Route.ActionArgs) {
  const session = await auth.api.getSession({
    headers: request.headers,
  })
  if (!session) throw redirect('/auth/sign-in')
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
      return { uploadId }
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
      await abortMultipartUpload(bucket, values.key, values.uploadId)
      return { success: true }
    }
  }
}
