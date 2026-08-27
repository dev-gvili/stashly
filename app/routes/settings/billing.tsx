import { Button } from '@/components/ui/button'
import {
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { auth } from '@/services/auth'
import { getPrefixForModel, toObjectId } from '@/utils/converters'
import { cn } from '@/utils/styles'
import { RiCheckboxCircleFill } from '@remixicon/react'
import { Form, redirect } from 'react-router'
import { updateDrive } from '@/services/drive-actions'
import { createQuota, updateTotalQuota } from '@/services/quota-actions'
import { findAllStoragePlans, findStoragePlanById } from '@/services/storagePlan-actions'
import { findActiveSubscriptionByOwner, updateSubscriptionRecord } from '@/services/subscription-actions'
import { findUserById, updateUser } from '@/services/user-actions'
import type { Route } from './+types/billing'

function formatBytes(b: bigint | number) {
  const bytes = typeof b === 'bigint' ? Number(b) : b
  if (bytes >= 1_000_000_000_000)
    return `${(bytes / 1_000_000_000_000).toFixed(2)} TB`
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(2)} GB`
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(2)} MB`
  if (bytes >= 1_000) return `${(bytes / 1_000).toFixed(2)} KB`
  return `${bytes} B`
}

export async function loader({ request }: Route.LoaderArgs) {
    const session = await auth.api.getSession({
    headers: request.headers,
  })
  if (!session) throw redirect('/auth/sign-in')

  const user = await findUserById(session.user.id)
  if (!user) throw redirect('/auth/sign-in')

  const [plans, activeSubscription] = await Promise.all([
    findAllStoragePlans({}),
    findActiveSubscriptionByOwner(user.id),
  ])

  const currentPlanId = activeSubscription?.storagePlanId ?? user.storagePlanId

  return { plans, currentPlanId }
}

export async function action({ request }: Route.ActionArgs) {
    const session = await auth.api.getSession({
    headers: request.headers,
  })
  if (!session) throw redirect('/auth/sign-in')

  const userId = session.user.id
  const formData = await request.formData()
  const planId = formData.get('storagePlanId') as string | null
  if (!planId) return new Response('Missing storagePlanId', { status: 400 })

  // validate plan exists
  const plan = await findStoragePlanById(planId)
  if (!plan) return new Response('Storage plan not found', { status: 404 })

  // update user record with the selected plan
  await updateUser({ userId, data: { storagePlanId: plan.id } })

  // if user has a quota, update the total storage to match selected plan
  try {
    await updateTotalQuota({
      userId,
      dataSize: plan.storageLimit,
    })
  } catch (err) {
    // If user has no quota record yet, try creating one (quietly ignoring errors)
    try {
      await createQuota({
        id: toObjectId(getPrefixForModel('Quota')),
        driveId: session.user.driveId!,
        storagePlanId: plan.id,
      })
    } catch (e) {}
  }

  // If an active subscription exists we also update its storagePlanId to keep data-model consistent
  const sub = await findActiveSubscriptionByOwner(userId)
  if (sub) {
    await updateSubscriptionRecord({
      where: { id: sub.id },
      data: { storagePlanId: plan.id },
    })
  }

  await updateDrive({
    where: { id: session.user.driveId! },
    data: { storage: { connect: { id: plan.id } } },
  })

  // Redirect back to the billing page after changing plan
  return redirect(request.headers.get('referer') ?? '/')
}

export default function BillingRoute({ loaderData }: Route.ComponentProps) {
  const { plans = [], currentPlanId } = loaderData ?? {}

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Billing & Storage</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Choose a plan that fits your needs. Changing plans updates your quota
          immediately.
        </p>
      </div>

      <div className="flex gap-4 h-full ">
        {plans.map((plan) => (
          <div
            className={cn(
              'relative flex w-full flex-col rounded border-sidebar bg-sidebar shadow-sm *:font-stashly h-[512px] overflow-hidden py-8 max-w-xs',
              currentPlanId === plan.id
                ? 'outline-2 outline-foreground'
                : 'border border-border'
            )}
            key={plan.name}
          >
            <div
              className={cn(
                'p-4 *:bg-sidebar text-sidebar-foreground font-stashly space-y-2 text-center'
              )}
            >
              <div className="font-medium text-lg">{plan.name}</div>
              <h3 className="mt-6 mb-2 flex items-end justify-center gap-1 text-foreground">
                <span className="font-bold text-2xl">
                  ${(plan.priceCents || 0) / 100}
                </span>
                <span className="text-muted-foreground">
                  {plan.name !== 'Free' ? `/${'month'}` : ''}
                </span>
              </h3>
              <Form method="post" className="pt-2">
                <Button
                  className="font-stashly font-bold"
                  type="submit"
                  variant={'default'}
                  value={plan.id}
                  name="storagePlanId"
                  id="storagePlanId"
                  disabled={plan.id === currentPlanId}
                >
                  {plan.id === currentPlanId ? 'Current Plan' : 'Get Started'}
                </Button>
                {/* The form and button for "Get Started" are now integrated directly into the main button */}
              </Form>
              <p className="font-normal text-muted-foreground text-sm whitespace-normal h-10 mt-6 ">
                {plan.description}
              </p>
            </div>
            <div
              className={cn(
                'space-y-4 px-4 pt-6 pb-8 text-muted-foreground text-sm'
              )}
            >
              {plan.features.map((feature, index) => (
                <div className="flex items-center gap-2" key={index}>
                  <RiCheckboxCircleFill className="h-4 w-4 text-foreground" />
                  <TooltipProvider>
                    <TooltipRoot>
                      <TooltipTrigger asChild>
                        <p className={cn(feature && 'cursor-pointer border-b')}>
                          {feature}
                        </p>
                      </TooltipTrigger>
                    </TooltipRoot>
                  </TooltipProvider>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
