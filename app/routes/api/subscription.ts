import { data, redirect } from 'react-router'
import { auth } from '@/services/auth'
import type { Route } from './+types/subscription'
import { parseFormData } from '@/utils/parsers'
import { subscriptionApiRouteInput } from '@/schemas/api.schemas'
import {
  getActiveSubscription,
  updateSubscriptionPlan,
  cancelSubscription,
} from '@/services/subscription-actions'
import { rethrowAsResponse, toErrorInfo } from '@/utils/api.errors'

export async function loader({ request }: Route.LoaderArgs) {
    const session = await auth.api.getSession({
    headers: request.headers,
  })
  if (!session) throw redirect('/auth/sign-in')

  const subscription = await getActiveSubscription(session.user.id)
  return data({ subscription })
}

export async function action({ request }: Route.ActionArgs) {
    const session = await auth.api.getSession({
    headers: request.headers,
  })
  if (!session) throw redirect('/auth/sign-in')

  const formData = await parseFormData({
    request,
    schema: subscriptionApiRouteInput,
  }).catch(rethrowAsResponse)

  try {
    if (formData.intent === 'update_plan') {
      const driveId = (session.user as any).driveId as string
      const plan = await updateSubscriptionPlan({
        userId: session.user.id,
        storagePlanId: formData.storagePlanId,
        storagePlanType: formData.storagePlanType,
        driveId,
      })
      return data({ plan })
    }

    if (formData.intent === 'cancel_subscription') {
      await cancelSubscription(session.user.id)
      return data({ cancelled: true })
    }
  } catch (e) {
    const err = toErrorInfo(e)
    return data(
      { error: err.message ?? 'Action failed' },
      { status: err.status ?? 500 }
    )
  }

  return data({ error: 'Invalid intent' }, { status: 400 })
}
