import { redirect } from 'react-router'
import { S3Service } from '@/services/s3'
import type { Route } from './+types/upload'
import { auth } from '@/services/auth'
import { z } from 'zod'
import { UploadService } from '@/services/upload'

const defaults = z.object({
  key: z.string(),
  uploadId: z.string(),
})

const uploadFileSchema = z.object({
  action: z.literal('upload-file'),
  file: z.instanceof(File),
  workspaceId: z.string().optional(),
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

const uploadFormData = z.discriminatedUnion('action', [
  create_multipart_upload,
  complete_multipart_upload,
  get_presigned_url,
  abort_multipart_upload,
  uploadFileSchema,
])

export async function action({ request }: Route.ActionArgs) {
  let session = await auth.api.getSession(request)
  if (!session) throw redirect('/auth/sign-in')
  let { user } = session

  // const values = await parseFormData({
  // 	request,
  // 	schema: uploadFormData,
  // })
  let data = await request.json()
  let values = uploadFormData.parse(data)

  const s3 = new UploadService({
    s3Service: new S3Service(user.bucket),
    user,
  })

  // console.log(
  //   'Processing image from URL:',
  //   'https://fastly.picsum.photos/id/342/256/323.jpg?hmac=lOm6dWgoikDgAecMhofyRqepC88fic4JAe5e71jCLmw'
  // )
  // const caption = await encodeImage(
  //   'https://fastly.picsum.photos/id/76/256/354.jpg?hmac=Fq7bmR9Adkmsqz-prbk3pEEph0c6xcqppeTHeopitWI'
  // )
  // // URL.revokeObjectURL(url)
  // console.log('Generated caption:', caption)
  // // const embedder = await pipeline(
  // //   'feature-extraction',
  // //   'Xenova/all-mpnet-base-v2'
  // // )
  // const embedding = await encodeText(caption)
  // // const embedding = await embedder(caption, {
  // //   pooling: 'mean',
  // //   normalize: true,
  // // })
  await s3.fixCors()
  switch (values.action) {
    case 'create-multipart-upload': {
      const { key, metadata } = values
      const UploadId = await s3.createMultipartUpload({ key, metadata })
      return { uploadId: UploadId }
    }
    case 'get-presigned-url': {
      const { key, uploadId, partNumber } = values
      const url = await s3.getPresignedUrlForPart({
        key,
        uploadId,
        partNumber,
      })
      return { url }
    }
    case 'complete-multipart-upload': {
      const { key, uploadId, parts } = values
      return await s3.completeMultipartUpload({ key, uploadId, parts })
    }
    case 'abort-multipart-upload': {
      const { key, uploadId } = values
      await s3.abortMultipartUpload({ key, uploadId })
      return { success: true }
    }
    default: {
      return data({ error: 'Invalid action' }, { status: 400 })
    }
  }
}
