import { prisma } from '@/services/db'
import { StashlyError, StashlyErrorCode } from '@/services/api.errors'
import { getPrefixForModel, toObjectId } from '@/utils/converters'
import type { Prisma, StoragePlan } from '@/prisma/client'
import type { StoragePlanType } from '@/prisma/enums'
import { SubscriptionStatus } from '@/prisma/enums'
import { findStoragePlanById, findStoragePlanByType } from './storagePlan-actions'
import { createQuota, updateTotalQuota } from './quota-actions'
import { stripe } from './stripe'
import type Stripe from 'stripe'
import { buildSubscriptionFilters } from '@/utils/filters/subscription.filters'
import { searchFactory } from '@/utils/search'

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

/**
 * Paginated, filterable search over Subscription records.
 *
 * @example
 * const page = await searchSubscriptions({ ownerId: 'user_123', take: 20, strategy: 'cursor' })
 */
export const searchSubscriptions = searchFactory({
  dbDelegate: prisma.subscription,
  buildFilters: buildSubscriptionFilters,
  defaultOrderBy: (): Prisma.SubscriptionOrderByWithRelationInput => ({ createdAt: 'desc' }),
})

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Get the active subscription (with plan) for a user.
 * Returns null if the user has no active subscription.
 */
export async function getActiveSubscription(userId: string) {
  return prisma.subscription.findFirst({
    where: {
      ownerId: userId,
      status: 'active',
    },
    include: { storagePlan: true },
  })
}

/**
 * Find a storage plan by ID or type.
 * At least one of planId or planType must be provided.
 */
export async function getStoragePlan(planId?: string | null, planType?: string | null) {
  if (planId) return findStoragePlanById(planId)
  if (planType) return findStoragePlanByType(planType as StoragePlanType)
  throw new StashlyError(StashlyErrorCode.INVALID_INPUT, 'planId or planType is required')
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/**
 * Update the user's subscription plan locally (non-Stripe path).
 * Updates the user record, quota, and subscription record in sequence.
 */
export async function updateSubscriptionPlan({
  userId,
  storagePlanId,
  storagePlanType,
  driveId,
}: {
  userId: string
  storagePlanId?: string | null
  storagePlanType?: string | null
  driveId: string
}) {
  const plan = await getStoragePlan(storagePlanId, storagePlanType)
  if (!plan) {
    throw new StashlyError(StashlyErrorCode.STORAGE_PLAN_NOT_FOUND)
  }

  // Update user's storage plan reference
  await prisma.user.update({
    where: { id: userId },
    data: { storagePlanId: plan.id },
  })

  // Update or create quota
  try {
    await updateTotalQuota({
      userId,
      dataSize: plan.storageLimit,
      client: prisma,
    })
  } catch {
    // Quota doesn't exist yet — create it
    try {
      await createQuota({
        id: toObjectId(getPrefixForModel('Quota')),
        driveId,
        storagePlanId: plan.id,
      })
    } catch {
      // ignore secondary creation errors
    }
  }

  // Ensure a subscription record exists
  const active = await findActiveSubscriptionByOwner(userId)
  if (active) {
    await updateSubscriptionRecord({
      where: { id: active.id },
      data: { storagePlanId: plan.id },
    })
  } else {
    await createSubscriptionRecord({
      id: toObjectId(getPrefixForModel('Subscription')),
      owner: { connect: { id: userId } },
      storagePlan: { connect: { id: plan.id } },
      status: 'active',
    })
  }

  return plan
}

/**
 * Mark the user's active subscription as cancelled.
 * No-ops silently if the user has no active subscription.
 */
export async function cancelSubscription(userId: string) {
  const active = await findActiveSubscriptionByOwner(userId)
  if (!active) {
    throw new StashlyError(StashlyErrorCode.SUBSCRIPTION_NOT_FOUND)
  }

  return updateSubscriptionRecord({
    where: { id: active.id },
    data: { status: 'canceled' as SubscriptionStatus },
  })
}

// ---------------------------------------------------------------------------
// Base CRUD (ported from SubscriptionRepository)
// ---------------------------------------------------------------------------

export async function findSubscriptionById(
  args: Prisma.SubscriptionFindUniqueArgs,
  client: Prisma.TransactionClient = prisma
) {
  return client.subscription.findUnique(args)
}

export async function findAllSubscriptions(
  args: Prisma.SubscriptionFindManyArgs,
  client: Prisma.TransactionClient = prisma
) {
  return client.subscription.findMany(args)
}

export async function createSubscriptionRecord(
  data: Prisma.SubscriptionCreateInput,
  client: Prisma.TransactionClient = prisma
) {
  return client.subscription.create({ data })
}

export async function updateSubscriptionRecord(
  args: Prisma.SubscriptionUpdateArgs,
  client: Prisma.TransactionClient = prisma
) {
  return client.subscription.update(args)
}

export async function deleteSubscription(id: string) {
  return prisma.subscription.delete({ where: { id } })
}

// ---------------------------------------------------------------------------
// Lookups (ported from SubscriptionRepository)
// ---------------------------------------------------------------------------

export async function findActiveSubscriptionByOwner(ownerId: string) {
  return prisma.subscription.findFirst({
    where: { ownerId, status: { in: [SubscriptionStatus.active] } },
  })
}

export async function findActiveByStripeCustomerId(stripeCustomerId: string) {
  return prisma.subscription.findFirst({
    where: { owner: { stripeCustomerId }, status: { in: [SubscriptionStatus.active] } },
  })
}

export async function findActiveByStoragePlanType(storagePlanType: StoragePlanType) {
  return prisma.subscription.findFirst({
    where: { storagePlan: { type: storagePlanType }, status: { in: [SubscriptionStatus.active] } },
  })
}

export async function findActiveSubscription({
  ownerId,
  stripeCustomerId,
  storagePlanType,
}: {
  ownerId: string
  stripeCustomerId: string
  storagePlanType: StoragePlanType
}) {
  return prisma.subscription.findFirst({
    where: {
      ownerId,
      owner: { stripeCustomerId },
      storagePlan: { type: storagePlanType },
      status: { in: [SubscriptionStatus.active] },
    },
  })
}

export async function findSubscriptionByStripeId(stripeSubscriptionId: string) {
  return prisma.subscription.findUnique({ where: { stripeSubscriptionId } })
}

export async function updateSubscriptionByStripeId(
  stripeSubscriptionId: string,
  data: Prisma.SubscriptionUpdateInput
) {
  return prisma.subscription.update({ where: { stripeSubscriptionId }, data })
}

// ---------------------------------------------------------------------------
// Stripe helpers (ported from SubscriptionRepository)
// ---------------------------------------------------------------------------

export async function findStripeCustomerId(userId: string): Promise<string> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
  if (user.stripeCustomerId) {
    try {
      const customer = await stripe.customers.retrieve(user.stripeCustomerId)
      return customer.id
    } catch {}
  }
  const customers = await stripe.customers.list({ email: user.email, limit: 1 })
  let customer = customers.data[0]
  if (!customer) {
    customer = await stripe.customers.create({
      email: user.email,
      name: user.name ?? undefined,
      metadata: { userId: user.id },
    })
  }
  await prisma.user.update({ where: { id: userId }, data: { stripeCustomerId: customer.id } })
  return customer.id
}

