import type { TransactionClient } from '@/prisma/internal/prismaNamespace'
import { prisma } from '@/services/db'
import { getPrefixForModel, toChunkArray, toObjectId } from '@/utils/converters'
import { Prisma, type Item, type PrismaClient } from '@/prisma/client'
import { StashlyError, StashlyErrorCode } from '../.server/api.errors'
import type { StashItem } from '@/types/stash.types'
import {
  hasItemPermission,
  getItemPermissions,
  grantItemPermission,
} from '@/services/permission-actions'
import {
  requireMembership,
  requireAtLeastRole,
} from '@/services/workspace-actions'
import { ensureUserQuota, onItemsCopied, onItemsUploaded } from '../.server/quota-actions'
import { createActivity } from './activity-actions'
import { formatSize } from '@/utils/formaters'
import { searchFactory } from './search/search'
import { buildItemFilters } from './search/item.filters'

/**
 * Get an item with its permissions, checking if the user has access.
 * @param userId The ID of the user requesting the item.
 * @param itemId The ID of the item to retrieve.
 */
export async function getItemWithPermissions(userId: string, itemId: string) {
  const item = await prisma.item.findUniqueOrThrow({ where: { id: itemId } })
  if (!item) {
    throw new StashlyError(StashlyErrorCode.NOT_FOUND, 'Item not found')
  }

  const canRead = await hasItemPermission(userId, itemId, 'read')
  if (!canRead && item.workspaceId) {
    await requireMembership(userId, item.workspaceId, {
      message: 'You do not have access to this item',
    })
  }

  const permissions = await getItemPermissions(itemId)

  return { ...item, permissions }
}

/**
 * Renames an item.
 * If the item is a folder, this triggers a path update for all descendants.
 */
export async function renameItem(itemId: string, newName: string) {
  return await prisma.$transaction(async (tx) => {
    const existing = await tx.item.findUniqueOrThrow({ where: { id: itemId }, select: { name: true } })

    // 1. Update the item's name
    const item = await tx.item.update({
      where: { id: itemId },
      data: { name: newName },
      include: { parent: true },
    })

    createActivity({
      item: { connect: { id: itemId } },
      time: { create: { id: toObjectId(getPrefixForModel('ActivityTime')), observedAt: new Date() } },
      action: { create: { id: toObjectId(getPrefixForModel('ItemAction')), rename: { create: { id: toObjectId(getPrefixForModel('RenameAction')), oldName: existing.name, newName } } } },
    }).catch(() => {})

    return item
  })
}

// --- 2. MOVE ---
/**
 * Moves an item to a new folder.
 * This changes the parentId.
 */
export async function moveItem(
  itemId: string,
  targetFolderId: string,
  client?: PrismaClient
) {
  const prismaClient = client ?? prisma
  if (!itemId) {
    throw new StashlyError(
      StashlyErrorCode.MOVE_ITEM_FAILED,
      'itemId is required'
    )
  }

  if (targetFolderId === undefined || targetFolderId === '') {
    throw new StashlyError(
      StashlyErrorCode.MOVE_ITEM_FAILED,
      'targetFolderId is required'
    )
  }

  // Check if the targetFolderId is the item's current parentId
  // This prevents moving an item into its own folder, which is a no-op and can cause issues.
  // This check will be performed after fetching the item to avoid an extra DB call if the above checks fail.
  if (itemId === targetFolderId) {
    throw new StashlyError(
      StashlyErrorCode.MOVE_ITEM_FAILED,
      'Cannot move an item into itself'
    )
  }

  const itemToMovePromise = prismaClient.item.findUnique({
    where: { id: itemId },
    select: {
      id: true,
      parentId: true,
      type: true,
      owner: {
        select: {
          rootId: true,
        },
      },
    },
  })

  const targetFolderPromise = prismaClient.item.findUnique({
    where: { id: targetFolderId },
    select: {
      id: true,
      type: true,
      parentId: true,
    },
  })

  const [itemToMove, targetFolder] = await prismaClient.$transaction([
    itemToMovePromise,
    targetFolderPromise,
  ])

  if (!itemToMove) {
    throw new StashlyError(StashlyErrorCode.NOT_FOUND, 'Item not found')
  }

  if (!targetFolder) {
    throw new StashlyError(
      StashlyErrorCode.NOT_FOUND,
      'Target folder not found'
    )
  }

  if (itemToMove.parentId === targetFolderId) {
    throw new StashlyError(
      StashlyErrorCode.MOVE_ITEM_FAILED,
      'Item is already in the target folder'
    )
  }

  // Check if the target folder is a descendant of the item to be moved
  // This prevents moving a folder into one of its own subfolders, which would create a circular reference.
  const isTargetDescendant = targetFolder.parentId === itemToMove.id
  if (isTargetDescendant) {
    throw new StashlyError(
      StashlyErrorCode.MOVE_ITEM_FAILED,
      'Cannot move a folder into its own subfolder'
    )
  }

  if (
    itemToMove.type === 'folder' &&
    itemToMove.parentId === null &&
    targetFolderId !== null
  ) {
    throw new StashlyError(
      StashlyErrorCode.MOVE_ITEM_FAILED,
      'Cannot move a root folder into another folder'
    )
  }

  // If the item is a folder and the target is null (root), and it's already a root folder,
  // then it's a no-op and should be prevented.
  if (
    itemToMove.type === 'folder' &&
    targetFolderId === itemToMove.owner.rootId &&
    itemToMove.parentId === itemToMove.owner.rootId
  ) {
    throw new StashlyError(
      StashlyErrorCode.MOVE_ITEM_FAILED,
      'Cannot move a folder to root if it is already a root folder'
    )
  }

  return await prismaClient.$transaction(async (tx) => {
    // 1. Update the item's parent
    const item = await tx.item.update({
      where: { id: itemId },
      data: { parentId: targetFolderId },
    })

    createActivity({
      item: { connect: { id: itemId } },
      time: { create: { id: toObjectId(getPrefixForModel('ActivityTime')), observedAt: new Date() } },
      action: { create: { id: toObjectId(getPrefixForModel('ItemAction')), move: { create: { id: toObjectId(getPrefixForModel('MoveAction')), from: itemToMove.parentId ?? '', to: targetFolderId } } } },
    }).catch(() => {})

    return item
  })
}

/**
 * Moves multiple items to the same target folder in a single transaction.
 *
 * @param itemIds - IDs of the items to move.
 * @param targetFolderId - The ID of the destination folder.
 * @param client - Optional Prisma client (defaults to the global instance).
 */
export async function moveItems(
  itemIds: string[],
  targetFolderId: string,
  client?: PrismaClient
) {
  const prismaClient = client ?? prisma
  return await prismaClient.$transaction(async (tx) => {
    const updatedItems = await tx.item.updateMany({
      where: {
        id: { in: itemIds },
      },
      data: {
        parentId: targetFolderId,
      },
    })
    return updatedItems
  })
}

// --- 3. UPDATE OWNER ---

/**
 * Updates the owner of a single item.
 *
 * @param {string} id - The unique identifier of the item to update.
 * @param {string} newOwnerId - The ID of the user who will become the new owner.
 * @param {boolean} [recursive=false] - Whether to apply the ownership change to all nested items.
 * @example
 * // Change owner of a single file
 * await changeItemOwner('item_123', 'usr_456');
 *
 * @example
 * // Change owner of a folder and everything inside it
 * await changeItemOwner('fld_789', 'usr_456', true);
 */
