import { z } from 'zod'
import type { Route } from './+types/s3'
import { parseFormData } from '@/utils/parsers'
import { S3Service } from '@/.server/s3'
import { auth } from '@/services/auth'
import { data } from 'react-router'

const PresignUrlSchema = z.object({
	intent: z.literal('put_url'),
	bucketName: z.string(),
	fileName: z.string(),
})

export const action = async ({ request, params }: Route.ActionArgs) => {
	const session = await auth.api.getSession(request)
	if (!session) throw new Response('Unauthorized', { status: 401 })
	const queryParams = params['*']
	console.log('Query Params:', queryParams)
	console.log('Session Params:', session)
	const parsedData = await parseFormData({
		request,
		schema: PresignUrlSchema,
	})
	const s3 = new S3Service(session.user.bucket)
	const presignUrl = await s3.getPresignedUrl(
		parsedData.intent === 'put_url' ? 'put' : 'get',
		parsedData.fileName
	)
	return data(
		{
			url: presignUrl,
		},
		{
			status: 200,
			headers: {
				'Content-Type': 'application/json',
			},
		}
	)
}
