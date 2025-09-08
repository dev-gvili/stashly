import { QuotaState } from '@/prisma/enums'
import type { Quota, StoragePlanType } from '@/prisma/client'
import type { QuotaOutput } from './quota'

/**
 * Calculates the QuotaState based on used and total space.
 * @param used - The used space in bytes.
 * @param total - The total space in bytes.
 * @returns The calculated QuotaState.
 */
export function toQuotaState({
	used,
	total,
}: Pick<QuotaOutput, 'used' | 'total'>): QuotaState {
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
): Pick<QuotaOutput, 'used' | 'deleted' | 'total' | 'state' | 'remaining'> {
	const total = data.total ?? current.total

	// Apply deltas and ensure values don't go below zero.
	let used = current.used + (data.used ?? 0n)
	if (used < 0n) used = 0n

	let deleted = current.deleted + (data.deleted ?? 0n)
	if (deleted < 0n) deleted = 0n

	const remaining = total - used

	// The state is now calculated here.
	const state = toQuotaState({ used, total })

	return {
		total,
		used,
		deleted,
		remaining,
		state,
	}
}


/**
 * Maps a storage plan type to its total quota size in bytes.
 * @param plan The storage plan type.
 * @returns The total quota size in bytes.
 */
export function toQuotaTotalSize(plan: StoragePlanType): bigint {
	switch (plan) {
		case 'free':
			return BigInt(15 * 1_000_000_000) // 15 GB
		case 'basic':
			return BigInt(100 * 1_000_000_000) // 100 GB in decimal bytes
		case 'standard':
			return BigInt(200 * 1_000_000_000) // 200 GB in decimal bytes
		case 'premium':
			return BigInt(2 * 1_000_000_000_000) // 2 TB in decimal bytes
		default:
			return BigInt(0)
	}
}
