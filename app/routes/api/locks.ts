import { authMiddleware } from '@/services/middleware/auth'
import { sessionContext } from '@/services/middleware/context'
import type { Route } from './+types/locks'
import { parseFormData, parseSearchParams } from '@/utils/parsers'
import { lockApiRouteInput, lockApiRouteQuery } from '@/schemas/api.schemas'
import {
  lockItemForUser,
  unlockItemForUser,
  isLockedByUser,
  getLockedItems,
} from '@/services/lock-actions'
import { parseOrRespond, rethrowAsResponse, toErrorInfo } from '@/utils/api.errors'

export const middleware: Route.MiddlewareFunction[] = [authMiddleware]

export const loader = async ({ request, context }: Route.LoaderArgs) => {
  const session = context.get(sessionContext)

  const params = parseOrRespond(() => parseSearchParams({ request, schema: lockApiRouteQuery }))

  if (params.intent === 'check') {
    if (!params.itemId) return Response.json({ locked: false }, { status: 400 })
    const locked = await isLockedByUser(params.itemId, session.user.id)
    return { locked }
  }

  return getLockedItems({ userId: session.user.id, cursor: params.cursor })
}

export const action = async ({ request, context }: Route.ActionArgs) => {
  const session = context.get(sessionContext)

  const formData = await parseFormData({ request, schema: lockApiRouteInput }).catch(
    rethrowAsResponse
  )

  try {
    switch (formData.intent) {
      case 'lock': {
        const expiresAt = formData.expiresAt ? new Date(formData.expiresAt) : undefined
        await lockItemForUser(formData.itemId, session.user.id, expiresAt)
        return { locked: true }
      }
      case 'unlock': {
        await unlockItemForUser(formData.itemId, session.user.id)
        return { locked: false }
      }
    }
  } catch (e) {
    const err = toErrorInfo(e)
    return Response.json(
      { error: err.message ?? 'Lock action failed' },
      { status: err.status ?? 500 }
    )
  }
}
