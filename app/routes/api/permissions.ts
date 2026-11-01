import { data } from 'react-router'
import { authMiddleware } from '@/services/middleware/auth'
import { sessionContext } from '@/services/middleware/context'
import type { Route } from './+types/permissions'
import { parseFormData, parseSearchParams } from '@/utils/parsers'
import {
  permissionsLoaderInput,
  permissionsApiRouteInput,
} from '@/schemas/api.schemas'
import { parseOrRespond, rethrowAsResponse, toErrorInfo } from '@/utils/api.errors'
import {
  listItemPermissionsForUser,
  grantItemPermissionForUser,
  revokeItemPermissionForUser,
  expirePermissionForUser,
} from '@/services/permission-actions'

export const middleware: Route.MiddlewareFunction[] = [authMiddleware]

export async function loader({ request, params, context }: Route.LoaderArgs) {
  const session = context.get(sessionContext)

  // itemId can come from URL params (e.g. /api/items/:itemId/permissions) or query string
  const itemId =
    (params as { itemId?: string }).itemId ??
    parseOrRespond(() =>
      parseSearchParams({ request, schema: permissionsLoaderInput })
    ).itemId

  try {
    const permissions = await listItemPermissionsForUser(session.user.id, itemId)
    return data({ permissions })
  } catch (e) {
    const err = toErrorInfo(e)
    return data(
      { error: err.message ?? 'An error occurred' },
      { status: err.status ?? 500 }
    )
  }
}

export async function action({ request, context }: Route.ActionArgs) {
  const session = context.get(sessionContext)

  const formData = await parseFormData({
    request,
    schema: permissionsApiRouteInput,
  }).catch(rethrowAsResponse)

  try {
    if (formData.intent === 'grant_permission') {
      const permission = await grantItemPermissionForUser(
        session.user.id,
        formData.userId,
        formData.itemId,
        formData.role
      )
      return data({ permission }, { status: 201 })
    }

    if (formData.intent === 'revoke_permission') {
      await revokeItemPermissionForUser(
        session.user.id,
        formData.userId,
        formData.itemId
      )
      return data({ success: true })
    }

    if (formData.intent === 'expire_permission') {
      const permission = await expirePermissionForUser(
        session.user.id,
        formData.permissionId,
        formData.expiresAt
      )
      return data({ permission })
    }
  } catch (e) {
    const err = toErrorInfo(e)
    return data(
      { error: err.message ?? 'An error occurred' },
      { status: err.status ?? 500 }
    )
  }

  return data({ error: 'Invalid intent' }, { status: 400 })
}
