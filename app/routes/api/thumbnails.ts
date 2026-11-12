/**
 * Every thumbnail read and write for a single item.
 *
 * GET  ?intent=presign — short-lived PUT for `thumbnails/{itemId}.webp`, plus a
 *                        signed GET per persisted stage for the client to paint
 * GET  ?intent=source  — short-lived GET on the original, for a visible card
 *                        whose file is not in memory (a `fromDownload` job; see
 *                        `useThumbnailWhenVisible`)
 * POST                 — create the Thumbnail row
 * PATCH                — record a completed stage
 */
import { ThumbnailSize, ViewType } from '@/prisma/enums'
import {
  thumbnailApiRouteQuery,
  thumbnailCreateSchema,
  thumbnailUpdateSchema,
} from '@/schemas/api.schemas'
import { authMiddleware } from '@/services/middleware/auth'
import { sessionContext } from '@/services/middleware/context'
import {
  createThumbnail,
  getThumbnailSource,
  presignThumbnailUpload,
  updateThumbnail,
} from '@/services/thumbnail-actions'
import { parseOrRespond, rethrowAsResponse, toErrorInfo } from '@/utils/api.errors'
import { parseFormData, parseSearchParams } from '@/utils/parsers'
import { isSearchIndexSubmission } from '@/utils/revalidation'
import { data, type ShouldRevalidateFunction } from 'react-router'
import type { Route } from './+types/thumbnails'

/** The PATCH route reads these from the query string, so check them before Prisma sees them. */
const isViewType = (v: string): v is ViewType =>
  (Object.values(ViewType) as string[]).includes(v)
const isThumbnailSize = (v: string): v is ThumbnailSize =>
  (Object.values(ThumbnailSize) as string[]).includes(v)

// Resolves the session once and forwards the cache cookie it refreshed, which
// a bare `getSession` here would drop: an upload is a long run of API calls
// with no page load in between (tech-debt item 35).
export const middleware: Route.MiddlewareFunction[] = [authMiddleware]

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

export async function loader({ params, request, context }: Route.LoaderArgs) {
  const session = context.get(sessionContext)

  const itemId = params.itemId
  if (!itemId) return data({ error: 'Not found' }, { status: 404 })

  const query = parseOrRespond(() =>
    parseSearchParams({
      request,
      schema: thumbnailApiRouteQuery,
    })
  )

  try {
    if (query.intent === 'presign') {
      return data(
        await presignThumbnailUpload(session.user.id, itemId)
      )
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

export async function action({ request, params, context }: Route.ActionArgs) {
  const session = context.get(sessionContext)

  try {
    if (request.method === 'POST') {
      const parsedData = await parseFormData({
        request,
        schema: thumbnailCreateSchema,
      }).catch(rethrowAsResponse)
      const thumbnail = await createThumbnail(
        session.user.id,
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
      const view = url.searchParams.get('view') || ViewType.grid
      const size = url.searchParams.get('size') || ThumbnailSize.medium
      if (!isViewType(view) || !isThumbnailSize(size)) {
        return data({ error: 'Invalid view or size' }, { status: 400 })
      }

      const parsedData = await parseFormData({
        request,
        schema: thumbnailUpdateSchema,
      }).catch(rethrowAsResponse)
      // `parsedData.url` is the client's optimistic src — deliberately unused.
      // The bucket and key are derived server-side in `updateThumbnail`.
      const signedUrl = await updateThumbnail(
        session.user.id,
        itemId,
        parsedData.stage,
        parsedData.width,
        parsedData.height,
        view,
        size
      )
      return data({
        ok: true,
        stage: parsedData.stage,
        url: signedUrl,
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


