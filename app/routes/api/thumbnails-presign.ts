import type { Route } from './+types/thumbnails-presign'
import { auth } from '@/services/auth'
import { data, redirect, type ShouldRevalidateFunction } from 'react-router'
import { getPresignedUrl } from '@/services/s3'
import { isSearchIndexSubmission } from '@/utils/revalidation'
import type { AuthSession } from '@/.server/auth.types'

/**
 * A presigned URL is fetched on demand by `useThumbnailV2` and used
 * immediately; nothing about a search-index write can change it. Without this
 * guard React Router re-ran this loader after every background submission —
 * once per OCR page, minting a fresh S3 signature nobody asked for.
 */
export const shouldRevalidate: ShouldRevalidateFunction = ({
  formData,
  defaultShouldRevalidate,
}) => {
  if (isSearchIndexSubmission(formData)) return false
  return defaultShouldRevalidate
}

export async function loader({ params, request }: Route.LoaderArgs) {
    const session = await auth.api.getSession({
    headers: request.headers,
  })
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
