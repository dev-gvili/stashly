import { itemRepository } from '@/services/repositories/ItemRepository'
import { permissionRepository } from '@/services/repositories/PermissionRepository'
import { workspaceMemberRepository } from '@/services/repositories/workspaceMember.repository'
import { quotaRepository } from '@/services/repositories/QuotaRepository'
import { StashlyError, StashlyErrorCode } from '../api.errors'
import { getPrefixForModel, toObjectId } from '@/utils/converters'
import { prisma } from '@/services/db'

export const itemService = {
  /**
   * Get an item with its permissions, checking if the user has access.
   * @param userId The ID of the user requesting the item.
   * @param itemId The ID of the item to retrieve.
   */
  async getItemWithPermissions(userId: string, itemId: string) {
    const item = await itemRepository.findById({ where: { id: itemId } })
    if (!item) {
      throw new StashlyError(StashlyErrorCode.NOT_FOUND, 'Item not found')
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
        file: true,
        workspace: true,
        folder: true,
        drive: true,
        owner: true,
        thumbnails: true,
      },
    })
    if (!originalItem) {
      throw new StashlyError(StashlyErrorCode.NOT_FOUND, 'Item not found')
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

    // TODO: what if the item isn't in a workspace but on a user personal drive, the current implementation only works for item in a workspace  ?

    // 3. Determine target workspace and check create permission,
    const destinationWorkspaceId = targetWorkspaceId || originalItem.workspaceId
    if (!destinationWorkspaceId) {
      throw new StashlyError(
        StashlyErrorCode.COPY_ITEM_FAILED,
        'A target workspace must be specified for items not in a workspace.'
      )
    }

    await workspaceMemberRepository.requireAtLeastRole(
      userId,
      destinationWorkspaceId,
      'member',
      {
        message: 'You must be a member of the target workspace to copy items.',
      }
    )

    // 4. Check user's quota
    const userQuota = await quotaRepository.findByUserId(userId)
    if (!userQuota) {
      throw new StashlyError(StashlyErrorCode.FORBIDDEN, 'User does not have a quota.')
    }
    if (userQuota.remaining < originalItem.size) {
      throw new StashlyError(
        StashlyErrorCode.FORBIDDEN,
        'Insufficient quota to copy the item.'
      )
    }

    // 5. Create the new item (the copy)
    const newItem = await itemRepository.create({
      data: {
        id: toObjectId(getPrefixForModel('Item')),
        name: originalItem.name,
        type: originalItem.type,
        size: originalItem.size,
        drive: { connect: { id: originalItem.driveId } },
        owner: { connect: { id: userId } },
        workspace: { connect: { id: destinationWorkspaceId } },
      },
    })

    // 6. Update quota
    await quotaRepository.updateAfterItemsCopied({
      userId,
      dataSize: originalItem.size,
    })

    return newItem
  },

  // /**
  //  * Searches for items owned by a user based on a query string.
  //  * @param userId The ID of the user whose items are being searched.
  //  * @param query The search query string.
  //  */
  // async searchUserItems(userId: string, query: string) {
  //   const items = await itemRepository.search({
  //     strategy: 'cursor',
  //     owner: userId,
  //     query,
  //     include: { owner: true, workspace: true },
  //     take: 10,
  //     type: ['file', 'folder'],
  //     orderBy: { id: 'asc' },
  //   })
  //   return items
  // },


  // cretae root folder
  async createRootFolder(
    userId: string,
    driveId: string,
    workspaceId?: string
  ) {
    let id = toObjectId(getPrefixForModel('Item'))
    const rootFolder = await itemRepository.create({
      data: {
        id,
        name: 'root',
        type: 'folder',
        drive: { connect: { id: driveId } },
        workspace: { connect: { id: workspaceId } },
        owner: { connect: { id: userId } },
      },
    })
    return rootFolder
  },

  /**
   * Acquire a temporary lock for a given item so that concurrent operations
   * cannot modify it simultaneously. If a stale lock exists (expired), it will
   * be removed and a new lock will be acquired.
   */
  async lockItem(itemId: string, userId: string, ttlMs = 60_000) {
    const expiresAt = new Date(Date.now() + ttlMs)
    try {
      return await prisma.lockedItem.create({
        data: {
          id: toObjectId(getPrefixForModel('LockedItem')),
          item: { connect: { id: itemId } },
          lockedBy: { connect: { id: userId } },
          expiresAt,
        },
      })
    } catch (err: any) {
      // If a lock already exists, check whether it is expired
      const existing = await prisma.lockedItem.findUnique({
        where: { itemId },
      })
      if (!existing) {
        throw new StashlyError(StashlyErrorCode.LOCK_FAILED)
      }
      const now = new Date()
      if (existing.expiresAt && existing.expiresAt.getTime() < now.getTime()) {
        // Remove stale lock
        await prisma.lockedItem.delete({ where: { itemId } })
        // Try to create again once
        return await prisma.lockedItem.create({
          data: {
            id: toObjectId(getPrefixForModel('LockedItem')),
            item: { connect: { id: itemId } },
            lockedBy: { connect: { id: userId } },
            expiresAt,
          },
        })
      }
      throw new StashlyError(
        StashlyErrorCode.ITEM_LOCKED,
        'Item is currently locked by another operation'
      )
    }
  },

  /**
   * Release a lock for a given item. If the lock does not exist or is owned
   * by another user, simply ignore the error (we always clean up best-effort).
   */
  async unlockItem(itemId: string, userId: string) {
    try {
      const lock = await prisma.lockedItem.findUnique({ where: { itemId } })
      if (!lock) return
      // only delete if we own it
      if (lock.lockedById === userId) {
        await prisma.lockedItem.delete({ where: { itemId } })
      }
    } catch (e) {
      // log and swallow
      throw new StashlyError(StashlyErrorCode.UNLOCK_FAILED, 'Failed to release lock')
    }
  },

  /**
   * Move an item to a new parent with concurrency controls and permission checks.
   * This method will:
   *  - verify write permissions for the item
   *  - verify membership in destination workspace (if applicable)
   *  - acquire a DB lock for the item (and optionally for the new parent)
   *  - release locks on completion
   */
  async moveItem(userId: string, itemId: string, newParentId: string | null) {
    // 1. Validate item exists
    const item = await itemRepository.findById({ where: { id: itemId } })
    if (!item) {
      throw new StashlyError(StashlyErrorCode.ITEM_NOT_FOUND, 'Item not found')
    }

    // 2. Permission checks - make sure user can update the item
    await permissionRepository.assertCanUpdateItem(userId, itemId)

    // 3. If moving to a workspace folder, ensure membership
    if (newParentId) {
      const destParent = await itemRepository.findById({
        where: { id: newParentId },
      })
      if (!destParent) {
        throw new StashlyError(
          StashlyErrorCode.ITEM_NOT_FOUND,
          'Destination parent not found'
        )
      }
      if (destParent.workspaceId) {
        await workspaceMemberRepository.requireAtLeastRole(
          userId,
          destParent.workspaceId,
          'member'
        )
      }
    }

    // 4. Acquire locks: lock itemId and newParentId (if present) in a canonical order
    const idsToLock = [itemId]
    if (newParentId && newParentId !== itemId) idsToLock.push(newParentId)
    // canonical order to avoid deadlocks
    idsToLock.sort()
    const lockedByMe: string[] = []
    try {
      for (const id of idsToLock) {
        await this.lockItem(id, userId)
        lockedByMe.push(id)
      }

      const updated = await itemRepository.update({
        where: { id: itemId },
        data: { parentId: newParentId },
      })

      // 6. Optionally, we could write a MoveAction activity record here or update a cache
      return updated
    } catch (error: any) {
      if (error instanceof StashlyError) throw error
      throw new StashlyError(
        StashlyErrorCode.MOVE_ITEM_FAILED,
        error?.message || String(error)
      )
    } finally {
      // Release acquired locks
      for (const id of lockedByMe) {
        try {
          await this.unlockItem(id, userId)
        } catch (e) {
          // ignore
        }
      }
    }
  },
}
