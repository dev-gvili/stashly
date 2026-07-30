/**
 * Presigned source for on-the-fly thumbnail backfill.
 *
 * Cards whose item has no thumbnail (upload-time generation failed or was
 * skipped) ask here for a short-lived GET on the original file, then run the
 * normal client pipeline over it. See `useThumbnailBackfill`.
 */
import type { Route } from './+types/thumbnails-source'
import { auth } from '@/services/auth'
import { data, redirect } from 'react-router'
import { getThumbnailSource } from '@/services/thumbnail-actions'

export async function loader({ params, request }: Route.LoaderArgs) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) throw redirect('/auth/sign-in')

  const itemId = params.itemId
  if (!itemId) return data({ status: 'unsupported' as const }, { status: 404 })

  try {
    return data(await getThumbnailSource(session.user.id, itemId))
  } catch (e) {
    const err = e as { statusCode?: number; message?: string }
    return data(
      { status: 'unsupported' as const, message: err.message },
      { status: err.statusCode ?? 500 }
    )
  }
}
