import type { Quota, StoragePlanType } from '@/prisma/client'
import type { QuotaOutput } from './quota'
import { QuotaStatus } from '@/prisma/enums'

/**
 * Calculates the QuotaState based on used and total space.
 * @param used - The used space in bytes.
 * @param total - The total space in bytes.
 * @returns The calculated QuotaState.
 */
export function toQuotaStatus({
  used,
  total,
}: Pick<QuotaOutput, 'used' | 'total'>): QuotaStatus {
  if (total === 0n) return used > 0n ? 'exceeded' : 'normal'

  const usageRatio = Number((used * 1000n) / total) / 1000

  if (usageRatio > 1) return 'exceeded'
  if (usageRatio > 0.99) return 'critical' // Remaining < 1%
  if (usageRatio > 0.9) return 'warning' // Remaining < 10%

  return 'normal'
}

/**
 * Calculates a new quota object by applying a set of changes (deltas) to the current quota.
 * This is a pure function that determines the next state without causing side effects.
 *
 * @param current The current quota object, containing `used`, `deleted`, and `total` values.
 * @param data An object with the changes to apply, which can contain deltas for `used`, `deleted`, or a new `total`.
 * @returns A new quota object with the updated `used`, `deleted`, `total`, `remaining`, and `state` values.
 */
export function calculateQuota(
  current: Pick<QuotaOutput, 'used' | 'deleted' | 'total'>,
  data: Partial<Pick<Quota, 'used' | 'deleted' | 'total'>>
): Pick<QuotaOutput, 'used' | 'deleted' | 'total' | 'status' | 'remaining'> {
  const total = data.total ?? current.total

  // Apply deltas and ensure values don't go below zero.
  let used = current.used + (data.used ?? 0n)
  if (used < 0n) used = 0n

  let deleted = current.deleted + (data.deleted ?? 0n)
  if (deleted < 0n) deleted = 0n

  const remaining = total - used

  // The state is now calculated here.
  const status = toQuotaStatus({ used, total })

  return {
    total,
    used,
    deleted,
    remaining,
    status,
  }
}

export function toQuota(
  quota: Omit<Quota, 'createdAt' | 'updatedAt'>
): QuotaOutput {
  const total = quota.total
  const used = quota.used
  const deleted = quota.deleted
  const remaining = total - used
  const status = toQuotaStatus({ used, total })
  return { ...quota, total, used, deleted, remaining, status }
}
