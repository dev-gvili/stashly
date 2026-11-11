import {
  ItemType,
  ItemStatus,
  Prisma,
  type File,
  type Item,
  type ItemCategory,
  type Thumbnail,
} from '@/prisma/client'
import { getPrefixForModel, toObjectId } from '@/utils/converters'
import { prisma } from '@/services/db'
import { z } from 'zod'
import {
  grantItemPermission,
  hasItemPermission,
  getItemPermissions,
  assertItemPermission,
  itemAccessSql,
  itemAccessWhere,
} from '@/services/permission-actions'
import { findFirstItem, updateItemOpenedAt } from '@/services/item-actions'
import { requireAtLeastRole } from '@/services/workspace-actions'
import {
  StashlyError,
  StashlyErrorCode,
  toRouteError,
} from '@/utils/api.errors'
import { buildCollectionFilters } from '@/utils/filters/collection.filters'
import { searchFactory } from '@/utils/search'
import { track } from '@/services/vinktar'
import { createActivity } from './activity-actions'
import { signStoredThumbnail, signThumbnails } from './thumbnail-actions'
import {
  collectionAfterCursor,
  collectionOrderBy,
  collectionSortKeys,
} from './collection-order'
import { buildItemFilters } from '@/utils/filters/item.filters'

function recordCollectionActivity(
  itemId: string,
  data: {
    kind: 'item_added' | 'item_removed' | 'emptied'
    collectionId?: string | null
    targetItemId?: string | null
    count?: number | null
  }
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
            collection: {
              create: {
                id: toObjectId(getPrefixForModel('CollectionAction')),
                kind: data.kind,
                collectionId: data.collectionId ?? null,
                itemId: data.targetItemId ?? null,
                count: data.count ?? null,
              },
            },
          },
        },
      })
    )
    .catch(() => {})
}

function recordCollectionCreate(itemId: string) {
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
            create: {
              create: { id: toObjectId(getPrefixForModel('CreateAction')) },
            },
          },
        },
      })
    )
    .catch(() => {})
}

function recordCollectionRename(
  itemId: string,
  oldName: string,
  newName: string
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
            rename: {
              create: {
                id: toObjectId(getPrefixForModel('RenameAction')),
                oldName,
                newName,
              },
            },
          },
        },
      })
    )
    .catch(() => {})
}

function recordCollectionDelete(itemId: string, name: string) {
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
            delete: {
              create: {
                id: toObjectId(getPrefixForModel('DeleteAction')),
                name,
                itemType: 'folder',
              },
            },
          },
        },
      })
    )
    .catch(() => {})
}

function recordCollectionRestore(itemId: string) {
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
            restore: {
              create: { id: toObjectId(getPrefixForModel('RestoreAction')) },
            },
          },
        },
      })
    )
    .catch(() => {})
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

/**
 * Paginated, filterable search over Collection (Item) records.
 *
 * @example
 * const page = await searchCollections({ name: 'photos', take: 20, strategy: 'cursor' })
 */
export const searchCollections = searchFactory({
  dbDelegate: prisma.item,
  buildFilters: buildItemFilters,
  defaultOrderBy: (): Prisma.ItemOrderByWithRelationInput => ({
    createdAt: 'desc',
  }),
})

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * An Item with type='collection', including its member links.
 * Replaces the old `CollectionWithRelations` (Prisma.CollectionGetPayload).
 */
export type CollectionWithMembers = Prisma.ItemGetPayload<{
  include: {
    members: true
    _count: { select: { members: true } }
  }
}>

const defaultInclude: Prisma.ItemInclude = {
  members: {
    select: {
      itemId: true,
    },
  },
  _count: { select: { members: true } },
} as const

// ---------------------------------------------------------------------------
// Internal low-level CRUD
// ---------------------------------------------------------------------------

/**
 * Find a single collection Item by ID, with its member links included.
 * Returns `null` when not found. Does not enforce permissions.
 */
