import {
  ItemType,
  ItemStatus,
  Prisma,
  type Item,
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
import { createActivity } from './activity-actions'
import { signStoredThumbnail, signThumbnails } from './thumbnail-actions'
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
  // A caller mistake, so a 400 — ADD_ITEMS_TO_COLLECTION_FAILED maps to 500.
  if (!itemIds.length)
    throw toRouteError(StashlyErrorCode.INVALID_INPUT, 'No item IDs provided')

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
 * Results are ordered by `(createdAt DESC, id DESC)` and filtered so only
 * items the caller can read are returned. Each item carries a `thumbnails`
 * array holding its best stored stage (or nothing), signed like any other
 * item payload.
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
    (Item & {
      linkId: string
      thumbnails: Pick<
        Thumbnail,
        'id' | 'width' | 'height' | 'size' | 'view' | 'stage' | 'bucket' | 'color'
      >[]
    })[]
  >`
    SELECT i.*, cm.id AS "linkId",
           COALESCE(th.thumbnails, '[]'::jsonb) AS thumbnails
    FROM "CollectionMember" cm
    JOIN "Item" i ON i.id = cm."itemId"
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

  const readable = (alias: string) => Prisma.sql`(
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

  return grantItemPermission(targetUserId, collectionId, role)
}
