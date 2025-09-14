import { workspaceMemberRepository } from '@/services/repositories/WorkspaceMemberRepository'
import { permissionRepository } from '@/services/repositories/PermissionRepository'
import { itemRepository } from '@/services/repositories/ItemRepository'
import { ApiError, ApiErrorCode } from '../api.errors'
import type { Prisma, Item, Permission } from '@/prisma/client'
import { toObjectId, getPrefixForModel } from '@/utils/misc'
import { PermissionRole } from '../prisma/enums'

export class WorkspaceItemService {
	/**
	 * Create a new item in a workspace.
	 * Requires the user to be at least a 'member' of the workspace.
	 */
	async createItem(
		userId: string,
		workspaceId: string,
		data: Prisma.ItemCreateInput
	): Promise<Item> {
		await workspaceMemberRepository.requireAtLeastRole(
			userId,
			workspaceId,
			'member',
			{
				statusCode: 403,
				message: 'You must be a workspace member to create items',
			}
		)

		const item = await itemRepository.create({
			...data,
			workspace: { connect: { id: workspaceId } },
			owner: { connect: { id: userId } },
		})

		// Give creator full write permission
		await permissionRepository.create({
			id: toObjectId(getPrefixForModel('Permission')),
			item: { connect: { id: item.id } },
			users: { connect: { id: userId } },
			roles: 'write',
		})

		return item
	}

	/**
	 * Update an existing item.
	 * Requires either item-level write permission or workspace admin/owner role.
	 */
	async updateItem(
		userId: string,
		itemId: string,
		updateData: Prisma.ItemUpdateInput
	): Promise<Item> {
		const item = await itemRepository.findById({ where: { id: itemId } })
		if (!item) throw new ApiError(ApiErrorCode.NOT_FOUND, 'Item not found')

		const canEdit = await permissionRepository.hasItemPermission(
			userId,
			itemId,
			'write'
		)
		if (!canEdit && item.workspaceId) {
			await workspaceMemberRepository.requireAtLeastRole(
				userId,
				item.workspaceId,
				'admin',
				{
					statusCode: 403,
					message: 'You do not have permission to edit this item',
				}
			)
		}

		return itemRepository.update({
			where: { id: itemId },
			data: updateData,
		})
	}

	/**
	 * Delete an item.
	 * Requires either item-level write permission or workspace admin/owner role.
	 */
	async deleteItem(userId: string, itemId: string): Promise<Item> {
		const item = await itemRepository.findById({ where: { id: itemId } })
		if (!item) throw new ApiError(ApiErrorCode.NOT_FOUND, 'Item not found')

		const canDelete = await permissionRepository.hasItemPermission(
			userId,
			itemId,
			'write'
		)
		if (!canDelete && item.workspaceId) {
			await workspaceMemberRepository.requireAtLeastRole(
				userId,
				item.workspaceId,
				'admin',
				{
					statusCode: 403,
					message: 'Only admins or owners can delete items',
				}
			)
		}

		return itemRepository.delete(itemId)
	}

	/**
	 * List items in a workspace that the user can access.
	 * Requires workspace membership.
	 */
	async listWorkspaceItems(
		userId: string,
		workspaceId: string,
		page = 1,
		pageSize = 20
	): Promise<Item[]> {
		await workspaceMemberRepository.requireMembership(userId, workspaceId, {
			statusCode: 403,
			message: 'You are not a member of this workspace',
		})

		return itemRepository.findByWorkspace(workspaceId, page, pageSize)
	}