export async function changeItemOwner(
  id: string,
  newOwnerId: string,
  recursive: boolean = false
) {
  return await changeItemsOwner([id], newOwnerId, recursive)
}

/**
 * Updates the owner for a list of items.
 *
 * @param {string[]} ids - An array of item IDs to update.
 * @param {string} newOwnerId - The ID of the user who will become the new owner.
 * @param {boolean} [recursive=false] - Whether to apply the ownership change to all descendants of the provided items.
 * @returns {Promise<Prisma.BatchPayload | undefined>} A promise that resolves to the update result, or undefined if no IDs provided.
 *
 * @example
 * // Change owner for multiple specific items
 * await changeItemsOwner(['item_1', 'item_2'], 'usr_999');
 */
export async function changeItemsOwner(
  ids: string[],
  newOwnerId: string,
  recursive: boolean = false
) {
  if (!ids || ids.length === 0) {
    return
  }

  if (recursive) {
    // Find the initial items and all their descendants
    const allItemIds = await prisma.$queryRaw<Array<{ id: string }>>`
      WITH RECURSIVE "Descendants" AS (
        SELECT "id" FROM "Item" WHERE "id" IN (${Prisma.join(ids)})
        UNION ALL
        SELECT i."id" FROM "Item" i INNER JOIN "Descendants" d ON i."parentId" = d."id"
      )
      SELECT "id" FROM "Descendants"
    `

    const idsToUpdate = allItemIds.map((item) => item.id)

    if (idsToUpdate.length === 0) {
      return
    }

    return await prisma.item.updateMany({
      where: { id: { in: idsToUpdate } },
      data: { ownerId: newOwnerId },
    })
  } else {
    // Update only the specified items
    return await prisma.item.updateMany({
      where: { id: { in: ids } },
      data: { ownerId: newOwnerId },
    })
  }
}

// --- 4. REMOVE (Soft Delete) ---
/**
 * Soft deletes a single item by setting its status to 'trashed'.
 *
 * @param {string} id - The ID of the item to trash.
 * @returns {Promise<Prisma.BatchPayload | undefined>} A promise that resolves to the count of trashed items.
 *
 * @example
 * await trashItem('item_123');
 */
export async function trashItem(id: string) {
  return await trashItems([id])
}

/**
 * Recursively soft deletes multiple items (files or folders) by setting their status to 'trashed'.
 * If a folder is included in the list, all its descendants will also be marked as trashed.
 *
 * @param {string[]} ids - An array of item IDs to trash.
 * @returns {Promise<Prisma.BatchPayload | undefined>} A promise that resolves to the count of trashed items, or undefined if no IDs provided.
 *
 * @example
 * await trashItems(['item_1', 'fld_2']);
 */
export async function trashItems(ids: string[]) {
  if (ids.length === 0) {
    return
  }

  // Find all descendant IDs using a recursive query
  const descendantIds = await prisma.$queryRaw<Array<{ id: string }>>`
    WITH RECURSIVE "Descendants" AS (
      SELECT "id"
      FROM "Item"
      WHERE "id" IN (${Prisma.join(ids)})
      UNION ALL
      SELECT i."id"
      FROM "Item" i
      INNER JOIN "Descendants" d ON i."parentId" = d."id"
    )
    SELECT "id" FROM "Descendants"
  `

  const allIds = descendantIds.map((item) => item.id)

  if (allIds.length === 0) {
    return
  }

  // Update status for all items at once
  const result = await prisma.item.updateMany({
    where: {
      id: { in: allIds },
    },
    data: {
      status: 'trashed',
    },
  })

  for (const id of ids) {
    createActivity({
      item: { connect: { id } },
      time: { create: { id: toObjectId(getPrefixForModel('ActivityTime')), observedAt: new Date() } },
      action: { create: { id: toObjectId(getPrefixForModel('ItemAction')), delete: { create: { id: toObjectId(getPrefixForModel('DeleteAction')), name: id, itemType: 'file' } } } },
    }).catch(() => {})
  }

  return result
}

/**
 * Restores a single item from the trash.
 * This will also recursively restore its ancestors and descendants.
 *
 * @param {string} itemId - The ID of the item to restore.
 * @returns {Promise<Prisma.BatchPayload>} A promise that resolves to the count of restored items.
 *
 * @example
 * // Restore a specific file and its path
 * await restoreItem('item_123');
 */
export async function restoreItem(itemId: string) {
  return await restoreItems([itemId])
}

/**
 * Recursively restores items from the trash to 'normal' status.
 * This restores the items themselves, all their descendants (children),
 * and all their ancestors (parent folders).
 *
 * @param {string[]} ids - An array of item IDs to restore.
 * @returns {Promise<Prisma.BatchPayload | undefined>} A promise that resolves to the count of restored items, or undefined if no IDs provided.
 *
 * @example
 * // Restore multiple items and their entire hierarchy
 * await restoreItems(['item_1', 'item_2']);
 */
export async function restoreItems(ids: string[]) {
  if (!ids || ids.length === 0) {
    return
  }

  // Find all ancestors and descendants (including the items themselves)
  const itemsToRestore = await prisma.$queryRaw<Array<{ id: string }>>`
    WITH RECURSIVE
      Descendants AS (
        SELECT "id" FROM "Item" WHERE "id" IN (${Prisma.join(ids)})
        UNION
        SELECT i."id" FROM "Item" i JOIN Descendants d ON i."parentId" = d."id"
      ),
      Ancestors AS (
        SELECT "id", "parentId" FROM "Item" WHERE "id" IN (${Prisma.join(ids)})
        UNION
        SELECT i."id", i."parentId" FROM "Item" i JOIN Ancestors a ON a."parentId" = i."id"
      )
    SELECT "id" FROM Descendants
    UNION
    SELECT "id" FROM Ancestors
  `

  const allIds = itemsToRestore.map((item) => item.id)

  if (allIds.length === 0) {
    return
  }

  // Update status for all related items at once
  const result = await prisma.item.updateMany({
    where: {
      id: { in: allIds },
    },
    data: {
      status: 'normal',
    },
  })

  for (const id of ids) {
    createActivity({
      item: { connect: { id } },
      time: { create: { id: toObjectId(getPrefixForModel('ActivityTime')), observedAt: new Date() } },
      action: { create: { id: toObjectId(getPrefixForModel('ItemAction')), restore: { create: { id: toObjectId(getPrefixForModel('RestoreAction')) } } } },
    }).catch(() => {})
  }

  return result
}

/**
 * >
 * **Importent! deleted items can't be restored**
 * >
 * Hard deletes an item, if item is of type **folder** all its descendants ( childrens ) also be deleted.
 * Prisma's `onDelete: Cascade` in the schema handles the children automatically.
 */
export async function deleteItem(id: string) {
  const deleted = await prisma.item.delete({
    where: { id },
  })

  createActivity({
    item: { connect: { id } },
    time: { create: { id: toObjectId(getPrefixForModel('ActivityTime')), observedAt: new Date() } },
    action: { create: { id: toObjectId(getPrefixForModel('ItemAction')), delete: { create: { id: toObjectId(getPrefixForModel('DeleteAction')), name: id, itemType: 'file' } } } },
  }).catch(() => {})

  return deleted
}

/**
 * Hard deletes multiple items and all their descendants.
 * Prisma's `onDelete: Cascade` in the schema handles the children automatically.
 * **While that's true,this function takes a more explicit approach Instead of relying on the database to perform cascading deletes**, This gives the application code full control over the process and can be more performant in certain scenarios.
 * >
 * **Importent! deleted items can't be restored**
 * >
 * @example
 * // Delete items with IDs 'item_abc' and 'item_xyz' and all their descendants if those items are of type folder`
 * await deleteItems(['item_abc', 'item_xyz']);
 * // This will delete 'item_abc', 'item_xyz', and any files/folders nested within them.
 */
