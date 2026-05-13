import { ItemType, ItemStatus, Prisma, type Item } from '@/prisma/client'
import { getPrefixForModel, toObjectId } from '@/utils/converters'
import { prisma } from '@/services/db'
import { z } from 'zod'
import {
  grantItemPermission,
  hasItemPermission,
  getItemPermissions,
  assertItemPermission,
} from '@/services/permission-actions'
import { findFirstItem } from '@/services/item-actions'
import { requireAtLeastRole } from '@/services/workspace-actions'
import { StashlyError, StashlyErrorCode } from '@/services/api.errors'
import { buildCollectionFilters } from '@/utils/filters/collection.filters'
import { searchFactory } from '@/utils/search'

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
  buildFilters: buildCollectionFilters,
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
    collectionItems: true
    _count: { select: { collectionItems: true } }
  }
}>

const defaultInclude: Prisma.ItemInclude = {
  collectionItems: {
    select: {
      itemId: true,
    },
  },
  _count: { select: { collectionItems: true } },
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
  return prisma.$transaction(async (tx) => {
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
  await requireAtLeastRole(ownerId, workspaceId, 'member', {
    statusCode: 403,
    message: 'You must be a workspace member to create collections',
  })

  return prisma.$transaction(async (tx) => {
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

  return prisma.item.update({
    where: { id: collectionId },
    data: { name: newName },
    include: defaultInclude,
  })
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

  return prisma.item.update({
    where: { id: collectionId },
    data: { status: ItemStatus.trashed },
  })
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

  return prisma.item.update({
    where: { id: collectionId },
    data: { status: ItemStatus.normal },
  })
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

  return prisma.item.delete({ where: { id: collectionId } })
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
 * Add a single Item to a Collection.
 * The DB trigger `collection_size_trigger` automatically updates the collection's size.
 *
 * Requires `write` access on the collection and at least `read` access on the item.
 */
export async function addItemToCollection(
  userId: string,
  collectionId: string,
  itemId: string
) {
  await assertItemPermission(userId, collectionId, 'write')
  await assertItemPermission(userId, itemId, 'read')

  return prisma.collectionMember.create({
    data: {
      id: toObjectId(getPrefixForModel('CollectionMember')),
      collectionId,
      itemId,
    },
  })
}

/**
 * Remove a single Item from a Collection.
 * The DB trigger `collection_size_trigger` automatically updates the collection's size.
 *
 * Requires `write` access on the collection.
 */
export async function removeItemFromCollection(
  userId: string,
  collectionId: string,
  itemId: string
) {
  await assertItemPermission(userId, collectionId, 'write')

  return prisma.collectionMember.delete({
    where: { collectionId_itemId: { collectionId, itemId } },
  })
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

  await prisma.collectionMember.deleteMany({
    where: { collectionId, itemId: { in: itemIds } },
  })

  return itemIds
}

/**
 * Add multiple Items to a Collection in a single transaction, skipping any
 * that are already members. Atomically updates the collection's total size.
 *
 * Requires `write` access on the collection. Items the caller cannot `read`
 * are silently skipped.
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
  await assertItemPermission(userId, collectionId, 'write')
  if (!itemIds.length)
    throw new StashlyError(
      StashlyErrorCode.ADD_ITEMS_TO_COLLECTION_FAILED,
      'No item IDs provided'
    )

  const toAdd = await prisma.$queryRaw<{ id: string; size: bigint }[]>`
    WITH accessible AS (
      SELECT i.id, i.size
      FROM "Item" i
      WHERE i.id IN (${Prisma.join(itemIds)})
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
    )
    SELECT a.id, a.size
    FROM accessible a
    WHERE NOT EXISTS (
      SELECT 1 FROM "CollectionMember" cm
      WHERE cm."collectionId" = ${collectionId}
        AND cm."itemId" = a.id
    )
  `

  if (!toAdd.length) return []

  return await prisma.collectionMember.createManyAndReturn({
    skipDuplicates: true,
    data: toAdd.map((i) => ({
      id: toObjectId(getPrefixForModel('CollectionMember')),
      collectionId,
      itemId: i.id,
    })),
  })
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

  await prisma.collectionMember.deleteMany({ where: { collectionId } })
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
  await assertItemPermission(userId, collectionId, 'read')

  const collection = await findCollectionById(collectionId)
  if (!collection) {
    throw new StashlyError(StashlyErrorCode.COLLECTION_NOT_FOUND, 'Collection not found')
  }
  return collection
}

/**
 * Retrieve items inside a collection using cursor-based pagination.
 *
 * Results are ordered by `(createdAt DESC, id DESC)` and filtered so only
 * items the caller can read are returned.
 *
 * Requires `read` access on the collection.
 */
export async function getCollectionItems(
  userId: string,
  collectionId: string,
  limit = 50,
  cursor?: string
) {
  await assertItemPermission(userId, collectionId, 'read')

  const cursorClause = cursor
    ? Prisma.sql`AND (
        cm."createdAt" < (SELECT "createdAt" FROM "CollectionMember" WHERE id = ${cursor})
        OR (
          cm."createdAt" = (SELECT "createdAt" FROM "CollectionMember" WHERE id = ${cursor})
          AND cm.id < ${cursor}
        )
      )`
    : Prisma.sql``

  const rows = await prisma.$queryRaw<
    (Item & { linkId: string; thumbnailUrl: string | null })[]
  >`
    SELECT i.*, cm.id AS "linkId",
           (SELECT t.url FROM "Thumbnail" t WHERE t."itemId" = i.id AND t.url IS NOT NULL AND t.url NOT LIKE '#%' LIMIT 1) AS "thumbnailUrl"
    FROM "CollectionMember" cm
    JOIN "Item" i ON i.id = cm."itemId"
    WHERE cm."collectionId" = ${collectionId}
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
      ${cursorClause}
    ORDER BY cm."createdAt" DESC, cm.id DESC
    LIMIT ${limit + 1}
  `

  let nextCursor: string | undefined
  if (rows.length > limit) {
    rows.pop()
    nextCursor = rows[rows.length - 1]?.linkId
  }

  return {
    items: rows.map(({ linkId: _linkId, thumbnailUrl, ...item }) => ({
      ...(item as Item),
      thumbnailUrl,
    })),
    nextCursor,
    hasMore: !!nextCursor,
  }
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
    throw new StashlyError(StashlyErrorCode.COLLECTION_NOT_FOUND, 'Collection not found')
  }

  const isOwner = item.ownerId === userId
  const canWrite =
    isOwner || (await hasItemPermission(userId, collectionId, 'write'))
  if (!canWrite) {
    throw new StashlyError(
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
    throw new StashlyError(StashlyErrorCode.COLLECTION_NOT_FOUND, 'Collection not found')
  }

  const isOwner = item.ownerId === actingUserId
  const canWrite =
    isOwner || (await hasItemPermission(actingUserId, collectionId, 'write'))
  if (!canWrite) {
    throw new StashlyError(
      StashlyErrorCode.FORBIDDEN,
      'You cannot grant permissions on this collection'
    )
  }

  return grantItemPermission(targetUserId, collectionId, role)
}