	/**
	 * Mark an item as a favorite for the user.
	 * Requires read access to the item.
	 */
	async favoriteItem(userId: string, itemId: string): Promise<Item> {
		const item = await itemRepository.findById({ where: { id: itemId } })
		if (!item) throw new ApiError(ApiErrorCode.NOT_FOUND, 'Item not found')

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
					statusCode: 403,
					message: 'You do not have access to this item',
				}
			)
		}

		return itemRepository.favorite(itemId, userId)
	}

	/**
	 * Remove an item from the user's favorites.
	 */
	async unfavoriteItem(userId: string, itemId: string): Promise<Item> {
		const item = await itemRepository.findById({ where: { id: itemId } })
		if (!item) throw new ApiError(ApiErrorCode.NOT_FOUND, 'Item not found')

		return itemRepository.unfavorite(itemId, userId)
	}

	/**
	 * Grant a specific role on an item to another user.
	 * Only workspace admins/owners or the item owner can do this.
	 */
	async grantItemPermission(
		actingUserId: string,
		targetUserId: string,
		itemId: string,
		role: PermissionRole
	) {
		const item = await itemRepository.findById({ where: { id: itemId } })
		if (!item) throw new ApiError(ApiErrorCode.NOT_FOUND, 'Item not found')

		// Check if acting user is allowed to grant permissions
		const isItemOwner = item.ownerId === actingUserId
		const isWorkspaceAdmin = await workspaceMemberRepository.hasAtLeastRole(
			actingUserId,
			item.workspaceId!, // todo: add proper check for workspaceId
			'admin'
		)

		if (!isItemOwner && !isWorkspaceAdmin) {
			throw new ApiError(
				ApiErrorCode.FORBIDDEN,
				'You cannot grant permissions on this item'
			)
		}

		// Create or update the permission
		return permissionRepository.create({
			id: toObjectId(getPrefixForModel('Permission')),
			item: { connect: { id: itemId } },
			users: { connect: { id: targetUserId } },
			roles: role,
		})
	}

	/**
	 * Revoke a user's permission on an item.
	 * Only workspace admins/owners or the item owner can do this.
	 */
	async revokeItemPermission(
		actingUserId: string,
		targetUserId: string,
		itemId: string
	) {
		const item = await itemRepository.findById({ where: { id: itemId } })
		if (!item) throw new ApiError(ApiErrorCode.NOT_FOUND, 'Item not found')

		const isItemOwner = item.ownerId === actingUserId
		const isWorkspaceAdmin = await workspaceMemberRepository.hasAtLeastRole(
			actingUserId,
			item.workspaceId!, // todo: add proper check for workspaceId
			'admin'
		)

		if (!isItemOwner && !isWorkspaceAdmin) {
			throw new ApiError(
				ApiErrorCode.FORBIDDEN,
				'You cannot revoke permissions on this item'
			)
		}

		// Find the permission record
		const perms = await permissionRepository.findByItemId(itemId)
		const perm = perms.find((p) =>
			p.users.some((u) => u.id === targetUserId)
		)
		if (!perm) {
			throw new ApiError(
				ApiErrorCode.NOT_FOUND,
				'Permission not found for this user'
			)
		}

		return permissionRepository.delete({ where: { id: perm.id } })
	}

	/**
	 * List all permissions for a given item.
	 * Only the item owner or workspace admins/owners can view this.
	 */
	async listItemPermissions(
		actingUserId: string,
		itemId: string
	): Promise<Permission[]> {
		const item = await itemRepository.findById({ where: { id: itemId } })
		if (!item) throw new ApiError(ApiErrorCode.NOT_FOUND, 'Item not found')

		const isItemOwner = item.ownerId === actingUserId
		const isWorkspaceAdmin = await workspaceMemberRepository.hasAtLeastRole(
			actingUserId,
			item.workspaceId!, // todo: add proper check for workspaceId
			'admin'
		)

		if (!isItemOwner && !isWorkspaceAdmin) {
			throw new ApiError(
				ApiErrorCode.FORBIDDEN,
				'You cannot view permissions for this item'
			)
		}

		return permissionRepository.findByItemId(itemId)
	}

	/**
	 * Sync a user's item-level permissions with their workspace role.
	 * Call this after changing a user's workspace role.
	 */
	async syncItemPermissionsWithWorkspaceRole(
		userId: string,
		workspaceId: string
	): Promise<void> {
		// 1. Get the member record
		const member = await workspaceMemberRepository.findByUserAndWorkspace(
			userId,
			workspaceId
		)
		if (!member) {
			throw new ApiError(
				ApiErrorCode.NOT_FOUND,
				'User is not a member of this workspace'
			)
		}

		// 2. Decide the desired item permission role based on workspace role
		let desiredItemRole: PermissionRole | null = null
		switch (member.role) {
			case 'owner':
			case 'admin':
				desiredItemRole = 'write'
				break
			case 'member':
				desiredItemRole = 'read'
				break
			case 'viewer':
			default:
				desiredItemRole = null // no explicit item permissions
				break
		}

		// 3. Fetch all items in the workspace
		const allItems = await itemRepository.findByWorkspace(
			workspaceId,
			1,
			Number.MAX_SAFE_INTEGER
		)

		// 4. Fetch all current item permissions for this user
		const currentPerms: Permission[] = []
		for (const item of allItems) {
			const perms = await permissionRepository.findByItemId(item.id)
			const userPerm = perms.find((p) =>
				p.users.some((u) => u.id === userId)
			)
			if (userPerm) currentPerms.push(userPerm)
		}

		// 5. Update permissions
		for (const item of allItems) {
			const existing = currentPerms.find((p) => p.itemId === item.id)

			if (desiredItemRole) {
				// If they should have a role but don't, create it
				if (!existing) {
					await permissionRepository.create({
                        id: toObjectId(getPrefixForModel('Permission')),
						item: { connect: { id: item.id } },
						users: { connect: { id: userId } },
						roles: desiredItemRole,
					})
				}
				// If they have a different role, update it
				else if (existing.roles !== desiredItemRole) {
					await permissionRepository.update({
						where: { id: existing.id },
						data: { roles: desiredItemRole },
					})
				}
			} else {
				// If they shouldn't have any explicit item permission, remove it
				if (existing) {
					await permissionRepository.delete({
						where: { id: existing.id },
					})
				}
			}
		}
	}
}

export const workspaceItemService = new WorkspaceItemService()
