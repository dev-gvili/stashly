import { auth } from '@/services/auth'
import { redirect } from 'react-router'
import {
  createThumbnail,
  updateThumbnail,
  getThumbnailByItemId,
} from '@/services/thumbnail-actions'
import { parseFormData } from '@/utils/parsers'
import { thumbnailCreateSchema, thumbnailUpdateSchema } from '@/schemas/api.schemas'
import type { Route } from './+types/thumbnails'

export async function loader({ params }: Route.LoaderArgs) {
  const itemId = params.itemId
  if (!itemId) return new Response(null, { status: 204 })

  const thumbnail = await getThumbnailByItemId(itemId)
  if (!thumbnail?.content) return new Response(null, { status: 204 })

  return new Response(thumbnail.content, {
    headers: {
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}

export async function action({ request, params }: Route.ActionArgs) {
  const session = await auth.api.getSession(request)
  if (!session) throw redirect('/auth/sign-in')

  if (request.method === 'POST') {
    const data = await parseFormData({ request, schema: thumbnailCreateSchema })
    const thumbnail = await createThumbnail(data.itemId, data.url)
    return Response.json({ id: thumbnail.id })
  }

  if (request.method === 'PATCH') {
    const itemId = params.itemId
    if (!itemId) return new Response('Not found', { status: 404 })
    const data = await parseFormData({ request, schema: thumbnailUpdateSchema })
    const content = new Uint8Array(await data.content.arrayBuffer())
    await updateThumbnail(itemId, data.stage, content as unknown as Buffer, data.width, data.height)
    return Response.json({ ok: true })
  }

  return new Response('Method not allowed', { status: 405 })
}
