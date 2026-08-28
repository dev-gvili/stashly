import type { TransactionClient } from '@/prisma/internal/prismaNamespace'
import { prisma } from '@/services/db'
import { getPrefixForModel, toChunkArray, toObjectId } from '@/utils/converters'
import { Prisma, type Item, type PrismaClient } from '@/prisma/client'
import { ItemCategory } from '@/prisma/enums'
import { StashlyError, StashlyErrorCode } from '../utils/api.errors'
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
import {
  ensureUserQuota,
  onActiveItemsDeleted,
  onItemsCopied,
  onItemsDeleted,
  onItemsRestored,
  onItemsTrashed,
  onItemsUploaded,
} from '../.server/quota-actions'
import { createActivity } from './activity-actions'
import { formatSize } from '@/utils/formaters'
import { searchFactory } from '@/utils/search'
import { buildItemFilters } from '@/utils/filters/item.filters'
import { getObjectText } from '@/services/s3'
import {
  extractMarkdownHeadings,
  type MarkdownHeading,
} from '@/utils/markdown'

/**
 * Fire-and-forget helper that records a favorite/unfavorite activity entry
 * for an item. Errors are swallowed so activity logging never blocks or
 * fails the calling operation.
 *
 * @param itemId - The ID of the item the activity relates to.
 * @param kind - Whether the item was favorited or unfavorited.
 *
 * @example
 * // Record that an item was favorited
 * recordFavoriteActivity('item_123', 'favorited');
 */
function recordFavoriteActivity(
  itemId: string,
  kind: 'favorited' | 'unfavorited'
) {
  Promise.resolve()
    .then(() =>
      createActivity({
        item: { connect: { id: itemId } },
        time: {
          create: {
            id: toObjectId(getPrefixForModel('ActivityTime')),
            observedAt: new Date(),
          },
        },
        action: {
          create: {
            id: toObjectId(getPrefixForModel('ItemAction')),
            favorite: {
              create: {
                id: toObjectId(getPrefixForModel('FavoriteAction')),
                kind,
              },
            },
          },
        },
      })
    )
    .catch(() => {})
}

/**
 * Get an item with its permissions, checking if the user has access.
 * @param userId - The ID of the user requesting the item.
 * @param itemId - The ID of the item to retrieve.
 * @throws {StashlyError} If the item is not found or the user has no access.
 *
 * @example
 * // Fetch an item together with its permission records
 * const item = await getItemWithPermissions('usr_123', 'item_456');
 * console.log(item.permissions);
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
 * A rename activity entry is recorded in the background.
 *
 * @param itemId - The ID of the item to rename.
 * @param newName - The new display name for the item.
 *
 * @example
 * // Rename a file
 * const item = await renameItem('item_123', 'vacation-photos.zip');
 */
export async function renameItem(itemId: string, newName: string) {
  return await prisma.$transaction(async (tx) => {
    const existing = await tx.item.findUniqueOrThrow({
      where: { id: itemId },
      select: { name: true },
    })

    // 1. Update the item's name
    const item = await tx.item.update({
      where: { id: itemId },
      data: { name: newName },
      include: { parent: true },
    })

    createActivity({
      item: { connect: { id: itemId } },
      time: {
        create: {
          id: toObjectId(getPrefixForModel('ActivityTime')),
          observedAt: new Date(),
        },
      },
      action: {
        create: {
          id: toObjectId(getPrefixForModel('ItemAction')),
          rename: {
            create: {
              id: toObjectId(getPrefixForModel('RenameAction')),
              oldName: existing.name,
              newName,
            },
          },
        },
      },
    }).catch(() => {})

    return item
  })
}

// --- 2. MOVE ---

/**
 * Moves multiple items to the same target folder.
 * Validates all structural constraints and checks write permission on every
 * source item and on the destination folder before performing the batch update.
 *
 * @param ids - IDs of the items to move.
 * @param targetFolderId - The ID of the destination folder.
 * @param userId - The ID of the user performing the operation.
 * @param currentParentId - Optional ID of the folder the items are moved from; used for activity recording (defaults to the first item's parent).
 * @throws {StashlyError} If a structural constraint is violated or the user lacks write access.
 *
 * @example
 * // Move two items into another folder
 * await moveItems(['item_1', 'item_2'], 'fld_target', 'usr_123');
 */
export async function moveItems(
  ids: string[],
  targetFolderId: string,
  userId: string,
  currentParentId = ''
) {
  if (ids.length === 0) {
    return
  }

  if (!targetFolderId) {
    throw new StashlyError(
      StashlyErrorCode.MOVE_ITEM_FAILED,
      'targetFolderId is required'
    )
  }

  const { result, fromParentId, fromParentName, toParentId, toParentName } =
    await prisma.$transaction(async (tx) => {
      const [items, targetFolder] = await Promise.all([
        tx.item.findMany({
          where: { id: { in: ids } },
          select: {
            id: true,
            parentId: true,
            type: true,
            owner: { select: { rootId: true } },
          },
        }),
        tx.item.findUnique({
          where: { id: targetFolderId },
          select: { id: true, name: true, type: true, parentId: true },
        }),
      ])

      if (!targetFolder) {
        throw new StashlyError(
          StashlyErrorCode.NOT_FOUND,
          'Target folder not found'
        )
      }

      if (targetFolder.type !== 'folder') {
        throw new StashlyError(
          StashlyErrorCode.MOVE_ITEM_FAILED,
          'Target must be a folder'
        )
      }

      const canWriteTarget = await hasItemPermission(
        userId,
        targetFolderId,
        'write',
        tx
      )
      if (!canWriteTarget) {
        throw new StashlyError(
          StashlyErrorCode.FORBIDDEN,
          'You do not have write access to the target folder'
        )
      }

      const foundIds = new Set(items.map((i) => i.id))
      for (const id of ids) {
        if (!foundIds.has(id)) {
          throw new StashlyError(
            StashlyErrorCode.NOT_FOUND,
            `Item ${id} not found`
          )
        }
      }

      for (const item of items) {
        if (item.id === targetFolderId) {
          throw new StashlyError(
            StashlyErrorCode.MOVE_ITEM_FAILED,
            'Cannot move an item into itself'
          )
        }

        if (item.parentId === targetFolderId) {
          throw new StashlyError(
            StashlyErrorCode.MOVE_ITEM_FAILED,
            'One or more items are already in the target folder'
          )
        }

        if (targetFolder.parentId === item.id) {
          throw new StashlyError(
            StashlyErrorCode.MOVE_ITEM_FAILED,
            'Cannot move a folder into its own subfolder'
          )
        }

        if (item.type === 'folder' && item.parentId === null) {
          throw new StashlyError(
            StashlyErrorCode.MOVE_ITEM_FAILED,
            'Cannot move a root folder into another folder'
          )
        }

        if (
          item.type === 'folder' &&
          targetFolderId === item.owner.rootId &&
          item.parentId === item.owner.rootId
        ) {
          throw new StashlyError(
            StashlyErrorCode.MOVE_ITEM_FAILED,
            'Cannot move a folder to root if it is already a root folder'
          )
        }

        const canWrite = await hasItemPermission(userId, item.id, 'write', tx)
        if (!canWrite) {
          throw new StashlyError(
            StashlyErrorCode.FORBIDDEN,
            'You do not have write access to one or more items'
          )
        }
      }

      const sourceId = currentParentId || items[0]?.parentId || ''
      const sourceFolder = sourceId
        ? await tx.item.findUnique({
            where: { id: sourceId },
            select: { name: true },
          })
        : null

      const updated = await tx.item.updateManyAndReturn({
        where: { id: { in: ids } },
        data: { parentId: targetFolderId },
      })

      return {
        result: updated,
        fromParentId: sourceId,
        fromParentName: sourceFolder?.name ?? 'My Stash',
        toParentId: targetFolderId,
        toParentName: targetFolder!.name,
      }
    })

  Promise.resolve()
    .then(() =>
      Promise.all(
        result.map((item) =>
          createActivity({
            item: { connect: { id: item.id } },
            time: {
              create: {
                id: toObjectId(getPrefixForModel('ActivityTime')),
                observedAt: new Date(),
              },
            },
            action: {
              create: {
                id: toObjectId(getPrefixForModel('ItemAction')),
                move: {
                  create: {
                    id: toObjectId(getPrefixForModel('MoveAction')),
                    fromParentId,
                    fromParentName,
                    toParentId,
                    toParentName,
                  },
                },
              },
            },
          })
        )
      )
    )
    .catch(() => {})

  return result
}

