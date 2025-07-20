import { QuotaState } from '@/prisma/enums'
import type { Quota } from '@/prisma/client'

/**
 * Calculates the QuotaState based on used and total space.
 * @param used - The used space in bytes.
 * @param total - The total space in bytes.
 * @returns The calculated QuotaState.
 */
export function calculateQuotaState(used: bigint, total: bigint): QuotaState {
	if (total === 0n) return used > 0n ? 'exceeded' : 'normal'

	const usageRatio = Number((used * 1000n) / total) / 1000

	if (usageRatio > 1) return 'exceeded'
	if (usageRatio > 0.99) return 'critical' // Remaining < 1%
	if (usageRatio > 0.9) return 'warning' // Remaining < 10%

	return 'normal'
}

interface QuotaUpdatePayload {
	/** Change in used space (positive for upload, negative for deletion). */
	usedDelta?: bigint
	/** Change in deleted space (positive for move to trash, negative for purge). */
	deletedDelta?: bigint
	/** A new total capacity, for instance after a subscription change. */
	newTotal?: bigint
}

/**
 * Calculates the new state of a quota based on a change event.
 * @param currentQuota The current quota object from the database.
 * @param payload The changes to apply to the quota.
 * @returns An object with the new `used`, `deleted`, `total`, `remaining`, and `state` values.
 */
export function calculateQuotaUpdate(
	currentQuota: Pick<Quota, 'used' | 'deleted' | 'total'>,
	payload: QuotaUpdatePayload
): Pick<Quota, 'used' | 'deleted' | 'total' | 'remaining' | 'state'> {
	const total = payload.newTotal ?? currentQuota.total

	// Ensure used and deleted don't go below zero.
	let used = currentQuota.used + (payload.usedDelta ?? 0n)
	if (used < 0n) used = 0n

	let deleted = currentQuota.deleted + (payload.deletedDelta ?? 0n)
	if (deleted < 0n) deleted = 0n

	const remaining = total - used
	const state = calculateQuotaState(used, total)

	return {
		total,
		used,
		deleted,
		remaining,
		state,
	}
}