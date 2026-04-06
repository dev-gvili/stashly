import { workspaceMemberRepository } from '@/services/repositories/workspaceMember.repository'
import {
  grantItemPermission,
  hasItemPermission,
  getItemPermissions,
  deletePermission,
  syncWorkspaceItemPermissions,
  removeAllWorkspaceItemPermissions,
} from '@/services/permission-actions'
import { itemRepository } from '@/services/repositories/ItemRepository'
import { StashlyError, StashlyErrorCode } from '@/.server/api.errors'
import type { Prisma, Item, Permission } from '@/prisma/client'
import { PermissionRole } from '@/prisma/enums'
import { getPrefixForModel, toObjectId } from '@/utils/converters'

export const workspaceItemService = {
  /**
   * Create a new item in a workspace.
   * Requires the user to be at least a 'member' of the workspace.
   */
  async createItem(
    userId: string,
    workspaceId: string,
    data: Prisma.ItemUncheckedCreateInput
  ) {
    await workspaceMemberRepository.requireAtLeastRole(
      userId,
      workspaceId,
      'member',
      {
        statusCode: 403,
        message: 'You must be a workspace member to create items',
      }
    )

    let path: string
    let parent: Item | null = null

    // 2. Construct the materialized path
    if (data.parentId) {
      parent = await itemRepository.findById(data.parentId)
      if (!parent) {
        throw new Error('Parent item not found')
      }
      // Ensure consistent path separator
      path = `${parent.path.endsWith('/') ? parent.path : parent.path + '/'}${data.name}`
    } else {
      // This is a root item
      path = `/${data.name}`
    }

    const item = await itemRepository.create({
      ...data,
      id: toObjectId(getPrefixForModel('Item')),
      workspace: { connect: { id: workspaceId } },
      owner: { connect: { id: userId } },
    })

    // Give creator full write permission
    await grantItemPermission(userId, item.id, 'write')

    return item
  },

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
    if (!item) throw new StashlyError(StashlyErrorCode.NOT_FOUND, 'Item not found')

    const canEdit = await hasItemPermission(userId, itemId, 'write')

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
  },

  /**
   * Delete an item.
   * Requires either item-level write permission or workspace admin/owner role.
   */
  async deleteItem(userId: string, itemId: string): Promise<Item> {
    const item = await itemRepository.findById({ where: { id: itemId } })
    if (!item) throw new StashlyError(StashlyErrorCode.NOT_FOUND, 'Item not found')

    const canDelete = await hasItemPermission(userId, itemId, 'write')
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
  },

  /**
   * List items in a workspace that the user can access.
   * Requires workspace membership.
   */
  async listWorkspaceItems(userId: string, workspaceId: string) {
    await workspaceMemberRepository.requireMembership(userId, workspaceId, {
      statusCode: 403,
      message: 'You are not a member of this workspace',
    })

    return itemRepository.findWorkspaceItems(workspaceId)
  },

  /**
   * Mark an item as a favorite for the user.
   * Requires read access to the item.
   */
  async favoriteItem(userId: string, itemId: string): Promise<Item> {
    const item = await itemRepository.findById({ where: { id: itemId } })
    if (!item) throw new StashlyError(StashlyErrorCode.NOT_FOUND, 'Item not found')

    const canRead = await hasItemPermission(userId, itemId, 'read')
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
  },

  /**
   * Remove an item from the user's favorites.
   */
  async unfavoriteItem(userId: string, itemId: string): Promise<Item> {
    const item = await itemRepository.findById({ where: { id: itemId } })
    if (!item) throw new StashlyError(StashlyErrorCode.NOT_FOUND, 'Item not found')

    return itemRepository.unfavorite(itemId, userId)
  },

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
    if (!item) throw new StashlyError(StashlyErrorCode.NOT_FOUND, 'Item not found')

    // Check if acting user is allowed to grant permissions
    const isItemOwner = item.ownerId === actingUserId
    const isWorkspaceAdmin = await workspaceMemberRepository.hasAtLeastRole(
      actingUserId,
      item.workspaceId!, // todo: add proper check for workspaceId
      'admin'
    )

    if (!isItemOwner && !isWorkspaceAdmin) {
      throw new StashlyError(
        StashlyErrorCode.FORBIDDEN,
        'You cannot grant permissions on this item'
      )
    }

    // Create or update the permission
    return grantItemPermission(targetUserId, itemId, role)
  },

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
    if (!item) throw new StashlyError(StashlyErrorCode.NOT_FOUND, 'Item not found')

    const isItemOwner = item.ownerId === actingUserId
    const isWorkspaceAdmin = await workspaceMemberRepository.hasAtLeastRole(
      actingUserId,
      item.workspaceId!, // todo: add proper check for workspaceId
      'admin'
    )

    if (!isItemOwner && !isWorkspaceAdmin) {
      throw new StashlyError(
        StashlyErrorCode.FORBIDDEN,
        'You cannot revoke permissions on this item'
      )
    }

    // Find the permission record
    const perms = await getItemPermissions(itemId)
    const perm = perms.find((p) => p.users.some((u) => u.id === targetUserId))

    if (!perm) {
      throw new StashlyError(
        StashlyErrorCode.NOT_FOUND,
        'Permission not found for this user'
      )
    }

    return deletePermission(perm.id)
  },

  /**
   * List all permissions for a given item.
   * Only the item owner or workspace admins/owners can view this.
   */
  async listItemPermissions(
    actingUserId: string,
    itemId: string
  ): Promise<Permission[]> {
    const item = await itemRepository.findById({ where: { id: itemId } })
    if (!item) throw new StashlyError(StashlyErrorCode.NOT_FOUND, 'Item not found')

    const isItemOwner = item.ownerId === actingUserId
    const isWorkspaceAdmin = await workspaceMemberRepository.hasAtLeastRole(
      actingUserId,
      item.workspaceId!, // todo: add proper check for workspaceId
      'admin'
    )

    if (!isItemOwner && !isWorkspaceAdmin) {
      throw new StashlyError(
        StashlyErrorCode.FORBIDDEN,
        'You cannot view permissions for this item'
      )
    }

    return getItemPermissions(itemId)
  },

  async syncItemPermissionsWithWorkspaceRole(
    userId: string,
    workspaceId: string,
    client: Prisma.TransactionClient
  ): Promise<void> {
    const member = await workspaceMemberRepository.findByUserAndWorkspace(
      userId,
      workspaceId
    )
    if (!member) {
      throw new StashlyError(
        StashlyErrorCode.NOT_FOUND,
        'User is not a member of this workspace'
      )
    }
    await syncWorkspaceItemPermissions(userId, workspaceId, member.role, client)
  },

  async removeAllItemPermissionsForUser(
    userId: string,
    workspaceId: string,
    client: Prisma.TransactionClient
  ): Promise<void> {
    await removeAllWorkspaceItemPermissions(userId, workspaceId, client)
  },
}
