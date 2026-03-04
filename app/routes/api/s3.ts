import { z } from 'zod'
import type { Route } from './+types/s3'
import { parseFormData } from '@/utils/parsers'
import { S3Service } from '@/.server/s3'
import { auth } from '@/services/auth'
import { data, redirect } from 'react-router'

const PresignUrlSchema = z.object({
  intent: z.literal('presign-put-url').or(z.literal('presign-get-url')),
  bucket: z.string(),
  key: z.string(),
})

export const action = async ({ request, params }: Route.ActionArgs) => {
  const session = await auth.api.getSession(request)
  if (!session) throw redirect('/auth/sign-in')
  const parsedData = await parseFormData({
    request,
    schema: PresignUrlSchema,
  })
  const s3 = new S3Service(session.user.bucket)

  switch (parsedData.intent) {
    case 'presign-put-url': {
      const presignUrl = await s3.getPresignedUrl('put', parsedData.key)
      return data(
        { url: presignUrl },
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }
    case 'presign-get-url': {
      const presignUrl = await s3.getPresignedUrl('get', parsedData.key)
      return data(
        { url: presignUrl },
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }
    default:
      throw new Error('Invalid intent')
  }
}