/**
 * Moves a single item to a new folder.
 * Delegates to {@link moveItems}.
 *
 * @param itemId - The ID of the item to move.
 * @param targetFolderId - The ID of the destination folder.
 * @param userId - The ID of the user performing the operation.
 * @param currentParentId - Optional ID of the folder the item is moved from; used for activity recording.
 *
 * @example
 * // Move a file into a folder
 * await moveItem('item_123', 'fld_456', 'usr_789');
 */
export async function moveItem(
  itemId: string,
  targetFolderId: string,
  userId: string,
  currentParentId = ''
) {
  return await moveItems([itemId], targetFolderId, userId, currentParentId)
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
 * @param {string} userId - The ID of the user trashing the item (used for quota adjustment).
 *
 * @example
 * await trashItem('item_123', 'usr_456');
 */
export async function trashItem(id: string, userId: string) {
  return await trashItems([id], userId)
}

/**
 * Recursively soft deletes multiple items (files or folders) by setting their status to 'trashed'.
 * If a folder is included in the list, all its descendants will also be marked as trashed.
 *
 * @param {string[]} ids - An array of item IDs to trash.
 * @param {string} userId - The ID of the user trashing the items (used for quota adjustment).
 *
 * @example
 * await trashItems(['item_1', 'fld_2'], 'usr_456');
 */
export async function trashItems(ids: string[], userId: string) {
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

  const [itemMeta, { _sum }] = await Promise.all([
    prisma.item.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, type: true },
    }),
    prisma.item.aggregate({
      where: { id: { in: allIds } },
      _sum: { size: true },
    }),
  ])

  const metaMap = Object.fromEntries(itemMeta.map((i) => [i.id, i]))

  // Update status for all items at once
  const result = await prisma.item.updateMany({
    where: {
      id: { in: allIds },
    },
    data: {
      status: 'trashed',
    },
  })

  const trashedSize = _sum.size ?? 0n
  if (trashedSize > 0n) {
    Promise.resolve()
      .then(() => onItemsTrashed({ userId, dataSize: trashedSize }))
      .catch(() => {})
  }

  for (const id of ids) {
    const meta = metaMap[id]
    createActivity({
      item: { connect: { id } },
      time: {
        create: {
          id: toObjectId(getPrefixForModel('ActivityTime')),
          observedAt: new Date(),
        },
      },
      action: {
        create: {
          id: toObjectId(getPrefixForModel('ItemAction')),
          delete: {
            create: {
              id: toObjectId(getPrefixForModel('DeleteAction')),
              name: meta?.name ?? id,
              itemType: meta?.type === 'folder' ? 'folder' : 'file',
            },
          },
        },
      },
    }).catch(() => {})
  }

  return result
}

/**
 * Restores a single item from the trash.
 * This will also recursively restore its ancestors and descendants.
 *
 * @param {string} itemId - The ID of the item to restore.
 * @param {string} userId - The ID of the user restoring the item (used for quota adjustment).
 *
 * @example
 * // Restore a specific file and its path
 * await restoreItem('item_123', 'usr_456');
 */
export async function restoreItem(itemId: string, userId: string) {
  return await restoreItems([itemId], userId)
}

/**
 * Recursively restores items from the trash to 'normal' status.
 * This restores the items themselves, all their descendants (children),
 * and all their ancestors (parent folders).
 *
 * @param {string[]} ids - An array of item IDs to restore.
 * @param {string} userId - The ID of the user restoring the items (used for quota adjustment).
 *
 * @example
 * // Restore multiple items and their entire hierarchy
 * await restoreItems(['item_1', 'item_2'], 'usr_456');
 */
