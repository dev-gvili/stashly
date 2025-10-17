import { itemRepository } from '@/services/repositories/ItemRepository'
import { permissionRepository } from '@/services/repositories/PermissionRepository'
import { workspaceMemberRepository } from '@/services/repositories/workspaceMember.repository'
import { quotaRepository } from '@/services/repositories/QuotaRepository'
import { ApiError, ApiErrorCode } from '../api.errors'
import { getPrefixForModel, toObjectId } from '@/utils/misc'

export const itemService = {
	/**
	 * Get an item with its permissions, checking if the user has access.
	 * @param userId The ID of the user requesting the item.
	 * @param itemId The ID of the item to retrieve.
	 */
	async getItemWithPermissions(userId: string, itemId: string) {
		const item = await itemRepository.findById({ where: { id: itemId } })
		if (!item) {
			throw new ApiError(ApiErrorCode.NOT_FOUND, 'Item not found')
		}

		const canRead = await permissionRepository.hasItemPermission(
			userId,
			itemId,
			'read'
		)
		if (!canRead && item.workspaceId) {
			await workspaceMemberRepository.requireMembership(
				userId,
				item.workspaceId,
				{
					message: 'You do not have access to this item',
				}
			)
		}

		const permissions = await permissionRepository.findByItemId(itemId)

		return { ...item, permissions }
	},

	/**
	 * Copies an item to a new location, checking permissions and quota.
	 * @param userId The ID of the user performing the copy.
	 * @param itemId The ID of the item to copy.
	 * @param targetWorkspaceId The optional ID of the workspace to copy the item to. Defaults to the original workspace.
	 */
	async copyItem(userId: string, itemId: string, targetWorkspaceId?: string) {
		// 1. Get the original item
		const originalItem = await itemRepository.findById({
			where: { id: itemId },
			include: {
				workspace: true,
				owner: true,
				permissions: true,
				favoritedBy: true,
				file: true,
				drive: true,
			},
		})
		if (!originalItem) {
			throw new ApiError(ApiErrorCode.NOT_FOUND, 'Item not found')
		}

		// 2. Check for read permission on the original item
		const canRead = await permissionRepository.hasItemPermission(
			userId,
			itemId,
			'read'
		)
		if (!canRead && originalItem.workspaceId) {
			await workspaceMemberRepository.requireMembership(
				userId,
				originalItem.workspaceId,
				{
					message: 'You do not have access to this item',
				}
			)
		}

		// 3. Determine target workspace and check create permission
		const destinationWorkspaceId =
			targetWorkspaceId || originalItem.workspaceId
		if (!destinationWorkspaceId) {
			throw new ApiError(
				ApiErrorCode.COPY_ITEM_FAILED,
				'A target workspace must be specified for items not in a workspace.'
			)
		}

		await workspaceMemberRepository.requireAtLeastRole(
			userId,
			destinationWorkspaceId,
			'member',
			{
				message:
					'You must be a member of the target workspace to copy items.',
			}
		)

		// 4. Check user's quota
		const userQuota = await quotaRepository.findByUserId(userId)
		if (!userQuota) {
			throw new ApiError(
				ApiErrorCode.FORBIDDEN,
				'User does not have a quota.'
			)
		}
		if (userQuota.remaining < originalItem.size) {
			throw new ApiError(
				ApiErrorCode.FORBIDDEN,
				'Insufficient quota to copy the item.'
			)
		}

		// 5. Create the new item (the copy)
		const { id, createdAt, updatedAt, ...restOfItem } = originalItem

		const newItem = await itemRepository.create({
			...restOfItem,
			id: toObjectId(getPrefixForModel('Item')),
			drive: { connect: { id: originalItem.driveId } },
			owner: { connect: { id: userId } },
			workspace: { connect: { id: destinationWorkspaceId } },
		})

		// 6. Update quota
		await quotaRepository.updateAfterItemsCopied({
			userId,
			dataSize: originalItem.size,
		})

		return newItem
	},

	/**
	 * Searches for items owned by a user based on a query string.
	 * @param userId The ID of the user whose items are being searched.
	 * @param query The search query string.
	 */
	async searchUserItems(userId: string, query: string) {
		const items = await itemRepository.search({
			strategy: 'cursor',
			owner: userId,
            query,
            include: { owner: true, workspace: true },
            take: 10,
		})
		return items
	},
}