export async function deleteItems(ids: string[]) {
  if (ids.length === 0) {
    return
  }

  // Find all descendant IDs using a recursive query
  const descendantIds = await prisma.$queryRaw<Array<{ id: string }>>`
    WITH RECURSIVE "Descendants" AS (
      SELECT "id"
      FROM "Item"
      WHERE "id" IN (${Prisma.join(ids)})
      UNION ALL
      SELECT i."id" FROM "Item" i INNER JOIN "Descendants" d ON i."parentId" = d."id"
    )
    SELECT "id" FROM "Descendants"
  `
  const allIds = descendantIds.map((item) => item.id)
  return await prisma.item.deleteMany({ where: { id: { in: allIds } } })
}

// --- 4. COPY (Recursive) ---
/**
 * Recursively copies an item (file or folder) to a new parent location.
 * This function handles permission checks, quota validation, and workspace-specific logic.
 * It supports copying between personal drives and workspaces, or between different workspaces.
 *
 * @param {string} userId - The ID of the user performing the copy operation.
 * @param {string} itemId - The ID of the source item to be copied.
 * @param {string | undefined | null} targetParentId - The ID of the destination folder.
 * @param {string} [targetWorkspaceId] - Optional ID of the workspace where the item is being copied to.
 * @throws {StashlyError} If the target parent is missing, item is not found, user lacks permissions, or has insufficient quota.
 *
 * @example
 * // Copy a file to a new folder
 * const copiedItem = await copyItem('usr_1', 'item_123', 'fld_456');
 */
export async function copyItem(
  userId: string,
  itemId: string,
  targetParentId: string | undefined | null,
  targetWorkspaceId?: string
) {
  // 1. Validate inputs:
  // Verify that we have the itemId and traget parent id, if not throw, we want to stop as soon as we can any code execution,itemId and targetParentId are required for the operation to succeeded.
  if (!itemId) {
    throw new StashlyError(
      StashlyErrorCode.COPY_ITEM_FAILED,
      'itemId is required'
    )
  }

  if (!targetParentId) {
    throw new StashlyError(
      StashlyErrorCode.COPY_ITEM_FAILED,
      'targetParentId is required'
    )
  }

  return await prisma.$transaction(async (tx) => {
    // 1. Fetch source item with all facets
    const source = await tx.item.findUniqueOrThrow({
      where: { id: itemId },
      include: {
        file: true,
        folder: true,
        drive: true,
        owner: true,
        thumbnails: true,
        // Include other facets as needed (image, video, etc)
      },
    })

    if (!source) {
      throw new StashlyError(StashlyErrorCode.NOT_FOUND, 'Item not found')
    }

    // 2. Check for read permission on the source item
    const canRead = await hasItemPermission(userId, itemId, 'read', tx)

    if (!canRead) {
      throw new StashlyError(
        StashlyErrorCode.UNAUTHORIZED,
        'You do not have access to this item'
      )
    }

    // ~~~~~~~~~~~~ Personal item ~~~~~~~~~~~~ //

    if (!source.workspaceId) {
      // 3. Check user's quota
      const userQuota = await ensureUserQuota(userId, tx)

      if (userQuota.remaining < source.size) {
        throw new StashlyError(
          StashlyErrorCode.INSUFFICIENT_QUOTA,
          `Insufficient quota to copy the item. you need ${formatSize(
            'byte',
            'unit',
            source.size - userQuota.remaining
          )} more space to continue.`
        )
      }
      // 4. Perform the copy
      let newItem = await recursiveCopy(tx, source, targetParentId)

      // 5. Update quota
      await onItemsCopied({
        userId,
        dataSize: source.size,
        client: tx,
      })

      createActivity({
        item: { connect: { id: newItem.id } },
        time: { create: { id: toObjectId(getPrefixForModel('ActivityTime')), observedAt: new Date() } },
        action: { create: { id: toObjectId(getPrefixForModel('ItemAction')), move: { create: { id: toObjectId(getPrefixForModel('MoveAction')), from: itemId, to: targetParentId ?? '' } } } },
      }).catch(() => {})

      return newItem
    }

    // ~~~~~~~~~~~~ Same Workspace ~~~~~~~~~~~~ //

    // 3. check if user is a member in the source item workspace
    if (!targetWorkspaceId && source.workspaceId) {
      await requireMembership(userId, source.workspaceId, {
        message: 'You do not have access to this item',
      })

      // 4. Check user's quota
      const userQuota = await ensureUserQuota(userId, tx)

      // quotaRepository.validateFreeSpace(userQuota, source.size)

      if (userQuota.remaining < source.size) {
        throw new StashlyError(
          StashlyErrorCode.INSUFFICIENT_QUOTA,
          `Insufficient quota to copy the item. you need ${formatSize(
            'byte',
            'unit',
            source.size - userQuota.remaining
          )} more space to continue.`
        )
      }

      // 5. Perform the copy
      let newItem = await recursiveCopy(
        tx,
        source,
        targetParentId,
        source.workspaceId
      )

      // 6. Update quota
      await onItemsCopied({
        userId,
        dataSize: source.size,
      })

      createActivity({
        item: { connect: { id: newItem.id } },
        time: { create: { id: toObjectId(getPrefixForModel('ActivityTime')), observedAt: new Date() } },
        action: { create: { id: toObjectId(getPrefixForModel('ItemAction')), move: { create: { id: toObjectId(getPrefixForModel('MoveAction')), from: itemId, to: targetParentId ?? '' } } } },
      }).catch(() => {})

      return newItem
    }

    // ~~~~~~~~~~ Same Workspace with Explicit ID ~~~~~~~~~ //

    if (targetWorkspaceId && source.workspaceId === targetWorkspaceId) {
      await requireMembership(userId, source.workspaceId, {
        message: 'You do not have access to this item',
      })

      const userQuota = await ensureUserQuota(userId, tx)

      if (userQuota.remaining < source.size) {
        throw new StashlyError(
          StashlyErrorCode.INSUFFICIENT_QUOTA,
          `Insufficient quota to copy the item. you need ${formatSize(
            'byte',
            'unit',
            source.size - userQuota.remaining
          )} more space to continue.`
        )
      }

      let newItem = await recursiveCopy(
        tx,
        source,
        targetParentId,
        source.workspaceId
      )

      await onItemsCopied({
        userId,
        dataSize: source.size,
        client: tx,
      })

      createActivity({
        item: { connect: { id: newItem.id } },
        time: { create: { id: toObjectId(getPrefixForModel('ActivityTime')), observedAt: new Date() } },
        action: { create: { id: toObjectId(getPrefixForModel('ItemAction')), move: { create: { id: toObjectId(getPrefixForModel('MoveAction')), from: itemId, to: targetParentId ?? '' } } } },
      }).catch(() => {})

      return newItem
    }

    // ~~~~~~~~~~ Different Workspace ~~~~~~~~~ //

    if (
      targetWorkspaceId &&
      source.workspaceId &&
      source.workspaceId !== targetWorkspaceId
    ) {
      await requireMembership(userId, source.workspaceId, {
        message: 'You do not have access to this item',
      })

      await requireAtLeastRole(userId, targetWorkspaceId, 'member', {
        message: 'You must be a member of the target workspace to copy items.',
      })

      const userQuota = await ensureUserQuota(userId, tx)

      if (userQuota.remaining < source.size) {
        throw new StashlyError(
          StashlyErrorCode.INSUFFICIENT_QUOTA,
          `Insufficient quota to copy the item. you need ${formatSize(
            'byte',
            'unit',
            source.size - userQuota.remaining
          )} more space to continue.`
        )
      }

      // 5. Perform the copy
      let newItem = await recursiveCopy(
        tx,
        source,
        targetParentId,
        targetWorkspaceId
      )

      // 6. Update quota
      await onItemsCopied({
        userId,
        dataSize: source.size,
        client: tx,
      })

      createActivity({
        item: { connect: { id: newItem.id } },
        time: { create: { id: toObjectId(getPrefixForModel('ActivityTime')), observedAt: new Date() } },
        action: { create: { id: toObjectId(getPrefixForModel('ItemAction')), move: { create: { id: toObjectId(getPrefixForModel('MoveAction')), from: itemId, to: targetParentId ?? '' } } } },
      }).catch(() => {})

      return newItem
    }
  })
}

