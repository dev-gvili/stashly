import { authMiddleware } from '@/services/middleware/auth'
import { sessionContext } from '@/services/middleware/context'
import type { Route } from './+types/pins'
import { data } from 'react-router'
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

export const middleware: Route.MiddlewareFunction[] = [authMiddleware]

export const loader = async ({ request, context }: Route.LoaderArgs) => {
  const session = context.get(sessionContext)

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

export const action = async ({ request, context }: Route.ActionArgs) => {
  const session = context.get(sessionContext)

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
