import { auth } from '@/services/auth'
import { data, redirect } from 'react-router'
import { createThumbnail, updateThumbnail } from '@/services/thumbnail-actions'
import { parseFormData } from '@/utils/parsers'
import {
  thumbnailCreateSchema,
  thumbnailUpdateSchema,
} from '@/schemas/api.schemas'
import type { Route } from './+types/thumbnails'

export async function action({ request, params }: Route.ActionArgs) {
    const session = await auth.api.getSession({
    headers: request.headers,
  })
  if (!session) throw redirect('/auth/sign-in')

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
    if (!itemId) return new Response('Not found', { status: 404 })

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

  return data('Method not allowed', { status: 405 })
}