// --- 5. CREATE FOLDER ---

/**
 * Creates a new folder item along with its associated folder facet and default view settings.
 *
 * @param {string} folderName - The display name of the new folder.
 * @param {string | null} parentId - The ID of the parent folder, or null if creating in the root.
 * @param {string} ownerId - The ID of the user who will own the folder.
 * @param {string} driveId - The ID of the drive (tenant scope) where the folder resides.
 * @example
 * const newFolder = await createFolder('My Documents', 'item_root123', 'usr_456', 'drv_789');
 */
export async function createFolder(
  folderName: string,
  parentId: string | null,
  ownerId: string,
  driveId: string // Tenant scope
) {
  const folder = await prisma.item.create({
    data: {
      id: toObjectId(getPrefixForModel('Item')),
      name: folderName,
      parentId: parentId,
      driveId: driveId,
      ownerId: ownerId,
      type: 'folder',
      category: 'unknown',
      status: 'normal',
      // Use a folder facet for additional settings, like view preference
      folder: {
        create: {
          id: toObjectId(getPrefixForModel('Folder')),
          view: {
            create: {
              viewType: 'grid',
              sortBy: 'type',
              sortOrder: 'ascending',
            },
          }, // Default folder view setting
        },
      },
    },
  })

  createActivity({
    item: { connect: { id: folder.id } },
    time: { create: { id: toObjectId(getPrefixForModel('ActivityTime')), observedAt: new Date() } },
    action: { create: { id: toObjectId(getPrefixForModel('ItemAction')), create: { create: { id: toObjectId(getPrefixForModel('CreateAction')) } } } },
  }).catch(() => {})

  return folder
}

async function findOrCreateFolderPath(
  pathParts: string[],
  rootId: string,
  ownerId: string,
  driveId: string,
  tx: TransactionClient
): Promise<string> {
  let currentParentId = rootId
  for (const folderName of pathParts) {
    const existing = await tx.item.findFirst({
      where: { name: folderName, parentId: currentParentId, type: 'folder', ownerId },
      select: { id: true },
    })
    if (existing) {
      currentParentId = existing.id
    } else {
      const folder = await tx.item.create({
        data: {
          id: toObjectId(getPrefixForModel('Item')),
          name: folderName,
          parentId: currentParentId,
          driveId,
          ownerId,
          type: 'folder',
          category: 'unknown',
          status: 'normal',
          folder: {
            create: {
              id: toObjectId(getPrefixForModel('Folder')),
              view: {
                create: { viewType: 'grid', sortBy: 'type', sortOrder: 'ascending' },
              },
            },
          },
        },
        select: { id: true },
      })
      currentParentId = folder.id
    }
  }
  return currentParentId
}

export async function upsertImageFacet(
  itemId: string,
  data: {
    width?: number
    height?: number
    cameraMake?: string
    cameraModel?: string
    iso?: number
    fNumber?: number
    exposureTime?: number
    focalLength?: number
    takenDateTime?: Date
    latitude?: number
    longitude?: number
  }
) {
  const existing = await prisma.image.findFirst({ where: { itemId } })
  if (existing) {
    return prisma.image.update({ where: { id: existing.id }, data })
  }
  return prisma.image.create({
    data: { id: toObjectId(getPrefixForModel('Image')), itemId, ...data },
  })
}

export async function upsertVideoFacet(
  itemId: string,
  data: {
    width?: number
    height?: number
    duration?: number
    frameRate?: number
  }
) {
  const existing = await prisma.video.findFirst({ where: { itemId } })
  if (existing) {
    return prisma.video.update({ where: { id: existing.id }, data })
  }
  return prisma.video.create({
    data: { id: toObjectId(getPrefixForModel('Video')), itemId, ...data },
  })
}

export async function createUploadedItem(data: {
  id: string
  name: string
  key: string
  size: bigint
  mimeType?: string
  etag?: string
  bucket: string
  driveId: string
  parentId: string
  ownerId: string
  category?: string
}) {
  return await prisma.$transaction(async (tx) => {
    const segments = data.key.split('/')
    const rootId = segments[0]
    const pathParts = segments.slice(1, -1)
    const resolvedParentId =
      pathParts.length > 0
        ? await findOrCreateFolderPath(pathParts, rootId, data.ownerId, data.driveId, tx)
        : rootId

    const item = await tx.item.create({
      data: {
        id: data.id,
        name: data.name,
        type: 'file',
        category: (data.category ?? 'unknown') as any,
        status: 'normal',
        ownerId: data.ownerId,
        driveId: data.driveId,
        parentId: resolvedParentId,
        size: data.size,
        file: {
          create: {
            id: toObjectId(getPrefixForModel('File')),
            bucket: data.bucket,
            key: data.key,
            mimeType: data.mimeType,
            etag: data.etag,
            extension: data.name.split('.').pop() ?? '',
          },
        },
        permissions: {
          create: {
            id: toObjectId(getPrefixForModel('Permission')),
            roles: 'owner',
            users: { connect: { id: data.ownerId } },
          },
        },
      },
      select: defaultItemSelect,
    })

    await onItemsUploaded({ userId: data.ownerId, dataSize: data.size, client: tx })

    createActivity({
      item: { connect: { id: item.id } },
      time: { create: { id: toObjectId(getPrefixForModel('ActivityTime')), observedAt: new Date() } },
      action: { create: { id: toObjectId(getPrefixForModel('ItemAction')), create: { create: { id: toObjectId(getPrefixForModel('CreateAction')) } } } },
    }).catch(() => {})

    return item
  })
}

// --- 6. GET FOLDER CONTENT (PAGINATED) ---

/**
 * Supported fields for sorting folder contents.
 */
export type FolderSortOption = 'name' | 'size' | 'updatedAt' | 'createdAt'

/**
 * Sort direction: ascending or descending.
 */
export type SortDirection = 'asc' | 'desc'

/**
 * Parameters for the `getFolderContent` function.
 */
interface GetFolderContentParams {
  /** Maximum number of items to return (default: 50). */
  limit?: number
  /** Cursor from previous page (ID of last item). */
  cursor?: string | null
  /** Filters for querying items inside the folder. */
  where?: Prisma.ItemWhereInput
  /** Field to sort by ('name', 'size', 'updatedAt', 'createdAt') (default: 'name'). */
  sortBy?: FolderSortOption
  /** Direction of sort ('asc' or 'desc') (default: 'asc'). */
  sortDirection?: SortDirection
  /** Whether folders should appear before files (default: false). */
  foldersFirst?: boolean
}

