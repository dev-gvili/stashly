import { authMiddleware } from '@/services/middleware/auth'
import { sessionContext } from '@/services/middleware/context'
import { data } from 'react-router'
import type { Route } from './+types/subscription'
import { parseFormData } from '@/utils/parsers'
import {
  subscriptionApiRouteInput,
  subscriptionLoaderOutput,
} from '@/schemas/api.schemas'
import {
  getActiveSubscription,
  updateSubscriptionPlan,
  cancelSubscription,
} from '@/services/subscription-actions'
import { rethrowAsResponse, toErrorInfo } from '@/utils/api.errors'

export const middleware: Route.MiddlewareFunction[] = [authMiddleware]

export async function loader({ request, context }: Route.LoaderArgs) {
  const session = context.get(sessionContext)

  const subscription = await getActiveSubscription(session.user.id)
  return data(subscriptionLoaderOutput.parse({ subscription }))
}

export async function action({ request, context }: Route.ActionArgs) {
  const session = context.get(sessionContext)

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