export async function listStripePrices() {
  return (await stripe.prices.list({ expand: ['data.product'], type: 'recurring', limit: 25, active: true })).data
}

export async function findStripePriceById(priceId: string) {
  return stripe.prices.retrieve(priceId, { expand: ['product'] })
}

export async function findStripeProductById(productId: string) {
  return stripe.products.retrieve(productId)
}

export async function findStripeProductByPriceId(priceId: string) {
  return stripe.prices.retrieve(priceId, { expand: ['product'] }).then((p) => p.product)
}

export async function findStripeSubscriptionsByCustomer(customerId: string) {
  return stripe.subscriptions.list({ customer: customerId })
}

export async function findStripeSubscriptionById(subscriptionId: string) {
  return stripe.subscriptions.retrieve(subscriptionId)
}

export async function findStripeCustomerById(customerId: string) {
  return stripe.customers.retrieve(customerId)
}

export async function findStripeCustomerByEmail(email: string) {
  return stripe.customers.list({ email, limit: 1 }).then((r) => r.data[0])
}

export async function createStripeCustomer(email: string, name?: string, userId?: string) {
  return stripe.customers.create({ email, name, metadata: userId ? { userId } : undefined })
}

export async function createStripeSubscription(customerId: string, priceId: string) {
  return stripe.subscriptions.create({ customer: customerId, items: [{ price: priceId }] })
}

export async function cancelStripeSubscription(subscriptionId: string) {
  return stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true })
}

export async function updateStripeSubscription(subscriptionId: string, data: Stripe.SubscriptionUpdateParams) {
  return stripe.subscriptions.update(subscriptionId, data)
}

// ---------------------------------------------------------------------------
// Transactional helpers (ported from SubscriptionRepository)
// ---------------------------------------------------------------------------

export async function createSubscriptionWithQuota(
  userId: string,
  storagePlan: StoragePlan,
  stripeSubscription: { stripeSubscriptionId: string; status: SubscriptionStatus }
) {
  return prisma.$transaction(async (tx) => {
    const newSubscription = await tx.subscription.create({
      data: {
        ownerId: userId,
        id: toObjectId(getPrefixForModel('Subscription')),
        storagePlanId: storagePlan.id,
        stripeSubscriptionId: stripeSubscription.stripeSubscriptionId,
        status: stripeSubscription.status,
      },
      include: { storagePlan: true, owner: true },
    })
    await tx.quota.update({
      where: { driveId: newSubscription.owner.driveId! },
      data: { total: storagePlan.storageLimit },
    })
    return newSubscription
  })
}

export async function changeSubscriptionPlan(stripeSubscriptionId: string, newPlan: StoragePlan) {
  return prisma.$transaction(async (tx) => {
    const current = await tx.subscription.findUniqueOrThrow({
      where: { stripeSubscriptionId },
      include: { storagePlan: true, owner: true },
    })
    const updated = await tx.subscription.update({
      where: { stripeSubscriptionId },
      data: { storagePlanId: newPlan.id },
    })
    await tx.quota.update({
      where: { driveId: current.owner.driveId! },
      data: { total: newPlan.storageLimit },
    })
    return updated
  })
}

export async function setSubscriptionCanceled(stripeSubscriptionId: string, cancelAt: Date) {
  return prisma.$transaction(async (tx) => {
    return tx.subscription.update({
      where: { stripeSubscriptionId },
      data: { status: SubscriptionStatus.canceled, endedAt: cancelAt },
    })
  })
}
