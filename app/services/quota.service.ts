import { PrismaClient, type Quota } from '@/prisma/client'
import { calculateQuotaUpdate } from './quota.utils'
import { prisma } from '@/services/db.server'

/**
 * A service for managing user storage quotas.
 */
export class QuotaService {
	/**
	 * Checks if a user has enough quota for a file upload.
	 * Throws an error if the quota is exceeded.
	 *
	 * @param userId - The ID of the user.
	 * @param fileSizeInBytes - The size of the file to be uploaded.
	 */
	public async checkFileUploadQuota(
		userId: string,
		fileSizeInBytes: bigint,
	): Promise<void> {
		const quota = await prisma.quota.findFirst({
			where: {
				drive: {
					ownerId: userId,
				},
			},
		})

		if (!quota) {
			throw new Error(`Quota for user ${userId} not found.`)
		}

		if (quota.remaining < fileSizeInBytes) {
			throw new Error('Insufficient storage space. Upload rejected.')
		}
	}

	/**
	 * Updates a user's quota after a successful file upload.
	 * This should be called after the file is confirmed to be in S3.
	 *
	 * @param userId - The ID of the user.
	 * @param fileSizeInBytes - The size of the uploaded file.
	 * @returns The updated quota.
	 */
	public async updateQuotaForUpload(
		userId: string,
		fileSizeInBytes: bigint,
	): Promise<Quota> {
		return prisma.$transaction(async tx => {
			const quota = await tx.quota.findFirstOrThrow({
				where: { drive: { ownerId: userId } },
			})

			const newQuotaValues = calculateQuotaUpdate(quota, {
				usedDelta: fileSizeInBytes,
			})

			return tx.quota.update({
				where: { id: quota.id },
				data: newQuotaValues,
			})
		})
	}

	/**
	 * Updates a user's quota after a file upload.
	 * It's recommended to run this within a larger transaction if other database
	 * operations are part of the file upload process.
	 *
	 * @param userId - The ID of the user uploading the file.
	 * @param fileSizeInBytes - The size of the uploaded file in bytes.
	 * @returns The updated quota.
	 * @throws Error if the user has insufficient storage space.
	 * @throws Error if the user's drive or quota is not found.
	 */
	public async handleFileUpload(
		userId: string,
		fileSizeInBytes: bigint
	): Promise<Quota> {
		return prisma.$transaction(async (tx) => {
			// Find the user's drive and its current quota.
			// This assumes a user has one primary drive.
			// Modify the query if users can have multiple drives (e.g., by driveId).
			const quota = await tx.quota.findFirst({
				where: {
					drive: {
						ownerId: userId,
					},
				},
			})

			if (!quota) {
				throw new Error(`Quota for user ${userId} not found.`)
			}

			// Check for sufficient space before updating
			if (quota.remaining < fileSizeInBytes) {
				throw new Error('Insufficient storage space. Upload rejected.')
			}

			const newQuotaValues = calculateQuotaUpdate(quota, {
				usedDelta: fileSizeInBytes,
			})

			// Update the quota record
			return await tx.quota.update({
				where: { id: quota.id },
				data: newQuotaValues,
			})
		})
	}

	/**
	 * Updates a user's quota after a file is moved to the recycle bin.
	 * @param userId - The ID of the user.
	 * @param fileSizeInBytes - The size of the deleted file in bytes.
	 * @returns The updated quota.
	 */
	public async handleFileDeletion(
		userId: string,
		fileSizeInBytes: bigint
	): Promise<Quota> {
		return prisma.$transaction(async (tx) => {
			const quota = await tx.quota.findFirstOrThrow({
				where: { drive: { ownerId: userId } },
			})

			const newQuotaValues = calculateQuotaUpdate(quota, {
				usedDelta: -fileSizeInBytes,
				deletedDelta: fileSizeInBytes,
			})

			return tx.quota.update({
				where: { id: quota.id },
				data: newQuotaValues,
			})
		})
	}

	/**
	 * Updates a user's quota after a file is permanently deleted from the recycle bin.
	 * @param userId - The ID of the user.
	 * @param fileSizeInBytes - The size of the permanently deleted file in bytes.
	 * @returns The updated quota.
	 */
	public async handleFilePurge(
		userId: string,
		fileSizeInBytes: bigint
	): Promise<Quota> {
		const quota = await prisma.quota.findFirstOrThrow({
			where: { drive: { ownerId: userId } },
		})

		// When a file is purged, only 'deleted' space decreases.
		const newDeleted = quota.deleted - fileSizeInBytes

		return prisma.quota.update({
			where: { id: quota.id },
			data: {
				deleted: newDeleted < 0n ? 0n : newDeleted,
			},
		})
	}
}
