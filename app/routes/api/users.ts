import { authMiddleware } from '@/services/middleware/auth'
import { sessionContext } from '@/services/middleware/context'
import { data } from 'react-router'
import type { Route } from './+types/users'
import { parseFormData, parseSearchParams } from '@/utils/parsers'
import { usersLoaderInput, usersApiRouteInput } from '@/schemas/api.schemas'
import {
  findUserById,
  findUserByEmail,
  updateUser,
  searchUsersByQuery,
  deleteUser,
} from '@/services/user-actions'
import { parseOrRespond, rethrowAsResponse, toErrorInfo } from '@/utils/api.errors'

export const middleware: Route.MiddlewareFunction[] = [authMiddleware]

export async function loader({ request, params, context }: Route.LoaderArgs) {
  const session = context.get(sessionContext)

  // Detail route: GET /api/users/:userId
  if (params.userId) {
    try {
      const user = await findUserById(params.userId)
      return data({ user })
    } catch (e) {
      const err = toErrorInfo(e)
      return data(
        { error: err.message ?? 'User not found' },
        { status: err.status ?? 404 }
      )
    }
  }

  // List / search route: GET /api/users?query=...
  try {
    const query = parseOrRespond(() => parseSearchParams({ request, schema: usersLoaderInput }))
    if (query.email) {
      const user = await findUserByEmail(query.email)
      return data({ user })
    }
    const result = await searchUsersByQuery({
      query: query.query ?? '',
      cursor: query.cursor,
      limit: query.limit,
    })
    return data(result)
  } catch (e) {
    const err = toErrorInfo(e)
    return data(
      { error: err.message ?? 'Failed to list users' },
      { status: err.status ?? 500 }
    )
  }
}

export async function action({ request, params, context }: Route.ActionArgs) {
  const session = context.get(sessionContext)

  try {
    const formData = await parseFormData({
      request,
      schema: usersApiRouteInput,
    }).catch(rethrowAsResponse)

    if (formData.intent === 'update_user') {
      const userId = params.userId ?? session.user.id
      const { intent, ...updateData } = formData
      const user = await updateUser({ userId, data: updateData })
      return data({ user })
    }

    if (formData.intent === 'delete_user') {
      const userId = formData.userId ?? params.userId
      if (!userId) return data({ error: 'userId is required' }, { status: 400 })
      // Only allow users to delete their own account
      if (userId !== session.user.id) {
        return data({ error: 'Forbidden' }, { status: 403 })
      }
      await deleteUser(userId)
      return data({ success: true })
    }

    return data({ error: 'Invalid intent' }, { status: 400 })
  } catch (e) {
    const err = toErrorInfo(e)
    return data(
      { error: err.message ?? 'An error occurred' },
      { status: err.status ?? 500 }
    )
  }
}
