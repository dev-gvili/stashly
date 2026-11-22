import { BillingSettings } from '@/components/settings/billing-settings'
import { SettingsSectionError } from '@/components/settings/settings-layout'
import { settingsHandle, settingsMeta } from '@/components/settings/settings-sections'
import { quotaApiRouteOutput } from '@/schemas/api.schemas'
import { sessionContext } from '@/services/middleware/context'
import { findQuota } from '@/services/quota-actions'
import { getPlanSummary } from '@/services/subscription-actions'
import type { Route } from './+types/billing'

export const handle = settingsHandle('billing')
export const meta = () => settingsMeta('billing')

/**
 * The plan with its real Stripe price, and the same quota the sidebar storage
 * card reads (`findQuota` through `quotaApiRouteOutput`), so the two agree.
 * No action: the CTA links to the plan picker.
 */
export async function loader({ context }: Route.LoaderArgs) {
  const session = context.get(sessionContext)
  const [plan, quota] = await Promise.all([
    getPlanSummary(session.user.id),
    findQuota({ userId: session.user.id }),
  ])
  const { used, total } = quotaApiRouteOutput.parse(quota)
  return { plan, quota: { used, total } }
}

export default function BillingRoute({ loaderData, params }: Route.ComponentProps) {
  return (
    <BillingSettings
      plan={loaderData.plan}
      quota={loaderData.quota}
      plansHref={`/${params.me}/settings/billing/plans`}
    />
  )
}

export function ErrorBoundary() {
  return <SettingsSectionError sectionId="billing" />
}