export function findCollectionById(
  id: string
): Promise<CollectionWithMembers | null> {
  return prisma.item.findFirst({
    where: { id, type: 'collection' },
    include: defaultInclude,
  })
}

/**
 * The collections page's list: the collections `userId` owns that are not in
 * trash, in `orderBy` (newest first by default). The scope lives here, not in
 * the loader, so a new caller can't forget it (tech-debt item 91).
 *
 * @example
 * const collections = await listCollectionsForUser(session.user.id, params.orderBy)
 */
export function listCollectionsForUser(
  userId: string,
  orderBy: Prisma.ItemFindManyArgs['orderBy'] = { createdAt: 'desc' }
): Promise<CollectionWithMembers[]> {
  return findAllCollections({ where: { ownerId: userId, status: 'normal' }, orderBy })
}

/**
 * Return all collection Items matching the given where/orderBy args.
 * Always restricts to type='collection' and merges `defaultInclude`.
 */
export function findAllCollections(
  args: Omit<Prisma.ItemFindManyArgs, 'where' | 'include'> & {
    where?: Omit<Prisma.ItemWhereInput, 'type'>
  }
): Promise<CollectionWithMembers[]> {
  return prisma.item.findMany({
    ...args,
    where: { ...args.where, type: 'collection' },
    include: defaultInclude,
  })
}

/**
 * Return the first collection Item matching the given args.
 * Does not enforce permissions.
 */
export function findFirstCollection(
  args: Omit<Prisma.ItemFindFirstArgs, 'where' | 'include'> & {
    where?: Omit<Prisma.ItemWhereInput, 'type'>
  }
): Promise<CollectionWithMembers | null> {
  return prisma.item.findFirst({
    ...args,
    where: { ...args.where, type: 'collection' },
    include: defaultInclude,
  })
}

/**
 * Count collection Items matching the given args.
 * Does not enforce permissions.
 */
