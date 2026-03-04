import type { Route } from '../+types'
import { auth } from '@/services/auth'
import { userRepository } from '../../.server/repositories/userrepository'
import { storagePlanRepository } from '../../.server/repositories/storageplanrepository'
import { subscriptionRepository } from '../../.server/repositories/subscriptionrepository'
import { quotaRepository } from '../../.server/repositories/quotarepository'
import { redirect } from 'react-router'

// GET: Get current user's subscription (if any)
export async function loader({ request }: Route.LoaderArgs) {
  const session = await auth.api.getSession(request)
  if (!session) throw redirect('/auth/sign-in')

  const user = await userRepository.findById(session.user.id)
  const active = user.subscriptions?.find((s) => s.status === 'active') ?? null
  return { subscription: active }
}

// POST: Update subscription / change local storage plan
export async function action({ request }: Route.ActionArgs) {
  const session = await auth.api.getSession(request)
  if (!session) throw redirect('/auth/sign-in')

  const userId = session.user.id
  const fd = await request.formData()
  const storagePlanType = (fd.get('storagePlanType') as string) || null
  const storagePlanId = (fd.get('storagePlanId') as string) || null

  let plan = null
  if (storagePlanId) plan = await storagePlanRepository.findById(storagePlanId)
  else if (storagePlanType)
    plan = await storagePlanRepository.findByType(storagePlanType as any)

  if (!plan) return new Response('Storage plan not found', { status: 404 })

  // Update user and quota locally. For Stripe-backed subscriptions, more complex flow needed.
  await userRepository.update({
    where: { id: userId },
    data: { storagePlanId: plan.id },
  })
  try {
    await quotaRepository.updateTotalQuota({
      userId,
      dataSize: plan.storageLimit,
    })
  } catch (e) {
    // if no quota exists, create one
    try {
      await quotaRepository.create({
        driveId: session.user.driveId!,
        userId,
        storagePlanId: plan.id,
      })
    } catch (err) {}
  }

  // Ensure there's a subscription record for bookkeeping
  const active = await subscriptionRepository.findActiveByOwnerId(userId)
  if (active) {
    await subscriptionRepository.update({
      where: { id: active.id },
      data: { storagePlanId: plan.id },
    })
  } else {
    // create a local subscription record (non-Stripe)
    await subscriptionRepository.create({
      data: {
        ownerId: userId,
        storagePlanId: plan.id,
        id: 'sub_local_' + Date.now().toString(),
      },
    })
  }

  return new Response('OK')
}
