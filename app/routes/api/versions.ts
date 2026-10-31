import { data, redirect } from 'react-router'
import { auth } from '@/services/auth'
import type { Route } from './+types/versions'
import { parseFormData, parseSearchParams } from '@/utils/parsers'
import {
  versionsLoaderInput,
  versionsApiRouteInput,
} from '@/schemas/api.schemas'
import { toErrorInfo } from '@/utils/api.errors'
import {
  listVersions,
  getVersion,
  createVersion,
  restoreVersion,
  deleteVersion,
} from '@/services/version-actions'

export async function loader({ request, params }: Route.LoaderArgs) {
    const session = await auth.api.getSession({
    headers: request.headers,
  })
  if (!session) throw redirect('/auth/sign-in')

  const { itemId: queryItemId, versionId: queryVersionId } = parseSearchParams({
    request,
    schema: versionsLoaderInput,
  })

  const itemId = params.itemId ?? queryItemId
  const versionId = params.versionId ?? queryVersionId

  if (versionId) {
    try {
      const version = await getVersion(versionId)
      return data({ version })
    } catch (e) {
      const err = toErrorInfo(e)
      return data(
        { error: err.message ?? 'Version not found' },
        { status: err.status ?? 404 }
      )
    }
  }

  if (!itemId) {
    return data({ error: 'itemId is required' }, { status: 400 })
  }

  const versions = await listVersions(itemId)
  return data({ versions })
}

export async function action({ request, params, unstable_url, context, unstable_pattern }: Route.ActionArgs) {
    const session = await auth.api.getSession({
    headers: request.headers,
  })
  if (!session) throw redirect('/auth/sign-in')

  const itemId = params.itemId
  if (!itemId) {
    return data({ error: 'itemId is required' }, { status: 400 })
  }

  try {
    const formData = await parseFormData({
      request,
      schema: versionsApiRouteInput,
    })

    if (formData.intent === 'create_version') {
      const version = await createVersion({
        itemId,
        userId: session.user.id,
        label: formData.label ?? null,
        version: formData.version ?? null,
        size: formData.size ?? null,
      })
      return data({ version }, { status: 201 })
    }

    if (formData.intent === 'restore_version') {
      const result = await restoreVersion({
        versionId: formData.versionId,
        itemId,
        userId: session.user.id,
      })
      return data({ success: true, result })
    }

    if (formData.intent === 'delete_version') {
      await deleteVersion({
        versionId: formData.versionId,
        ownerId: session.user.id,
      })
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
