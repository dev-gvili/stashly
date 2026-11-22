import { ProfileSettings } from '@/components/settings/profile-settings'
import { SettingsSectionError } from '@/components/settings/settings-layout'
import { settingsHandle, settingsMeta } from '@/components/settings/settings-sections'
import { settingsProfileInput } from '@/schemas/api.schemas'
import { sessionContext } from '@/services/middleware/context'
import {
  getUserSettings,
  updateUserSettings,
  validateProfileName,
} from '@/services/settings-actions'
import { rethrowAsResponse } from '@/utils/api.errors'
import { parseFormData } from '@/utils/parsers'
import { data } from 'react-router'
import type { Route } from './+types/profile'

export const handle = settingsHandle('profile')
export const meta = () => settingsMeta('profile')

export async function loader({ context }: Route.LoaderArgs) {
  const session = context.get(sessionContext)
  const user = await getUserSettings(session.user.id)
  return { user: { name: user.name, email: user.email, image: user.image } }
}

export async function action({ request, context }: Route.ActionArgs) {
  const session = context.get(sessionContext)
  const input = await parseFormData({ request, schema: settingsProfileInput }).catch(
    rethrowAsResponse
  )
  const checked = validateProfileName(input.name)
  if (!checked.ok) return data({ fieldErrors: { name: checked.error } }, { status: 400 })
  await updateUserSettings({ userId: session.user.id, name: checked.name })
  return { ok: true as const, name: checked.name }
}

export default function ProfileRoute({ loaderData }: Route.ComponentProps) {
  return <ProfileSettings user={loaderData.user} />
}

export function ErrorBoundary() {
  return <SettingsSectionError sectionId="profile" />
}
