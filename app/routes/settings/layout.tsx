import { SettingsLayout } from '@/components/settings/settings-layout'
import { Outlet, useParams } from 'react-router'

export default function SettingsLayoutRoute() {
  const { me } = useParams()
  return (
    <SettingsLayout base={`/${me}/settings`}>
      <Outlet />
    </SettingsLayout>
  )
}
