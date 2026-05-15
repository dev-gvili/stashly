import type { Route } from './+types/pins'
import { redirect } from 'react-router'
import { auth } from '@/services/auth'
import { parseFormData, parseSearchParams } from '@/utils/parsers'
import { pinApiRouteInput, pinApiRouteQuery } from '@/schemas/api.schemas'
import {
  pinItem,
  unpinItem,
  reorderPin,
  getPinnedItems,
  isPinned,
} from '@/services/pin-actions'

export const loader = async ({ request }: Route.LoaderArgs) => {
  const session = await auth.api.getSession(request)
  if (!session) throw redirect('/auth/sign-in')

  const params = parseSearchParams({ request, schema: pinApiRouteQuery })

  if (params.intent === 'check') {
    if (!params.itemId) return Response.json({ pinned: false }, { status: 400 })
    const pinned = await isPinned(params.itemId, session.user.id)
    return { pinned }
  }

  return getPinnedItems({ userId: session.user.id, cursor: params.cursor })
}

export const action = async ({ request }: Route.ActionArgs) => {
  const session = await auth.api.getSession(request)
  if (!session) throw redirect('/auth/sign-in')

  const data = await parseFormData({ request, schema: pinApiRouteInput })

  try {
    switch (data.intent) {
      case 'pin': {
        await pinItem(data.itemId, session.user.id)
        return { pinned: true }
      }
      case 'unpin': {
        await unpinItem(data.itemId, session.user.id)
        return { pinned: false }
      }
      case 'reorder': {
        await reorderPin(data.pinId, session.user.id, data.position)
        return { ok: true }
      }
    }
  } catch (e) {
    const err = e as { statusCode?: number; message?: string }
    return Response.json(
      { error: err.message ?? 'Pin action failed' },
      { status: err.statusCode ?? 500 }
    )
  }
}
