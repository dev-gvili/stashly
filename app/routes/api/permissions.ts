import { data, redirect } from 'react-router'
import { auth } from '@/services/auth'
import type { Route } from './+types/permissions'
import { parseFormData, parseSearchParams } from '@/utils/parsers'
import {
  permissionsLoaderInput,
  permissionsApiRouteInput,
} from '@/schemas/api.schemas'
import { toErrorInfo } from '@/utils/api.errors'
import {
  getItemPermissions,
  grantItemPermission,
  revokeItemPermission,
  expirePermission,
} from '@/services/permission-actions'

export async function loader({ request, params }: Route.LoaderArgs) {
    const session = await auth.api.getSession({
    headers: request.headers,
  })
  if (!session) throw redirect('/auth/sign-in')

  // itemId can come from URL params (e.g. /api/items/:itemId/permissions) or query string
  const itemIdFromParams = (params as any).itemId
  if (itemIdFromParams) {
    const permissions = await getItemPermissions(itemIdFromParams)
    return data({ permissions })
  }

  const query = parseSearchParams({ request, schema: permissionsLoaderInput })
  const permissions = await getItemPermissions(query.itemId)
  return data({ permissions })
}

export async function action({ request, params }: Route.ActionArgs) {
    const session = await auth.api.getSession({
    headers: request.headers,
  })
  if (!session) throw redirect('/auth/sign-in')

  const formData = await parseFormData({
    request,
    schema: permissionsApiRouteInput,
  })

  try {
    if (formData.intent === 'grant_permission') {
      const permission = await grantItemPermission(
        formData.userId,
        formData.itemId,
        formData.role as any
      )
      return data({ permission }, { status: 201 })
    }

    if (formData.intent === 'revoke_permission') {
      await revokeItemPermission(formData.userId, formData.itemId)
      return data({ success: true })
    }

    if (formData.intent === 'expire_permission') {
      const permission = await expirePermission(
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