export async function restoreItems(ids: string[], userId: string) {
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

  // Sum only items that were actually trashed (those shifting from deleted→used)
  const { _sum } = await prisma.item.aggregate({
    where: { id: { in: allIds }, status: 'trashed' },
    _sum: { size: true },
  })

  // Update status for all related items at once
  const result = await prisma.item.updateMany({
    where: {
      id: { in: allIds },
    },
    data: {
      status: 'normal',
    },
  })

  const restoredSize = _sum.size ?? 0n
  if (restoredSize > 0n) {
    Promise.resolve()
      .then(() => onItemsRestored({ userId, dataSize: restoredSize }))
      .catch(() => {})
  }

  for (const id of ids) {
    createActivity({
      item: { connect: { id } },
      time: {
        create: {
          id: toObjectId(getPrefixForModel('ActivityTime')),
          observedAt: new Date(),
        },
      },
      action: {
        create: {
          id: toObjectId(getPrefixForModel('ItemAction')),
          restore: {
            create: { id: toObjectId(getPrefixForModel('RestoreAction')) },
          },
        },
      },
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
 *
 * @param id - The ID of the item to permanently delete.
 * @param userId - The ID of the user deleting the item (used for quota adjustment).
 *
 * @example
 * // Permanently delete a file
 * await deleteItem('item_123', 'usr_456');
 */
export async function deleteItem(id: string, userId: string) {
  const deleted = await prisma.item.delete({
    where: { id },
  })

  const size = deleted.size ?? 0n
  if (size > 0n) {
    // Items deleted from trash: reduce deleted quota.
    // Items force-deleted while active: reduce used quota.
    const quotaFn =
      deleted.status === 'trashed' ? onItemsDeleted : onActiveItemsDeleted
    Promise.resolve()
      .then(() => quotaFn({ userId, dataSize: size }))
      .catch(() => {})
  }

  createActivity({
    item: { connect: { id } },
    time: {
      create: {
        id: toObjectId(getPrefixForModel('ActivityTime')),
        observedAt: new Date(),
      },
    },
    action: {
      create: {
        id: toObjectId(getPrefixForModel('ItemAction')),
        delete: {
          create: {
            id: toObjectId(getPrefixForModel('DeleteAction')),
            name: deleted.name,
            itemType: deleted.type === 'folder' ? 'folder' : 'file',
          },
        },
      },
    },
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
 * @param ids - An array of item IDs to permanently delete.
 * @param userId - The ID of the user deleting the items (used for quota adjustment).
 *
 * @example
 * // Delete items with IDs 'item_abc' and 'item_xyz' and all their descendants if those items are of type folder`
 * await deleteItems(['item_abc', 'item_xyz'], 'usr_456');
 * // This will delete 'item_abc', 'item_xyz', and any files/folders nested within them.
 */
export async function deleteItems(ids: string[], userId: string) {
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

  // Aggregate sizes by status before deleting so we can adjust quota correctly
  const [trashedAgg, activeAgg] = await Promise.all([
    prisma.item.aggregate({
      where: { id: { in: allIds }, status: 'trashed' },
      _sum: { size: true },
    }),
    prisma.item.aggregate({
      where: { id: { in: allIds }, status: { not: 'trashed' } },
      _sum: { size: true },
    }),
  ])

  const result = await prisma.item.deleteMany({ where: { id: { in: allIds } } })

  const trashedSize = trashedAgg._sum.size ?? 0n
  const activeSize = activeAgg._sum.size ?? 0n
  if (trashedSize > 0n) {
    Promise.resolve()
      .then(() => onItemsDeleted({ userId, dataSize: trashedSize }))
      .catch(() => {})
  }
  if (activeSize > 0n) {
    Promise.resolve()
      .then(() => onActiveItemsDeleted({ userId, dataSize: activeSize }))
      .catch(() => {})
  }

  return result
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
        video: true,
        image: true,
        pdf: true,
        parent: true,
        thumbnails: true,
      },
    })

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
        time: {
          create: {
            id: toObjectId(getPrefixForModel('ActivityTime')),
            observedAt: new Date(),
          },
        },
        action: {
          create: {
            id: toObjectId(getPrefixForModel('ItemAction')),
            copy: {
              create: {
                id: toObjectId(getPrefixForModel('CopyAction')),
                fromParentId: source.parentId!,
                fromParentName: source.parent?.name ?? '',
                toParentId: targetParentId,
                toParentName: newItem.parent?.name ?? '',
              },
            },
          },
        },
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
        time: {
          create: {
            id: toObjectId(getPrefixForModel('ActivityTime')),
            observedAt: new Date(),
          },
        },
        action: {
          create: {
            id: toObjectId(getPrefixForModel('ItemAction')),
            copy: {
              create: {
                id: toObjectId(getPrefixForModel('CopyAction')),
                fromParentId: source.parentId!,
                fromParentName: source.parent?.name ?? '',
                toParentId: targetParentId,
                toParentName: newItem.parent?.name ?? '',
              },
            },
          },
        },
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
        time: {
          create: {
            id: toObjectId(getPrefixForModel('ActivityTime')),
            observedAt: new Date(),
          },
        },
        action: {
          create: {
            id: toObjectId(getPrefixForModel('ItemAction')),
            copy: {
              create: {
                id: toObjectId(getPrefixForModel('CopyAction')),
                fromParentId: source.parentId!,
                fromParentName: source.parent?.name ?? '',
                toParentId: targetParentId,
                toParentName: newItem.parent?.name ?? '',
              },
            },
          },
        },
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
        time: {
          create: {
            id: toObjectId(getPrefixForModel('ActivityTime')),
            observedAt: new Date(),
          },
        },
        action: {
          create: {
            id: toObjectId(getPrefixForModel('ItemAction')),
            copy: {
              create: {
                id: toObjectId(getPrefixForModel('CopyAction')),
                fromParentId: source.parentId!,
                fromParentName: source.parent?.name ?? '',
                toParentId: targetParentId,
                toParentName: newItem.parent?.name ?? '',
              },
            },
          },
        },
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
    time: {
      create: {
        id: toObjectId(getPrefixForModel('ActivityTime')),
        observedAt: new Date(),
      },
    },
    action: {
      create: {
        id: toObjectId(getPrefixForModel('ItemAction')),
        create: {
          create: { id: toObjectId(getPrefixForModel('CreateAction')) },
        },
      },
    },
  }).catch(() => {})

  return folder
}

/**
 * Lists the direct child folders of a parent folder within a drive,
 * including each folder's count of non-trashed subfolders.
 * Used by folder-picker UIs (e.g. the move-to-folder dialog) for drill-down.
 *
 * @param parentId - The ID of the folder whose children to list.
 * @param driveId - The drive scope to search within.
 *
 * @example
 * // List subfolders for a drill-down picker
 * const folders = await getChildFolders('fld_123', 'drv_456');
 */
export async function getChildFolders(parentId: string, driveId: string) {
  return prisma.item.findMany({
    where: { parentId, driveId, type: 'folder', status: 'normal' },
    select: {
      id: true,
      name: true,
      parentId: true,
      _count: {
        select: {
          children: { where: { type: 'folder', status: 'normal' } },
        },
      },
    },
    orderBy: { name: 'asc' },
  })
}

/**
 * Searches non-trashed folders in a drive by name (case-insensitive substring
 * match). Returns at most 50 results, each with its count of non-trashed
 * subfolders.
 *
 * @param query - The substring to match against folder names.
 * @param driveId - The drive scope to search within.
 *
 * @example
 * // Find folders whose name contains "photo"
 * const folders = await searchFolders('photo', 'drv_456');
 */
export async function searchFolders(query: string, driveId: string) {
  return prisma.item.findMany({
    where: {
      driveId,
      type: 'folder',
      status: 'normal',
      name: { contains: query, mode: 'insensitive' },
    },
    select: {
      id: true,
      name: true,
      parentId: true,
      _count: {
        select: {
          children: { where: { type: 'folder', status: 'normal' } },
        },
      },
    },
    orderBy: { name: 'asc' },
    take: 50,
  })
}

/**
 * Internal helper that walks a relative folder path under a root folder,
 * creating any missing folders along the way. Resolves to the ID of the
 * deepest folder plus the IDs of any folders created during the walk.
 *
 * @param pathParts - Ordered folder names forming the relative path (e.g. `['photos', '2026']`).
 * @param rootId - The ID of the folder to start resolving from.
 * @param ownerId - The ID of the user who will own any created folders.
 * @param driveId - The drive the folders belong to.
 * @param tx - The Prisma transaction client to run all reads/writes in.
 *
 * @example
 * // Resolve (and create if needed) "photos/2026" under the root folder
 * const { parentId, createdFolderIds } = await findOrCreateFolderPath(
 *   ['photos', '2026'],
 *   'item_root',
 *   'usr_123',
 *   'drv_456',
 *   tx
 * );
 */
async function findOrCreateFolderPath(
  pathParts: string[],
  rootId: string,
  ownerId: string,
  driveId: string,
  tx: TransactionClient
): Promise<{ parentId: string; createdFolderIds: string[] }> {
  let currentParentId = rootId
  const createdFolderIds: string[] = []
  for (const folderName of pathParts) {
    // Guard against the check-then-create race: when many files under one
    // directory upload at once, each runs in its own transaction, so their
    // `findFirst`s all miss and each creates a duplicate folder (same name,
    // different id, with the directory's contents split across the copies).
    // A transaction-scoped advisory lock keyed on (owner, parent, name)
    // serializes concurrent creators of the *same* folder — the waiter then
    // sees the committed folder and reuses it. Files in unrelated folders
    // don't contend.
    const lockKey = `folder:${ownerId}:${currentParentId}:${folderName}`
    // `$executeRaw`, not `$queryRaw`: pg_advisory_xact_lock returns `void`,
    // which $queryRaw can't deserialize as a result column.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`

    const existing = await tx.item.findFirst({
      where: {
        name: folderName,
        parentId: currentParentId,
        type: 'folder',
        ownerId,
      },
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
                create: {
                  viewType: 'grid',
                  sortBy: 'type',
                  sortOrder: 'ascending',
                },
              },
            },
          },
        },
        select: { id: true },
      })
      currentParentId = folder.id
      createdFolderIds.push(folder.id)
    }
  }
  return { parentId: currentParentId, createdFolderIds }
}

