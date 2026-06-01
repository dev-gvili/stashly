import type { Route } from './+types/thumbnails-presign'
import { auth } from '@/services/auth'
import { data, redirect } from 'react-router'
import { getPresignedUrl } from '@/services/s3'
import type { AuthSession } from '@/.server/auth.types'

export async function loader({ params, request }: Route.LoaderArgs) {
  const session = await auth.api.getSession(request)
  if (!session) throw redirect('/auth/sign-in')

  const itemId = params.itemId
  if (!itemId) return data('Not found', { status: 404 })

  const key = `thumbnails/${itemId}.webp`
  const uploadUrl = await getPresignedUrl(
    session.user.bucket,
    'put',
    key,
    300,
    {
      acl: 'public-read',
    }
  )
  const publicUrl = toS3PublicUrl(session, key)

  return data({ uploadUrl, publicUrl })
}

function toS3PublicUrl(session: AuthSession, key: string) {
  return `https://${session.user.bucket}.t3.tigrisfiles.io/${key}`
}
