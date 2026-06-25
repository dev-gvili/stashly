import { data, redirect } from 'react-router'
import { auth } from '@/services/auth'
import type { Route } from './+types/settings'
import { parseFormData } from '@/utils/parsers'
import { settingsApiRouteInput } from '@/schemas/api.schemas'
import {
  getUserSettings,
  updateUserSettings,
} from '@/services/settings-actions'

export async function loader({ request }: Route.LoaderArgs) {
    const session = await auth.api.getSession({
    headers: request.headers,
  })
  if (!session) throw redirect('/auth/sign-in')

  try {
    const settings = await getUserSettings(session.user.id)
    return data({ settings })
  } catch (e) {
    const err = e as { statusCode?: number; message?: string }
    return data(
      { error: err.message ?? 'Failed to load settings' },
      { status: err.statusCode ?? 500 }
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
    })

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
    const err = e as { statusCode?: number; message?: string }
    return data(
      { error: err.message ?? 'An error occurred' },
      { status: err.statusCode ?? 500 }
    )
  }
}
