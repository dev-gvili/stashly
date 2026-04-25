import { auth } from '@/services/auth'
import { redirect } from 'react-router'
import {
  createThumbnail,
  updateThumbnail,
} from '@/services/thumbnail-actions'
import { parseFormData } from '@/utils/parsers'
import { thumbnailCreateSchema, thumbnailUpdateSchema } from '@/schemas/api.schemas'
import type { Route } from './+types/thumbnails'

export async function action({ request, params }: Route.ActionArgs) {
  const session = await auth.api.getSession(request)
  if (!session) throw redirect('/auth/sign-in')

  if (request.method === 'POST') {
    const data = await parseFormData({ request, schema: thumbnailCreateSchema })
    const thumbnail = await createThumbnail(params.itemId || data.itemId, data.url, data.view, data.size)
    return Response.json({ id: thumbnail.id })
  }

  if (request.method === 'PATCH') {
    const itemId = params.itemId
    if (!itemId) return new Response('Not found', { status: 404 })

    const url = new URL(request.url)
    const view = url.searchParams.get('view') || 'grid'
    const size = url.searchParams.get('size') || 'medium'

    const data = await parseFormData({ request, schema: thumbnailUpdateSchema })
    await updateThumbnail(itemId, data.stage, data.url, data.width, data.height, view, size)
    return Response.json({ ok: true })
  }

  return new Response('Method not allowed', { status: 405 })
}