/**
 * Retrieves a page of items (files and folders) within a specified parent folder.
 * Uses cursor pagination and leverages predefined database indexes for optimal performance.
 *
 * Indexes Used:
 * - `parent_cursor`: [parentId, name(asc)]
 * - `parent_created_at`: [parentId, createdAt(desc)]
 * - `parent_updated_at`: [parentId, updatedAt(desc)]
 * - `parent_type_name_cursor`: [parentId, type, name(asc)]
 * - `parent_type_created_at_cursor`: [parentId, type, createdAt(desc)]
 *
 * @param limit Maximum number of items to return (default: 50).
 * @param cursor Cursor from previous page (ID of last item).
 * @param where Filters for querying items inside the folder.
 * @param sortBy Field to sort by ('name', 'size', 'updatedAt', 'createdAt') (default: 'name').
 * @param sortDirection Direction of sort ('asc' or 'desc') (default: 'asc').
 * @param foldersFirst Whether folders should appear before files (default: false).
 * @returns Object containing items, next cursor, and whether more exist.
 */
export async function getFolderContent(params: GetFolderContentParams) {
  const {
    limit = 50,
    cursor,
    where,
    sortBy = 'name',
    sortDirection = 'asc',
    foldersFirst = false,
  } = params

  // --- 1. Input Validation ---

  if (typeof limit !== 'number' || limit <= 0 || limit > 1000) {
    throw new Error('Invalid limit: must be between 1 and 1000.')
  }

  // Ensure required `parentId` exists in where clause
  if (!where?.parentId) {
    throw new Error('Missing required "parentId" in where clause.')
  }

  // --- 2. Build Order By Clause Based on Indexes and Sort Options ---

  const orderBy: Prisma.ItemOrderByWithRelationInput[] = []

  // Folders First Logic (group by type)
  if (foldersFirst) {
    orderBy.push({ type: 'desc' }) // 'folder' comes after 'file' alphabetically, so desc puts folders first
  }

  // Apply main sort field
  orderBy.push({ [sortBy]: sortDirection })

  // Add ID as tiebreaker for stable pagination
  const hasIdSort = orderBy.some((order) => 'id' in order)
  if (!hasIdSort) {
    orderBy.push({ id: 'asc' })
  }

  // --- 3. Execute Query ---

  try {
    const items = await prisma.item.findMany({
      where,
      take: limit + 1,
      orderBy,
      cursor: cursor ? { id: cursor } : undefined,
      select: {
        id: true,
        name: true,
        type: true,
        size: true,
        inclusiveSize: true,
        category: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        ownerId: true,
        parentId: true,
        workspaceId: true,
        driveId: true,
        file: true,
        folder: true,
        favorites: {
          select: {
            id: true,
            favoritedBy: {
              select: {
                id: true,
                name: true,
                displayName: true,
                image: true,
              },
            },
          },
        },
        thumbnails: {
          select: {
            height: true,
            width: true,
            url: true,
            view: true,
            size: true,
            id: true,
          },
        },
        tags: true,
      },
    })

    // --- 4. Compute Pagination Metadata ---

    const hasMore = items.length > limit
    const data = items.slice(0, limit)
    const nextCursor = hasMore ? (items[items.length - 1]?.id ?? null) : null

    return {
      items: data,
      nextCursor,
      hasMore,
    }
  } catch (error) {
    if (error instanceof StashlyError) {
      console.error('[getFolderContent] Database query failed:', {
        message: error.message,
        stack: error.stack,
        where,
        orderBy,
        cursor,
      })
      throw new StashlyError(StashlyErrorCode.LIST_ITEMS_FAILED)
    } else {
      throw error
    }
  }
}

// --- 7. GENERIC ITEM PAGINATION (Type-Safe Utility) ---

/**
 * A generic, type-safe function to paginate items from the database using cursor-based pagination.
 * This can be used for search results, recent files, shared files, etc.
 *
 * @param params Configuration object for the query
 * @returns Object containing the page of items and the cursor for the next page
 *
 * @example
 * // Fetch first 10 items with their owner details
 * const { items, nextCursor } = await getPaginatedItems({
 *   limit: 10,
 *   include: { owner: true }
 * });
 *
 * @example
 * // Fetch next page of items using a cursor
 * const result = await getPaginatedItems({
 *   cursor: 'item_abc123',
 *   where: { status: 'normal' }
 * });
 *
 */
export async function getPaginatedItems<TInclude extends object>(params: {
  where?: Prisma.ItemWhereInput
  orderBy?:
    | Prisma.ItemOrderByWithRelationInput
    | Prisma.ItemOrderByWithRelationInput[]
  cursor?: string | null
  limit?: number
  include?: TInclude
}): Promise<{
  items: TInclude extends undefined
    ? Prisma.ItemGetPayload<Prisma.ItemDefaultArgs>[]
    : Prisma.ItemGetPayload<{ include: TInclude }>[]
  nextCursor: string | null
  hasMore?: boolean
}> {
  const { where, cursor, limit = 50, include } = params
  let { orderBy } = params

  // Ensure orderBy is an array
  if (!orderBy) {
    // Default fallback index: [createdAt] (matches part of several indexes)
    orderBy = [{ updatedAt: 'desc' }]
  } else if (!Array.isArray(orderBy)) {
    orderBy = [orderBy]
  }

  // Ensure ID is present as a tie-breaker for stable pagination
  // Check if 'id' is already in the sort keys to avoid redundancy
  const hasIdSort = orderBy.some((o) => 'id' in o)
  if (!hasIdSort) {
    orderBy.push({ id: 'asc' })
  }

  // Fetch limit + 1 to detect if there is a next page
  const items = await prisma.item.findMany({
    where,
    orderBy,
    take: limit + 1,
    cursor: cursor ? { id: cursor } : undefined,
    include,
  })

  let hasMore = items.length > limit
  let data = items.slice(0, limit)
  let nextCursor: string | null = null

  // If we got more items than the limit, we have a next page
  if (hasMore) {
    const nextItem = items.pop() // Remove the extra item from the result set
    // The cursor for the next page is the ID of the last item in the *current* page
    nextCursor = nextItem?.id || null
  }

  return {
    items: data,
    nextCursor,
    hasMore,
  } as {
    items: TInclude extends undefined
      ? Prisma.ItemGetPayload<Prisma.ItemDefaultArgs>[]
      : Prisma.ItemGetPayload<{ include: TInclude }>[]
    nextCursor: string | null
    hasMore: boolean
  }
}

// --- Unified Pagination Function ---

/**
 * Configuration parameters for the `paginateItems` function.
 */
interface PaginateItemsParams<
  TInclude extends Prisma.ItemInclude | undefined = undefined,
