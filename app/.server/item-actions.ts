import { Prisma } from '@/prisma/client'
import { ItemCategory, type ItemType } from '@/prisma/enums'
import { createActivity } from '@/services/activity-actions'
import { prisma } from '@/services/db'
import {
  assertItemAccess,
  assertItemsAccess,
  getItemPermissions,
  hasItemPermission,
  itemAccessSql,
  itemAccessWhere,
} from '@/services/permission-actions'
import {
  ensureUserQuota,
  findQuotaByUserId,
  onItemsCopied,
  onItemsDeleted,
  onItemsRestored,
  onItemsTrashed,
  refuseUploadCharge,
  settlePendingCharges,
} from '@/services/quota-actions'
import { deleteObjects, getObjectText, getPresignedUrl } from '@/services/s3'
import { ensureSizeRollup } from '@/services/size-rollup'
import {
  signThumbnails,
  thumbnailKey,
  type WithSignedThumbnails,
} from '@/services/thumbnail-actions'
import { track } from '@/services/vinktar'
import { log } from '@/services/log'
import {
  requireAtLeastRole,
  requireMembership,
} from '@/services/workspace-actions'
import type { StashItem } from '@/types/stash.types'
import {
  StashlyError,
  StashlyErrorCode,
  toRouteError,
} from '@/utils/api.errors'
import { getPrefixForModel, toChunkArray, toObjectId, toObjectKey } from '@/utils/converters'
import { buildItemFilters } from '@/utils/filters/item.filters'
import { extractMarkdownHeadings, type MarkdownHeading } from '@/utils/markdown'
import { parseFileExtension } from '@/utils/parsers'
import { searchFactory } from '@/utils/search'

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

/** What each batched activity kind needs per item. */
type ActivityItems = {
  delete: Array<{ id: string; name: string; type: ItemType }>
  restore: Array<{ id: string }>
  upload: Array<{ id: string; uploadId: string }>
}

const ACTIVITY_KINDS = {
  delete: {
    model: 'DeleteAction',
    column: Prisma.sql`"deleteActionId"`,
    insert: Prisma.sql`INSERT INTO "DeleteAction" ("id", "name", "itemType")
      SELECT "kindId", "name", "itemType"::"ObjectType" FROM "Input"`,
  },
  restore: {
    model: 'RestoreAction',
    column: Prisma.sql`"restoreActionId"`,
    insert: Prisma.sql`INSERT INTO "RestoreAction" ("id") SELECT "kindId" FROM "Input"`,
  },
  upload: {
    model: 'UploadAction',
    column: Prisma.sql`"uploadActionId"`,
    insert: Prisma.sql`INSERT INTO "UploadAction" ("id", "uploadId")
      SELECT "kindId", "uploadId" FROM "Input"`,
  },
} as const

/**
 * Records a trash (`delete`), `restore` or `upload` activity for every item in
 * one statement, instead of a nested `createActivity` per item (8 round-trips
 * each). The four tables are filled from one `unnest` of ids generated here;
 * the foreign keys between them are checked when the statement ends, so they
 * can all be inserted together.
 *
 * Call it only after the items' own transaction has committed: run from inside
 * it, the insert reads the items on another connection, before they exist.
 * Fire-and-forget like `recordFavoriteActivity`, but a failure is logged
 * rather than swallowed — a silent catch hid lost upload activities.
 *
 * @example
 * recordItemActivities('delete', [{ id: 'item_1', name: 'a.pdf', type: 'file' }])
 * recordItemActivities('upload', [{ id: 'item_1', uploadId: 'up_1' }])
 */
