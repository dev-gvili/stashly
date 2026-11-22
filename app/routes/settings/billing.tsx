import { BillingSettings } from '@/components/settings/billing-settings'
import { SettingsSectionError } from '@/components/settings/settings-layout'
import { settingsHandle, settingsMeta } from '@/components/settings/settings-sections'
import { quotaApiRouteOutput, settingsBillingInput } from '@/schemas/api.schemas'
import { sessionContext } from '@/services/middleware/context'
import { findQuota } from '@/services/quota-actions'
import {
  changeStoragePlan,
  getPlanSummary,
  listPlanSummaries,
} from '@/services/subscription-actions'
import { rethrowAsResponse, toErrorInfo } from '@/utils/api.errors'
import { parseFormData } from '@/utils/parsers'
import { data } from 'react-router'
import type { Route } from './+types/billing'

export const handle = settingsHandle('billing')
export const meta = () => settingsMeta('billing')

/**
 * The current plan with its real Stripe price, the same quota the sidebar
 * storage card reads (`findQuota` through `quotaApiRouteOutput`), and every
 * plan for the cards below it.
 */
export async function loader({ context }: Route.LoaderArgs) {
  const session = context.get(sessionContext)
  const [plan, plans, quota] = await Promise.all([
    getPlanSummary(session.user.id),
    listPlanSummaries(),
    findQuota({ userId: session.user.id }),
  ])
  const { used, total } = quotaApiRouteOutput.parse(quota)
  return { plan, plans, quota: { used, total } }
}

export async function action({ request, context }: Route.ActionArgs) {
  const session = context.get(sessionContext)
  const input = await parseFormData({ request, schema: settingsBillingInput }).catch(
    rethrowAsResponse
  )
  try {
    await changeStoragePlan({
      userId: session.user.id,
      driveId: session.user.driveId!,
      planId: input.storagePlanId,
    })
    return { ok: true as const }
  } catch (e) {
    const err = toErrorInfo(e)
    return data({ error: err.message ?? "Couldn't change plan" }, { status: err.status ?? 500 })
  }
}

export default function BillingRoute({ loaderData }: Route.ComponentProps) {
  return (
    <BillingSettings plan={loaderData.plan} plans={loaderData.plans} quota={loaderData.quota} />
  )
}

export function ErrorBoundary() {
  return <SettingsSectionError sectionId="billing" />
}
