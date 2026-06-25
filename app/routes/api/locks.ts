import type { Route } from './+types/locks'
import { redirect } from 'react-router'
import { auth } from '@/services/auth'
import { parseFormData, parseSearchParams } from '@/utils/parsers'
import { lockApiRouteInput, lockApiRouteQuery } from '@/schemas/api.schemas'
import {
  lockItemForUser,
  unlockItemForUser,
  isLockedByUser,
  getLockedItems,
} from '@/services/lock-actions'

export const loader = async ({ request }: Route.LoaderArgs) => {
    const session = await auth.api.getSession({
    headers: request.headers,
  })
  if (!session) throw redirect('/auth/sign-in')

  const params = parseSearchParams({ request, schema: lockApiRouteQuery })

  if (params.intent === 'check') {
    if (!params.itemId) return Response.json({ locked: false }, { status: 400 })
    const locked = await isLockedByUser(params.itemId, session.user.id)
    return { locked }
  }

  return getLockedItems({ userId: session.user.id, cursor: params.cursor })
}

export const action = async ({ request }: Route.ActionArgs) => {
    const session = await auth.api.getSession({
    headers: request.headers,
  })
  if (!session) throw redirect('/auth/sign-in')

  const formData = await parseFormData({ request, schema: lockApiRouteInput })

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
    const err = e as { statusCode?: number; message?: string }
    return Response.json(
      { error: err.message ?? 'Lock action failed' },
      { status: err.statusCode ?? 500 }
    )
  }
}