function recordItemActivities<K extends keyof ActivityItems>(
  kind: K,
  items: ActivityItems[K]
) {
  if (items.length === 0) return
  Promise.resolve()
    .then(() => {
      const { model, column, insert } = ACTIVITY_KINDS[kind]
      const rows = items as Array<{
        id: string
        name?: string
        type?: ItemType
        uploadId?: string
      }>
      const newIds = (prefixModel: Parameters<typeof getPrefixForModel>[0]) =>
        rows.map(() => toObjectId(getPrefixForModel(prefixModel)))
      return prisma.$executeRaw`
        WITH "Input" AS (
          SELECT * FROM unnest(
            ${rows.map((i) => i.id)}::text[],
            ${rows.map((i) => i.name ?? null)}::text[],
            ${rows.map((i) => (i.type === undefined ? null : i.type === 'folder' ? 'folder' : 'file'))}::text[],
            ${rows.map((i) => i.uploadId ?? null)}::text[],
            ${newIds('ActivityTime')}::text[],
            ${newIds('Activity')}::text[],
            ${newIds('ItemAction')}::text[],
            ${newIds(model)}::text[]
          ) AS t("itemId", "name", "itemType", "uploadId", "timeId", "activityId", "actionId", "kindId")
        ), "Times" AS (
          -- UTC, like every timestamp Prisma writes: the session time zone is
          -- local and the column has none, so a bare now() stored local time
          -- that Prisma read back as UTC (3 h ahead in Asia/Jerusalem).
          INSERT INTO "ActivityTime" ("id", "observedAt") SELECT "timeId", (now() AT TIME ZONE 'UTC') FROM "Input"
        ), "Activities" AS (
          INSERT INTO "Activity" ("id", "timeId", "itemId")
          SELECT "activityId", "timeId", "itemId" FROM "Input"
        ), "Kinds" AS (
          ${insert}
        )
        INSERT INTO "ItemAction" ("id", "activityId", ${column})
        SELECT "actionId", "activityId", "kindId" FROM "Input"
      `
    })
    .catch((error) =>
      log.error('activities not recorded', { kind, count: items.length, error })
    )
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
    throw toRouteError(StashlyErrorCode.NOT_FOUND, 'Item not found')
  }

  const canRead = await hasItemPermission(userId, itemId, 'read')
  if (!canRead && item.workspaceId) {
    await requireMembership(
      userId,
      item.workspaceId,
      'You do not have access to this item'
    )
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
export async function renameItem(
  itemId: string,
  newName: string,
  userId?: string
) {
  const renamed = await prisma.$transaction(async (tx) => {
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

  track(
    'item_renamed',
    {
      item_id: itemId,
      item_type: renamed.type,
      category: renamed.category,
      workspace_id: renamed.workspaceId ?? null,
      name_length: newName.length,
    },
    { userId: userId ?? renamed.ownerId }
  )

  return renamed
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
      // The folders the items leave are held FOR KEY SHARE until the move
      // commits, with the target: a trash holds its folders FOR UPDATE, so a
      // move arriving during one waits, then reads its items as trashed below
      // and is refused; one that gets here first makes the trash wait, and its
      // walk finds the items in their new folder. Without it a trashed item
      // could be moved into a live folder with no Trash entry, or the two
      // deadlocked on the old folder's size row (item 69). The items are read
      // after the lock, never beside it, so that read sees a trash that just
      // finished.
      // Access first, as createFolder does: answering "in trash" before it told
      // a caller with no access whether the folder was in trash (item 74).
      const canWriteTarget = await hasItemPermission(
        userId,
        targetFolderId,
        'write',
        tx
      )
      if (!canWriteTarget) {
        throw toRouteError(
          StashlyErrorCode.FORBIDDEN,
          'You do not have write access to the target folder'
        )
      }
      const targetFolder = await lockDestinationFolder(tx, targetFolderId, ids)
      const items = await tx.item.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          parentId: true,
          type: true,
          status: true,
          driveId: true,
          owner: { select: { rootId: true } },
        },
      })

      const foundIds = new Set(items.map((i) => i.id))
      for (const id of ids) {
        if (!foundIds.has(id)) {
          throw toRouteError(StashlyErrorCode.NOT_FOUND, `Item ${id} not found`)
        }
      }

      // A folder can go nowhere under itself: the move would close a loop that
      // no walk up the tree ever leaves (item 77). The walk is up from the
      // target, as many rows as it is deep, and only when a folder moves. UNION,
      // not UNION ALL, so a loop already in the data ends the walk.
      const movedFolders = items.filter((i) => i.type === 'folder').map((i) => i.id)
      const aboveTarget = new Set(
        movedFolders.length === 0
          ? []
          : (
              await tx.$queryRaw<{ id: string }[]>`
                WITH RECURSIVE "Up" AS (
                  SELECT "id", "parentId" FROM "Item" WHERE "id" = ${targetFolderId}
                  UNION
                  SELECT i."id", i."parentId" FROM "Item" i JOIN "Up" u ON i."id" = u."parentId"
                )
                SELECT "id" FROM "Up" WHERE "id" IN (${Prisma.join(movedFolders)})`
            ).map((r) => r.id)
      )

      for (const item of items) {
        // A trashed item has no place to go but back: restore puts it there.
        if (item.status === 'trashed') {
          throw toRouteError(
            StashlyErrorCode.NOT_FOUND,
            'One or more items are in trash; restore them before moving them'
          )
        }

        // A drive pays for what is on it, so an item never changes drive. The
        // folder picker only lists the session's drive; this is the rule itself.
        if (item.driveId !== targetFolder.driveId) {
          throw new StashlyError(
            StashlyErrorCode.MOVE_ITEM_FAILED,
            'Items can only be moved within their own drive'
          )
        }

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

        if (aboveTarget.has(item.id)) {
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
          throw toRouteError(
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

  track(
    'items_moved',
    {
      item_count: result.length,
      folder_count: result.filter((item) => item.type === 'folder').length,
      file_count: result.filter((item) => item.type === 'file').length,
      from_folder_id: fromParentId,
      to_folder_id: toParentId,
      workspace_id: result[0]?.workspaceId ?? null,
    },
    { userId }
  )

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
 * Only the items asked for become Trash entries: each gets a `TrashItem` row
 * (in its drive's `Trash`, created on first use). Their descendants get the
 * status alone. That is what keeps a trashed folder one entry in Trash, and
 * what lets a file trashed *before* its folder stay an entry of its own, and
 * stay in Trash when the folder is restored.
 *
 * @param {string[]} ids - An array of item IDs to trash.
 * @param {string} userId - The ID of the user trashing the items (used for quota adjustment).
 *
 * @example
 * await trashItems(['item_1', 'fld_2'], 'usr_456');
 */
/**
 * Holds every folder under `ids` (and the folders among `ids`) FOR UPDATE for
 * the rest of the transaction, before the trash walks the subtree.
 *
 * A statement sees the database as it was when it started, so a trash and an
 * upload into one of its folders could each miss the other: the upload read
 * the folder as live, the walk never saw the new row, and the file stayed live
 * inside a trashed folder. FOR UPDATE is the one row lock that conflicts with
 * the FOR KEY SHARE every insert takes on its parent (`insertUploadedItem`,
 * `resolveFolderTree`), so an upload already running finishes first, and one
 * arriving later waits, then finds its folder trashed and is refused.
 *
 * The walk that follows is a statement of its own, so it sees everything that
 * finished while these locks were waited for. A folder created during that
 * wait is visible only to a later statement, so the lock repeats until it
 * finds no folder it didn't hold: nothing can then be created under a held
 * folder before this transaction ends, so it stops, normally after the
 * second pass. Folders only, found through `parent_type_name_cursor`: files
 * get nothing put inside them.
 */
async function lockSubtreeFolders(tx: Prisma.TransactionClient, ids: string[]) {
  // The ids a pass held, not their count: a folder leaving the tree and one
  // arriving while the first pass waited gave two passes the same count, and a
  // folder made under the arriving one was never held (item 73).
  let held: string | null = null
  for (;;) {
    const [{ folders }] = await tx.$queryRaw<{ folders: string | null }[]>`
      WITH RECURSIVE "Folders" AS (
        SELECT "id" FROM "Item" WHERE "id" IN (${Prisma.join(ids)}) AND "type" = 'folder'
        UNION
        SELECT i."id" FROM "Item" i JOIN "Folders" f ON i."parentId" = f."id"
        WHERE i."type" = 'folder'
      ), "Held" AS (
        -- In id order, as moveItems takes its folders, so the two can't deadlock.
        SELECT i."id" FROM "Item" i WHERE i."id" IN (SELECT "id" FROM "Folders")
        ORDER BY i."id"
        FOR UPDATE
      )
      SELECT string_agg("id", ',' ORDER BY "id") AS "folders" FROM "Held"
    `
    if ((folders ?? '') === held) return
    held = folders ?? ''
  }
}

/**
 * Reads the folder a create, move or copy writes into, FOR KEY SHARE, for the
 * rest of the transaction, and refuses one that is gone, not a folder, or in
 * trash (tech-debt item 67).
 *
 * The other half of `lockSubtreeFolders`, as `insertUploadedItem` is for
 * uploads: a trash holds the folder FOR UPDATE, so this waits for it and
 * re-reads the row, which is then trashed, and nothing is written. A writer
 * that gets here first holds the folder until it commits, so the trash waits
 * and its walk sees what was put inside.
 *
 * `leaving` are the items a move takes out of their folders: those folders are
 * held in the same statement, so a move costs no extra round trip for them.
 * Rows are taken in id order, as `lockSubtreeFolders` takes them, so the two
 * can't deadlock. The type and status are checked on the row the lock returns,
 * which is its latest version once any trash holding it has committed.
 *
 * @throws `ITEM_NOT_FOUND` (404) when no live folder has that id.
 */
async function lockDestinationFolder(
  tx: Prisma.TransactionClient,
  folderId: string,
  leaving: string[] = []
) {
  const rows = await tx.$queryRaw<
    {
      id: string
      name: string
      parentId: string | null
      driveId: string
      workspaceId: string | null
      type: string
      status: string
    }[]
  >`
    SELECT "id", "name", "parentId", "driveId", "workspaceId", "type", "status" FROM "Item"
    WHERE "id" = ${folderId}${
      leaving.length > 0
        ? Prisma.sql` OR "id" IN (SELECT "parentId" FROM "Item" WHERE "id" IN (${Prisma.join(leaving)}))`
        : Prisma.empty
    }
    ORDER BY "id"
    FOR KEY SHARE
  `
  const folder = rows.find(
    (row) => row.id === folderId && row.type === 'folder' && row.status !== 'trashed'
  )
  if (!folder) {
    throw new StashlyError(
      StashlyErrorCode.ITEM_NOT_FOUND,
      'The destination folder no longer exists or is in trash, so nothing was put in it.'
    )
  }
  return folder
}

export async function trashItems(ids: string[], userId: string) {
  if (ids.length === 0) {
    return
  }
  await assertItemsAccess(userId, ids, 'write')

  const changed = await prisma.$transaction(
    async (tx) => {
      await lockSubtreeFolders(tx, ids)
      // One statement walks the subtree, trashes what isn't trashed yet, and
      // sums the bytes of the files it changed. Only files count: a folder's
      // `size` is a trigger rollup of its active contents, so adding it would
      // count those bytes again. Files already in trash moved their bytes
      // earlier, so the `status` guard leaves them out. `UNION` keeps a file
      // reached through two selected items from counting twice.
      const [result] = await tx.$queryRaw<SubtreeChange[]>`
        WITH RECURSIVE "Subtree" AS (
          SELECT "id" FROM "Item" WHERE "id" IN (${Prisma.join(ids)})
          UNION
          SELECT i."id" FROM "Item" i JOIN "Subtree" s ON i."parentId" = s."id"
        ), "Changed" AS (
          -- UTC, like every timestamp Prisma writes: the session time zone is
          -- local (Asia/Jerusalem on dev) and the column has none, so a bare
          -- now() stored local time that Prisma then read back as UTC.
          UPDATE "Item" i SET "status" = 'trashed', "updatedAt" = (now() AT TIME ZONE 'UTC')
          FROM "Subtree" s
          WHERE i."id" = s."id" AND i."status" <> 'trashed'
          RETURNING i."id", i."name", i."type", i."size", i."driveId"
        )
        SELECT COUNT(*) AS "count",
          COALESCE(SUM("size") FILTER (WHERE "type" = 'file'), 0)::bigint AS "bytes",
          ${bytesPerDrive(Prisma.raw(`"Changed"`))},
          json_agg(json_build_object('id', "id", 'name', "name", 'type', "type"))
            FILTER (WHERE "id" IN (${Prisma.join(ids)})) AS "roots"
        FROM "Changed"
      `
      await recordDirectlyTrashed(ids, userId, tx)
      return result
    },
    // A large folder is one long UPDATE; the 5 s default is the interactive
    // timeout, which surfaces as an FK error rather than "expired".
    { timeout: 20_000 }
  )

  // Each file's drive is the one that was charged for it, whoever trashes it.
  for (const { driveId, dataSize } of toDriveBytes(changed)) {
    // A failed settle must not cost the refund: at worst `used` clamps at 0.
    settlePendingCharges(driveId)
      .catch((error) => log.warn('logged quota charges not settled before a refund', { driveId, error }))
      .then(() => onItemsTrashed({ driveId, dataSize }))
      .catch((error) => log.error('quota move after trash failed', { driveId, error }))
  }

  recordItemActivities('delete', changed.roots ?? [])

  track(
    'items_trashed',
    {
      selected_count: ids.length,
      changed_count: Number(changed.count),
      folder_count: (changed.roots ?? []).filter((r) => r.type === 'folder')
        .length,
      bytes: Number(changed.bytes),
    },
    { userId }
  )

  return { count: Number(changed.count) }
}

/**
 * Gives each of `ids` a `TrashItem` row, so Trash lists it as an entry.
 *
 * An id that already has one keeps it, with its original `trashedAt`: trashing
 * an entry again doesn't move it in Trash. An id that was only indirectly
 * trashed (inside a trashed folder) gets one now, and becomes an entry.
 *
 * @param ids - The items the user asked to trash.
 * @param userId - Who trashed them.
 * @param tx - The transaction the status update ran in.
 */
async function recordDirectlyTrashed(
  ids: string[],
  userId: string,
  tx: Prisma.TransactionClient
) {
  const items = await tx.item.findMany({
    where: { id: { in: ids } },
    select: { id: true, driveId: true },
  })
  const trashByDrive = new Map<string, string>()
  for (const driveId of new Set(items.map((i) => i.driveId))) {
    const trash = await tx.trash.upsert({
      where: { driveId },
      create: { id: toObjectId(getPrefixForModel('Trash')), driveId },
      update: {},
      select: { id: true },
    })
    trashByDrive.set(driveId, trash.id)
  }
  await tx.trashItem.createMany({
    data: items.map((item) => ({
      id: toObjectId(getPrefixForModel('TrashItem')),
      itemId: item.id,
      trashId: trashByDrive.get(item.driveId)!,
      trashedById: userId,
    })),
    skipDuplicates: true,
  })
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
 * This restores the items themselves, their descendants (children) except
 * those the user trashed separately before (they stay in Trash), and all
 * their ancestors (parent folders), so a restored item always has a live
 * parent.
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
  await assertItemsAccess(userId, ids, 'write')

  // One statement: the items, their descendants and their ancestors go back to
  // 'normal' (only the rows actually in trash), and the restored files' bytes
  // are summed for the quota. Files only, for the same reason as `trashItems`.
  //
  // Trash entries (`TrashItem` rows) shape it:
  // - "Descendants" stops at a descendant with its own row: the user trashed
  //   it before its folder, so restoring the folder leaves it in Trash.
  // - "Unlisted" deletes the rows of everything restored.
  // - "Orphaned" lists, as entries of their own, the trashed children of a
  //   restored ancestor that are not being restored (restoring a deep file
  //   brings its folders back, and their other trashed contents would
  //   otherwise sit under a live folder with no entry). Their `trashedAt` is
  //   `updatedAt`, set when the folder above them was trashed.
  // All sub-statements read the same snapshot, so the CTEs decide from the
  // pre-restore rows and from `Changed`, never from each other's writes.
  const [changed] = await prisma.$queryRaw<SubtreeChange[]>`
    WITH RECURSIVE "Descendants" AS (
      SELECT "id" FROM "Item" WHERE "id" IN (${Prisma.join(ids)})
      UNION
      SELECT i."id" FROM "Item" i JOIN "Descendants" d ON i."parentId" = d."id"
      WHERE NOT EXISTS (SELECT 1 FROM "TrashItem" t WHERE t."itemId" = i."id")
    ), "Ancestors" AS (
      SELECT "id", "parentId" FROM "Item" WHERE "id" IN (${Prisma.join(ids)})
      UNION
      SELECT i."id", i."parentId" FROM "Item" i JOIN "Ancestors" a ON a."parentId" = i."id"
    ), "Related" AS (
      SELECT "id" FROM "Descendants"
      UNION
      SELECT "id" FROM "Ancestors"
    ), "Changed" AS (
      -- UTC, for the reason given in trashItems.
      UPDATE "Item" i SET "status" = 'normal', "updatedAt" = (now() AT TIME ZONE 'UTC')
      FROM "Related" r
      WHERE i."id" = r."id" AND i."status" = 'trashed'
      RETURNING i."id", i."name", i."type", i."size", i."driveId"
    ), "Unlisted" AS (
      DELETE FROM "TrashItem" t USING "Changed" c
      WHERE t."itemId" = c."id"
      RETURNING t."itemId"
    ), "Orphaned" AS (
      INSERT INTO "TrashItem" ("id", "itemId", "trashId", "trashedAt")
      SELECT 'ti_' || substr(md5(random()::text || k."id"), 1, 22), k."id", tr."id", k."updatedAt"
      FROM (
        -- GROUP BY and an array, never a join with "Changed": once autovacuum
        -- has analysed the table with nothing in trash, the planner expects no
        -- trashed rows, and a nested loop compared 5,000 files 12.5 million
        -- times. No plan of this form can do that.
        SELECT s."id", max(s."driveId") AS "driveId", max(s."updatedAt") AS "updatedAt"
        FROM (
          SELECT i."id", i."driveId", i."updatedAt", false AS "restored"
          FROM "Item" i
          WHERE i."status" = 'trashed'
            AND i."parentId" = ANY (ARRAY(SELECT "id" FROM "Changed" WHERE "type" = 'folder'))
          UNION ALL
          SELECT "id", NULL, NULL::timestamp, true FROM "Changed"
        ) s
        GROUP BY s."id"
        HAVING NOT bool_or(s."restored")
      ) k
      JOIN "Trash" tr ON tr."driveId" = k."driveId"
      WHERE NOT EXISTS (SELECT 1 FROM "TrashItem" x WHERE x."itemId" = k."id")
      RETURNING "itemId"
    )
    SELECT COUNT(*) AS "count",
      COALESCE(SUM("size") FILTER (WHERE "type" = 'file'), 0)::bigint AS "bytes",
      ${bytesPerDrive(Prisma.raw(`"Changed"`))},
      json_agg(json_build_object('id', "id", 'name', "name", 'type', "type"))
        FILTER (WHERE "id" IN (${Prisma.join(ids)})) AS "roots"
    FROM "Changed"
  `

  for (const { driveId, dataSize } of toDriveBytes(changed)) {
    onItemsRestored({ driveId, dataSize }).catch((error) =>
      log.error('quota move after restore failed', { driveId, error })
    )
  }

  recordItemActivities('restore', changed.roots ?? [])

  track(
    'items_restored',
    {
      selected_count: ids.length,
      changed_count: Number(changed.count),
      folder_count: (changed.roots ?? []).filter((r) => r.type === 'folder')
        .length,
      bytes: Number(changed.bytes),
    },
    { userId }
  )

  return { count: Number(changed.count) }
}

/** What a trash, restore or delete statement changed, in one row. */
type SubtreeChange = {
  count: bigint
  /** Bytes of the files that changed status: what the quota moves. */
  bytes: bigint
  /** The same bytes per drive, as text: JSON has no BigInt. Null when none. */
  drives: Array<{ driveId: string; bytes: string }> | null
  /** The requested items among the changed rows; null when none changed. */
  roots: Array<{ id: string; name: string; type: ItemType }> | null
}

/**
 * A `"drives"` select column for a statement's changed rows: the files' bytes per
 * drive, for a subquery in the same statement. `changed` is a CTE with `"size"`,
 * `"type"` and `"driveId"`, narrowed by `filter`.
 */
function bytesPerDrive(changed: Prisma.Sql, filter: Prisma.Sql = Prisma.empty) {
  return Prisma.sql`(
    SELECT json_agg(json_build_object('driveId', d."driveId", 'bytes', d."bytes"::text))
    FROM (
      SELECT "driveId", SUM("size") AS "bytes" FROM ${changed}
      WHERE "type" = 'file' ${filter}
      GROUP BY "driveId" HAVING SUM("size") > 0
    ) d
  ) AS "drives"`
}

function toDriveBytes({ drives }: Pick<SubtreeChange, 'drives'>) {
  return (drives ?? []).map(({ driveId, bytes }) => ({ driveId, dataSize: BigInt(bytes) }))
}

/**
 * Deletes the stored objects of items whose rows are already gone. Runs after
 * the database delete, never before: if S3 fails here the objects are merely
 * orphans (scripts/sweep-s3-orphans.ts removes them), whereas the reverse
 * order could leave live items pointing at missing bytes. A failure is logged
 * loudly and does not fail the request — the delete the user asked for did
 * happen.
 */
async function removeStoredObjects(objects: Map<string, string[]>) {
  for (const [bucket, keys] of objects) {
    const { failed } = await deleteObjects(bucket, keys)
    if (failed.length > 0) {
      // The orphan sweep removes them.
      log.error('S3 objects left behind after a delete', {
        bucket,
        failed_count: failed.length,
        object_count: keys.length,
        keys: failed,
      })
    }
  }
}

/**
 * Permanently deletes items from trash, with everything beneath them, their
 * stored objects (file bytes and thumbnails) and their share of the quota.
 * **Deleted items can't be restored.**
 *
 * Needs `owner` access to every item, and every item must be in trash: one
 * that isn't refuses the whole batch with a 400 and deletes nothing.
 *
 * One statement reads the subtree's S3 keys, deletes the rows and sums the
 * bytes. Every part of a statement sees the rows as they were before it ran,
 * so the keys are read before the cascade removes `File` and `Thumbnail`.
 */
async function deleteFromTrash(ids: string[], userId: string) {
  // Permanent delete can't be undone, so `owner`; `write` is not enough.
  await assertItemsAccess(userId, ids, 'owner')

  const [result] = await prisma.$queryRaw<
    Array<
      SubtreeChange & {
        blocked: boolean
        objects: Array<{
          bucket: string
          key: string | null
          itemId: string | null
        }> | null
      }
    >
  >`
    WITH RECURSIVE "Subtree" AS (
      SELECT "id" FROM "Item" WHERE "id" IN (${Prisma.join(ids)})
      UNION
      SELECT i."id" FROM "Item" i JOIN "Subtree" s ON i."parentId" = s."id"
    ), "Blocked" AS (
      SELECT 1 FROM "Item"
      WHERE "id" IN (${Prisma.join(ids)}) AND "status" <> 'trashed'
      LIMIT 1
    ), "Objects" AS (
      -- A copy points at its original's object instead of duplicating it, so
      -- an object goes only with the last row that names it.
      SELECT f."bucket", f."key", NULL::text AS "itemId"
      FROM "File" f JOIN "Subtree" s ON f."itemId" = s."id"
      WHERE NOT EXISTS (
        SELECT 1 FROM "File" o
        WHERE o."bucket" = f."bucket" AND o."key" = f."key"
          AND o."itemId" NOT IN (SELECT "id" FROM "Subtree")
      )
      UNION
      SELECT t."bucket", NULL::text, t."itemId"
      FROM "Thumbnail" t JOIN "Subtree" s ON t."itemId" = s."id"
      WHERE t."bucket" IS NOT NULL
    ), "Deleted" AS (
      DELETE FROM "Item" i USING "Subtree" s
      WHERE i."id" = s."id" AND NOT EXISTS (SELECT 1 FROM "Blocked")
      RETURNING i."id", i."name", i."type", i."size", i."status", i."driveId"
    )
    SELECT
      EXISTS (SELECT 1 FROM "Blocked") AS "blocked",
      ${bytesPerDrive(Prisma.raw(`"Deleted"`), Prisma.sql`AND "status" = 'trashed'`)},
      (SELECT COUNT(*) FROM "Deleted") AS "count",
      (SELECT COALESCE(SUM("size") FILTER (WHERE "type" = 'file' AND "status" = 'trashed'), 0)::bigint
         FROM "Deleted") AS "bytes",
      (SELECT json_agg(json_build_object('id', "id", 'name', "name", 'type', "type"))
         FROM "Deleted" WHERE "id" IN (${Prisma.join(ids)})) AS "roots",
      (SELECT json_agg(json_build_object('bucket', "bucket", 'key', "key", 'itemId', "itemId"))
         FROM "Objects" WHERE NOT EXISTS (SELECT 1 FROM "Blocked")) AS "objects"
  `

  if (result.blocked) {
    throw toRouteError(
      StashlyErrorCode.INVALID_INPUT,
      'Only items in trash can be deleted permanently'
    )
  }

  const objects = new Map<string, string[]>()
  for (const o of result.objects ?? []) {
    const key = o.key ?? thumbnailKey(o.itemId!)
    objects.set(o.bucket, [...(objects.get(o.bucket) ?? []), key])
  }
  await removeStoredObjects(objects)

  // Bytes in trash are counted in `deleted`, so that is what goes down.
  for (const { driveId, dataSize } of toDriveBytes(result)) {
    onItemsDeleted({ driveId, dataSize }).catch((error) =>
      log.error('quota move after delete failed', { driveId, error })
    )
  }

  track(
    'items_deleted',
    {
      selected_count: ids.length,
      deleted_count: Number(result.count),
      bytes_freed: Number(result.bytes),
      object_count: [...objects.values()].reduce((n, keys) => n + keys.length, 0),
    },
    { userId }
  )

  return { count: Number(result.count), roots: result.roots ?? [] }
}

/**
 * Permanently deletes one item from trash, with everything beneath it.
 * See `deleteFromTrash`.
 *
 * @example
 * await deleteItem('item_123', 'usr_456')
 */
export async function deleteItem(id: string, userId: string) {
  const { roots } = await deleteFromTrash([id], userId)
  return roots[0]
}

/**
 * Permanently deletes items from trash, with everything beneath them.
 * See `deleteFromTrash`.
 *
 * @example
 * await deleteItems(['item_abc', 'item_xyz'], 'usr_456')
 */
export async function deleteItems(ids: string[], userId: string) {
  if (ids.length === 0) {
    return
  }
  const { count } = await deleteFromTrash(ids, userId)
  return { count }
}

// --- 4. COPY (Recursive) ---
/**
 * Copies an item (a file, or a folder with its live contents) into a folder.
 *
 * A copy shares its original's bytes: the `File` row is copied with its key, and
 * a permanent delete keeps an object any other `File` row still names. The
 * copier still pays for it, so the copy sits on the copier's own drive, which
 * is checked and charged (a refund follows `Item.driveId`, so the two must be
 * the same drive). The copier owns every copied item, with an owner grant like
 * an upload's, so a file someone shared with them can be copied and then opened.
 * Contents in trash are left out, which is also what the folder's `size`, the
 * amount charged, counts.
 *
 * The destination is held FOR KEY SHARE until the copy commits
 * (`lockDestinationFolder`), so a folder in trash, or being trashed, is refused.
 *
 * @param userId - The user copying, who needs `read` on the source and `write` on the destination.
 * @param itemId - The item to copy.
 * @param targetParentId - The folder to copy into.
 * @throws `ITEM_NOT_FOUND` (404) for a source or destination that is gone or in trash;
 *   `FORBIDDEN` (403) without `write` on the destination; `COPY_ITEM_FAILED` when the
 *   destination is on another drive; `INSUFFICIENT_QUOTA` when the copy doesn't fit.
 *
 * @example
 * const copiedItem = await copyItem('usr_1', 'item_123', 'fld_456');
 */
export async function copyItem(
  userId: string,
  itemId: string,
  targetParentId: string | undefined | null
) {
  if (!itemId) {
    throw new StashlyError(StashlyErrorCode.COPY_ITEM_FAILED, 'itemId is required')
  }
  if (!targetParentId) {
    throw new StashlyError(StashlyErrorCode.COPY_ITEM_FAILED, 'targetParentId is required')
  }

  const { copied, source, bytes } = await prisma.$transaction(async (tx) => {
    const source = await tx.item.findFirst({
      where: { id: itemId, status: { not: 'trashed' } },
      include: { ...copyFacets, parent: { select: { name: true } } },
    })
    if (!source) {
      throw new StashlyError(StashlyErrorCode.ITEM_NOT_FOUND, 'The item to copy no longer exists or is in trash.')
    }
    if (!(await hasItemPermission(userId, itemId, 'read', tx))) {
      throw toRouteError(StashlyErrorCode.UNAUTHORIZED, 'You do not have access to this item')
    }

    // Access before the trash check, so a caller with no access can't tell
    // whether the folder is in trash (item 74).
    if (!(await hasItemPermission(userId, targetParentId, 'write', tx))) {
      throw toRouteError(StashlyErrorCode.FORBIDDEN, 'You do not have write access to the target folder')
    }
    const target = await lockDestinationFolder(tx, targetParentId)
    // `recursiveCopy` lists a folder's contents after making its copy, so a copy
    // into the folder or anywhere under it would find that copy among them and
    // copy it again, until the transaction timed out. The walk is up from the
    // destination: as many rows as it is deep.
    if (source.type === 'folder') {
      const [{ inside }] = await tx.$queryRaw<{ inside: boolean }[]>`
        WITH RECURSIVE "Up" AS (
          SELECT "id", "parentId" FROM "Item" WHERE "id" = ${target.id}
          UNION ALL
          SELECT i."id", i."parentId" FROM "Item" i JOIN "Up" u ON i."id" = u."parentId"
        )
        SELECT EXISTS (SELECT 1 FROM "Up" WHERE "id" = ${source.id}) AS "inside"`
      if (inside) {
        throw toRouteError(
          StashlyErrorCode.INVALID_INPUT,
          'A folder cannot be copied into itself or one of its subfolders.'
        )
      }
    }

    // The copy belongs where it lands: the destination folder's workspace, or
    // none in a personal folder. It once kept the source's, so a copy out of a
    // workspace into a personal folder stayed in the workspace (item 75).
    if (source.workspaceId) {
      await requireMembership(userId, source.workspaceId, 'You do not have access to this item')
    }
    if (target.workspaceId && target.workspaceId !== source.workspaceId) {
      await requireAtLeastRole(
        userId,
        target.workspaceId,
        'member',
        'You must be a member of the target workspace to copy items.'
      )
    }

    const userQuota = await ensureUserQuota(userId, tx)
    if (userQuota.driveId !== target.driveId) {
      throw new StashlyError(
        StashlyErrorCode.COPY_ITEM_FAILED,
        'A copy goes into your own drive, which pays for it.'
      )
    }
    const { item: copied, bytes } = await recursiveCopy(tx, source, target.id, {
      ownerId: userId,
      driveId: target.driveId,
      workspaceId: target.workspaceId,
    })
    // The bytes of the files actually copied, never the source folder's `size`:
    // that is a trigger rollup, which trails its contents while the database is
    // busy (it charged 143 bytes for a 150-byte copy in a full test run).
    // The charge checks the free space in its own UPDATE, never against a figure
    // read earlier, so two copies can't both pass on the same free space. A
    // refusal (507) rolls the whole copy back.
    await onItemsCopied({ userId, dataSize: bytes, client: tx })
    return { copied: { ...copied, parentName: target.name }, source, bytes }
  })

  // After the commit, so a copy refused for quota or access is never counted,
  // and the activity's own write can't fail inside the copy's transaction.
  createActivity({
    item: { connect: { id: copied.id } },
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
            fromParentId: source.parentId ?? '',
            fromParentName: source.parent?.name ?? '',
            toParentId: targetParentId,
            toParentName: copied.parentName,
          },
        },
      },
    },
  }).catch((error) => log.error('copy activity failed', { item_id: copied.id, error }))

  track(
    'item_copied',
    {
      source_item_id: itemId,
      item_type: copied.type,
      size_bytes: Number(bytes),
      target_folder_id: targetParentId,
      workspace_id: copied.workspaceId ?? null,
      cross_workspace: copied.workspaceId !== source.workspaceId,
    },
    { userId }
  )

  return copied
}

// --- 5. CREATE FOLDER ---

/**
 * Creates a new folder item along with its associated folder facet and default view settings.
 *
 * @param {string} folderName - The display name of the new folder.
 * @param {string | null} parentId - The ID of the parent folder, or null if creating in the root.
 * @param {string} ownerId - The ID of the user who will own the folder.
 * @param {string} driveId - The ID of the drive (tenant scope) where the folder resides.
 * @throws `FORBIDDEN` (403) without `write` on `parentId`, the same rule as an upload into it.
 * @example
 * const newFolder = await createFolder('My Documents', 'item_root123', 'usr_456', 'drv_789');
 */
export async function createFolder(
  folderName: string,
  parentId: string | null,
  ownerId: string,
  driveId: string // Tenant scope, for a folder with no parent
) {
  if (parentId) await assertItemAccess(ownerId, parentId, { role: 'write' })

  const folder = await prisma.$transaction(async (tx) => {
    // A folder sits on its parent's drive, whoever makes it: that drive pays for
    // what is uploaded into it. The parent is held until the create commits, so
    // a trash of it can't miss the new folder (item 67).
    const parent = parentId ? await lockDestinationFolder(tx, parentId) : null
    return tx.item.create({
      data: {
        id: toObjectId(getPrefixForModel('Item')),
        name: folderName,
        parentId: parentId,
        driveId: parent?.driveId ?? driveId,
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

  track(
    'folder_created',
    {
      folder_id: folder.id,
      parent_id: parentId,
      drive_id: driveId,
      at_root: parentId === null,
      name_length: folderName.length,
    },
    { userId: ownerId }
  )

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

/** Room for a big tree, or for a wait on another batch of the same uploader. */
const FOLDER_TREE_TX = { timeout: 60_000, maxWait: 10_000 }

/**
 * Distinct folders one request may resolve. Past it the batch is refused (400)
 * and its files resolve their own paths one by one, as a single file does. The
 * schemas already cap each path at S3's 1,024-character key, so this bounds
 * the work: a request of 20,000 paths each 512 folders deep would otherwise
 * build millions of prefixes before the first query.
 */
const MAX_UPLOAD_FOLDERS = 20_000

/**
 * Resolves the folders of an upload under its root in one go: finds the ones
 * that exist, creates the rest, and answers each directory's folder id.
 *
 * `dirs` are paths relative to `rootId` (`photos/2026`), in any order; every
 * prefix of each is resolved too. One query per depth level while the parents
 * still exist (below a new folder everything is new), then one statement that
 * inserts every missing folder with its `Folder` and `View` rows, whatever the
 * batch size. It replaces a walk that every file repeated: an advisory lock and
 * a lookup per level, in a transaction of its own, so a 639-file directory sent
 * 11,600 statements and took 1,824 locks.
 *
 * It never guesses, the rules the walk applied: a trashed folder doesn't match,
 * and two live folders with the same name refuse every path through them
 * (`refused`), even when only one of the copies continues the path. Only
 * folders the uploader owns match.
 *
 * Takes one advisory lock per uploader for the caller's transaction, so two
 * batches can't both create the same folder. It is released on commit, before
 * any file row is written. Per uploader, not per root: two uploads into nested
 * destinations (`a` and `a/b`) can create the same folder under different roots.
 *
 * @example
 * const tree = await prisma.$transaction((tx) => resolveFolderTree(tx, rootId, userId, ['photos/2026']))
 * tree.folders.get('photos/2026') // → 'item_…'
 */
async function resolveFolderTree(
  tx: Prisma.TransactionClient,
  rootId: string,
  ownerId: string,
  dirs: string[]
): Promise<{ folders: Map<string, string>; refused: Map<string, string>; createdFolderIds: string[] }> {
  // Every prefix is kept, so a path still costs about its length squared in
  // characters; the limits bound that: paths of at most 1,024 characters
  // (the schemas) and MAX_UPLOAD_FOLDERS. Unbounded, one 32 KB key blocked the
  // event loop for 2.4 s (31 Oct); at the limits a refusal takes 75 ms and a
  // 1,024-character key 2 ms. Extending the previous prefix, rather than
  // re-joining the parts per depth, also cut that 32 KB case to 0.6 s.
  const levels: Set<string>[] = []
  let folderCount = 0
  for (const dir of dirs) {
    let prefix = ''
    for (const [depth, part] of dir.split('/').filter(Boolean).entries()) {
      prefix = prefix ? `${prefix}/${part}` : part
      const level = (levels[depth] ??= new Set())
      if (level.has(prefix)) continue
      level.add(prefix)
      if (++folderCount > MAX_UPLOAD_FOLDERS) {
        throw new StashlyError(
          StashlyErrorCode.INVALID_INPUT,
          `An upload can resolve at most ${MAX_UPLOAD_FOLDERS.toLocaleString('en')} folders at once.`
        )
      }
    }
  }

  // `$executeRaw`, not `$queryRaw`: pg_advisory_xact_lock returns `void`,
  // which $queryRaw can't deserialize as a result column.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`folder-tree:${ownerId}`}, 0))`
  // The root and the folders found below are held FOR KEY SHARE until the
  // transaction commits, as `insertUploadedItem` holds its folder, but only
  // once the tree is known, all in one statement in id order (below). Taken a
  // level at a time, the tree held the root and waited for a subfolder while a
  // trash of the root, which takes its folders in id order, held the subfolder
  // and waited for the root: a deadlock (item 72).
  const [root] = await tx.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "Item"
    WHERE "id" = ${rootId} AND "type" = 'folder' AND "status" <> 'trashed'
  `
  if (!root) {
    throw new StashlyError(
      StashlyErrorCode.ITEM_NOT_FOUND,
      'The folder this upload went into no longer exists, so nothing was filed.'
    )
  }
  const parentOf = (path: string) => path.slice(0, Math.max(0, path.lastIndexOf('/')))
  const nameOf = (path: string) => path.slice(path.lastIndexOf('/') + 1)

  const folders = new Map<string, string>([['', rootId]])
  const created = new Set<string>()
  const refused = new Map<string, string>()
  const missing: { id: string; name: string; parentId: string; folderId: string; viewId: string }[] = []

  for (const level of levels) {
    const paths = [...level]
    for (const path of paths) {
      const reason = refused.get(parentOf(path))
      if (reason) refused.set(path, reason)
    }
    const open = paths.filter((path) => folders.has(parentOf(path)))
    // Only a folder that already existed can have children that exist.
    const lookup = open.filter((path) => !created.has(parentOf(path)))
    const found = new Map<string, string[]>()
    if (lookup.length > 0) {
      const rows = await tx.$queryRaw<{ id: string; parentId: string; name: string }[]>`
        SELECT i."id", i."parentId", i."name"
        FROM "Item" i
        JOIN unnest(
          ${lookup.map((path) => folders.get(parentOf(path))!)}::text[],
          ${lookup.map(nameOf)}::text[]
        ) AS wanted("parentId", "name")
          ON i."parentId" = wanted."parentId" AND i."name" = wanted."name"
        WHERE i."type" = 'folder' AND i."status" <> 'trashed' AND i."ownerId" = ${ownerId}
      `
      for (const row of rows) {
        const key = `${row.parentId}/${row.name}`
        found.set(key, [...(found.get(key) ?? []), row.id])
      }
    }
    for (const path of open) {
      const parentId = folders.get(parentOf(path))!
      const matches = found.get(`${parentId}/${nameOf(path)}`) ?? []
      if (matches.length > 1) {
        // Uploading from inside the intended folder is always unambiguous,
        // which is what the message tells the user to do.
        refused.set(
          path,
          `More than one folder is named "${nameOf(path)}" at "${path}", so this file was not filed. Open the folder you mean and upload there.`
        )
      } else if (matches.length === 1) {
        folders.set(path, matches[0])
      } else {
        const id = toObjectId(getPrefixForModel('Item'))
        folders.set(path, id)
        created.add(path)
        missing.push({
          id,
          name: nameOf(path),
          parentId,
          folderId: toObjectId(getPrefixForModel('Folder')),
          viewId: toObjectId(getPrefixForModel('View')),
        })
      }
    }
  }

  // Hold the root and every folder found, in id order as trash takes them, and
  // read each row again: a trash that ran since the lookups (or holds one of
  // them now, which this waits for) leaves it trashed, and nothing is filed.
  const held = [...new Set([...folders].filter(([path]) => !created.has(path)).map(([, id]) => id))]
  const live = await tx.$queryRaw<{ id: string; status: string }[]>`
    SELECT "id", "status" FROM "Item"
    WHERE "id" IN (${Prisma.join(held)})
    ORDER BY "id"
    FOR KEY SHARE
  `
  if (live.length !== held.length || live.some((row) => row.status === 'trashed')) {
    throw new StashlyError(
      StashlyErrorCode.ITEM_NOT_FOUND,
      live.some((row) => row.id === rootId && row.status === 'trashed')
        ? 'The folder this upload went into no longer exists, so nothing was filed.'
        : 'A folder on this upload’s path was moved to trash while it was being resolved, so nothing was filed.'
    )
  }

  if (missing.length > 0) {
    // A child can be inserted in the same statement as its parent: foreign
    // keys and the size/child-count triggers run at the end of the statement,
    // when both rows exist. A JS Date, not `now()`: the columns are `timestamp
    // without time zone` and `now()` would store the session's local time.
    const now = new Date()
    // On the root's drive, whoever uploads: that drive pays for these folders.
    const { driveId } = await tx.item.findUniqueOrThrow({
      where: { id: rootId },
      select: { driveId: true },
    })
    await tx.$executeRaw`
      WITH items AS (
        INSERT INTO "Item" ("id", "name", "parentId", "driveId", "ownerId", "type", "category", "status", "createdAt", "updatedAt")
        SELECT f."id", f."name", f."parentId", ${driveId}, ${ownerId},
               'folder'::"ItemType", 'unknown'::"ItemCategory", 'normal'::"ItemStatus", ${now}, ${now}
        FROM unnest(
          ${missing.map((f) => f.id)}::text[],
          ${missing.map((f) => f.name)}::text[],
          ${missing.map((f) => f.parentId)}::text[]
        ) AS f("id", "name", "parentId")
      ), folders AS (
        INSERT INTO "Folder" ("id", "itemId")
        SELECT f."folderId", f."itemId"
        FROM unnest(
          ${missing.map((f) => f.folderId)}::text[],
          ${missing.map((f) => f.id)}::text[]
        ) AS f("folderId", "itemId")
      )
      INSERT INTO "View" ("id", "viewType", "sortBy", "sortOrder", "folderId", "createdAt", "updatedAt")
      SELECT v."id", 'grid'::"ViewType", 'type'::"SortBy", 'ascending'::"SortOrder", v."folderId", ${now}, ${now}
      FROM unnest(
        ${missing.map((f) => f.viewId)}::text[],
        ${missing.map((f) => f.folderId)}::text[]
      ) AS v("id", "folderId")
    `
  }

  folders.delete('')
  return { folders, refused, createdFolderIds: missing.map((f) => f.id) }
}

/**
 * Resolves every folder of a folder upload before its files start, so each file
 * is filed straight into its folder (`createUploadedItem` with that folder as
 * `parentId`) instead of resolving its path again. Needs write access to the
 * root, the check each file of the batch would make. Records an upload activity
 * for each folder it creates.
 *
 * @param input.dirs - Directory paths relative to `rootId`, `/`-separated.
 * @returns `folders`: path → folder id for every directory and each of its
 * prefixes. `refused`: path → reason, for paths through two live folders of the
 * same name; their files are left to `createUploadedItem`, which refuses them.
 * @throws `FORBIDDEN` (403) without write access to `rootId`.
 *
 * @example
 * const { folders } = await resolveUploadFolders({ userId, rootId, dirs: ['photos/2026', 'docs'] })
 * folders['photos/2026'] // → 'item_…'
 */
export async function resolveUploadFolders({
  userId,
  rootId,
  dirs,
}: {
  userId: string
  rootId: string
  dirs: string[]
}) {
  await assertItemsAccess(userId, [rootId], 'write')
  const tree = await prisma.$transaction(
    (tx) => resolveFolderTree(tx, rootId, userId, dirs),
    FOLDER_TREE_TX
  )
  recordItemActivities(
    'upload',
    tree.createdFolderIds.map((id) => ({ id, uploadId: '' }))
  )
  track(
    'upload_folders_resolved',
    {
      root_id: rootId,
      dir_count: dirs.length,
      created_count: tree.createdFolderIds.length,
      refused_count: tree.refused.size,
      max_depth: Math.max(0, ...dirs.map((d) => d.split('/').length)),
    },
    { userId }
  )
  return {
    folders: Object.fromEntries(tree.folders),
    refused: Object.fromEntries(tree.refused),
    createdFolderIds: tree.createdFolderIds,
  }
}

/**
 * Creates or updates the Image facet for an item with extracted image metadata
 * (dimensions, DPI, bit depth, and EXIF camera/exposure/GPS fields).
 * Only the provided fields are written; other existing values are preserved.
 * One statement (`INSERT … ON CONFLICT` on the unique `itemId`), so two
 * saves for the same item can't collide.
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
  return prisma.image.upsert({
    where: { itemId },
    update: data,
    create: { id: toObjectId(getPrefixForModel('Image')), itemId, ...data },
  })
}

/**
 * Creates or updates the Video facet for an item with extracted video metadata.
 * Only the provided fields are written; other existing values are preserved.
 * One statement (`INSERT … ON CONFLICT` on the unique `itemId`), so two
 * saves for the same item can't collide.
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
  return prisma.video.upsert({
    where: { itemId },
    update: data,
    create: { id: toObjectId(getPrefixForModel('Video')), itemId, ...data },
  })
}

/**
 * Creates or updates the Audio facet for an item with extracted audio metadata
 * (duration, bitrate, and ID3 tag fields such as title/artist/album).
 * Only the provided fields are written; other existing values are preserved.
 * One statement (`INSERT … ON CONFLICT` on the unique `itemId`), so two
 * saves for the same item can't collide.
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
  return prisma.audio.upsert({
    where: { itemId },
    update: data,
    create: { id: toObjectId(getPrefixForModel('Audio')), itemId, ...data },
  })
}

/**
 * Creates or updates the Pdf facet for an item with extracted document
 * metadata (page count, document info fields, and feature flags such as
 * form fields or signatures).
 * Only the provided fields are written; other existing values are preserved.
 * One statement (`INSERT … ON CONFLICT` on the unique `itemId`), so two
 * saves for the same item can't collide.
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
  return prisma.pdf.upsert({
    where: { itemId },
    update: data,
    create: { id: toObjectId(getPrefixForModel('Pdf')), itemId, ...data },
  })
}

/**
 * Creates or updates the Markdown facet for an item with extracted document
 * statistics (word count, headings, links, code blocks) and frontmatter fields.
 * Only the provided fields are written; other existing values are preserved.
 * One statement (`INSERT … ON CONFLICT` on the unique `itemId`), so two
 * saves for the same item can't collide.
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
  return prisma.markdown.upsert({
    where: { itemId },
    update: data,
    create: { id: toObjectId(getPrefixForModel('Markdown')), itemId, ...data },
  })
}

/**
 * Creates the database record for a freshly uploaded file, in its folder, with
 * the File facet and an owner permission, and charges the owner's quota for
 * `size`: the only place an upload is charged. Records upload activity for the
 * item and any folders created for it.
 *
 * The row, facet, permission and charge are one statement (`insertUploadedItem`),
 * so they commit together or not at all.
 *
 * The folder is either
 * - `parentId`, when it differs from the key's first segment: a folder upload
 *   resolved its folders up front (`resolveUploadFolders`) and names the file's
 *   own. That is the client's word, so it gets the check any destination gets:
 *   write access here, and a live folder when the row is inserted; or
 * - the upload path: the first segment is the root and the middle segments
 *   are folders, resolved like a batch of one (`resolveFolderTree`). Single
 *   files, and any upload that didn't resolve first, take this way.
 *
 * The key must be the upload's own (`toObjectKey(uploadPath, id)`): a key
 * another row serves would put two rows on one object, and a later upload to
 * it would change both. Anything else is refused with 400.
 *
 * `ownerId` is the signed-in uploader (the route passes the session user, never
 * the form's value), and they need `write` access to the destination. Without
 * that check any signed-in user could file items into anyone's folder by
 * naming it.
 *
 * @param data - Upload result payload: item ID/name, S3 `key`/`bucket`/`etag`, the `uploadPath`, `size`, `mimeType`, owner/parent IDs, the `uploadId`, and an optional `category`. The drive is the folder's.
 * @throws `INVALID_INPUT` (400) when the key is not `toObjectKey(uploadPath, id)`.
 * @throws `FORBIDDEN` (403) without write access to the destination.
 * @throws `CONFLICT` (409) when two live folders share a name on the upload path.
 * @throws `ITEM_NOT_FOUND` (404) when the folder is no longer a live folder; nothing is written or charged.
 * @throws `INSUFFICIENT_QUOTA` (507) when the file doesn't fit the free quota of the folder's drive; nothing is written.
 *
 * @example
 * // Create the item record after a completed S3 upload
 * const item = await createUploadedItem({
 *   id: 'item_123',
 *   name: 'report.pdf',
 *   key: 'item_root/item_123/report.pdf',
 *   uploadPath: 'item_root/documents/report.pdf',
 *   size: 1024n,
 *   mimeType: 'application/pdf',
 *   bucket: 'stashly-bucket',
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
  uploadPath: string
  size: bigint
  mimeType?: string
  etag?: string
  /** Client-computed content hash (see `app/workers/hash.worker.ts`). */
  hash?: string
  bucket: string
  parentId: string
  ownerId: string
  uploadId: string
  category?: string
}) {
  // Under load the file's size and charge reach their rows through the upload
  // logs; make sure this process applies them.
  ensureSizeRollup()
  if (data.key !== toObjectKey(data.uploadPath, data.id)) {
    throw new StashlyError(
      StashlyErrorCode.INVALID_INPUT,
      "The upload's storage key does not match its item"
    )
  }
  const segments = data.uploadPath.split('/')
  const rootId = segments[0]
  const path = segments.slice(1, -1).join('/')
  let parentId = rootId
  let createdFolderIds: string[] = []

  if (data.parentId && data.parentId !== rootId) {
    await assertItemsAccess(data.ownerId, [data.parentId], 'write')
    parentId = data.parentId
  } else {
    await assertCanUploadTo(data.ownerId, data.uploadPath)
    if (path) {
      // Its own transaction, committed before the file's statement, so the
      // tree lock is never held while a file row is written.
      const tree = await prisma.$transaction(
        (tx) => resolveFolderTree(tx, rootId, data.ownerId, [path]),
        FOLDER_TREE_TX
      )
      const refusal = tree.refused.get(path)
      if (refusal) throw new StashlyError(StashlyErrorCode.CONFLICT, refusal)
      parentId = tree.folders.get(path)!
      createdFolderIds = tree.createdFolderIds
    }
  }

  const result = await insertUploadedItem({ ...data, parentId })
  if (!result) return refuseUploadedItem(data.ownerId, parentId, data.size)

  // After the statement has committed, never inside it: an activity started
  // inside the file's transaction looked the item up on another connection
  // before the commit and failed with P2025 under upload load (376 of 575
  // files in one directory upload had no activity).
  recordItemActivities('upload', [
    { id: result.id, uploadId: result.uploadId ?? '' },
    ...createdFolderIds.map((id) => ({ id, uploadId: data.uploadId })),
  ])

  // After the commit, so a refused or rolled-back upload is never counted.
  track(
    'file_uploaded',
    {
      size_bytes: Number(data.size),
      mime_type: data.mimeType,
      category: data.category,
      extension: parseFileExtension(data.name).toLowerCase(),
      drive_id: result.driveId,
      parent_id: parentId,
      created_folder_count: createdFolderIds.length,
    },
    { userId: data.ownerId }
  )

  return result
}

/**
 * Writes an uploaded file's `Item`, `File`, `Permission` and owner link, and
 * charges its size to the folder's drive, as ONE statement. The drive pays for
 * what is on it, so a collaborator's upload charges the folder's owner, and the
 * row takes that drive: its refunds follow it.
 *
 * Each step reads from the one before: the charge only runs while the parent
 * is a live folder, and the rows are inserted only when it says yes. A file
 * that doesn't fit, a missing or trashed parent, or no quota leaves the rest
 * with no input row, so nothing is written or charged and it answers `null`.
 * `stashly_charge_upload()` keeps the limit strict; while the database is busy
 * it logs the charge rather than writing the shared `Quota` row (migration
 * `20261106120000_upload_quota_log`).
 * One statement is atomic on its own, so there is no transaction around it:
 * Prisma's nested create took 9 round trips for the same rows (BEGIN, the
 * inserts, a user lookup, a read-back, the charge, COMMIT).
 */
async function insertUploadedItem(data: {
  id: string
  name: string
  key: string
  uploadPath: string
  size: bigint
  mimeType?: string
  etag?: string
  hash?: string
  bucket: string
  parentId: string
  ownerId: string
  uploadId: string
  category?: string
}) {
  // A JS Date, not `now()`: the columns are `timestamp without time zone` and
  // `now()` would store the session's local time while Prisma writes UTC.
  const now = new Date()
  const rows = await prisma.$queryRaw<
    {
      id: string
      name: string
      size: bigint
      parentId: string
      uploadId: string | null
      driveId: string
    }[]
  >`
    WITH parent AS (
      -- FOR KEY SHARE, the lock the parentId foreign key takes anyway, taken
      -- here so the status check can't go stale: a trash holds its folders
      -- FOR UPDATE (lockSubtreeFolders), so this waits for it and re-reads
      -- the row, which is then trashed, and nothing is written. Size and child
      -- count updates don't conflict with it, so concurrent uploads into one
      -- folder don't queue on it.
      SELECT "id", "driveId" FROM "Item"
      WHERE "id" = ${data.parentId} AND "type" = 'folder' AND "status" <> 'trashed'
      FOR KEY SHARE
    ), charge AS (
      SELECT stashly_charge_upload(parent."driveId", ${data.size}::bigint) AS "ok" FROM parent
    ), item AS (
      INSERT INTO "Item" ("id", "name", "type", "category", "status", "ownerId", "driveId", "parentId", "size", "uploadId", "createdAt", "updatedAt")
      SELECT ${data.id}, ${data.name}, 'file'::"ItemType", ${data.category ?? 'unknown'}::"ItemCategory", 'normal'::"ItemStatus",
             ${data.ownerId}, parent."driveId", parent."id", ${data.size}::bigint, ${data.uploadId}, ${now}, ${now}
      FROM parent, charge
      WHERE charge."ok"
      RETURNING "id", "name", "size", "parentId", "uploadId", "driveId"
    ), file AS (
      INSERT INTO "File" ("id", "bucket", "key", "uploadPath", "mimeType", "etag", "hash", "extension", "itemId")
      SELECT ${toObjectId(getPrefixForModel('File'))}, ${data.bucket}, ${data.key}, ${data.uploadPath}, ${data.mimeType ?? null}, ${data.etag ?? null},
             ${data.hash || null}, ${data.name.split('.').pop() ?? ''}, item."id"
      FROM item
    ), permission AS (
      INSERT INTO "Permission" ("id", "roles", "itemId", "createdAt", "updatedAt")
      SELECT ${toObjectId(getPrefixForModel('Permission'))}, 'owner'::"PermissionRole", item."id", ${now}, ${now}
      FROM item
      RETURNING "id"
    ), link AS (
      INSERT INTO "_PermissionToUser" ("A", "B")
      SELECT permission."id", ${data.ownerId} FROM permission
    )
    SELECT * FROM item
  `
  return rows[0] ?? null
}

/**
 * Throws why `insertUploadedItem` wrote nothing: the folder is no longer a live
 * folder (404), or the file doesn't fit or there is no quota. Only called after
 * a refusal, so a successful upload never pays for it.
 */
async function refuseUploadedItem(userId: string, parentId: string, size: bigint): Promise<never> {
  const parent = await prisma.item.findUnique({
    where: { id: parentId },
    select: { type: true, status: true, driveId: true },
  })
  if (!parent || parent.type !== 'folder' || parent.status === 'trashed') {
    throw new StashlyError(
      StashlyErrorCode.ITEM_NOT_FOUND,
      'The folder this file was uploaded into no longer exists, so it was not filed.'
    )
  }
  return refuseUploadCharge(parent.driveId, userId, size)
}

/**
 * Refuses an upload into a folder the user can't write to. The folder is the
 * key's first segment, the destination root every upload key starts with.
 *
 * Called at every step that commits something: creating the multipart upload
 * (before any bytes move), completing it (before S3 assembles an object) and
 * filing the row. A revoke mid-batch therefore stops the next file before its
 * bytes are sent, rather than after.
 *
 * @param userId - The signed-in uploader.
 * @param key - The object key, `<rootFolderId>/<path>/<name>`.
 * @throws `FORBIDDEN` (403) without `write` on the root folder (owner, a
 *   `write` grant on a shared folder, or workspace membership plus a grant).
 *
 * @example
 * await assertCanUploadTo(user.id, 'item_root/photos/a.jpg')
 */
export async function assertCanUploadTo(userId: string, key: string) {
  await assertItemsAccess(userId, [key.split('/')[0]], 'write')
}

/** `User.bucket`'s schema default (`prisma/models/user.prisma`): not a real bucket. */
const PLACEHOLDER_BUCKET = 'default-bucket'

/**
 * Refuses an upload onto a key a `File` row already serves.
 *
 * Keys come from the file's path (`<root>/<path>/<name>`), so a second upload
 * under the same name lands on the object a filed row serves. Completing it
 * swapped the bytes behind that row while its size and the uploader's quota
 * kept the old number: a 1-byte file could be grown to any size for free, and
 * an honest re-upload silently replaced the older item's content. A trashed
 * row counts too: its bytes are what a restore brings back.
 *
 * Runs at `create-multipart-upload`, before any bytes move, and again at
 * `complete-multipart-upload`, which aborts on refusal.
 *
 * @param bucket - The session user's bucket, the one every upload call uses.
 * @throws `CONFLICT` (409) when a row serves the key.
 *
 * @example
 * await assertKeyUnfiled(user.bucket, 'item_root/report.pdf')
 */
export async function assertKeyUnfiled(bucket: string, key: string) {
  const filed = await prisma.file.findFirst({ where: { bucket, key }, select: { id: true } })
  if (filed) {
    throw new StashlyError(
      StashlyErrorCode.CONFLICT,
      "This upload's storage key is already in use"
    )
  }
}

/** What `discardUploadedObject` did with the object it was asked to remove. */
export type DiscardVerdict = 'deleted' | 'referenced' | 'no-bucket' | 'failed'

/**
 * Deletes the bytes of an upload whose item row could not be created.
 *
 * The bytes reach S3 before the row exists, and nothing retries the row, so a
 * refused upload's object would otherwise sit in the bucket, unbilled and
 * unseen, until someone ran the orphan sweep by hand. The key comes from the
 * request, so the delete is guarded twice:
 *
 * - it only ever looks in the **user's own bucket**, read from their row, never
 *   from the request. Every S3 call of an upload (`/api/s3/upload`) uses that
 *   bucket, so this is where the bytes are, and no request can reach someone
 *   else's objects;
 * - no `File` row may point at the object, the same test the sweep uses to
 *   call an object an orphan (`classifyObject` in `@/utils/s3-orphans`).
 *
 * It deliberately does **not** require access to the destination folder: a
 * revoke mid-upload is exactly when a row is refused, and checking the folder
 * kept those bytes for good.
 *
 * Never throws: it runs while a refusal is already being answered, and the
 * original error is the one the user needs to see. A failed delete is logged
 * loudly, and the orphan sweep is the backstop for it.
 *
 * @param userId - The signed-in uploader.
 * @param key - The object key, `<rootFolderId>/<path>/<name>`.
 * @returns What happened: `deleted`, `referenced` (kept, a row uses it),
 *   `no-bucket` (kept, the user has no bucket) or `failed` (nothing deleted:
 *   S3 or the database refused).
 *
 * @example
 * // In the route, after `createUploadedItem` threw
 * await discardUploadedObject(user.id, key) // → 'deleted'
 */
export async function discardUploadedObject(
  userId: string,
  key: string
): Promise<DiscardVerdict> {
  let bucket: string | null | undefined
  let references: number
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { bucket: true },
    })
    bucket = user?.bucket
    // `default-bucket` is the column's schema default, a placeholder shared by
    // every user onboarding never gave a real bucket. It proves nothing about
    // whose object this is, so it counts as no bucket.
    if (!bucket || bucket === PLACEHOLDER_BUCKET) return 'no-bucket'
    references = await prisma.file.count({ where: { bucket, key } })
  } catch (e) {
    log.error('could not check whether a refused upload is referenced; kept it', {
      key,
      error: e,
    })
    return 'failed'
  }
  if (references > 0) return 'referenced'

  // `deleteObjects` never throws: failures come back in `failed`.
  const { failed } = await deleteObjects(bucket, [key])
  if (failed.length > 0) {
    // The orphan sweep removes them.
    log.error('bytes of a refused upload left behind', { bucket, keys: failed })
    return 'failed'
  }
  return 'deleted'
}

export async function getFolder(
  folderId: string,
  userId: string,
  workspaceId?: string,
  client: Prisma.TransactionClient = prisma
) {
  // personal branch: if the folder is personal, we only check for item permission.
  if (!workspaceId) {
    try {
      await assertItemAccess(userId, folderId, { tx: client })

      const folder = await client.item.findUniqueOrThrow({
        where: { id: folderId },
        include: {
          folder: true,
          parent: true,
          activities: {
            include: {
              time: true,
              action: true,
            },
            orderBy: {
              time: {
                observedAt: 'desc',
              },
            },
            take: 50,
          },
        },
      })

      await updateItemOpenedAt(folderId)
      return folder
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw toRouteError(
            StashlyErrorCode.ITEM_NOT_FOUND,
            `Folder with ID ${folderId} not found.`
          )
        }
      }
      throw error
    }
  } else {
    // workspace branch: if the folder is in a workspace, we check for both item permission and membership.
    await assertItemAccess(userId, folderId, {
      workspaceId,
      role: 'read',
      tx: client,
    })

    const folder = await client.item.findUniqueOrThrow({
      where: { id: folderId },
      include: {
        folder: true,
        parent: true,
        activities: {
          include: {
            time: true,
            action: true,
          },
          orderBy: {
            time: {
              observedAt: 'desc',
            },
          },
          take: 50,
        },
      },
    })

    await updateItemOpenedAt(folderId)
    return folder
  }
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
  /**
   * The user making the request. Required: this function decides access, and
   * it cannot do that without knowing who is asking.
   */
  userId: string
  /**
   * Set when the folder is being reached through a workspace URL. Adds a
   * membership requirement on top of the item permission check.
   */
  workspaceId?: string
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
    Prisma.ItemOrderByWithRelationInput | Prisma.ItemOrderByWithRelationInput[]
}

