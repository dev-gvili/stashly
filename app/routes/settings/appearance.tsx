import { AppearanceSettings } from '@/components/settings/appearance-settings'
import { SettingsSectionError } from '@/components/settings/settings-layout'
import { settingsHandle, settingsMeta } from '@/components/settings/settings-sections'

// The theme lives in the root loader's `color-scheme` cookie: no loader here.
export const handle = settingsHandle('appearance')
export const meta = () => settingsMeta('appearance')

export default function AppearanceRoute() {
  return <AppearanceSettings />
}

export function ErrorBoundary() {
  return <SettingsSectionError sectionId="appearance" />
}
