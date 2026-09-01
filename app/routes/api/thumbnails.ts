/**
 * Every thumbnail read and write for a single item.
 *
 * GET  ?intent=presign — short-lived PUT for `thumbnails/{itemId}.webp`
 * GET  ?intent=source  — short-lived GET on the original, for on-the-fly
 *                        backfill of cards whose upload-time generation failed
 *                        or was skipped (see `useThumbnailBackfill`)
 * POST                 — create the Thumbnail row
 * PATCH                — record a completed stage
 */
import { auth } from '@/services/auth'
import { data, redirect, type ShouldRevalidateFunction } from 'react-router'
import {
  createThumbnail,
  updateThumbnail,
  getThumbnailSource,
} from '@/services/thumbnail-actions'
import { getPresignedUrl } from '@/services/s3'
import { parseFormData, parseSearchParams } from '@/utils/parsers'
import {
  thumbnailApiRouteQuery,
  thumbnailCreateSchema,
  thumbnailUpdateSchema,
} from '@/schemas/api.schemas'
import { isSearchIndexSubmission } from '@/utils/revalidation'
import { toErrorInfo } from '@/utils/api.errors'
import type { AuthSession } from '@/.server/auth.types'
import type { Route } from './+types/thumbnails'

/**
 * A presigned URL is fetched on demand and used immediately; nothing about a
 * search-index write can change it. Without this guard React Router re-ran the
 * presign loader after every background submission — once per OCR page, minting
 * a fresh S3 signature nobody asked for.
 *
 * This now covers the `source` intent too, which is equally immune: both are
 * point reads the client drives itself.
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
  if (!itemId) return data({ error: 'Not found' }, { status: 404 })

  const query = parseSearchParams({
    request,
    schema: thumbnailApiRouteQuery,
  })

  try {
    if (query.intent === 'presign') {
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
      return data({ uploadUrl, publicUrl: toS3PublicUrl(session, key) })
    }

    return data(await getThumbnailSource(session.user.id, itemId))
  } catch (e) {
    const err = toErrorInfo(e)
    // `source` callers branch on this shape; `presign` callers only check ok.
    return data(
      { status: 'unsupported' as const, message: err.message },
      { status: err.status ?? 500 }
    )
  }
}

export async function action({ request, params }: Route.ActionArgs) {
  const session = await auth.api.getSession({
    headers: request.headers,
  })
  if (!session) throw redirect('/auth/sign-in')

  try {
    if (request.method === 'POST') {
      const parsedData = await parseFormData({
        request,
        schema: thumbnailCreateSchema,
      })
      const thumbnail = await createThumbnail(
        params.itemId || parsedData.itemId,
        parsedData.url,
        parsedData.view,
        parsedData.size
      )
      return data({ id: thumbnail.id })
    }

    if (request.method === 'PATCH') {
      const itemId = params.itemId
      if (!itemId) return data({ error: 'Not found' }, { status: 404 })

      const url = new URL(request.url)
      const view = url.searchParams.get('view') || 'grid'
      const size = url.searchParams.get('size') || 'medium'

      const parsedData = await parseFormData({
        request,
        schema: thumbnailUpdateSchema,
      })
      await updateThumbnail(
        itemId,
        parsedData.stage,
        parsedData.url,
        parsedData.width,
        parsedData.height,
        view,
        size
      )
      return data({
        ok: true,
        stage: parsedData.stage,
        url: parsedData.url,
        width: parsedData.width,
        height: parsedData.height,
      })
    }

    return data({ error: 'Method not allowed' }, { status: 405 })
  } catch (e) {
    const err = toErrorInfo(e)
    return data(
      { error: err.message ?? 'An error occurred' },
      { status: err.status ?? 500 }
    )
  }
}

function toS3PublicUrl(session: AuthSession, key: string) {
  return `https://${session.user.bucket}.t3.tigrisfiles.io/${key}`
}