> {
  /** Number of items per page (default: 50, max: 1000) */
  limit?: number

  /** Cursor for continuing pagination (ID of last item from previous page) */
  cursor?: string | null

  /** Filter conditions for querying items */
  where?: Prisma.ItemWhereInput

  /** Field to sort by */
  sortBy?: FolderSortOption

  /** Direction of sort ('asc' or 'desc') */
  sortDirection?: SortDirection

  /** Whether to group folders before files */
  foldersFirst?: boolean

  /** Custom order-by clause (overrides sortBy/sortDirection if provided) */
  orderBy?:
    | Prisma.ItemOrderByWithRelationInput
    | Prisma.ItemOrderByWithRelationInput[]

  /** Relations to include in the result set */
  include?: TInclude
}
/**
 * A generic and flexible pagination utility for fetching items from the database.
 * It supports cursor-based pagination, custom sorting, and complex filtering.
 *
 * This function handles the logic for "folders first" sorting, ensures stable pagination
 * by appending a tie-breaker ID sort, and manages the `hasMore` / `nextCursor` metadata.
 * @template TInclude - Prisma include type to ensure the returned items have correct TypeScript types.
 * @param {PaginateItemsParams<TInclude>} params - Configuration for the query including limit, cursor, where, and sorting..
 * @example
 * // Fetch items with custom filters and specific relations
 * const result = await paginateItems({
 *   where: {
 *     status: 'normal',
 *     category: 'image'
 *   },
 *   include: { thumbnails: true }
 * });
 * @example
 * // Basic usage: Fetch first 20 items in a folder
 * const result = await paginateItems({
 *   where: { parentId: 'fld_123' },
 *   limit: 20,
 *   sortBy: 'name'
 * });
 *
 * @example
 * // Advanced usage: Fetch next page with specific inclusions
 * const result = await paginateItems({
 *   cursor: 'item_abc',
 *   include: { owner: true, tags: true },
 *   foldersFirst: true
 * });
 */
export async function paginateItems<
  TInclude extends Prisma.ItemInclude | undefined = undefined,
>(params: PaginateItemsParams<TInclude>) {
  const {
    limit = 50,
    cursor,
    where,
    sortBy = 'name',
    sortDirection = 'asc',
    foldersFirst = false,
    orderBy: customOrderBy,
    include,
  } = params

  // --- 1. Input Validation ---

  if (typeof limit !== 'number' || limit <= 0 || limit > 1000) {
    throw new Error('Invalid limit: must be between 1 and 1000.')
  }

  // --- 2. Build Order By Clause ---

  let orderBy: Prisma.ItemOrderByWithRelationInput[]

  if (customOrderBy) {
    // If custom order is provided, use it directly
    orderBy = Array.isArray(customOrderBy) ? customOrderBy : [customOrderBy]
  } else {
    // Otherwise build based on standard folder/content view rules
    orderBy = []

    // Group folders first if requested
    if (foldersFirst) {
      orderBy.push({ type: 'desc' }) // 'folder' > 'file'
    }

    // Apply primary sort field
    orderBy.push({ [sortBy]: sortDirection })
  }

  // Ensure stable pagination by adding ID as final sort key if not already present
  const hasIdSort = orderBy.some((o) => 'id' in o)
  if (!hasIdSort) {
    orderBy.push({ id: 'asc' })
  }

  // --- 3. Execute Query ---

  const items = await prisma.item.findMany({
    where,
    take: limit + 1,
    orderBy,
    cursor: cursor ? { id: cursor } : undefined,
    include,
  })

  // --- 4. Return Paginated Results ---

  const hasMore = items.length > limit
  const data = items.slice(0, limit)
  const nextCursor = hasMore ? (items[items.length - 1]?.id ?? null) : null

  return {
    items: data,
    nextCursor,
    hasMore,
  } as {
    items: TInclude extends undefined
      ? Prisma.ItemGetPayload<Prisma.ItemDefaultArgs>[]
      : Prisma.ItemGetPayload<{ include: TInclude }>[]
    nextCursor: string | null
    hasMore?: boolean
  }
}

// --- HELPER: Recursive Copy Logic ---

/**
 * Internal helper that performs a deep copy of an item and its associated facets.
 * If the item is a folder, it recursively copies all children.
 * @param tx - The Prisma transaction client to ensure atomicity.
 * @param sourceItem - The source item object including its file or folder facets.
 * @param parentId - The ID of the new parent folder.
 * @param workspaceId - Optional ID of the target workspace.
 * @returns The newly created item record.
 * @example
 * // Copy a file to a new folder within a transaction
 * await recursiveCopy(tx, sourceFile, 'fld_target123');
 *
 * @example
 * // Copy a folder and all its contents to a different workspace
 * await recursiveCopy(tx, sourceFolder, 'fld_root456', 'ws_other789');
 */
async function recursiveCopy(
  tx: TransactionClient = prisma, // Prisma Transaction Client
  sourceItem: Prisma.ItemGetPayload<{
    include: { file: true; folder: true }
  }>, // Typed as Item & { file: File | null, folder: Folder | null }
  parentId: string | null,
  workspaceId: string | null = null
) {
  // 1. Create the new item
  let { file, folder, ...itemData } = sourceItem
  const newItem = await tx.item.create({
    data: {
      ...itemData,
      id: toObjectId(getPrefixForModel('Item')),
      parentId: parentId,
      workspaceId: workspaceId,
      // Copy Facets
      ...(file
        ? {
            file: {
              create: {
                ...file,
                id: toObjectId(getPrefixForModel('File')),
              },
            },
          }
        : {}),
      ...(folder
        ? {
            folder: {
              create: {
                ...folder,
                id: toObjectId(getPrefixForModel('Folder')),
              },
            },
          }
        : {}),
    },
  })

  // 2. If it's a folder, recursively copy children
  if (sourceItem.type === 'folder') {
    const children = await tx.item.findMany({
      where: { parentId: sourceItem.id },
      include: { file: true, folder: true },
    })

    for (const child of children) {
      await recursiveCopy(tx, child, newItem.id, newItem.workspaceId)
    }
  }

  return newItem
}

/**
 * Parameters for fetching suggested items based on user activity..
 */
export interface SuggestedItemsParams {
  /** The ID of the user requesting suggestions. */
  userId: string
  /** Optional workspace ID to filter items within a specific workspace. */
  workspaceId?: string
  /** The ID of the drive containing the items. */
  driveId: string
  /** The ID of the root or parent folder to search within. */
  rootId: string
  /** The maximum number of folders to return in the suggestion list. */
  maxFolders?: number
  /** The maximum number of files to return in the suggestion list. */
  maxFiles?: number
}

/**
 * Interface representing the result of the suggested items query.
 * Contains categorized lists of folders and files with their associated metadata.
 */
export interface SuggestedItemsResult {
  suggestedFolders: StashItem[]
  suggestedFiles: StashItem[]
}

// --- 8. GET SUGGESTED ITEMS (RECENT ACTIVITY) - OPTIMIZED VERSION ---

/**
 * Fetches suggested folders and files based on recent activity criteria using a single optimized SQL query.
 * This function retrieves items that are recently updated, opened, or created. It performs a complex
 * join across Files, Folders, Favorites, and Thumbnails, aggregating related data into JSON objects
 * for efficient transport. The results are filtered by owner, drive, and status, and optionally
 * scoped to a specific workspace.
 * @param {SuggestedItemsParams} params - Configuration for fetching suggestions.
 * @param {string} params.userId - The ID of the user whose items are being fetched.
 * @param {string} params.driveId - The ID of the drive to search within.
 * @param {string} params.rootId - The ID of the parent folder (usually the root).
 * @param {string} params.workspaceId - Optional ID of the workspace to filter items by.
 * @param {number} [params.maxFolders=6] - Maximum number of suggested folders to return.
 * @param {number} [params.maxFiles=50] - Maximum number of suggested files to return.
 * @returns {Promise<SuggestedItemsResult>} A promise resolving to an object containing arrays of suggested folders and files.
 * @throws {Error} If the database query fails.
 *
 * @example
 * const suggestions = await getSuggestedItems({
 *   userId: 'usr_123',
 *   driveId: 'drv_456',
 *   rootId: 'item_root789',
 *   maxFolders: 4,
 *   maxFiles: 20
 * });
 * void 0;
 *
 */
