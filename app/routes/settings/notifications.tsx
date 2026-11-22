import { NotificationsSettings } from '@/components/settings/notifications-settings'
import { SettingsSectionError } from '@/components/settings/settings-layout'
import { settingsHandle, settingsMeta } from '@/components/settings/settings-sections'
import { settingsNotificationsInput } from '@/schemas/api.schemas'
import { sessionContext } from '@/services/middleware/context'
import {
  getNotificationPreferences,
  setNotificationPreference,
} from '@/services/settings-actions'
import { rethrowAsResponse, toErrorInfo } from '@/utils/api.errors'
import { parseFormData } from '@/utils/parsers'
import { data } from 'react-router'
import type { Route } from './+types/notifications'

export const handle = settingsHandle('notifications')
export const meta = () => settingsMeta('notifications')

export async function loader({ context }: Route.LoaderArgs) {
  const session = context.get(sessionContext)
  return { prefs: await getNotificationPreferences(session.user.id) }
}

export async function action({ request, context }: Route.ActionArgs) {
  const session = context.get(sessionContext)
  const input = await parseFormData({ request, schema: settingsNotificationsInput }).catch(
    rethrowAsResponse
  )
  try {
    await setNotificationPreference({ userId: session.user.id, key: input.key, value: input.value })
    return { ok: true as const }
  } catch (e) {
    const err = toErrorInfo(e)
    return data({ error: err.message ?? "Couldn't save" }, { status: err.status ?? 500 })
  }
}

export default function NotificationsRoute({ loaderData }: Route.ComponentProps) {
  return <NotificationsSettings prefs={loaderData.prefs} />
}

export function ErrorBoundary() {
  return <SettingsSectionError sectionId="notifications" />
}
