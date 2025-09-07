import { type Quota } from '@/prisma/client'
import { calculateQuota } from './quota.utils'
import { prisma } from '@/services/db'

interface UpdateQuotaInput {
	userId: string
	used?: bigint
	deleted?: bigint
	total?: bigint
}

export interface QuotaInput {
	userId: string
	dataSize: bigint
}

export interface QuotaOutput extends Quota {
	remaining: bigint
}

interface FindQuotaInput extends Pick<QuotaInput, 'userId'> {}

/**
 * Retrieves the quota for a given user.
 *
 * @param userId - The ID of the user.
 * @returns The user's quota.
 */
export async function findQuota({
	userId,
}: FindQuotaInput): Promise<QuotaOutput> {
	const quota = await prisma.quota.findFirst({
		where: {
			drive: {
				ownerId: userId,
			},
		},
	})

	if (!quota) {
		throw new Error(`Quota not found for user ${userId}`)
	}

	return {
		...quota,
		remaining: quota.total - quota.used,
	}
}

/**
 * Checks if the user has enough free quota for a given data size.
 *
 * @param quota - The user's current quota.
 * @param dataSize - The size of the data to check against the quota.
 * @returns True if the user has enough free quota, false otherwise.
 */
export function verifyFreeQuota(quota: QuotaOutput, dataSize: bigint): boolean {
	return quota.remaining >= dataSize
}

/**
 * Updates the quota for a user.
 *
 * @param userId - The ID of the user.
 * @param used - The amount of data used (optional).
 * @param deleted - The amount of data deleted (optional).
 * @param total - The total amount of data (optional).
 * @returns The updated quota information.
 */
async function update({
	userId,
	...args
}: UpdateQuotaInput): Promise<QuotaOutput> {
	return prisma.$transaction(async (tx) => {
		const current = await findQuota({ userId })

		const { remaining, ...data } = calculateQuota(current, {
			...args,
		})

		let quota = await tx.quota.update({
			where: { id: current.id },
			data,
		})

		return {
			...quota,
			remaining,
		}
	})
}

/**
 * Handles the quota update after a successful file upload.
 *
 * @param userId - The ID of the user.
 * @param dataSize - The sum of the sizes of the uploaded items.
 */
export async function onItemsUploaded({
	userId,
	dataSize,
}: QuotaInput): Promise<QuotaOutput> {
	return await update({ userId, used: dataSize })
}

/**
 * Updates the quota after items are copied.
 *
 * @param userId - The ID of the user.
 * @param dataSize - The sum of the sizes of the copied items.
 */
export async function onItemsCopied({
	userId,
	dataSize,
}: QuotaInput): Promise<QuotaOutput> {
	return await update({ userId, used: dataSize })
}

/**
 * Updates the quota after items are moved to trash.
 *
 * @param userId - The ID of the user.
 * @param dataSize - The sum of the sizes of the trashed items.
 */
export async function onItemsTrashed({
	userId,
	dataSize,
}: QuotaInput): Promise<QuotaOutput> {
	return await update({ userId, used: -dataSize, deleted: dataSize })
}

/**
 * Updates the quota after items are restored from trash.
 *
 * @param userId - The ID of the user.
 * @param dataSize - The sum of the sizes of the restored items.
 */
export async function onItemsRestored({
	userId,
	dataSize,
}: QuotaInput): Promise<QuotaOutput> {
	return await update({ userId, used: dataSize, deleted: -dataSize })
}

/**
 * Updates the quota after items are permanently deleted from trash.
 *
 * @param userId - The ID of the user.
 * @param dataSize - The sum of the sizes of the deleted items.
 */
export async function onItemsDeleted({
	userId,
	dataSize,
}: QuotaInput): Promise<QuotaOutput> {
	return await update({ userId, deleted: -dataSize })
}

/**
 * Updates the total quota for a user.
 *
 * @param userId - The ID of the user.
 * @param total - The new total quota value.
 * @returns The updated quota information.
 */
export async function updateTotalQuota({
	userId,
	dataSize,
}: QuotaInput): Promise<QuotaOutput> {
	return await update({ userId, total: dataSize })
}