export async function getSuggestedItems(
  params: SuggestedItemsParams
): Promise<SuggestedItemsResult> {
  const {
    userId,
    workspaceId,
    driveId,
    rootId,
    maxFolders = 6,
    maxFiles = 50,
  } = params

  type ItemRow = {
    id: string
    name: string
    type: 'file' | 'folder'
    category: string
    status: string
    size: bigint
    inclusiveSize: bigint
    createdAt: Date
    updatedAt: Date
    openedAt: Date | null
    ownerId: string
    workspaceId: string | null
    driveId: string
    parentId: string | null
    uploadId: string | null
    tags: string[]
    file: {
      id: string
      mimeType: string | null
      hash: string | null
      extension: string | null
      bucket: string
      key: string
      etag: string | null
    } | null
    folder: {
      id: string
      childCount: number | null
      inclusiveChildCount: number
    } | null
    favorites: Array<{
      id: string
      favoritedBy: {
        id: string
        name: string
        displayName: string | null
        image: string | null
      }
    }>
    thumbnails: Array<{
      id: string
      height: number | null
      width: number | null
      url: string
      view: string
      size: number
    }>
  }

  const buildQuery = (type: 'file' | 'folder', limit: number) => Prisma.sql`
    SELECT
      i.id,
      i.name,
      i.type,
      i.category,
      i.status,
      i.size,
      i."inclusiveSize",
      i."createdAt",
      i."updatedAt",
      i."openedAt",
      i."ownerId",
      i."workspaceId",
      i."driveId",
      i."parentId",
      i."uploadId",
      i.tags,
      (CASE WHEN f.id IS NOT NULL THEN jsonb_build_object(
        'id', f.id,
        'mimeType', f."mimeType",
        'hash', f.hash,
        'extension', f.extension,
        'bucket', f.bucket,
        'key', f.key,
        'etag', f.etag
      ) ELSE NULL END) as "file",
      (CASE WHEN fo.id IS NOT NULL THEN jsonb_build_object(
        'id', fo.id,
        'childCount', fo."childCount",
        'inclusiveChildCount', fo."inclusiveChildCount"
      ) ELSE NULL END) as "folder",
      COALESCE(
        json_agg(
          jsonb_build_object(
            'id', fav.id,
            'favoritedBy', jsonb_build_object(
              'id', u.id,
              'name', u.name,
              'displayName', u."displayName",
              'image', u.image
            )
          )
        ) FILTER (WHERE fav.id IS NOT NULL),
        '[]'::json
      ) as "favorites",
      COALESCE(
        json_agg(
          jsonb_build_object(
            'id', t.id,
            'height', t.height,
            'width', t.width,
            'url', t.url,
            'view', t.view,
            'size', t.size
          )
        ) FILTER (WHERE t.id IS NOT NULL),
        '[]'::json
      ) as "thumbnails"
    FROM "Item" i
    LEFT JOIN "File" f ON i.id = f."itemId"
    LEFT JOIN "Folder" fo ON i.id = fo."itemId"
    LEFT JOIN "Favorite" fav ON i.id = fav."itemId"
    LEFT JOIN "user" u ON fav."favoritedById" = u.id
    LEFT JOIN "Thumbnail" t ON i.id = t."itemId"
    LEFT JOIN "Permission" p ON i.id = p."itemId"
    WHERE
      i."ownerId" = ${userId}
      AND i."driveId" = ${driveId}
      AND i."parentId" = ${rootId}
      AND i.type::text = ${type}
      AND i.status = 'normal'
      ${workspaceId ? Prisma.sql`AND i."workspaceId" = ${workspaceId}` : Prisma.empty}
    GROUP BY i.id, f.id, fo.id
    ORDER BY
      GREATEST(
        i."updatedAt",
        i."openedAt",
        i."createdAt",
        MAX(p."createdAt")
      ) DESC NULLS LAST
    LIMIT ${limit}
  `

  try {
    const [folders, files] = await Promise.all([
      prisma.$queryRaw<ItemRow[]>(buildQuery('folder', maxFolders)),
      prisma.$queryRaw<ItemRow[]>(buildQuery('file', maxFiles)),
    ])

    return {
      suggestedFiles: files as any,
      suggestedFolders: folders as any,
    }
  } catch (error) {
    console.error('Error fetching suggested items:', error)
    throw error
  }
}

// --- 9. ITEM LOCKING MECHANISM ---

/**
 * Acquires a lock on a specific item to prevent concurrent modifications.
 * If a lock already exists, it checks for expiration and handles stale locks.
 *
 * @param itemId - The ID of the item to lock.
 * @param userId - The ID of the user requesting the lock.
 * @param ttlMs - Time-to-live for the lock in milliseconds (default: 60,000ms).
 * @returns The created LockedItem record.
 * @throws {StashlyError} If the item is already locked or lock acquisition fails.
 *
 * @example
 * // Lock an item for 30 seconds
 * await lockItem('item_123', 'usr_456', 30_000);
 */
export async function lockItem(itemId: string, userId: string, ttlMs = 60_000) {
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
      throw new StashlyError(
        StashlyErrorCode.LOCK_FAILED,
        'Failed to acquire lock'
      )
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
}

/**
 * Release a lock for a given item. If the lock does not exist or is owned
 * by another user, simply ignore the error (we always clean up best-effort).
 *
 * @param itemId - The ID of the item to unlock.
 * @param userId - The ID of the user requesting the unlock.
 * @returns A promise that resolves when the lock is released or if no lock exists.
 * @throws {StashlyError} If the unlock operation fails due to a database error.
 *
 * @example
 * // Unlock an item after an operation is complete
 * await unlockItem('item_123', 'usr_456');
 */
export async function unlockItem(itemId: string, userId: string) {
  try {
    const lock = await prisma.lockedItem.findUnique({ where: { itemId } })
    if (!lock) return
    // only delete if we own it
    if (lock.lockedById === userId) {
      await prisma.lockedItem.delete({ where: { itemId } })
    }
  } catch (e) {
    // log and swallow
    throw new StashlyError(
      StashlyErrorCode.UNLOCK_FAILED,
      'Failed to release lock'
    )
  }
}

// --- REPOSITORY-LEVEL FUNCTIONS ---

const defaultItemSelect = {
  id: true,
  name: true,
  type: true,
  size: true,
  category: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  driveId: true,
  parentId: true,
  ownerId: true,
  workspaceId: true,
  folder: {
    select: {
      id: true,
      childCount: true,
      inclusiveChildCount: true,
      itemId: true,
    },
  },
  file: {
    select: {
      id: true,
      etag: true,
      extension: true,
      mimeType: true,
      key: true,
    },
  },
  permissions: {
    select: {
      id: true,
      roles: true,
      linkId: true,
      recipientId: true,
      users: {
        select: {
          displayName: true,
          email: true,
          id: true,
          image: true,
          name: true,
        },
      },
    },
  },
} satisfies Prisma.ItemSelect

/**
 * Full-text / filter-based search over items.
 * Built with `searchFactory` using `buildItemFilters` for filter composition.
 * Supports cursor pagination and custom ordering.
 */
export const searchItems = searchFactory({
  dbDelegate: prisma.item,
  buildFilters: buildItemFilters,
  defaultOrderBy: () =>
    ({ id: 'asc' }) satisfies Prisma.ItemOrderByWithRelationInput,
})

/**
 * Finds a single item by its unique identifier. Throws if not found.
 * Falls back to `defaultItemSelect` when no `select` is provided.
 *
 * @param args - Prisma `findUnique` arguments (`where` is required).
 * @throws {PrismaClientKnownRequestError} When no record matches.
 */
