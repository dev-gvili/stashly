import { AiSettings } from '@/components/settings/ai-settings'
import { SettingsSectionError } from '@/components/settings/settings-layout'
import { settingsHandle, settingsMeta } from '@/components/settings/settings-sections'
import { settingsAiInput } from '@/schemas/api.schemas'
import { sessionContext } from '@/services/middleware/context'
import { getAiPreferences, setAiPreference } from '@/services/settings-actions'
import { rethrowAsResponse, toErrorInfo } from '@/utils/api.errors'
import { parseFormData } from '@/utils/parsers'
import { data } from 'react-router'
import type { Route } from './+types/ai'

export const handle = settingsHandle('ai')
export const meta = () => settingsMeta('ai')

export async function loader({ context }: Route.LoaderArgs) {
  const session = context.get(sessionContext)
  return { prefs: await getAiPreferences(session.user.id) }
}

export async function action({ request, context }: Route.ActionArgs) {
  const session = context.get(sessionContext)
  const input = await parseFormData({ request, schema: settingsAiInput }).catch(rethrowAsResponse)
  try {
    await setAiPreference({ userId: session.user.id, key: input.key, value: input.value })
    return { ok: true as const }
  } catch (e) {
    const err = toErrorInfo(e)
    return data({ error: err.message ?? "Couldn't save" }, { status: err.status ?? 500 })
  }
}

export default function AiRoute({ loaderData }: Route.ComponentProps) {
  return <AiSettings prefs={loaderData.prefs} />
}

export function ErrorBoundary() {
  return <SettingsSectionError sectionId="ai" />
}
