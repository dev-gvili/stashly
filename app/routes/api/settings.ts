import { data, redirect } from 'react-router'
import { auth } from '@/services/auth'
import type { Route } from './+types/settings'
import { parseFormData } from '@/utils/parsers'
import { settingsApiRouteInput } from '@/schemas/api.schemas'
import {
  getUserSettings,
  updateUserSettings,
} from '@/services/settings-actions'
import { rethrowAsResponse, toErrorInfo } from '@/utils/api.errors'

export async function loader({ request }: Route.LoaderArgs) {
    const session = await auth.api.getSession({
    headers: request.headers,
  })
  if (!session) throw redirect('/auth/sign-in')

  try {
    const settings = await getUserSettings(session.user.id)
    return data({ settings })
  } catch (e) {
    const err = toErrorInfo(e)
    return data(
      { error: err.message ?? 'Failed to load settings' },
      { status: err.status ?? 500 }
    )
  }
}

export async function action({ request }: Route.ActionArgs) {
    const session = await auth.api.getSession({
    headers: request.headers,
  })
  if (!session) throw redirect('/auth/sign-in')

  try {
    const formData = await parseFormData({
      request,
      schema: settingsApiRouteInput,
    }).catch(rethrowAsResponse)

    if (formData.intent === 'update_settings') {
      const { intent, ...rest } = formData
      const settings = await updateUserSettings({
        userId: session.user.id,
        ...rest,
      })
      return data({ settings })
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
