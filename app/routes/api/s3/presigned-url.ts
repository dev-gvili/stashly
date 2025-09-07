import { z } from 'zod'
import { type ActionFunctionArgs, redirect, data } from 'react-router'
import { auth } from '@/.server/auth'
import { S3Service } from '@/.server/s3'
import { parseFormData } from '@/utils/parsers'

const schema = z.object({
	bucketName: z.string(),
	fileName: z.string(),
})

export async function action({ request }: ActionFunctionArgs) {
	const session = await auth.api.getSession(request)
	if (!session) throw redirect('/auth/sign-in')

	const { fileName } = await parseFormData({
		request,
		schema,
	})

	const s3 = new S3Service(session.user.bucket)
	try {
		const url = await s3.getPresignedUrl('put', fileName)
		return data({ url })
	} catch (error) {
		console.error('Failed to generate presigned URL:', error)
		return data(
			{ error: 'Failed to generate presigned URL' },
			{ status: 500 }
		)
	}
}