/**
 * Creates or updates the Image facet for an item with extracted image metadata
 * (dimensions, DPI, bit depth, and EXIF camera/exposure/GPS fields).
 * Only the provided fields are written; other existing values are preserved.
 *
 * @param itemId - The ID of the item the facet belongs to.
 * @param data - Partial image metadata to store.
 *
 * @example
 * // Store dimensions and camera info extracted from a photo
 * await upsertImageFacet('item_123', {
 *   width: 4032,
 *   height: 3024,
 *   cameraMake: 'Apple',
 *   cameraModel: 'iPhone 15 Pro',
 * });
 */
export async function upsertImageFacet(
  itemId: string,
  data: {
    width?: number
    height?: number
    horizontalResolution?: number
    verticalResolution?: number
    bitDepth?: number
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

/**
 * Creates or updates the Video facet for an item with extracted video metadata.
 * Only the provided fields are written; other existing values are preserved.
 *
 * @param itemId - The ID of the item the facet belongs to.
 * @param data - Partial video metadata to store.
 *
 * @example
 * // Store dimensions and duration extracted from a video
 * await upsertVideoFacet('item_123', { width: 1920, height: 1080, duration: 42.5 });
 */
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

/**
 * Creates or updates the Audio facet for an item with extracted audio metadata
 * (duration, bitrate, and ID3 tag fields such as title/artist/album).
 * Only the provided fields are written; other existing values are preserved.
 *
 * @param itemId - The ID of the item the facet belongs to.
 * @param data - Partial audio metadata to store.
 *
 * @example
 * // Store ID3 tags extracted from an MP3
 * await upsertAudioFacet('item_123', {
 *   title: 'Bohemian Rhapsody',
 *   artist: 'Queen',
 *   duration: 354,
 * });
 */
export async function upsertAudioFacet(
  itemId: string,
  data: {
    duration?: number
    bitrate?: number
    title?: string
    artist?: string
    album?: string
    albumArtist?: string
    composer?: string
    genre?: string
    copyright?: string
    year?: number
    track?: number
    trackCount?: number
    disc?: number
    discCount?: number
  }
) {
  const existing = await prisma.audio.findFirst({ where: { itemId } })
  if (existing) {
    return prisma.audio.update({ where: { id: existing.id }, data })
  }
  return prisma.audio.create({
    data: { id: toObjectId(getPrefixForModel('Audio')), itemId, ...data },
  })
}

/**
 * Creates or updates the Pdf facet for an item with extracted document
 * metadata (page count, document info fields, and feature flags such as
 * form fields or signatures).
 * Only the provided fields are written; other existing values are preserved.
 *
 * @param itemId - The ID of the item the facet belongs to.
 * @param data - Partial PDF metadata to store.
 *
 * @example
 * // Store metadata extracted from a PDF document
 * await upsertPdfFacet('item_123', {
 *   pageCount: 12,
 *   title: 'Annual Report',
 *   hasFormFields: true,
 * });
 */
export async function upsertPdfFacet(
  itemId: string,
  data: {
    pageCount?: number
    title?: string
    author?: string
    subject?: string
    keywords?: string
    creator?: string
    producer?: string
    pdfVersion?: string
    language?: string
    isEncrypted?: boolean
    hasFormFields?: boolean
    hasAnnotations?: boolean
    hasSignatures?: boolean
    pageWidth?: number
    pageHeight?: number
    docCreatedAt?: Date
    docModifiedAt?: Date
  }
) {
  const existing = await prisma.pdf.findFirst({ where: { itemId } })
  if (existing) {
    return prisma.pdf.update({ where: { id: existing.id }, data })
  }
  return prisma.pdf.create({
    data: { id: toObjectId(getPrefixForModel('Pdf')), itemId, ...data },
  })
}

/**
 * Creates or updates the Markdown facet for an item with extracted document
 * statistics (word count, headings, links, code blocks) and frontmatter fields.
 * Only the provided fields are written; other existing values are preserved.
 *
 * @param itemId - The ID of the item the facet belongs to.
 * @param data - Partial markdown metadata to store.
 *
 * @example
 * // Store stats parsed from a markdown document
 * await upsertMarkdownFacet('item_123', {
 *   title: 'README',
 *   wordCount: 1250,
 *   headingCount: 8,
 *   hasFrontmatter: true,
 * });
 */
export async function upsertMarkdownFacet(
  itemId: string,
  data: {
    title?: string
    author?: string
    description?: string
    tags?: string
    wordCount?: number
    readingTime?: number
    headingCount?: number
    linkCount?: number
    imageCount?: number
    codeBlockCount?: number
    taskCount?: number
    hasFrontmatter?: boolean
    docCreatedAt?: Date
    docModifiedAt?: Date
  }
) {
  const existing = await prisma.markdown.findFirst({ where: { itemId } })
  if (existing) {
    return prisma.markdown.update({ where: { id: existing.id }, data })
  }
  return prisma.markdown.create({
    data: { id: toObjectId(getPrefixForModel('Markdown')), itemId, ...data },
  })
}

/**
 * Creates the database record for a freshly uploaded file, deriving its parent
 * folder from the S3 key (missing folders in the key path are created on the
 * fly). Also creates the File facet, an owner permission, updates the owner's
 * quota, and records upload activity for the item and any created folders.
 *
 * @param data - Upload result payload: item ID/name, S3 `key`/`bucket`/`etag`, `size`, `mimeType`, owner/drive/parent IDs, the `uploadId`, and an optional `category`.
 *
 * @example
 * // Create the item record after a completed S3 upload
 * const item = await createUploadedItem({
 *   id: 'item_123',
 *   name: 'report.pdf',
 *   key: 'item_root/documents/report.pdf',
 *   size: 1024n,
 *   mimeType: 'application/pdf',
 *   bucket: 'stashly-bucket',
 *   driveId: 'drv_456',
 *   parentId: 'item_root',
 *   ownerId: 'usr_789',
 *   uploadId: 'upl_abc',
 *   category: 'document',
 * });
 */
export async function createUploadedItem(data: {
  id: string
  name: string
  key: string
  size: bigint
  mimeType?: string
  etag?: string
  /** Client-computed content hash (see `app/workers/hash.worker.ts`). */
  hash?: string
  bucket: string
  driveId: string
  parentId: string
  ownerId: string
  uploadId: string
  category?: string
}) {
  let createdFolderIds: string[] = []
  const result = await prisma.$transaction(async (tx) => {
    const segments = data.key.split('/')
    const rootId = segments[0]
    const pathParts = segments.slice(1, -1)
    let resolvedParentId = rootId
    if (pathParts.length > 0) {
      const folderResult = await findOrCreateFolderPath(
        pathParts,
        rootId,
        data.ownerId,
        data.driveId,
        tx
      )
      resolvedParentId = folderResult.parentId
      createdFolderIds = folderResult.createdFolderIds
    }

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
        uploadId: data.uploadId,
        file: {
          create: {
            id: toObjectId(getPrefixForModel('File')),
            bucket: data.bucket,
            key: data.key,
            mimeType: data.mimeType,
            etag: data.etag,
            // Empty string means the browser could not hash the file; store
            // null so duplicate grouping reads it as "unknown", not "matches
            // every other file that also failed".
            hash: data.hash || null,
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

    await onItemsUploaded({
      userId: data.ownerId,
      dataSize: data.size,
      client: tx,
    })

    createActivity({
      item: { connect: { id: item.id } },
      time: {
        create: {
          id: toObjectId(getPrefixForModel('ActivityTime')),
          observedAt: new Date(),
        },
      },
      action: {
        create: {
          id: toObjectId(getPrefixForModel('ItemAction')),
          upload: {
            create: {
              uploadId: item.uploadId ?? '',
              id: toObjectId(getPrefixForModel('UploadAction')),
            },
          },
        },
      },
    }).catch(() => {})

    return item
  })

  for (const folderId of createdFolderIds) {
    const id = folderId
    Promise.resolve()
      .then(() =>
        createActivity({
          item: { connect: { id } },
          time: {
            create: {
              id: toObjectId(getPrefixForModel('ActivityTime')),
              observedAt: new Date(),
            },
          },
          action: {
            create: {
              id: toObjectId(getPrefixForModel('ItemAction')),
              upload: {
                create: {
                  id: toObjectId(getPrefixForModel('UploadAction')),
                  uploadId: data.uploadId,
                },
              },
            },
          },
        })
      )
      .catch(() => {})
  }

  return result
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
  /** Custom order-by clause (overrides sortBy/sortDirection when provided). */
  orderBy?:
    | Prisma.ItemOrderByWithRelationInput
    | Prisma.ItemOrderByWithRelationInput[]
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
 *
 * @example
 * // First page of a folder, folders grouped before files
 * const { items, nextCursor, hasMore } = await getFolderContent({
 *   where: { parentId: 'fld_123', status: 'normal' },
 *   limit: 50,
 *   foldersFirst: true,
 * });
 */
export async function getFolderContent(params: GetFolderContentParams) {
  const {
    limit = 50,
    cursor,
    where,
    sortBy = 'name',
    sortDirection = 'asc',
    foldersFirst = false,
    orderBy: customOrderBy,
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

  // Apply caller-provided sort if any, otherwise the sortBy/sortDirection default
  if (customOrderBy) {
    const arr = Array.isArray(customOrderBy) ? customOrderBy : [customOrderBy]
    // Split any merged multi-key objects into separate entries (Prisma requires one field per object)
    for (const entry of arr) {
      const keys = Object.keys(entry)
      if (keys.length > 1) {
        for (const k of keys)
          orderBy.push({
            [k]: (entry as Record<string, unknown>)[k],
          } as Prisma.ItemOrderByWithRelationInput)
      } else {
        orderBy.push(entry)
      }
    }
  } else {
    orderBy.push({ [sortBy]: sortDirection })
  }

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
        locked: true,
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
            stage: true,
          },
        },
        tags: true,
        parent: {
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
            locked: true,
            favorites: {
              select: {
                id: true,
                favoritedById: true,
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
                stage: true,
              },
            },
            tags: true,
            parent: true,
          },
        },
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
  take?: number
  include?: TInclude
}): Promise<{
  items: TInclude extends undefined
    ? Prisma.ItemGetPayload<Prisma.ItemDefaultArgs>[]
    : Prisma.ItemGetPayload<{ include: TInclude }>[]
  nextCursor: string | null
  hasMore?: boolean
}> {
  const { where, cursor, take = 50, include } = params
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
    take: take + 1,
    cursor: cursor ? { id: cursor } : undefined,
    include,
  })

  let hasMore = items.length > take
  let data = items.slice(0, take)
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
 *
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
    include: { file: true; folder: true; video: true; image: true; pdf: true }
  }>, // Typed as Item & { file: File | null, folder: Folder | null }
  parentId: string | null,
  workspaceId: string | null = null
) {
  // 1. Create the new item
  let { file, folder, video, image, pdf, ...itemData } = sourceItem
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
      ...(video
        ? {
            video: {
              create: {
                ...video,
                id: toObjectId(getPrefixForModel('Video')),
              },
            },
          }
        : {}),
      ...(image
        ? {
            image: {
              create: {
                ...image,
                id: toObjectId(getPrefixForModel('Image')),
              },
            },
          }
        : {}),
      ...(pdf
        ? {
            pdf: {
              create: {
                ...pdf,
                id: toObjectId(getPrefixForModel('Pdf')),
              },
            },
          }
        : {}),
    },
    include: {
      file: true,
      folder: true,
      video: true,
      image: true,
      pdf: true,
      parent: true,
    },
  })

  // 2. If it's a folder, recursively copy children
  if (sourceItem.type === 'folder') {
    const children = await tx.item.findMany({
      where: { parentId: sourceItem.id },
      include: {
        file: true,
        folder: true,
        video: true,
        image: true,
        pdf: true,
      },
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
    pins: Array<{
      id: string
      pinnedById: string
    }>
    locked: {
      id: string
      lockedById: string
      lockedAt: Date
    } | null
    parent: {
      id: string
      name: string
    } | null
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
      ) as "thumbnails",
      COALESCE(
        json_agg(
          jsonb_build_object(
            'id', pin.id,
            'pinnedById', pin."pinnedById"
          )
        ) FILTER (WHERE pin.id IS NOT NULL),
        '[]'::json
      ) as "pins",
      (CASE WHEN li.id IS NOT NULL THEN jsonb_build_object(
        'id', li.id,
        'lockedById', li."lockedById",
        'lockedAt', li."lockedAt"
      ) ELSE NULL END) as "locked",
      (CASE WHEN parent.id IS NOT NULL THEN jsonb_build_object(
        'id', parent.id,
        'name', parent.name
      ) ELSE NULL END) as "parent"
    FROM "Item" i
    LEFT JOIN "File" f ON i.id = f."itemId"
    LEFT JOIN "Folder" fo ON i.id = fo."itemId"
    LEFT JOIN "Favorite" fav ON i.id = fav."itemId"
    LEFT JOIN "user" u ON fav."favoritedById" = u.id
    LEFT JOIN "Thumbnail" t ON i.id = t."itemId"
    LEFT JOIN "PinItem" pin ON i.id = pin."itemId"
    LEFT JOIN "Permission" p ON i.id = p."itemId"
    LEFT JOIN "LockedItem" li ON i.id = li."itemId"
    LEFT JOIN "Item" parent ON i."parentId" = parent.id
    WHERE
      i."ownerId" = ${userId}
      AND i."driveId" = ${driveId}
      AND i.type::text = ${type}
      AND i.name != 'root'
      AND i.status = 'normal'
      ${workspaceId ? Prisma.sql`AND i."workspaceId" = ${workspaceId}` : Prisma.empty}
    GROUP BY i.id, f.id, fo.id, li.id, parent.id, parent.name
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

export const defaultItemSelect = {
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
  parent: true,
  ownerId: true,
  workspaceId: true,
  uploadId: true,
  image: true,
  tags: true,
  video: true,
  audio: true,
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
 *
 * @example
 * // Search for items with "report" in the name, sorted by creation date
 * const results = await searchItems({
 *   query: 'report',
 *   filters: { name: { contains: 'report' } },
 *   orderBy: { createdAt: 'desc' },
 *   limit: 20,
 * });
 *
 * @example
 * // Search for items in a specific workspace with a certain tag
 * const results = await searchItems({
 *   filters: {
 *     workspaceId: 'ws_123',
 *     tags: { has: 'important' },
 *   },
 * });
 *
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
 *
 * @example
 * // Find an item by ID with the default select shape
 * const item = await findItem({ where: { id: 'item_123' } });
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
 *
 * @example
 * // Create a bare folder item
 * const item = await createItem({
 *   data: {
 *     id: 'item_123',
 *     name: 'Documents',
 *     type: 'folder',
 *     owner: { connect: { id: 'usr_456' } },
 *     drive: { connect: { id: 'drv_789' } },
 *   },
 * });
 */
export async function createItem(args: Prisma.ItemCreateArgs) {
  return prisma.item.create({
    ...args,
    select: args.select || defaultItemSelect,
  })
}

// create many items at once (e.g. for bulk upload)
/**
 * Creates multiple item records in a single operation. Note that this does not support creating related facets (e.g. File, Folder) or relations (e.g. Favorites) — use `createManyItemsBatched` for that.
 *
 * @param args - Prisma `createMany` arguments (`data` is required).
 *
 * @example
 * // Bulk-insert flat item records
 * const { count } = await createManyItems({
 *   data: [
 *     { id: 'item_1', name: 'a.txt', type: 'file', ownerId: 'usr_1', driveId: 'drv_1' },
 *     { id: 'item_2', name: 'b.txt', type: 'file', ownerId: 'usr_1', driveId: 'drv_1' },
 *   ],
 * });
 */
export async function createManyItems(args: Prisma.ItemCreateManyArgs) {
  return prisma.item.createMany(args)
}

// create many items in barchsequentially including their relations (e.g. for copying large folders)
/**
 * Creates multiple items in batches, allowing for the creation of related facets and relations. This function processes items sequentially in batches to manage database load and handle potential constraints. If a batch fails (e.g., due to unique constraint violations), it falls back to creating items individually to isolate errors.
 *
 * @param items - An array of item creation data, including related facets and relations.
 * @param batchSize - The number of items to process in each batch (default: 100).
 * @throws {Error} If item creation fails after retrying individually.
 *
 * @example
 * // Copy a large folder's contents in batches of 50
 * const created = await createManyItemsBatched(itemInputs, 50);
 */
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
 *
 * @example
 * // Add a tag to an item
 * const item = await updateItem({
 *   where: { id: 'item_123' },
 *   data: { tags: { push: 'important' } },
 * });
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
 *
 * @example
 * // Fetch the latest items added to a workspace
 * const items = await findWorkspaceItems('ws_123');
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
 *
 * @example
 * const favorites = await findFavoritesForUser('usr_123');
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
 *
 * @param userId - The ID of the user whose favorites to list.
 * @param cursor - Optional cursor from the previous page (ID of the last item).
 * @param limit - Maximum number of items per page (default: 50).
 *
 * @example
 * // First page of favorites, then the next page
 * const page1 = await getFavoritedItems({ userId: 'usr_123', limit: 20 });
 * const page2 = await getFavoritedItems({
 *   userId: 'usr_123',
 *   cursor: page1.nextCursor ?? undefined,
 *   limit: 20,
 * });
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
      tags: true,
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
          stage: true,
        },
      },
      pins: {
        select: {
          id: true,
          pinnedById: true,
          pinnedBy: {
            select: { id: true, name: true, displayName: true, image: true },
          },
        },
      },
      parent: {
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
          tags: true,
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
              stage: true,
            },
          },
          locked: {
            select: { id: true, lockedById: true, lockedAt: true },
          },
          parent: { select: { id: true, name: true } },
        },
      },
      locked: {
        select: {
          id: true,
          lockedById: true,
          lockedAt: true,
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
 *
 * @example
 * const favorite = await findFavoriteItem('item_123', 'usr_456');
 * if (favorite) console.log('Already favorited');
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
 *
 * @example
 * await addFavorite('item_123', 'usr_456');
 */
export async function addFavorite(
  itemId: string,
  favoritedById: string,
  client: Prisma.TransactionClient = prisma
) {
  const updated = await client.item.update({
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
  recordFavoriteActivity(itemId, 'favorited')
  return updated
}

/**
 * Marks multiple items as favorited by a user in a single operation.
 * Already-favorited items are skipped, so the call is idempotent.
 *
 * @param itemIds - The IDs of the items to favorite.
 * @param favoritedById - The ID of the user favoriting the items.
 * @param client - Optional transaction client (defaults to the global instance).
 *
 * @example
 * // Favorite a selection of items at once
 * const added = await addFavorites(['item_1', 'item_2'], 'usr_456');
 */
export async function addFavorites(
  itemIds: string[],
  favoritedById: string,
  client: Prisma.TransactionClient = prisma
) {
  if (itemIds.length === 0) return 0

  const existing = await client.favorite.findMany({
    where: { favoritedById, itemId: { in: itemIds } },
    select: { itemId: true },
  })
  const already = new Set(existing.map((f) => f.itemId))
  const toAdd = itemIds.filter((id) => !already.has(id))
  if (toAdd.length === 0) return 0

  await client.favorite.createMany({
    data: toAdd.map((itemId) => ({
      id: toObjectId(getPrefixForModel('Favorite')),
      itemId,
      favoritedById,
    })),
  })

  for (const itemId of toAdd) recordFavoriteActivity(itemId, 'favorited')
  return toAdd.length
}

/**
 * Removes a favorite record for the given user and item.
 * No-ops if the item has not been favorited.
 *
 * @param itemId - The ID of the item to unfavorite.
 * @param favoritedById - The ID of the user removing the favorite.
 * @param client - Optional transaction client (defaults to the global instance).
 *
 * @example
 * await removeFavorite('item_123', 'usr_456');
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
  const updated = await client.item.update({
    where: { id: itemId },
    data: { favorites: { delete: { id: item.id } } },
  })
  recordFavoriteActivity(itemId, 'unfavorited')
  return updated
}

/**
 * Returns all items matching the given Prisma `findMany` arguments.
 * No default select is applied — the caller controls the shape.
 *
 * @param args - Prisma `findMany` arguments.
 *
 * @example
 * // All non-trashed images in a folder
 * const images = await findAllItems({
 *   where: { parentId: 'fld_123', category: 'image', status: 'normal' },
 * });
 */
export async function findAllItems(args: Prisma.ItemFindManyArgs) {
  return prisma.item.findMany(args)
}

/**
 * Returns the first item matching the given Prisma `findFirst` arguments, or `null`.
 *
 * @param args - Prisma `findFirst` arguments.
 *
 * @example
 * // Find a folder by name under a parent
 * const folder = await findFirstItem({
 *   where: { parentId: 'fld_123', name: 'Documents', type: 'folder' },
 * });
 */
export async function findFirstItem(args: Prisma.ItemFindFirstArgs) {
  return prisma.item.findFirst(args)
}

/**
 * Returns the count of items matching the given Prisma `count` arguments.
 *
 * @param args - Prisma `count` arguments.
 *
 * @example
 * // Count non-trashed items in a folder
 * const total = await countItems({
 *   where: { parentId: 'fld_123', status: 'normal' },
 * });
 */
export async function countItems(args: Prisma.ItemCountArgs): Promise<number> {
  return prisma.item.count(args)
}

/**
 * Drive-wide counters for the page toolbar's stat run and storage meter.
 *
 * Five cheap aggregates in one round trip — deliberately *not*
 * `getStorageOverview`, which also runs a category groupBy, a top-10 scan, and
 * a duplicate-detection pass. This one is light enough to sit in a list
 * route's loader on every navigation.
 *
 * @param userId - Owner whose drive is being summarised.
 * @returns Raw counts and BigInt byte totals; format them at the edge with
 *   `formatSize('byte', 'unit', bytes)`.
 *
 * @example
 * const stats = await getLibraryStats(session.user.id)
 * // { folders: 34, files: 1286, favorites: 52, trashed: 19,
 * //   usedBytes: 19783246929n, quotaBytes: 42949672960n }
 */
export async function retrieveUserUsageMetrics(userId: string) {
  const active = { ownerId: userId, status: { not: 'trashed' as const } }

  const [folders, files, favorites, trashed, quota] = await Promise.all([
    prisma.item.count({ where: { ...active, type: 'folder' } }),
    prisma.item.count({ where: { ...active, type: 'file' } }),
    prisma.favorite.count({ where: { favoritedById: userId } }),
    prisma.item.count({ where: { ownerId: userId, status: 'trashed' } }),
    prisma.quota.findFirst({
      where: { drive: { ownerId: userId } },
      select: { used: true, total: true },
    }),
  ])

  return {
    folders,
    files,
    favorites,
    trashed,
    usedBytes: quota?.used ?? 0n,
    quotaBytes: quota?.total ?? 0n,
  }
}

/**
 * Counts scoped to a single folder's direct children, for the toolbar's
 * "in this folder" stat line. The size is the folder's rollup
 * (`inclusiveSize`), which the Postgres triggers keep current — so it covers
 * the whole subtree, not just the direct children counted here.
 *
 * @param folderId - The folder being viewed.
 *
 * @example
 * const scope = await getFolderScopeStats(params.folderId)
 * // { folders: 6, files: 214, sizeBytes: 4080218931n }
 */
export async function retrieveFolderStats(folderId: string) {
  const active = { parentId: folderId, status: { not: 'trashed' as const } }

  const [folders, files, folder] = await Promise.all([
    prisma.item.count({ where: { ...active, type: 'folder' } }),
    prisma.item.count({ where: { ...active, type: 'file' } }),
    prisma.item.findUnique({
      where: { id: folderId },
      select: { inclusiveSize: true },
    }),
  ])

  return { folders, files, sizeBytes: folder?.inclusiveSize ?? 0n }
}

/**
 * Creates the root folder item for a drive.
 * Used during user/workspace provisioning to establish the top-level folder anchor.
 *
 * @param userId - The ID of the user who will own the root folder.
 * @param driveId - The drive the root folder belongs to.
 * @param workspaceId - Optional workspace to associate the root folder with.
 *
 * @example
 * // Provision the root folder for a new user's drive
 * const root = await createRootFolder('usr_123', 'drv_456');
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

/**
 * Resolves a file *name* to its item id within a folder.
 *
 * Relative links inside a Markdown document (`[spec](./upload-multipart.md)`)
 * resolve against the current URL, so they land on the file route with
 * `:fileId` set to `upload-multipart.md` instead of an `item_…` id. The file
 * loader calls this to recover the real id before any id-keyed query runs.
 *
 * Deliberately not permission-scoped — it only maps a name to an id inside a
 * folder the caller already navigated to; `getFileItem` still enforces read
 * permission on whatever comes back.
 *
 * @param folderId - The parent folder to look in.
 * @param name - The file name as it appears in the URL (already decoded).
 * @returns The item id, or `null` when the folder holds no file by that name.
 *
 * @example
 * // '/…/folders/item_abc/files/spec.md' → 'item_def'
 * const id = await findFolderChildIdByName('item_abc', 'spec.md');
 */
export async function getChildIdByName(
  folderId: string,
  name: string
): Promise<string | null> {
  const match = await prisma.item.findFirst({
    where: { parentId: folderId, name },
    select: { id: true },
  })
  return match?.id ?? null
}

/**
 * Fetches a single file item for the file page, including every relation the
 * page renders: owner, parent, facets (image/video/audio/pdf/markdown),
 * favorites, permissions, lock state, collections, thumbnails, and pins.
 * Verifies the requesting user has read permission before querying.
 *
 * @param userId - The ID of the user requesting the file.
 * @param fileId - The ID of the file item to fetch.
 * @param folderId - The ID of the folder the file must belong to (guards against mismatched URLs).
 * @throws {StashlyError} If the user lacks read permission.
 *
 * @example
 * // Load a file for the item page
 * const file = await getFileItem('usr_123', 'item_456', 'fld_789');
 */
export async function getFileItem(
  userId: string,
  fileId: string,
  folderId: string
) {
  const canRead = await hasItemPermission(userId, fileId, 'read')
  if (!canRead) {
    throw new StashlyError(
      StashlyErrorCode.FORBIDDEN,
    )
  }


  const item = await prisma.item.findUnique({
    where: { id: fileId, parentId: folderId },
    include: {
      owner:{
        select:{
          id:true,
          name: true,
          email:true,
          image:true,
          bucket:true
        }
      },
      parent: {
        select: {
          id: true,
          name: true,
          folder: { select: { id: true, childCount: true } },
        },
      },
      favorites: {
        select: {
          favoritedBy: { select: { image: true, name: true, id: true } },
        },
      },
      permissions: {
        select: {
          _count: { select: { users: true } },
          roles: true,
          users: { select: { id: true, image: true, name: true, bucket: true } },
        },
      },
      locked: {
        select: {
          id: true,
          expiresAt: true,
          lockedAt: true,
          lockedById: true,
          lockedBy: { select: { image: true, name: true, id: true } },
        },
      },
      file: {
        select: { id: true, mimeType: true, extension: true, key: true, bucket: true },
      },
      image: true,
      video: true,
      audio: true,
      pdf: true,
      markdown: true,
      memberOfCollections: {
        select: {
          collection: { select: { id: true, name: true } },
        },
      },
      thumbnails: {
        select: {
          url: true,
          size: true,
          stage: true,
          view: true,
          width: true,
          height: true,
        },
      },
      pins: { select: { id: true, pinnedById: true } },
    },
  })

  if (!item) {
    throw new StashlyError(
      StashlyErrorCode.ITEM_NOT_FOUND,
      `File item not found or does not belong to the specified folder`
    )
  }

  return item
}

/**
 * Lists the image/video items sharing a folder, for prev/next navigation on
 * the file page. Ordered by name so the sequence is stable across visits.
 *
 * @param userId - The owner whose items to list (siblings are owner-scoped).
 * @param folderId - The parent folder to list media items from.
 *
 * @example
 * // Build prev/next navigation for the file page
 * const siblings = await getMediaSiblings('usr_123', 'fld_456');
 * const index = siblings.findIndex((s) => s.id === currentFileId);
 */
export async function getMediaSiblings(userId: string, folderId: string) {
  return prisma.item.findMany({
    where: {
      parentId: folderId,
      ownerId: userId,
      category: { in: [ItemCategory.image, ItemCategory.video] },
    },
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  })
}

/**
 * Updates the `openedAt` timestamp of an item to the current time.
 * This is used to track recent activity for features like "Suggested Items".
 *
 * @param itemId - The ID of the item to update.
 *
 * @example
 * // Record that the user opened an item
 * await updateItemOpenedAt('item_123');
 */
export async function updateItemOpenedAt(itemId: string) {
  await prisma.item.update({
    where: { id: itemId },
    data: { openedAt: new Date() },
  })
}

/**
 * Loads a Markdown document's body from S3 and derives its heading outline,
 * server-side. Returns the raw text plus the `#`..`######` outline (slugged
 * with the same algorithm rehype-slug applies to the rendered HTML, so the
 * outline-rail ids line up with the heading element ids).
 *
 * Called (unawaited) from the file loader so the document streams to the client
 * via React Router's deferred data instead of a separate browser → S3 fetch.
 *
 * @param bucket - The S3 bucket containing the object.
 * @param key - The S3 object key of the `.md` file.
 *
 * @example
 * const doc = loadMarkdownDocument(item.file.bucket, item.file.key) // Promise
 * return { ...rest, markdownDoc: doc } // streamed, not awaited
 */
export async function loadMarkdownDocument(
  bucket: string,
  key: string
): Promise<{ text: string; headings: MarkdownHeading[] }> {
  const text = await getObjectText(bucket, key)
  return { text, headings: extractMarkdownHeadings(text) }
}

/**
 * Server-side load of a plain-text/code document body for TextStage. Same
 * deferred-streaming contract as `loadMarkdownDocument`: return it unawaited
 * from the loader so the page shell paints while the body streams.
 */
export async function loadTextDocument(
  bucket: string,
  key: string
): Promise<{ text: string }> {
  return { text: await getObjectText(bucket, key) }
}
