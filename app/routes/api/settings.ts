import { authMiddleware } from '@/services/middleware/auth'
import { sessionContext } from '@/services/middleware/context'
import { data } from 'react-router'
import type { Route } from './+types/settings'
import { parseFormData } from '@/utils/parsers'
import { settingsApiRouteInput } from '@/schemas/api.schemas'
import {
  getUserSettings,
  updateUserSettings,
} from '@/services/settings-actions'
import { rethrowAsResponse, toErrorInfo } from '@/utils/api.errors'

export const middleware: Route.MiddlewareFunction[] = [authMiddleware]

export async function loader({ request, context }: Route.LoaderArgs) {
  const session = context.get(sessionContext)

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

export async function action({ request, context }: Route.ActionArgs) {
  const session = context.get(sessionContext)

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