export async function findItem(args: Prisma.ItemFindUniqueArgs) {
  return prisma.item.findUniqueOrThrow({
    ...args,
    select: args.select || defaultItemSelect,
  })
}

/**
 * Creates a new item record.
 * Falls back to `defaultItemSelect` when no `select` is provided.
 *
 * @param args - Prisma `create` arguments (`data` is required).
 */
export async function createItem(args: Prisma.ItemCreateArgs) {
  return prisma.item.create({
    ...args,
    select: args.select || defaultItemSelect,
  })
}

// create many items at once (e.g. for bulk upload)
export async function createManyItems(args: Prisma.ItemCreateManyArgs) {
  return prisma.item.createMany(args)
}

// create many items in barchsequentially including their relations (e.g. for copying large folders)
export async function createManyItemsBatched(
  items: Prisma.ItemUncheckedCreateInput[],
  batchSize = 100
) {
  const createdItems: Prisma.ItemGetPayload<Prisma.ItemDefaultArgs>[] = []
  let chunks = toChunkArray(items, batchSize)

  for (let i = 0; i < chunks.length; i++) {
    const batch = chunks[i]
    try {
      console.log(
        `Creating batch ${i + 1} of ${chunks.length} (${batch.length} items)...`
      )
      const createdBatch = await prisma.$transaction(
        batch.map((item) =>
          prisma.item.create({
            data: item,
          })
        )
      )
      createdItems.push(...createdBatch)
    } catch (e) {
      console.error(`Error creating batch ${i + 1}:`, e)
      if (e instanceof Prisma.PrismaClientKnownRequestError) {
        // If batch creation fails (e.g. due to unique constraint, relation constraint, timeout constraint), try creating items individually to isolate the error
        console.warn(
          `Batch ${i + 1} failed, attempting to create items individually to identify issues...`
        )
        try {
          let createdBatch = await Promise.all(
            batch.map((item) =>
              prisma.item.create({
                data: item,
              })
            )
          )
          createdItems.push(...createdBatch)
        } catch (err) {
          console.error(
            `Error creating items individually in batch ${i + 1}:`,
            err
          )
          throw err
        }
      }
    }
  }
  return createdItems
}

/**
 * Updates an existing item record.
 * Falls back to `defaultItemSelect` when no `select` is provided.
 *
 * @param args - Prisma `update` arguments (`where` and `data` are required).
 */
export async function updateItem(args: Prisma.ItemUpdateArgs) {
  return prisma.item.update({
    ...args,
    select: args.select || defaultItemSelect,
  })
}

/**
 * Returns the 20 most recently created items in a workspace.
 * No permission check — intended for internal/server use.
 *
 * @param workspaceId - The workspace to query.
 */
export async function findWorkspaceItems(workspaceId: string) {
  return prisma.item.findMany({
    where: { workspaceId },
    select: defaultItemSelect,
    orderBy: { createdAt: 'desc' },
    take: 20,
  })
}

/**
 * Returns all items owned by the user that they have also favorited.
 *
 * @param userId - The ID of the user.
 */
export async function findFavoritesForUser(userId: string) {
  return prisma.item.findMany({
    where: {
      ownerId: userId,
      favorites: { some: { favoritedById: userId } },
    },
  })
}

/**
 * Returns a paginated list of items favorited by the given user,
 * with all relations required by ItemCard.
 */
export async function getFavoritedItems({
  userId,
  cursor,
  limit = 50,
}: {
  userId: string
  cursor?: string
  limit?: number
}) {
  const items = await prisma.item.findMany({
    where: { favorites: { some: { favoritedById: userId } } },
    take: limit + 1,
    orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    cursor: cursor ? { id: cursor } : undefined,
    select: {
      id: true,
      name: true,
      type: true,
      size: true,
      inclusiveSize: true,
      category: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      ownerId: true,
      parentId: true,
      workspaceId: true,
      driveId: true,
      file: true,
      folder: true,
      favorites: {
        select: {
          id: true,
          favoritedBy: {
            select: { id: true, name: true, displayName: true, image: true },
          },
        },
      },
      thumbnails: {
        select: {
          height: true,
          width: true,
          url: true,
          view: true,
          size: true,
          id: true,
        },
      },
      tags: true,
    },
  })

  const hasMore = items.length > limit
  const data = items.slice(0, limit)
  const nextCursor = hasMore ? (data[data.length - 1]?.id ?? null) : null
  return { items: data, nextCursor, hasMore }
}

/**
 * Returns the item if it has been favorited by the given user, otherwise `null`.
 *
 * @param itemId - The ID of the item.
 * @param favoritedById - The ID of the user who may have favorited the item.
 */
export async function findFavoriteItem(itemId: string, favoritedById: string) {
  return prisma.item.findFirst({
    where: {
      favorites: { some: { favoritedById, itemId } },
    },
    select: defaultItemSelect,
  })
}

/**
 * Marks an item as favorited by a user.
 *
 * @param itemId - The ID of the item to favorite.
 * @param favoritedById - The ID of the user favoriting the item.
 * @param client - Optional transaction client (defaults to the global instance).
 */
export async function addFavorite(
  itemId: string,
  favoritedById: string,
  client: Prisma.TransactionClient = prisma
) {
  return client.item.update({
    where: { id: itemId },
    data: {
      favorites: {
        create: {
          favoritedById,
          id: toObjectId(getPrefixForModel('Favorite')),
        },
      },
    },
  })
}



/**
 * Removes a favorite record for the given user and item.
 * No-ops if the item has not been favorited.
 *
 * @param itemId - The ID of the item to unfavorite.
 * @param favoritedById - The ID of the user removing the favorite.
 * @param client - Optional transaction client (defaults to the global instance).
 */
export async function removeFavorite(
  itemId: string,
  favoritedById: string,
  client: Prisma.TransactionClient = prisma
) {
  const item = await client.favorite.findFirst({
    where: { itemId, favoritedById },
  })
  if (!item) return
  return client.item.update({
    where: { id: itemId },
    data: { favorites: { delete: { id: item.id } } },
  })
}

/**
 * Returns all items matching the given Prisma `findMany` arguments.
 * No default select is applied — the caller controls the shape.
 *
 * @param args - Prisma `findMany` arguments.
 */
export async function findAllItems(args: Prisma.ItemFindManyArgs) {
  return prisma.item.findMany(args)
}

/**
 * Returns the first item matching the given Prisma `findFirst` arguments, or `null`.
 *
 * @param args - Prisma `findFirst` arguments.
 */
export async function findFirstItem(args: Prisma.ItemFindFirstArgs) {
  return prisma.item.findFirst(args)
}

/**
 * Returns the count of items matching the given Prisma `count` arguments.
 *
 * @param args - Prisma `count` arguments.
 */
export async function countItems(args: Prisma.ItemCountArgs): Promise<number> {
  return prisma.item.count(args)
}

/**
 * Creates the root folder item for a drive.
 * Used during user/workspace provisioning to establish the top-level folder anchor.
 *
 * @param userId - The ID of the user who will own the root folder.
 * @param driveId - The drive the root folder belongs to.
 * @param workspaceId - Optional workspace to associate the root folder with.
 */
export async function createRootFolder(
  userId: string,
  driveId: string,
  workspaceId?: string
) {
  const id = toObjectId(getPrefixForModel('Item'))
  return createItem({
    data: {
      id,
      name: 'root',
      type: 'folder',
      drive: { connect: { id: driveId } },
      workspace: { connect: { id: workspaceId } },
      owner: { connect: { id: userId } },
    },
  })
}