export function countCollections(
  args: Omit<Prisma.ItemCountArgs, 'where'> & {
    where?: Omit<Prisma.ItemWhereInput, 'type'>
  }
): Promise<number> {
  return prisma.item.count({
    ...args,
    where: { ...(args.where as Prisma.ItemWhereInput), type: 'collection' },
  })
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

/**
 * Create a new personal Collection for `ownerId`.
 *
 * Creates a single Item with type='collection'. The creator is automatically
 * granted `write` access.
 */
export async function createCollection({
  name,
  ownerId,
  driveId,
}: {
  name: string
  ownerId: string
  driveId: string
}) {
  const created = await prisma.$transaction(async (tx) => {
    const id = toObjectId(getPrefixForModel('Item'))
    const newItem = await tx.item.create({
      data: {
        id,
        name,
        type: ItemType.collection,
        category: 'unknown',
        status: ItemStatus.normal,
        ownerId,
        driveId,
        size: 0,
        permissions: {
          create: {
            id: toObjectId(getPrefixForModel('Permission')),
            users: { connect: { id: ownerId } },
            roles: 'write',
          },
        },
      },
      include: defaultInclude,
    })

    return newItem
  })
  recordCollectionCreate(created.id)
  track(
    'collection_created',
    { collection_id: created.id, drive_id: driveId, workspace_id: null },
    { userId: ownerId }
  )
  return created
}

/**
 * Create a new Collection scoped to a workspace.
 *
 * Requires the creator (`ownerId`) to be at least a `member` of the workspace.
 */
export async function createWorkspaceCollection({
  name,
  ownerId,
  driveId,
  workspaceId,
}: {
  name: string
  ownerId: string
  driveId: string
  workspaceId: string
}) {
  await requireAtLeastRole(
    ownerId,
    workspaceId,
    'member',
    'You must be a workspace member to create collections'
  )

  const created = await prisma.$transaction(async (tx) => {
    const newItem = await tx.item.create({
      data: {
        id: toObjectId(getPrefixForModel('Item')),
        name,
        type: ItemType.collection,
        category: 'unknown',
        status: ItemStatus.normal,
        ownerId,
        driveId,
        workspaceId,
        size: 0,
      },
      include: defaultInclude,
    })

    await tx.permission.create({
      data: {
        id: toObjectId(getPrefixForModel('Permission')),
        item: { connect: { id: newItem.id } },
        users: { connect: { id: ownerId } },
        roles: 'write',
      },
    })

    return newItem
  })
  recordCollectionCreate(created.id)
  track(
    'collection_created',
    { collection_id: created.id, drive_id: driveId, workspace_id: workspaceId },
    { userId: ownerId }
  )
  return created
}

// ---------------------------------------------------------------------------
// Rename
// ---------------------------------------------------------------------------

/**
 * Rename a collection. Requires `write` access.
 */
export async function renameCollection({
  userId,
  collectionId,
  newName,
}: {
  userId: string
  collectionId: string
  newName: string
}) {
  await assertItemPermission(userId, collectionId, 'write')

  const existing = await prisma.item.findUniqueOrThrow({
    where: { id: collectionId },
    select: { name: true },
  })

  const updated = await prisma.item.update({
    where: { id: collectionId },
    data: { name: newName },
    include: defaultInclude,
  })

  recordCollectionRename(collectionId, existing.name, newName)
  track(
    'collection_renamed',
    {
      collection_id: collectionId,
      workspace_id: updated.workspaceId ?? null,
      name_length: newName.length,
    },
    { userId }
  )
  return updated
}

// ---------------------------------------------------------------------------
// Trash / Restore / Delete
// ---------------------------------------------------------------------------

/**
 * Soft-delete a collection by setting its status to `trashed`. Requires `write` access.
 */
export async function trashCollection({
  userId,
  collectionId,
}: {
  userId: string
  collectionId: string
}) {
  await assertItemPermission(userId, collectionId, 'write')

  const trashed = await prisma.item.update({
    where: { id: collectionId },
    data: { status: ItemStatus.trashed },
  })
  recordCollectionDelete(collectionId, trashed.name)
  track(
    'collection_trashed',
    {
      collection_id: collectionId,
      workspace_id: trashed.workspaceId ?? null,
      size_bytes: Number(trashed.size),
    },
    { userId }
  )
  return trashed
}

/**
 * Restore a trashed collection back to `normal` status. Requires `write` access.
 */
export async function restoreCollection({
  userId,
  collectionId,
}: {
  userId: string
  collectionId: string
}) {
  await assertItemPermission(userId, collectionId, 'write')

  const restored = await prisma.item.update({
    where: { id: collectionId },
    data: { status: ItemStatus.normal },
  })
  recordCollectionRestore(collectionId)
  track(
    'collection_restored',
    {
      collection_id: collectionId,
      workspace_id: restored.workspaceId ?? null,
      size_bytes: Number(restored.size),
    },
    { userId }
  )
  return restored
}

/**
 * Hard-delete a collection and all its member links (via cascade). Requires `write` access.
 */
export async function deleteCollection({
  userId,
  collectionId,
}: {
  userId: string
  collectionId: string
}) {
  await assertItemPermission(userId, collectionId, 'write')

  const existing = await prisma.item.findUnique({
    where: { id: collectionId },
    select: { name: true },
  })
  const deleted = await prisma.item.delete({ where: { id: collectionId } })
  recordCollectionDelete(collectionId, existing?.name ?? deleted.name)
  track(
    'collection_deleted',
    {
      collection_id: collectionId,
      workspace_id: deleted.workspaceId ?? null,
      size_bytes: Number(deleted.size),
    },
    { userId }
  )
  return deleted
}

// ---------------------------------------------------------------------------
// Manage Collection Members
// ---------------------------------------------------------------------------

/**
 * Check whether an item is a member of a collection. Requires `read` access.
 */
export async function isItemInCollection(
  userId: string,
  collectionId: string,
  itemId: string
): Promise<boolean> {
  await assertItemPermission(userId, collectionId, 'read')

  const link = await prisma.collectionMember.findUnique({
    where: { collectionId_itemId: { collectionId, itemId } },
  })
  return link !== null
}

/**
 * The 400 for adding anything but a file: a collection holds files only, and
 * the add-to-collection picker offers nothing else, so a folder or a
 * collection here is the caller's mistake.
 */
const onlyFilesError = () =>
  toRouteError(
    StashlyErrorCode.INVALID_INPUT,
    'Only files can be added to a collection'
  )

/**
 * The add-to-collection target check: `write` on `collectionId`, and it must
 * be a live collection reachable in its scope (membership for a workspace
 * collection). `assertItemPermission` alone let a trashed collection, or a
 * folder, take members (tech-debt item 90).
 *
 * @throws `FORBIDDEN` (403) without write access; `COLLECTION_NOT_FOUND` (404)
 *   when the target is not a live collection the user can reach.
 */
async function assertWritableCollection(userId: string, collectionId: string) {
  await assertItemPermission(userId, collectionId, 'write')
  const collection = await prisma.item.findFirst({
    where: {
      id: collectionId,
      type: ItemType.collection,
      status: { not: 'trashed' },
      ...itemAccessWhere(userId, 'write'),
    },
    select: { id: true },
  })
  if (!collection) {
    throw toRouteError(StashlyErrorCode.COLLECTION_NOT_FOUND, 'Collection not found')
  }
}

/**
 * Add a single Item to a Collection.
 * The DB trigger `collection_size_trigger` automatically updates the collection's size.
 *
 * Requires `write` access on the collection and at least `read` access on the item.
 *
 * @throws A 400 `INVALID_INPUT` route error when the item is not a file.
 */
export async function addItemToCollection(
  userId: string,
  collectionId: string,
  itemId: string
) {
  await assertWritableCollection(userId, collectionId)
  // Read access in the item's scope (membership for a workspace item), and
  // not in trash; no row is refused like no access.
  const item = await prisma.item.findFirst({
    where: { id: itemId, status: { not: 'trashed' }, ...itemAccessWhere(userId, 'read') },
    select: { type: true },
  })
  if (!item) {
    throw toRouteError(
      StashlyErrorCode.FORBIDDEN,
      'You do not have read access to this item'
    )
  }
  if (item.type !== ItemType.file) throw onlyFilesError()

  const member = await prisma.collectionMember.create({
    data: {
      id: toObjectId(getPrefixForModel('CollectionMember')),
      collectionId,
      itemId,
    },
  })
  recordCollectionActivity(collectionId, {
    kind: 'item_added',
    collectionId,
    targetItemId: itemId,
    count: 1,
  })
  track(
    'collection_items_added',
    { collection_id: collectionId, item_count: 1, selected_count: 1 },
    { userId }
  )
  return member
}

/**
 * Remove a single Item from a Collection.
 * The DB trigger `collection_size_trigger` automatically updates the collection's size.
 *
 * Requires `write` access on the collection.
 */
export async function removeItemFromCollection({
  userId,
  collectionId,
  itemId,
}: {
  userId: string
  collectionId: string
  itemId: string
}) {
  await assertItemPermission(userId, collectionId, 'write')

  const removed = await prisma.collectionMember.delete({
    where: { collectionId_itemId: { collectionId, itemId } },
  })
  recordCollectionActivity(collectionId, {
    kind: 'item_removed',
    collectionId,
    targetItemId: itemId,
    count: 1,
  })
  track(
    'collection_items_removed',
    { collection_id: collectionId, item_count: 1, selected_count: 1 },
    { userId }
  )
  return removed
}

// Remove multiple items at once, with a single permission check for better performance when managing large collections.
// The DB trigger `collection_size_trigger` fires per-row and keeps the collection's size in sync automatically.
export async function removeItemsFromCollection({
  userId,
  collectionId,
  itemIds,
}: {
  userId: string
  collectionId: string
  itemIds: string[]
}) {
  await assertItemPermission(userId, collectionId, 'write')
  if (!itemIds.length)
    throw new StashlyError(
      StashlyErrorCode.REMOVE_ITEMS_FROM_COLLECTION_FAILED,
      'No item IDs provided'
    )

  const result = await prisma.collectionMember.deleteMany({
    where: { collectionId, itemId: { in: itemIds } },
  })

  if (result.count > 0) {
    recordCollectionActivity(collectionId, {
      kind: 'item_removed',
      collectionId,
      count: result.count,
    })
  }

  track(
    'collection_items_removed',
    {
      collection_id: collectionId,
      item_count: result.count,
      selected_count: itemIds.length,
    },
    { userId }
  )

  return itemIds
}

/**
 * Add multiple Items to a Collection in a single transaction, skipping any
 * that are already members. Atomically updates the collection's total size.
 *
 * Requires `write` access on a live collection. Items the caller cannot
 * `read` in their scope, or that are in trash, are silently skipped.
 *
 * @throws A 400 `INVALID_INPUT` route error, adding nothing, when any readable
 *   item is not a file.
 */
export async function addItemsToCollection({
  userId,
  collectionId,
  itemIds,
}: {
  userId: string
  collectionId: string
  itemIds: string[]
}) {
  await assertWritableCollection(userId, collectionId)
  // A caller mistake, so a 400 — ADD_ITEMS_TO_COLLECTION_FAILED maps to 500.
  if (!itemIds.length)
    throw toRouteError(StashlyErrorCode.INVALID_INPUT, 'No item IDs provided')

  const toAdd = await prisma.$queryRaw<
    { id: string; size: bigint; type: ItemType }[]
  >`
    WITH accessible AS (
      SELECT i.id, i.size, i."type"
      FROM "Item" i
      WHERE i.id IN (${Prisma.join(itemIds)})
        AND i."status" <> 'trashed'
        -- Read access in the item's scope: membership for a workspace item.
        AND ${itemAccessSql(userId, 'read')}
    )
    SELECT a.id, a.size, a."type"
    FROM accessible a
    WHERE NOT EXISTS (
      SELECT 1 FROM "CollectionMember" cm
      WHERE cm."collectionId" = ${collectionId}
        AND cm."itemId" = a.id
    )
  `

  if (toAdd.some((item) => item.type !== ItemType.file)) throw onlyFilesError()
  if (!toAdd.length) return []

  const created = await prisma.collectionMember.createManyAndReturn({
    skipDuplicates: true,
    data: toAdd.map((i) => ({
      id: toObjectId(getPrefixForModel('CollectionMember')),
      collectionId,
      itemId: i.id,
    })),
  })

  if (created.length > 0) {
    recordCollectionActivity(collectionId, {
      kind: 'item_added',
      collectionId,
      count: created.length,
    })
  }

  track(
    'collection_items_added',
    {
      collection_id: collectionId,
      item_count: created.length,
      selected_count: itemIds.length,
      total_bytes: Number(
        toAdd.reduce((sum, item) => sum + item.size, BigInt(0))
      ),
    },
    { userId }
  )

  return created
}

/**
 * Remove all items from a collection and reset its size to 0.
 *
 * Requires `write` access on the collection.
 */
export async function clearCollection({
  userId,
  collectionId,
}: {
  userId: string
  collectionId: string
}) {
  await assertItemPermission(userId, collectionId, 'write')

  const result = await prisma.collectionMember.deleteMany({
    where: { collectionId },
  })

  recordCollectionActivity(collectionId, {
    kind: 'emptied',
    collectionId,
    count: result.count,
  })
  track(
    'collection_cleared',
    { collection_id: collectionId, item_count: result.count },
    { userId }
  )
}

// ---------------------------------------------------------------------------
// Read Collection Content
// ---------------------------------------------------------------------------

/**
 * Fetch a collection by ID, asserting the user has at least `read` access.
 */
export async function getCollectionForUser(
  userId: string,
  collectionId: string
): Promise<CollectionWithMembers> {
  return prisma.$transaction(async (tx) => {
    // Existence before permission: a missing collection is a 404, not a 403.
    const collection = await findCollectionById(collectionId)
    if (!collection) {
      throw toRouteError(
        StashlyErrorCode.COLLECTION_NOT_FOUND,
        'Collection not found'
      )
    }
    await assertItemPermission(userId, collectionId, 'read', tx) 
    await updateItemOpenedAt(collectionId, tx)
    return collection
  })
}

/**
 * Retrieve items inside a collection using cursor-based pagination.
 *
 * Results are ordered by the sort pill's `orderBy` (name, ascending, when there
 * is none), with the membership id breaking ties, and filtered to files the
 * caller can read — a collection holds files only, never folders. Each item carries a `thumbnails` array
 * holding its best stored stage (or nothing), signed like any other item
 * payload.
 *
 * Requires `read` access on the collection.
 *
 * @param orderBy - The parsed `orderBy` search param; see {@link collectionSortKeys}
 *   for what it accepts. Anything else is a 400.
 */
export async function getCollectionItems(
  userId: string,
  collectionId: string,
  limit = 50,
  cursor?: string,
  orderBy?: unknown
) {
  await assertItemPermission(userId, collectionId, 'read')

  const sortKeys = collectionSortKeys(orderBy)
  const after = collectionAfterCursor(sortKeys, cursor)

  const rows = await prisma.$queryRaw<
    (Item & {
      linkId: string
      file: File | null
      thumbnails: Pick<
        Thumbnail,
        'id' | 'width' | 'height' | 'size' | 'view' | 'stage' | 'bucket' | 'color'
      >[]
    })[]
  >`
    ${after.with}
    SELECT i.*, cm.id AS "linkId",
           to_jsonb(f) AS file,
           COALESCE(th.thumbnails, '[]'::jsonb) AS thumbnails
    FROM "CollectionMember" cm
    JOIN "Item" i ON i.id = cm."itemId"
    LEFT JOIN "File" f ON f."itemId" = i.id
    ${after.join}
    LEFT JOIN LATERAL (
      SELECT jsonb_build_array(jsonb_build_object(
        'id', t.id, 'width', t.width, 'height', t.height, 'size', t.size,
        'view', t.view, 'stage', t.stage, 'bucket', t.bucket, 'color', t.color
      )) AS thumbnails
      FROM "Thumbnail" t
      WHERE t."itemId" = i.id AND t.bucket IS NOT NULL
      ORDER BY t.stage DESC
      LIMIT 1
    ) th ON true
    WHERE cm."collectionId" = ${collectionId}
      -- A collection holds files only; the add-to-collection picker offers nothing else.
      AND i."type" = 'file'
      AND (
        i."ownerId" = ${userId}
        OR EXISTS (
          SELECT 1
          FROM "Permission" p
          JOIN "_PermissionToUser" pu ON pu."A" = p.id
          WHERE pu."B" = ${userId}
            AND p."itemId" = i.id
            AND p."deletedAt" IS NULL
            AND (p."expiresAt" IS NULL OR p."expiresAt" > NOW())
        )
      )
      ${after.where}
    ${collectionOrderBy(sortKeys)}
    LIMIT ${limit + 1}
  `

  let nextCursor: string | undefined
  if (rows.length > limit) {
    rows.pop()
    nextCursor = rows[rows.length - 1]?.linkId
  }

  return {
    items: await signThumbnails(rows.map(({ linkId: _linkId, ...item }) => item)),
    nextCursor,
    hasMore: !!nextCursor,
  }
}

/**
 * Signed cover images for a batch of collection cards: the newest members
 * that have a real stored thumbnail, at most `perCollection` per collection.
 *
 * One query for the whole batch — a window function caps each collection —
 * so a page of cards costs one round trip, not one per card. Members without
 * a stored thumbnail are skipped rather than padded, so a collection of
 * documents simply returns fewer (or no) covers.
 *
 * Fails closed: a collection the caller can't read contributes nothing, and
 * within a readable collection only members the caller can read are used.
 *
 * @param userId - The viewer.
 * @param collectionIds - Collections to fetch covers for.
 * @param perCollection - Max covers per collection (default 4).
 * @returns Signed URLs keyed by collection id; collections with no covers
 *   are absent.
 *
 * @example
 * const covers = await getCollectionCovers(session.user.id, ids)
 * const urls = covers[collection.id] ?? []
 */
export async function getCollectionCovers(
  userId: string,
  collectionIds: string[],
  perCollection = 4
): Promise<Record<string, string[]>> {
  if (collectionIds.length === 0) return {}

  const readable = (alias: string) => readableBy(userId, alias)

  const rows = await prisma.$queryRaw<
    {
      collectionId: string
      itemId: string
      bucket: string | null
      stage: number | null
    }[]
  >`
    SELECT "collectionId", "itemId", bucket, stage
    FROM (
      SELECT cm."collectionId", i.id AS "itemId", th.bucket, th.stage,
             ROW_NUMBER() OVER (
               PARTITION BY cm."collectionId"
               ORDER BY cm."createdAt" DESC, cm.id DESC
             ) AS rn
      FROM "CollectionMember" cm
      JOIN "Item" c ON c.id = cm."collectionId"
      JOIN "Item" i ON i.id = cm."itemId"
      JOIN LATERAL (
        SELECT t.bucket, t.stage FROM "Thumbnail" t
        WHERE t."itemId" = i.id AND t.bucket IS NOT NULL
        ORDER BY t.stage DESC
        LIMIT 1
      ) th ON true
      WHERE cm."collectionId" IN (${Prisma.join(collectionIds)})
        AND ${readable('c')}
        AND ${readable('i')}
    ) ranked
    WHERE rn <= ${perCollection}
    ORDER BY "collectionId", rn
  `

  const covers: Record<string, string[]> = {}
  const signed = await Promise.all(
    rows.map((row) =>
      signStoredThumbnail({ bucket: row.bucket, stage: row.stage }, row.itemId)
    )
  )
  rows.forEach((row, i) => {
    const url = signed[i]
    if (!url) return
    ;(covers[row.collectionId] ??= []).push(url)
  })
  return covers
}

/**
 * SQL fragment: the item at `alias` is readable by `userId` — owned, or shared
 * through a live (undeleted, unexpired) permission. Shared by the cover queries
 * so both fail closed the same way.
 */
function readableBy(userId: string, alias: string) {
  return Prisma.sql`(
    ${Prisma.raw(alias)}."ownerId" = ${userId}
    OR EXISTS (
      SELECT 1
      FROM "Permission" p
      JOIN "_PermissionToUser" pu ON pu."A" = p.id
      WHERE pu."B" = ${userId}
        AND p."itemId" = ${Prisma.raw(alias)}.id
        AND p."deletedAt" IS NULL
        AND (p."expiresAt" IS NULL OR p."expiresAt" > NOW())
    )
  )`
}

/** One tile of a mosaic cover: a member's thumbnail, or its kind when it has none. */
export interface CollectionMosaicTile {
  url: string | null
  category: ItemCategory
}

/**
 * The newest members of each collection as mosaic tiles. Unlike
 * {@link getCollectionCovers}, a member with no stored thumbnail still takes
 * its place, with `url: null`, so the cover can show its kind instead of
 * skipping it.
 *
 * Fails closed the same way: unreadable collections contribute nothing, and
 * unreadable members are left out.
 *
 * @param perCollection - Tiles per collection (default 3: one large, two small).
 * @returns Tiles keyed by collection id, newest member first; collections with
 *   no readable members are absent.
 *
 * @example
 * const mosaics = await getCollectionMosaics(session.user.id, ids)
 * <CollectionCover variant="mosaic" tiles={mosaics[collection.id] ?? []} />
 */
export async function getCollectionMosaics(
  userId: string,
  collectionIds: string[],
  perCollection = 3
): Promise<Record<string, CollectionMosaicTile[]>> {
  if (collectionIds.length === 0) return {}

  const rows = await prisma.$queryRaw<
    {
      collectionId: string
      itemId: string
      category: ItemCategory
      bucket: string | null
      stage: number | null
    }[]
  >`
    SELECT "collectionId", "itemId", category, bucket, stage
    FROM (
      SELECT cm."collectionId", i.id AS "itemId", i.category, th.bucket, th.stage,
             ROW_NUMBER() OVER (
               PARTITION BY cm."collectionId"
               ORDER BY cm."createdAt" DESC, cm.id DESC
             ) AS rn
      FROM "CollectionMember" cm
      JOIN "Item" c ON c.id = cm."collectionId"
      JOIN "Item" i ON i.id = cm."itemId"
      LEFT JOIN LATERAL (
        SELECT t.bucket, t.stage FROM "Thumbnail" t
        WHERE t."itemId" = i.id AND t.bucket IS NOT NULL
        ORDER BY t.stage DESC
        LIMIT 1
      ) th ON true
      WHERE cm."collectionId" IN (${Prisma.join(collectionIds)})
        AND ${readableBy(userId, 'c')}
        AND ${readableBy(userId, 'i')}
    ) ranked
    WHERE rn <= ${perCollection}
    ORDER BY "collectionId", rn
  `

  const signed = await Promise.all(
    rows.map((row) =>
      row.bucket
        ? signStoredThumbnail({ bucket: row.bucket, stage: row.stage }, row.itemId)
        : null
    )
  )
  const mosaics: Record<string, CollectionMosaicTile[]> = {}
  rows.forEach((row, i) => {
    ;(mosaics[row.collectionId] ??= []).push({
      url: signed[i] ?? null,
      category: row.category,
    })
  })
  return mosaics
}

/**
 * Return the total number of items in a collection. Requires `read` access.
 */
export async function countCollectionItems(
  userId: string,
  collectionId: string
): Promise<number> {
  await assertItemPermission(userId, collectionId, 'read')

  return prisma.collectionMember.count({ where: { collectionId } })
}

// ---------------------------------------------------------------------------
// Permission management
// ---------------------------------------------------------------------------

/**
 * List all Permission records for a collection.
 * Only the owner or a user with `write` access may call this.
 */
export async function listCollectionPermissions(
  userId: string,
  collectionId: string
) {
  const item = await findFirstItem({ where: { id: collectionId } })
  if (!item) {
    throw toRouteError(
      StashlyErrorCode.COLLECTION_NOT_FOUND,
      'Collection not found'
    )
  }

  const isOwner = item.ownerId === userId
  const canWrite =
    isOwner || (await hasItemPermission(userId, collectionId, 'write'))
  if (!canWrite) {
    throw toRouteError(
      StashlyErrorCode.FORBIDDEN,
      'You do not have permission to view collection permissions'
    )
  }

  return getItemPermissions(collectionId)
}

/**
 * Grant a user access to a collection.
 * Only the owner or a user with `write` access may grant permissions.
 */
export async function grantCollectionPermission(
  actingUserId: string,
  targetUserId: string,
  collectionId: string,
  role: 'read' | 'write' = 'read'
) {
  const item = await findFirstItem({ where: { id: collectionId } })
  if (!item) {
    throw toRouteError(
      StashlyErrorCode.COLLECTION_NOT_FOUND,
      'Collection not found'
    )
  }

  const isOwner = item.ownerId === actingUserId
  const canWrite =
    isOwner || (await hasItemPermission(actingUserId, collectionId, 'write'))
  if (!canWrite) {
    throw toRouteError(
      StashlyErrorCode.FORBIDDEN,
      'You cannot grant permissions on this collection'
    )
  }

  const permission = await grantItemPermission(targetUserId, collectionId, role)
  track(
    'collection_permission_granted',
    {
      collection_id: collectionId,
      target_user_id: targetUserId,
      role,
      granted_by_owner: isOwner,
      workspace_id: item.workspaceId ?? null,
    },
    { userId: actingUserId }
  )
  return permission
}
