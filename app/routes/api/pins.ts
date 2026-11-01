import type { Route } from './+types/pins'
import { data, redirect } from 'react-router'
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
import { parseOrRespond, rethrowAsResponse, toErrorInfo } from '@/utils/api.errors'

export const loader = async ({ request }: Route.LoaderArgs) => {
    const session = await auth.api.getSession({
    headers: request.headers,
  })
  if (!session) throw redirect('/auth/sign-in')

  const params = parseOrRespond(() =>
    parseSearchParams({ request, schema: pinApiRouteQuery })
  )

  if (params.intent === 'check') {
    if (!params.itemId) return data({ pinned: false }, { status: 400 })
    const pinned = await isPinned(params.itemId, session.user.id)
    return data({ pinned })
  }

  return await getPinnedItems({
    userId: session.user.id,
    cursor: params.cursor,
  })
}

export const action = async ({ request }: Route.ActionArgs) => {
    const session = await auth.api.getSession({
    headers: request.headers,
  })
  if (!session) throw redirect('/auth/sign-in')

  const parsedData = await parseFormData({ request, schema: pinApiRouteInput }).catch(
    rethrowAsResponse
  )

  try {
    switch (parsedData.intent) {
      case 'pin': {
        await pinItem(parsedData.itemId, session.user.id)
        return data({ pinned: true })
      }
      case 'unpin': {
        await unpinItem(parsedData.itemId, session.user.id)
        return data({ pinned: false })
      }
      case 'reorder': {
        await reorderPin(parsedData.pinId, session.user.id, parsedData.position)
        return data({ ok: true })
      }
    }
  } catch (e) {
    const err = toErrorInfo(e)
    return data(
      { error: err.message ?? 'Pin action failed' },
      { status: err.status ?? 500 }
    )
  }
}