/**
 * The fields a folder listing returns per item: what `<ItemCard>`,
 * `FileCardDetail` and `FolderCardTab` render, `parent` included as the full
 * `StashAncestor`. Shared by `getFolderContent` and `getCardItems`, so a row an
 * upload hands the page is exactly the row the next load of the folder returns.
 */
const folderCardSelect = {
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
      bucket: true,
      color: true,
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
          bucket: true,
          color: true,
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
} satisfies Prisma.ItemSelect

/**
 * The listing rows of the caller's own items, signed like `getFolderContent`'s.
 * An upload answers with these (tech-debt item 45), so the page inserts the new
 * rows instead of reloading the whole folder.
 *
 * Only the caller's own items: an upload creates its rows as the uploader, and
 * nothing here checks folder access, so another user's ids return nothing.
 *
 * @param userId - The caller; only items they own are returned.
 * @param ids - The items to read. Missing or foreign ids are left out.
 * @returns The rows, in no particular order.
 *
 * @example
 * const [card] = await getCardItems(user.id, [item.id])
 */
export async function getCardItems(userId: string, ids: string[]) {
  if (ids.length === 0) return []
  const items = await prisma.item.findMany({
    where: { id: { in: ids }, ownerId: userId },
    select: folderCardSelect,
  })
  return signThumbnails(items)
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
    userId,
    workspaceId,
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

  // --- 1b. Authorization ---
  //
  // This is the only layer that sees both the caller and the folder, so the
  // check belongs here rather than in each route loader. Before this existed
  // the query ran on `parentId` alone: any signed-in user who knew a folder id
  // could list its children.
  //
  // `parentId` may legitimately be an object filter (e.g. `{ in: [...] }`);
  // only a plain id identifies a single folder to authorize against.
  const parentId = where.parentId
  if (typeof parentId !== 'string') {
    throw new Error(
      'getFolderContent requires a single "parentId" string to authorize against.'
    )
  }
  await assertItemAccess(userId, parentId, { workspaceId })

  // --- 2. Build Order By Clause Based on Indexes and Sort Options ---

  const orderBy: Prisma.ItemOrderByWithRelationInput[] = []

  // Folders First Logic (group by type)
  if (foldersFirst) {
    orderBy.push({ type: 'asc' }) // the ItemType enum is declared folder, file, collection, and Postgres orders by that
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
      select: folderCardSelect,
    })

    // --- 4. Compute Pagination Metadata ---

    const hasMore = items.length > limit
    const data = await signThumbnails(items.slice(0, limit))
    const nextCursor = hasMore ? (items[items.length - 1]?.id ?? null) : null

    return {
      items: data,
      nextCursor,
      hasMore,
    }
  } catch (error) {
    if (error instanceof StashlyError) {
      log.error('folder content query failed', {
        error,
        where,
        order_by: orderBy,
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
    Prisma.ItemOrderByWithRelationInput | Prisma.ItemOrderByWithRelationInput[]
  cursor?: string | null
  take?: number
  include?: TInclude
}): Promise<{
  items: TInclude extends undefined
    ? WithSignedThumbnails<Prisma.ItemGetPayload<Prisma.ItemDefaultArgs>>[]
    : WithSignedThumbnails<Prisma.ItemGetPayload<{ include: TInclude }>>[]
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
  let data = await signThumbnails(items.slice(0, take))
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
      ? WithSignedThumbnails<Prisma.ItemGetPayload<Prisma.ItemDefaultArgs>>[]
      : WithSignedThumbnails<Prisma.ItemGetPayload<{ include: TInclude }>>[]
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
    Prisma.ItemOrderByWithRelationInput | Prisma.ItemOrderByWithRelationInput[]

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
      orderBy.push({ type: 'asc' }) // enum order: folder, file, collection
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
  const data = await signThumbnails(items.slice(0, limit))
  const nextCursor = hasMore ? (items[items.length - 1]?.id ?? null) : null

  return {
    items: data,
    nextCursor,
    hasMore,
  } as {
    items: TInclude extends undefined
      ? WithSignedThumbnails<Prisma.ItemGetPayload<Prisma.ItemDefaultArgs>>[]
      : WithSignedThumbnails<Prisma.ItemGetPayload<{ include: TInclude }>>[]
    nextCursor: string | null
    hasMore?: boolean
  }
}

// --- HELPER: Recursive Copy Logic ---

/** The facets a copy carries over: each is copied as a new row of its own. */
const copyFacets = {
  file: true,
  folder: true,
  image: true,
  video: true,
  audio: true,
  pdf: true,
  markdown: true,
} as const satisfies Prisma.ItemInclude

type CopySource = Prisma.ItemGetPayload<{ include: typeof copyFacets }>

/** A facet's fields for a nested create: a new id, and no `itemId` (the nesting sets it). */
function copiedFacet<T extends { id: string; itemId: string }>(
  facet: T | null,
  model: Parameters<typeof getPrefixForModel>[0]
) {
  if (!facet) return undefined
  const { id: _id, itemId: _itemId, ...fields } = facet
  return { create: { ...fields, id: toObjectId(getPrefixForModel(model)) } }
}

/**
 * Copies `sourceItem` under `parentId`, then its live contents, in `tx`.
 *
 * Only the source's own fields are copied: the copy belongs to `copy.ownerId`
 * (with an owner grant, as an upload has) on `copy.driveId`. A folder starts
 * empty, with size and counts 0: the triggers add each copied child as it
 * arrives, so copying the source's totals would count them twice. Contents in
 * trash are skipped. A folder gets the default view `createFolder` gives one.
 *
 * @param tx - The copy's transaction.
 * @param sourceItem - The item to copy, with its facets (`copyFacets`).
 * @param parentId - The folder the copy goes into.
 * @param copy - Who owns the copy, which drive it is on, and its workspace.
 *
 * @example
 * await recursiveCopy(tx, source, 'fld_target123', { ownerId, driveId, workspaceId: null })
 */
async function recursiveCopy(
  tx: Prisma.TransactionClient,
  sourceItem: CopySource,
  parentId: string,
  copy: { ownerId: string; driveId: string; workspaceId: string | null }
) {
  const newItem = await tx.item.create({
    data: {
      id: toObjectId(getPrefixForModel('Item')),
      name: sourceItem.name,
      type: sourceItem.type,
      category: sourceItem.category,
      status: 'normal',
      tags: sourceItem.tags,
      size: sourceItem.type === 'folder' ? 0n : sourceItem.size,
      parentId,
      ownerId: copy.ownerId,
      driveId: copy.driveId,
      workspaceId: copy.workspaceId,
      permissions: {
        create: {
          id: toObjectId(getPrefixForModel('Permission')),
          roles: 'owner',
          users: { connect: { id: copy.ownerId } },
        },
      },
      file: copiedFacet(sourceItem.file, 'File'),
      image: copiedFacet(sourceItem.image, 'Image'),
      video: copiedFacet(sourceItem.video, 'Video'),
      audio: copiedFacet(sourceItem.audio, 'Audio'),
      pdf: copiedFacet(sourceItem.pdf, 'Pdf'),
      markdown: copiedFacet(sourceItem.markdown, 'Markdown'),
      ...(sourceItem.type === 'folder'
        ? {
            folder: {
              create: {
                id: toObjectId(getPrefixForModel('Folder')),
                view: {
                  create: { viewType: 'grid', sortBy: 'type', sortOrder: 'ascending' },
                },
              },
            },
          }
        : {}),
    },
  })

  let bytes = sourceItem.type === 'folder' ? 0n : sourceItem.size
  if (sourceItem.type === 'folder') {
    const children = await tx.item.findMany({
      where: { parentId: sourceItem.id, status: { not: 'trashed' } },
      include: copyFacets,
    })
    for (const child of children) {
      bytes += (await recursiveCopy(tx, child, newItem.id, copy)).bytes
    }
  }

  return { item: newItem, bytes }
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
 * Fetches suggested folders and files: the user's own items they opened or
 * edited, and items shared with them by a live grant, most recent first. An
 * item that was only created (a fresh upload) is never suggested: it has no
 * `openedAt`, its `updatedAt` equals its `createdAt`, and the owner's own
 * Permission row its upload writes doesn't count as a share. "Edited" is
 * `updatedAt` more than 5 s after `createdAt`, so a rename, move or restore
 * counts too: nothing records content edits separately. Related rows
 * (file, folder, favorites, thumbnails, pins) are aggregated into JSON.
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

  // Changed after it was created, by more than the upload itself takes.
  const edited = Prisma.sql`i."updatedAt" > i."createdAt" + interval '5 seconds'`

  const buildQuery = (type: 'file' | 'folder', limit: number) => Prisma.sql`
    WITH grants AS (
      -- Shared with this user: someone else's item a grant links them to, still
      -- readable by the app's own rule (live, unexpired, workspace member).
      -- The owner's own Permission row, which every upload writes stamped with
      -- the upload's time, never counts.
      SELECT p."itemId", MAX(p."createdAt") AS "sharedAt"
      FROM "Permission" p
      JOIN "_PermissionToUser" pu ON pu."A" = p.id AND pu."B" = ${userId}
      JOIN "Item" gi ON gi.id = p."itemId" AND gi."ownerId" <> ${userId}
      WHERE p."deletedAt" IS NULL
        AND ${itemAccessSql(userId, 'read', Prisma.raw('gi'))}
      GROUP BY p."itemId"
    ), candidates AS (
      -- Own items that were opened or edited. A fresh upload has no openedAt
      -- and updatedAt = createdAt, so it stays out until someone uses it.
      SELECT i.id FROM "Item" i
      WHERE i."ownerId" = ${userId}
        AND i."driveId" = ${driveId}
        AND (i."openedAt" IS NOT NULL OR ${edited})
      UNION
      SELECT "itemId" FROM grants
    )
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
            'bucket', t.bucket,
            'color', t.color,
            'stage', t.stage,
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
    LEFT JOIN grants g ON g."itemId" = i.id
    LEFT JOIN "LockedItem" li ON i.id = li."itemId"
    LEFT JOIN "Item" parent ON i."parentId" = parent.id
    WHERE
      i.id IN (SELECT id FROM candidates)
      AND i.type::text = ${type}
      AND i.name != 'root'
      AND i.status = 'normal'
      ${workspaceId ? Prisma.sql`AND i."workspaceId" = ${workspaceId}` : Prisma.empty}
    GROUP BY i.id, f.id, fo.id, li.id, parent.id, parent.name, g."sharedAt"
    ORDER BY
      GREATEST(
        i."openedAt",
        CASE WHEN ${edited} THEN i."updatedAt" END,
        g."sharedAt"
      ) DESC NULLS LAST
    LIMIT ${limit}
  `

  try {
    const [folders, files] = await Promise.all([
      prisma.$queryRaw<ItemRow[]>(buildQuery('folder', maxFolders)),
      prisma.$queryRaw<ItemRow[]>(buildQuery('file', maxFiles)),
    ])

    // Raw SQL bypasses every Prisma-level hook, so the aggregated thumbnail
    // JSON is signed here like any other read.
    return await signThumbnails({
      suggestedFiles: files as any,
      suggestedFolders: folders as any,
    })
  } catch (error) {
    log.error('suggested items query failed', { error })
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
    throw toRouteError(
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
export async function findItem(
  args: Prisma.ItemFindUniqueArgs,
  client: Prisma.TransactionClient = prisma
) {
  return client.item.findUniqueOrThrow({
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
export async function createItem(
  args: Prisma.ItemCreateArgs,
  client: Prisma.TransactionClient = prisma
) {
  return client.item.create({
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
export async function createManyItems(
  args: Prisma.ItemCreateManyArgs,
  client: Prisma.TransactionClient = prisma
) {
  return client.item.createMany(args)
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
      log.debug('creating item batch', {
        batch: i + 1,
        batch_count: chunks.length,
        item_count: batch.length,
      })
      const createdBatch = await prisma.$transaction(
        batch.map((item) =>
          prisma.item.create({
            data: item,
          })
        )
      )
      createdItems.push(...createdBatch)
    } catch (e) {
      log.error('item batch failed', { batch: i + 1, error: e })
      if (e instanceof Prisma.PrismaClientKnownRequestError) {
        // If batch creation fails (e.g. due to unique constraint, relation constraint, timeout constraint), try creating items individually to isolate the error
        log.info('retrying item batch one item at a time', { batch: i + 1 })
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
          log.error('item batch failed one item at a time', {
            batch: i + 1,
            error: err,
          })
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
export async function updateItem(
  args: Prisma.ItemUpdateArgs,
  client: Prisma.TransactionClient = prisma
) {
  return client.item.update({
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
export async function findWorkspaceItems(
  workspaceId: string,
  client: Prisma.TransactionClient = prisma
) {
  return client.item.findMany({
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
export async function findFavoritesForUser(
  userId: string,
  client: Prisma.TransactionClient = prisma
) {
  return client.item.findMany({
    where: {
      ownerId: userId,
      favorites: { some: { favoritedById: userId } },
    },
  })
}

/** What each favorite carries: the full `ItemCard` shape, parent included. */
export const favoriteItemSelect = {
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
      favoritedBy: { select: { id: true, name: true, displayName: true, image: true } },
    },
  },
  thumbnails: {
    select: { height: true, width: true, bucket: true, color: true, view: true, size: true, id: true, stage: true },
  },
  pins: {
    select: {
      id: true,
      pinnedById: true,
      pinnedBy: { select: { id: true, name: true, displayName: true, image: true } },
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
          favoritedBy: { select: { id: true, name: true, displayName: true, image: true } },
        },
      },
      thumbnails: {
        select: { height: true, width: true, bucket: true, color: true, view: true, size: true, id: true, stage: true },
      },
      locked: { select: { id: true, lockedById: true, lockedAt: true } },
      parent: { select: { id: true, name: true } },
    },
  },
  locked: { select: { id: true, lockedById: true, lockedAt: true } },
  permissions: {
    select: {
      id: true,
      roles: true,
      linkId: true,
      recipientId: true,
      users: { select: { displayName: true, email: true, id: true, image: true, name: true } },
    },
  },
} satisfies Prisma.ItemSelect

type FavoriteItem = Prisma.ItemGetPayload<{ select: typeof favoriteItemSelect }>

/** Epoch milliseconds: nested `timestamp` columns must not reach JSON as local-time strings. */
const epochMs = (column: Prisma.Sql) => Prisma.sql`floor(extract(epoch FROM ${column}) * 1000)::bigint`

/** JSON fields for an item's file, folder, favorites, thumbnails and lock, arrays ordered by id. */
const cardRelationsSql = (item: Prisma.Sql) => Prisma.sql`
  'file', (SELECT to_jsonb(f) FROM "File" f WHERE f."itemId" = ${item}."id"),
  'folder', (SELECT to_jsonb(fo) FROM "Folder" fo WHERE fo."itemId" = ${item}."id"),
  'favorites', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', fav."id",
      'favoritedBy', jsonb_build_object('id', u."id", 'name', u."name", 'displayName', u."displayName", 'image', u."image")
    ) ORDER BY fav."id")
    FROM "Favorite" fav JOIN "user" u ON u."id" = fav."favoritedById"
    WHERE fav."itemId" = ${item}."id"
  ), '[]'::jsonb),
  'thumbnails', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'height', t."height", 'width', t."width", 'bucket', t."bucket", 'color', t."color",
      'view', t."view", 'size', t."size", 'id', t."id", 'stage', t."stage"
    ) ORDER BY t."id")
    FROM "Thumbnail" t WHERE t."itemId" = ${item}."id"
  ), '[]'::jsonb),
  'locked', (
    SELECT jsonb_build_object('id', l."id", 'lockedById', l."lockedById", 'lockedAt', ${epochMs(Prisma.sql`l."lockedAt"`)})
    FROM "LockedItem" l WHERE l."itemId" = ${item}."id"
  )`

type LockedJson = { id: string; lockedById: string; lockedAt: number } | null
const toLocked = (l: LockedJson) => (l ? { ...l, lockedAt: new Date(l.lockedAt) } : null)

type CardJson = Pick<FavoriteItem, 'file' | 'folder' | 'favorites' | 'thumbnails'> & { locked: LockedJson }
type ParentJson = Omit<NonNullable<FavoriteItem['parent']>, 'size' | 'inclusiveSize' | 'createdAt' | 'updatedAt' | 'locked'> & {
  size: string
  inclusiveSize: string
  createdAt: number
  updatedAt: number
  locked: LockedJson
}
type FavoriteRow = Omit<FavoriteItem, keyof CardJson | 'parent'> & { card: CardJson; parent: ParentJson | null }

/**
 * Returns a paginated list of items favorited by the given user,
 * with all relations required by ItemCard.
 *
 * One statement that filters first: `page` picks the favorited items the user
 * can still read, in page order, and only those rows are joined to build the
 * card. The Prisma `findMany` this replaces ran every relation join for every
 * item the user could read before keeping the favorites: 4,463 rows and
 * 165-200 ms for 1 favorite (31 Oct). Same result, ordering and cursor
 * semantics (the page starts at the cursor row); `favorite-actions.test.ts`
 * checks it against that query.
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
export async function getFavoritedItems(
  {
    userId,
    cursor,
    limit = 50,
  }: {
    userId: string
    cursor?: string
    limit?: number
  },
  client: Prisma.TransactionClient = prisma
) {
  // A missing cursor item yields an empty page, as Prisma's cursor does.
  const atCursor = cursor
    ? Prisma.sql`AND EXISTS (
        SELECT 1 FROM "Item" c WHERE c."id" = ${cursor}
          AND (i."createdAt" < c."createdAt" OR (i."createdAt" = c."createdAt" AND i."id" >= c."id"))
      )`
    : Prisma.empty

  const rows = await client.$queryRaw<FavoriteRow[]>`
    WITH page AS (
      SELECT i.* FROM "Item" i
      WHERE EXISTS (SELECT 1 FROM "Favorite" fv WHERE fv."itemId" = i."id" AND fv."favoritedById" = ${userId})
        AND ${itemAccessSql(userId, 'read')}
        ${atCursor}
      ORDER BY i."createdAt" DESC, i."id" ASC
      LIMIT ${limit + 1}
    )
    SELECT
      i."id", i."name", i."type"::text AS "type", i."size", i."inclusiveSize",
      i."category"::text AS "category", i."status"::text AS "status",
      i."createdAt", i."updatedAt", i."ownerId", i."parentId", i."workspaceId", i."driveId",
      COALESCE(i."tags", '{}') AS "tags", -- Prisma reads a NULL list as []
      jsonb_build_object(${cardRelationsSql(Prisma.raw('i'))}) AS "card",
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', pin."id", 'pinnedById', pin."pinnedById",
          'pinnedBy', jsonb_build_object('id', u."id", 'name', u."name", 'displayName', u."displayName", 'image', u."image")
        ) ORDER BY pin."id")
        FROM "PinItem" pin JOIN "user" u ON u."id" = pin."pinnedById"
        WHERE pin."itemId" = i."id"
      ), '[]'::jsonb) AS "pins",
      (
        SELECT jsonb_build_object(
          'id', p."id", 'name', p."name", 'type', p."type", 'size', p."size"::text,
          'inclusiveSize', p."inclusiveSize"::text, 'category', p."category", 'status', p."status",
          'createdAt', ${epochMs(Prisma.sql`p."createdAt"`)}, 'updatedAt', ${epochMs(Prisma.sql`p."updatedAt"`)},
          'ownerId', p."ownerId", 'parentId', p."parentId", 'workspaceId', p."workspaceId",
          'driveId', p."driveId", 'tags', COALESCE(p."tags", '{}'),
          ${cardRelationsSql(Prisma.raw('p'))},
          'parent', (SELECT jsonb_build_object('id', gp."id", 'name', gp."name") FROM "Item" gp WHERE gp."id" = p."parentId")
        )
        FROM "Item" p WHERE p."id" = i."parentId"
      ) AS "parent",
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', perm."id", 'roles', perm."roles", 'linkId', perm."linkId", 'recipientId', perm."recipientId",
          'users', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
              'displayName', u."displayName", 'email', u."email", 'id', u."id", 'image', u."image", 'name', u."name"
            ) ORDER BY u."id")
            FROM "_PermissionToUser" pu JOIN "user" u ON u."id" = pu."B"
            WHERE pu."A" = perm."id"
          ), '[]'::jsonb)
        ) ORDER BY perm."id")
        FROM "Permission" perm WHERE perm."itemId" = i."id"
      ), '[]'::jsonb) AS "permissions"
    FROM page i
    ORDER BY i."createdAt" DESC, i."id" ASC
  `

  const items: FavoriteItem[] = rows.map(({ card, parent, ...item }) => ({
    ...item,
    ...card,
    locked: toLocked(card.locked),
    parent: parent && {
      ...parent,
      size: BigInt(parent.size),
      inclusiveSize: BigInt(parent.inclusiveSize),
      createdAt: new Date(parent.createdAt),
      updatedAt: new Date(parent.updatedAt),
      locked: toLocked(parent.locked),
    },
  }))

  const hasMore = items.length > limit
  const data = await signThumbnails(items.slice(0, limit))
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
export async function findFavoriteItem(
  itemId: string,
  favoritedById: string,
  client: Prisma.TransactionClient = prisma
) {
  return client.item.findFirst({
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
  // Only an item the user can read. Without this, anyone holding an item id
  // could favorite someone else's file and then read its name, size and
  // thumbnail off their own Favorites page.
  await assertItemAccess(favoritedById, itemId, { tx: client })

  // `Favorite` has no unique constraint, so a repeat favorite (a double submit,
  // two tabs) would insert a second row — check first, as `addFavorites` does.
  const existing = await client.favorite.findFirst({
    where: { itemId, favoritedById },
    select: { id: true },
  })
  if (existing) return client.item.findUniqueOrThrow({ where: { id: itemId } })

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
  track(
    'favorite_added',
    {
      item_id: itemId,
      item_type: updated.type,
      workspace_id: updated.workspaceId ?? null,
      item_count: 1,
    },
    { userId: favoritedById }
  )
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

  // All-or-nothing, like the single path: one unreadable id refuses the batch.
  await assertItemsAccess(favoritedById, itemIds, 'read')

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
  track(
    'favorite_added',
    {
      item_count: toAdd.length,
      selected_count: itemIds.length,
      already_favorited_count: already.size,
    },
    { userId: favoritedById }
  )
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
  // Every row for this user, not just the first: with no unique constraint a
  // duplicate could exist, and deleting one left the item favorited.
  const updated = await client.item.update({
    where: { id: itemId },
    data: { favorites: { deleteMany: { favoritedById } } },
  })
  recordFavoriteActivity(itemId, 'unfavorited')
  track(
    'favorite_removed',
    {
      item_id: itemId,
      item_type: updated.type,
      workspace_id: updated.workspaceId ?? null,
    },
    { userId: favoritedById }
  )
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
export async function countItems(
  args: Prisma.ItemCountArgs,
  client: Prisma.TransactionClient = prisma
): Promise<number> {
  return client.item.count(args)
}

/**
 * The Trash entries: items the user trashed directly, which are the ones with
 * a `TrashItem` row. Trashing a folder marks its whole subtree trashed, and
 * listing every row put the folder and each of its 64 files side by side in
 * Trash. This keeps the folder as one entry, the way Drive, OneDrive and
 * Dropbox show a deleted folder; its contents come back with it on restore.
 *
 * It is stored, not derived from the parent's status: a file trashed *before*
 * its folder has a trashed parent too, yet it is still an entry of its own,
 * and restoring the folder leaves it in Trash (see `restoreItems`).
 *
 * @example
 * prisma.item.findMany({ where: { ownerId, ...TRASH_ROOTS } })
 */
export const TRASH_ROOTS = {
  status: 'trashed',
  trash: { isNot: null },
} satisfies Prisma.ItemWhereInput

/** The id of the synthetic "Trash" crumb that heads every trash folder trail. */
export const TRASH_CRUMB_ID = 'trash'

/**
 * Opens a trashed folder for browsing inside Trash
 * (`/:me/stash/trash/folders/:folderId`), and returns its trail.
 *
 * The trail starts at "Trash" and runs down through trashed folders only: it
 * stops above the Trash entry the folder sits under, because the live folders
 * above that are not part of what is in Trash.
 *
 * @param userId - The signed-in user; must own the folder.
 * @param folderId - The trashed folder to open.
 * @returns Crumbs for the toolbar: `Trash`, then the trashed folders down to
 *   this one.
 * @throws `NOT_FOUND` (404) when the folder is not the user's, not a folder,
 *   or not in Trash: a live folder opens in its own route, not here. A restore
 *   made from this view takes the folder out of Trash too, so the restore
 *   action sends the page back to Trash first (`toTrashRedirectUrl`).
 *
 * @example
 * const crumbs = await getTrashFolderTrail(user.id, 'item_abc')
 * // → [{ id: 'trash', name: 'Trash', … }, { id: 'item_core', name: 'core-components', … }, …]
 */
export async function getTrashFolderTrail(
  userId: string,
  folderId: string
): Promise<Array<{ id: string; name: string; parentId: string | null; type: 'folder' }>> {
  const folder = await prisma.item.findFirst({
    where: { id: folderId, ownerId: userId, type: 'folder', status: 'trashed' },
    select: { id: true },
  })
  if (!folder) throw toRouteError(StashlyErrorCode.NOT_FOUND, 'Folder not found in Trash')

  // Walk up while the parent is still trashed, so the trail ends at the
  // folder's Trash entry.
  const trail = await prisma.$queryRaw<
    Array<{ id: string; name: string; parentId: string | null }>
  >`
    WITH RECURSIVE "Up" AS (
      SELECT "id", "name", "parentId", 0 AS "depth" FROM "Item" WHERE "id" = ${folderId}
      UNION ALL
      SELECT p."id", p."name", p."parentId", u."depth" + 1
      FROM "Item" p JOIN "Up" u ON u."parentId" = p."id"
      WHERE p."status" = 'trashed'
    )
    SELECT "id", "name", "parentId" FROM "Up" ORDER BY "depth" DESC
  `
  return [
    { id: TRASH_CRUMB_ID, name: 'Trash', parentId: null, type: 'folder' },
    ...trail.map((c) => ({ ...c, type: 'folder' as const })),
  ]
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
export async function retrieveUserUsageMetrics(
  userId: string,
  client: Prisma.TransactionClient = prisma
) {
  const active = { ownerId: userId, status: { not: 'trashed' as const } }

  const [folders, files, favorites, trashed, quota] = await Promise.all([
    countItems({ where: { ...active, type: 'folder' } }, client),
    countItems({ where: { ...active, type: 'file' } }, client),
    // What the Favorites page lists: items, not rows (no unique constraint, so
    // rows can repeat), and only ones the user can still read.
    countItems(
      {
        where: {
          favorites: { some: { favoritedById: userId } },
          ...itemAccessWhere(userId, 'read'),
        },
      },
      client
    ),
    // What the Trash page lists, so the count matches its cards.
    countItems({ where: { ownerId: userId, ...TRASH_ROOTS } }, client),
    findQuotaByUserId(userId, client),
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
export async function retrieveFolderStats(
  folderId: string,
  client: Prisma.TransactionClient = prisma
) {
  const active = { parentId: folderId, status: { not: 'trashed' as const } }

  const [folders, files, folder] = await Promise.all([
    countItems({ where: { ...active, type: 'folder' } }, client),
    countItems({ where: { ...active, type: 'file' } }, client),
    findItem({ where: { id: folderId } }, client),
  ])

  return { folders, files, sizeBytes: folder.size ?? 0n }
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
  workspaceId?: string,
  client: Prisma.TransactionClient = prisma
) {
  const id = toObjectId(getPrefixForModel('Item'))
  return createItem(
    {
      data: {
        id,
        name: 'root',
        type: 'folder',
        drive: { connect: { id: driveId } },
        workspace: { connect: { id: workspaceId } },
        owner: { connect: { id: userId } },
      },
    },
    client
  )
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
 * The name must lead to exactly one live item, or to none:
 * - a trashed item never matches. It keeps its `parentId`, so it still sits in
 *   the folder, and the link used to open it;
 * - two live items with the name are not picked between (`findFirst` has no
 *   order, so the link opened either one). No match is returned, the same
 *   "never guess" rule uploads follow in `resolveFolderTree`.
 *
 * @param folderId - The parent folder to look in.
 * @param name - The file name as it appears in the URL (already decoded).
 * @returns The item id, or `null` when the folder holds no live item by that
 *   name, or more than one.
 *
 * @example
 * // '/…/folders/item_abc/files/spec.md' → 'item_def'
 * const id = await getChildIdByName('item_abc', 'spec.md');
 */
export async function getChildIdByName(
  folderId: string,
  name: string,
  client: Prisma.TransactionClient = prisma
): Promise<string | null> {
  const matches = await client.item.findMany({
    where: { parentId: folderId, name, status: { not: 'trashed' } },
    select: { id: true },
    take: 2,
  })
  return matches.length === 1 ? matches[0].id : null
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
  folderId: string,
  client: Prisma.TransactionClient = prisma
) {
  const canRead = await hasItemPermission(userId, fileId, 'read')
  if (!canRead) {
    throw toRouteError(StashlyErrorCode.FORBIDDEN)
  }

  const item = await client.item.findUnique({
    where: { id: fileId, parentId: folderId },
    include: {
      owner: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          bucket: true,
        },
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
          users: {
            select: { id: true, image: true, name: true, bucket: true },
          },
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
        select: {
          id: true,
          mimeType: true,
          extension: true,
          key: true,
          bucket: true,
        },
      },
      image: true,
      video: true,
      audio: true,
      pdf: true,
      markdown: true,
      memberships: {
        select: {
          collection: { select: { id: true, name: true } },
        },
      },
      thumbnails: {
        select: {
          bucket: true,
          color: true,
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
    throw toRouteError(
      StashlyErrorCode.ITEM_NOT_FOUND,
      `File item not found or does not belong to the specified folder`
    )
  }

  await updateItemOpenedAt(fileId) // record that the user opened this file
  return signThumbnails(item)
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
export async function getMediaSiblings(
  userId: string,
  folderId: string,
  client: Prisma.TransactionClient = prisma
) {
  return client.item.findMany({
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
export async function updateItemOpenedAt(
  itemId: string,
  client: Prisma.TransactionClient = prisma
) {
  await client.item.update({
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

/** How long a download URL stays valid: long enough to start a zip of many files. */
const DOWNLOAD_URL_TTL_SECONDS = 600

/**
 * Signs a short-lived GET URL for each requested file so the browser can
 * download it (one file directly, several into a zip).
 *
 * One query, filtered by read access: an id the user can't read, a folder, or
 * a trashed item is not returned, and the whole request is refused — a
 * partial list would silently drop files from the zip.
 *
 * @param userId - The acting user.
 * @param itemIds - Files to download, in the order the caller wants them.
 * @throws {StashlyError} NOT_FOUND when any id is missing, unreadable or not a file.
 *
 * @example
 * const files = await getDownloadUrls(session.user.id, ['itm_a', 'itm_b'])
 * // → [{ id: 'itm_a', name: 'a.png', url: 'https://…X-Amz-Signature=…' }, …]
 */
export async function getDownloadUrls(
  userId: string,
  itemIds: string[]
): Promise<{ id: string; name: string; url: string }[]> {
  const ids = [...new Set(itemIds)]
  if (ids.length === 0) {
    throw toRouteError(StashlyErrorCode.INVALID_INPUT, 'No files to download')
  }
  const rows = await prisma.item.findMany({
    where: {
      id: { in: ids },
      type: 'file',
      status: { not: 'trashed' },
      ...itemAccessWhere(userId, 'read'),
    },
    select: { id: true, name: true, file: { select: { bucket: true, key: true } } },
  })
  const byId = new Map(rows.map((row) => [row.id, row]))
  const missing = ids.filter((id) => !byId.get(id)?.file)
  if (missing.length > 0) {
    throw toRouteError(StashlyErrorCode.NOT_FOUND, 'Some files are unavailable')
  }
  return Promise.all(
    ids.map(async (id) => {
      const row = byId.get(id)!
      const url = await getPresignedUrl(
        row.file!.bucket,
        'get',
        row.file!.key,
        DOWNLOAD_URL_TTL_SECONDS,
        { responseCacheControl: 'no-store' }
      )
      return { id, name: row.name, url }
    })
  )
}
