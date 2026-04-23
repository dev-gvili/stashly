import { prisma } from '@/services/db'
import { StashlyError, StashlyErrorCode } from '@/services/api.errors'
import { getPrefixForModel, toObjectId } from '@/utils/converters'
import type { StoragePlanType, SubscriptionStatus } from '@/prisma/enums'
import { subscriptionRepository } from './repositories/SubscriptionRepository'
import { findStoragePlanById, findStoragePlanByType } from './storagePlan-actions'
import { createQuota, updateTotalQuota } from './quota-actions'

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
        driveId,
        userId,
        storagePlanId: plan.id,
      })
    } catch {
      // ignore secondary creation errors
    }
  }

  // Ensure a subscription record exists
  const active = await subscriptionRepository.findActiveByOwnerId(userId)
  if (active) {
    await subscriptionRepository.update({
      where: { id: active.id },
      data: { storagePlanId: plan.id },
    })
  } else {
    await subscriptionRepository.create({
      data: {
        ownerId: userId,
        storagePlanId: plan.id,
        id: toObjectId(getPrefixForModel('Subscription')),
      },
    })
  }

  return plan
}

/**
 * Mark the user's active subscription as cancelled.
 * No-ops silently if the user has no active subscription.
 */
export async function cancelSubscription(userId: string) {
  const active = await subscriptionRepository.findActiveByOwnerId(userId)
  if (!active) {
    throw new StashlyError(StashlyErrorCode.SUBSCRIPTION_NOT_FOUND)
  }

  return subscriptionRepository.update({
    where: { id: active.id },
    data: { status: 'canceled' as SubscriptionStatus },
  })
}
