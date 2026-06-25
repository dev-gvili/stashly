import { redirect } from 'react-router'
import type { Route } from './+types/upload'
import { auth } from '@/services/auth'
import { z } from 'zod'
import {
  createMultipartUpload,
  getPresignedUrlForPart,
  completeMultipartUpload,
  abortMultipartUpload,
} from '@/services/s3'

const defaults = z.object({
  key: z.string(),
  uploadId: z.string(),
})

const create_multipart_upload = z.object({
  ...defaults.pick({ key: true }).shape,
  action: z.literal('create-multipart-upload'),
  metadata: z.record(z.string(), z.string()).optional(),
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

  switch (values.action) {
    case 'create-multipart-upload': {
      const { UploadId: uploadId } = await createMultipartUpload(
        bucket,
        values.key,
        values.metadata
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
      const { Key, Bucket, ETag, VersionId, Location, $metadata } =
        await completeMultipartUpload(bucket, values.key, values.uploadId, values.parts)
      return { key: Key, bucket: Bucket, etag: ETag, version: VersionId, location: Location, metadata: $metadata }
    }
    case 'abort-multipart-upload': {
      await abortMultipartUpload(bucket, values.key, values.uploadId)
      return { success: true }
    }
  }
}
