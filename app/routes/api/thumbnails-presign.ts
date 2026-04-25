import type { Route } from './+types/thumbnails-presign'
import { auth } from '@/services/auth'
import { redirect } from 'react-router'
import { getPresignedUrl } from '@/services/s3'
import { prisma } from '@/services/db'

export async function loader({ params, request }: Route.LoaderArgs) {
  const session = await auth.api.getSession(request)
  if (!session) throw redirect('/auth/sign-in')

  const itemId = params.itemId
  if (!itemId) return new Response('Not found', { status: 404 })

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { bucket: true },
  })

  if (!user?.bucket) {
    return new Response('User bucket not found', { status: 404 })
  }

  const key = `thumbnails/${itemId}.webp`
  const uploadUrl = await getPresignedUrl(user.bucket, 'put', key, 300)
  const publicUrl = `https://${user.bucket}.t3.tigrisfiles.io/${key}`

  return Response.json({ uploadUrl, publicUrl })
}