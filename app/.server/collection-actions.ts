import { ItemType, ItemStatus, Prisma, type Item } from '@/prisma/client'
import { getPrefixForModel, toObjectId } from '@/utils/converters'
import { prisma } from '@/services/db'
import {
  buildCollectionFilters,
  collectionFilterSchema,
} from '@/utils/filters/collection.filters'
import { searchFactory } from '@/utils/search'
import { z } from 'zod'
import {
  grantItemPermission,
  hasItemPermission,
  getItemPermissions,
  assertItemPermission,
} from '@/services/permission-actions'
import { findItem } from '@/services/item-actions'
import { requireAtLeastRole } from '@/services/workspace-actions'
import { StashlyError, StashlyErrorCode } from '@/services/api.errors'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CollectionWithRelations = Prisma.CollectionGetPayload<{
  include: { item: true; items: true }
}>

const defaultInclude = {
  item: true,
  items: true,
} as const

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

const defaultOrderBy: (
  params: z.infer<typeof collectionFilterSchema>
) => Prisma.CollectionOrderByWithRelationInput = (_params) => ({})

/**
 * Paginated, filterable search over Collection records.
 *
 * This is an internal helper — it does not enforce any permission checks.
 * Use it inside services that have already verified the caller's access.
 *
 * @example
 * const page = await searchCollections({ name: 'design', take: 20 })
 */
export const searchCollections = searchFactory({
  dbDelegate: prisma.collection,
  buildFilters: buildCollectionFilters,
  defaultOrderBy,
})

// ---------------------------------------------------------------------------
// Internal low-level CRUD
// These functions are intentionally unpermissioned. They are called by the
// higher-level action functions below, or by internal server-side code that
// has already established context (e.g. system jobs, migrations).
// ---------------------------------------------------------------------------

/**
 * Find a single Collection by its ID, with `item` and `items` relations included.
 *
 * Returns `null` when no record matches. Does **not** enforce permissions — use
 * {@link getCollectionForUser} for user-facing reads.
 *
 * @param id - The Collection ID (same as its base Item ID).
 * @returns The collection with relations, or `null` if not found.
 *
 * @example
 * const col = await findCollectionById(collectionId)
 * if (!col) throw new StashlyError(StashlyErrorCode.NOT_FOUND, 'Not found')
 */
export function findCollectionById(
  id: string
): Promise<CollectionWithRelations | null> {
  return prisma.collection.findUnique({ where: { id }, include: defaultInclude })
}

/**
 * Return all Collections matching the given Prisma query args.
 *
 * Always merges `defaultInclude` (`item` + `items`) into the query. Does **not**
 * enforce permissions — intended for server-side bulk reads.
 *
 * @param args - Any Prisma `findMany` args (where, orderBy, take, skip, …).
 * @returns Array of matching collections (empty if none found).
 *
 * @example
 * const all = await findAllCollections({})
 * const large = await findAllCollections({ where: { size: { gt: 1_000_000 } } })
 */
export function findAllCollections(
  args: Prisma.CollectionFindManyArgs
): Promise<CollectionWithRelations[]> {
  return prisma.collection.findMany({ ...args, include: defaultInclude })
}

/**
 * Return the first Collection matching the given Prisma query args.
 *
 * Does **not** enforce permissions.
 *
 * @param args - Any Prisma `findFirst` args.
 * @returns The first matching collection, or `null`.
 *
 * @example
 * const col = await findFirstCollection({ where: { item: { ownerId: userId } } })
 */
export function findFirstCollection(
  args: Prisma.CollectionFindFirstArgs
): Promise<CollectionWithRelations | null> {
  return prisma.collection.findFirst({ ...args, include: defaultInclude })
}

/**
 * Count Collection records matching the given Prisma query args.
 *
 * Does **not** enforce permissions — intended for admin dashboards and metrics.
 *
 * @param args - Any Prisma `count` args (where, …).
 * @returns The number of matching collections.
 *
 * @example
 * const total = await countCollections({})
 * const userCollections = await countCollections({ where: { item: { ownerId: userId } } })
 */
export function countCollections(args: Prisma.CollectionCountArgs): Promise<number> {
  return prisma.collection.count(args)
}

/**
 * Update a Collection record directly via Prisma args.
 *
 * Low-level escape hatch — does **not** enforce permissions. Prefer
 * {@link renameCollection} for the common rename case.
 *
 * @param args - Prisma update args (`where` + `data`).
 * @returns The updated collection with relations.
 *
 * @example
 * await updateCollection({ where: { id: collectionId }, data: { size: 0 } })
 */
export function updateCollection(
  args: Prisma.CollectionUpdateArgs
): Promise<CollectionWithRelations> {
  return prisma.collection.update({ ...args, include: defaultInclude })
}

/**
 * Hard-delete a Collection record directly via Prisma args.
 *
 * Does **not** enforce permissions and bypasses the Item cascade. Prefer
 * {@link deleteCollection} which deletes through the base Item so all cascade
 * rules apply correctly.
 *
 * @param args - Prisma delete args (`where`).
 * @returns The deleted collection record.
 *
 * @example
 * await deleteCollectionRecord({ where: { id: collectionId } })
 */
export function deleteCollectionRecord(
  args: Prisma.CollectionDeleteArgs
): Promise<CollectionWithRelations> {
  return prisma.collection.delete({ ...args, include: defaultInclude })
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

/**
 * Create a new personal Collection for `ownerId`.
 *
 * Creates a base Item (type `collection`) and its linked Collection facet in a
 * single transaction. The creator is automatically granted `write` access.
 *
 * Does **not** require prior permission checks — the caller is always the owner
 * of the thing being created.
 *
 * @param name     - Display name of the collection.
 * @param ownerId  - ID of the user who will own the collection.
 * @param driveId  - The drive (root folder) to attach the collection to.
 * @param parentId - Optional parent Item ID; `null` places it at drive root.
 * @returns The created Item with its `collection` relation.
 *
 * @example
 * const col = await createCollection('Favorites', userId, user.driveId)
 *
 * @example
 * // Nested inside a folder:
 * const col = await createCollection('Q1 Assets', userId, user.driveId, folderId)
 */
export async function createCollection(
  name: string,
  ownerId: string,
  driveId: string,
  parentId: string | null = null
) {
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
        parentId,
        size: 0,
        collection: {
          create: { name, size: 0 },
        },
      },
      include: { collection: true },
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

/**
 * Create a new Collection scoped to a workspace.
 *
 * Requires the creator (`ownerId`) to be at least a `member` of the workspace.
 * The creator is automatically granted `write` access in the same transaction.
 *
 * @param name        - Display name of the collection.
 * @param ownerId     - ID of the user creating the collection (must be a workspace member).
 * @param driveId     - The drive to attach the collection to.
 * @param workspaceId - The workspace the collection belongs to.
 * @param parentId    - Optional parent Item ID; `null` places it at workspace root.
 * @returns The created Item with its `collection` relation.
 * @throws {Error} When `ownerId` is not at least a `member` of the workspace.
 *
 * @example
 * const col = await createWorkspaceCollection('Campaign Assets', userId, user.driveId, workspaceId)
 *
 * @example
 * // Nested under an existing workspace folder:
 * const col = await createWorkspaceCollection('Drafts', userId, user.driveId, workspaceId, folderId)
 */
export async function createWorkspaceCollection(
  name: string,
  ownerId: string,
  driveId: string,
  workspaceId: string,
  parentId: string | null = null
) {
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
        parentId,
        size: 0,
        collection: {
          create: { name, size: 0 },
        },
      },
      include: { collection: true },
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
 * Rename a collection.
 *
 * Updates both the base Item's `name` and the Collection facet's `name` to keep
 * them consistent. Requires `write` access on the collection.
 *
 * @param userId       - The user performing the rename.
 * @param collectionId - The ID of the collection to rename.
 * @param newName      - The new display name.
 * @returns The updated Item with its `collection` relation.
 * @throws {StashlyError} `FORBIDDEN` when the user lacks `write` access.
 *
 * @example
 * const updated = await renameCollection(userId, collectionId, 'Q2 Campaign')
 */
export async function renameCollection(
  userId: string,
  collectionId: string,
  newName: string
) {
  await assertItemPermission(userId, collectionId, 'write')

  return prisma.$transaction(async (tx) => {
    return tx.item.update({
      where: { id: collectionId },
      data: {
        name: newName,
        collection: { update: { name: newName } },
      },
      include: { collection: true },
    })
  })
}

// ---------------------------------------------------------------------------
// Trash / Restore / Delete
// ---------------------------------------------------------------------------

/**
 * Soft-delete a collection by setting its Item status to `trashed`.
 *
 * The collection record and its item associations are preserved; the collection
 * is simply hidden from normal queries. Requires `write` access.
 *
 * @param userId       - The user performing the trash action.
 * @param collectionId - The ID of the collection to trash.
 * @returns The updated Item record.
 * @throws {StashlyError} `FORBIDDEN` when the user lacks `write` access.
 *
 * @example
 * await trashCollection(userId, collectionId)
 */
export async function trashCollection(userId: string, collectionId: string) {
  await assertItemPermission(userId, collectionId, 'write')

  return prisma.item.update({
    where: { id: collectionId },
    data: { status: ItemStatus.trashed },
  })
}

/**
 * Restore a previously trashed collection back to `normal` status.
 *
 * Requires `write` access on the collection.
 *
 * @param userId       - The user performing the restore.
 * @param collectionId - The ID of the collection to restore.
 * @returns The updated Item record.
 * @throws {StashlyError} `FORBIDDEN` when the user lacks `write` access.
 *
 * @example
 * await restoreCollection(userId, collectionId)
 */
export async function restoreCollection(userId: string, collectionId: string) {
  await assertItemPermission(userId, collectionId, 'write')

  return prisma.item.update({
    where: { id: collectionId },
    data: { status: ItemStatus.normal },
  })
}

/**
 * Hard-delete a collection and all its associations.
 *
 * Deletes the base Item record; Prisma's `onDelete: Cascade` rules
 * automatically remove the Collection facet and all CollectionItem links.
 *
 * Only the collection owner or a user with `write` access may call this.
 * For safer removal consider {@link trashCollection} instead.
 *
 * @param userId       - The user performing the deletion.
 * @param collectionId - The ID of the collection to delete.
 * @returns The deleted Item record.
 * @throws {StashlyError} `FORBIDDEN` when the user lacks `write` access.
 *
 * @example
 * await deleteCollection(userId, collectionId)
 */
export async function deleteCollection(userId: string, collectionId: string) {
  await assertItemPermission(userId, collectionId, 'write')

  return prisma.item.delete({ where: { id: collectionId } })
}

// ---------------------------------------------------------------------------
// Manage Collection Items
// ---------------------------------------------------------------------------

/**
 * Check whether an item is a member of a collection.
 *
 * Requires `read` access on the collection.
 *
 * @param userId       - The user performing the check.
 * @param collectionId - The collection to check.
 * @param itemId       - The item to look for.
 * @returns `true` if the item is in the collection, `false` otherwise.
 * @throws {StashlyError} `FORBIDDEN` when the user lacks `read` access.
 *
 * @example
 * if (await isItemInCollection(userId, collectionId, itemId)) {
 *   console.log('already added')
 * }
 */
export async function isItemInCollection(
  userId: string,
  collectionId: string,
  itemId: string
): Promise<boolean> {
  await assertItemPermission(userId, collectionId, 'read')

  const link = await prisma.collectionItem.findUnique({
    where: { collectionId_itemId: { collectionId, itemId } },
  })
  return link !== null
}

/**
 * Add a single Item to a Collection, atomically incrementing the collection's
 * total size.
 *
 * Requires `write` access on the collection. The caller must also have at least
 * `read` access on the item being added to prevent blind enumeration of
 * inaccessible items through the collection membership side-channel.
 *
 * @param userId       - The user performing the action.
 * @param collectionId - The collection to add the item to.
 * @param itemId       - The item to add.
 * @returns The created CollectionItem association record.
 * @throws {StashlyError} `FORBIDDEN` when the user lacks `write` access on the
 *   collection, or `read` access on the item.
 * @throws {StashlyError} `NOT_FOUND` when the item does not exist.
 *
 * @example
 * const link = await addItemToCollection(userId, collectionId, itemId)
 */
export async function addItemToCollection(
  userId: string,
  collectionId: string,
  itemId: string
) {
  await assertItemPermission(userId, collectionId, 'write')
  await assertItemPermission(userId, itemId, 'read')

  return prisma.$transaction(async (tx) => {
    const itemToAdd = await tx.item.findUniqueOrThrow({
      where: { id: itemId },
      select: { size: true },
    })

    const association = await tx.collectionItem.create({
      data: {
        id: toObjectId(getPrefixForModel('CollectionItem')),
        collectionId,
        itemId,
      },
    })

    await tx.collection.update({
      where: { id: collectionId },
      data: { size: { increment: itemToAdd.size } },
    })

    return association
  })
}

/**
 * Remove a single Item from a Collection, atomically decrementing the
 * collection's total size.
 *
 * Requires `write` access on the collection.
 *
 * @param userId       - The user performing the action.
 * @param collectionId - The collection to remove the item from.
 * @param itemId       - The item to remove.
 * @returns The deleted CollectionItem association record.
 * @throws {StashlyError} `FORBIDDEN` when the user lacks `write` access.
 * @throws {Error} When the item is not in the collection (Prisma not-found).
 *
 * @example
 * await removeItemFromCollection(userId, collectionId, itemId)
 */
export async function removeItemFromCollection(
  userId: string,
  collectionId: string,
  itemId: string
) {
  await assertItemPermission(userId, collectionId, 'write')

  return prisma.$transaction(async (tx) => {
    const itemToRemove = await tx.item.findUniqueOrThrow({
      where: { id: itemId },
      select: { size: true },
    })

    const deletedAssociation = await tx.collectionItem.delete({
      where: {
        collectionId_itemId: { collectionId, itemId },
      },
    })

    await tx.collection.update({
      where: { id: collectionId },
      data: { size: { decrement: itemToRemove.size } },
    })

    return deletedAssociation
  })
}

/**
 * Add multiple Items to a Collection in a single transaction, skipping any
 * that are already members. Atomically updates the collection's total size.
 *
 * Requires `write` access on the collection. Items the caller cannot `read`
 * (neither owns nor holds an unexpired permission on) are silently skipped to
 * prevent blind enumeration of inaccessible items via the collection side-channel.
 *
 * Uses a single `$queryRaw` CTE to resolve accessibility and deduplication in
 * one round-trip, replacing the four Prisma queries the naïve implementation
 * would require.
 *
 * @param userId       - The user performing the action.
 * @param collectionId - The collection to add items to.
 * @param itemIds      - Array of item IDs to add.
 * @returns Array of item IDs that were actually added (excludes pre-existing members
 *   and items the caller cannot read).
 * @throws {StashlyError} `FORBIDDEN` when the user lacks `write` access on the collection.
 *
 * @example
 * const added = await addItemsToCollection(userId, collectionId, [id1, id2, id3])
 * console.log(`${added.length} items added`)
 */
export async function addItemsToCollection(
  userId: string,
  collectionId: string,
  itemIds: string[]
) {
  await assertItemPermission(userId, collectionId, 'write')
  if (!itemIds.length) return []

  // Single CTE: accessible items (owned or have unexpired read permission) that
  // are not yet members of this collection. Replaces 4 separate Prisma queries.
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
      SELECT 1 FROM "CollectionItem" ci
      WHERE ci."collectionId" = ${collectionId}
        AND ci."itemId" = a.id
    )
  `

  if (!toAdd.length) return []

  return prisma.$transaction(async (tx) => {
    await tx.collectionItem.createMany({
      data: toAdd.map((i) => ({
        id: toObjectId(getPrefixForModel('CollectionItem')),
        collectionId,
        itemId: i.id,
      })),
    })

    const totalSize = toAdd.reduce((acc, i) => acc + i.size, 0n)
    await tx.collection.update({
      where: { id: collectionId },
      data: { size: { increment: totalSize } },
    })

    return toAdd.map((i) => i.id)
  })
}

/**
 * Remove all items from a collection and reset its size to 0.
 *
 * Requires `write` access on the collection.
 *
 * @param userId       - The user performing the action.
 * @param collectionId - The collection to clear.
 * @throws {StashlyError} `FORBIDDEN` when the user lacks `write` access.
 *
 * @example
 * await clearCollection(userId, collectionId)
 */
export async function clearCollection(userId: string, collectionId: string) {
  await assertItemPermission(userId, collectionId, 'write')

  return prisma.$transaction(async (tx) => {
    await tx.collectionItem.deleteMany({ where: { collectionId } })
    await tx.collection.update({
      where: { id: collectionId },
      data: { size: 0 },
    })
  })
}

// ---------------------------------------------------------------------------
// Read Collection Content
// ---------------------------------------------------------------------------

/**
 * Fetch a collection by ID, asserting the user has at least `read` access.
 *
 * @param userId       - The user requesting the collection.
 * @param collectionId - The ID of the collection.
 * @returns The collection with `item` and `items` relations.
 * @throws {StashlyError} `FORBIDDEN` when the user lacks `read` access.
 * @throws {StashlyError} `NOT_FOUND` when the collection does not exist.
 *
 * @example
 * const col = await getCollectionForUser(userId, collectionId)
 * console.log(col.name, col.items.length)
 */
export async function getCollectionForUser(
  userId: string,
  collectionId: string
): Promise<CollectionWithRelations> {
  await assertItemPermission(userId, collectionId, 'read')

  const collection = await findCollectionById(collectionId)
  if (!collection) {
    throw new StashlyError(StashlyErrorCode.NOT_FOUND, 'Collection not found')
  }
  return collection
}

/**
 * Retrieve items inside a collection using cursor-based pagination.
 *
 * Results are ordered by `(createdAt DESC, id DESC)` (most-recently-added first)
 * and filtered so only items the caller can read are returned — the caller must
 * either own the item or hold an unexpired Permission record on it. This differs
 * from the previous behaviour which returned all items unconditionally; the
 * stricter filtering prevents items from leaking to users whose direct item
 * access was later revoked.
 *
 * Requires `read` access on the collection itself.
 *
 * Uses a single `$queryRaw` JOIN query, replacing the separate `assertItemPermission`
 * round-trip and Prisma's `findMany` call.
 *
 * @param userId       - The user requesting the items.
 * @param collectionId - The collection to page through.
 * @param limit        - Maximum items to return per page (default `50`).
 * @param cursor       - The `CollectionItem.id` to resume after (keyset pagination).
 * @returns `{ items, nextCursor }` — `nextCursor` is `undefined` on the last page.
 * @throws {StashlyError} `FORBIDDEN` when the user lacks `read` access on the collection.
 *
 * @example
 * const { items, nextCursor } = await getCollectionItems(userId, collectionId)
 *
 * @example
 * // Fetch the next page:
 * const page2 = await getCollectionItems(userId, collectionId, 50, nextCursor)
 */
export async function getCollectionItems(
  userId: string,
  collectionId: string,
  limit = 50,
  cursor?: string
) {
  await assertItemPermission(userId, collectionId, 'read')

  // Optional keyset cursor: items whose (createdAt, id) sorts after the cursor row.
  const cursorClause = cursor
    ? Prisma.sql`AND (
        ci."createdAt" < (SELECT "createdAt" FROM "CollectionItem" WHERE id = ${cursor})
        OR (
          ci."createdAt" = (SELECT "createdAt" FROM "CollectionItem" WHERE id = ${cursor})
          AND ci.id < ${cursor}
        )
      )`
    : Prisma.sql``

  const rows = await prisma.$queryRaw<(Item & { linkId: string })[]>`
    SELECT i.*, ci.id AS "linkId"
    FROM "CollectionItem" ci
    JOIN "Item" i ON i.id = ci."itemId"
    WHERE ci."collectionId" = ${collectionId}
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
    ORDER BY ci."createdAt" DESC, ci.id DESC
    LIMIT ${limit + 1}
  `

  let nextCursor: string | undefined
  if (rows.length > limit) {
    const nextRow = rows.pop()
    nextCursor = nextRow?.linkId
  }

  return {
    items: rows.map(({ linkId: _linkId, ...item }) => item as Item),
    nextCursor,
  }
}

/**
 * Return the total number of items in a collection.
 *
 * Requires `read` access on the collection.
 *
 * @param userId       - The user making the request.
 * @param collectionId - The collection to count items in.
 * @returns The item count.
 * @throws {StashlyError} `FORBIDDEN` when the user lacks `read` access.
 *
 * @example
 * const count = await countCollectionItems(userId, collectionId)
 * console.log(`${count} items in collection`)
 */
export async function countCollectionItems(
  userId: string,
  collectionId: string
): Promise<number> {
  await assertItemPermission(userId, collectionId, 'read')

  return prisma.collectionItem.count({ where: { collectionId } })
}

// ---------------------------------------------------------------------------
// Permission management
// ---------------------------------------------------------------------------

/**
 * List all Permission records for a collection, with their associated users.
 *
 * Only the collection owner or a user with `write` access may call this.
 *
 * @param userId       - The user requesting the permission list.
 * @param collectionId - The collection whose permissions to list.
 * @returns Array of Permission records with `users` included (empty if none).
 * @throws {StashlyError} `NOT_FOUND` when the collection item does not exist.
 * @throws {StashlyError} `FORBIDDEN` when the user lacks authority to view permissions.
 *
 * @example
 * const perms = await listCollectionPermissions(userId, collectionId)
 * const editors = perms.filter(p => p.roles === 'write').flatMap(p => p.users)
 */
export async function listCollectionPermissions(
  userId: string,
  collectionId: string
) {
  const item = await findItem({ where: { id: collectionId } })
  if (!item) {
    throw new StashlyError(StashlyErrorCode.NOT_FOUND, 'Collection not found')
  }

  const isOwner = item.ownerId === userId
  const canWrite = isOwner || (await hasItemPermission(userId, collectionId, 'write'))
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
 *
 * Only the collection owner or a user with `write` access may grant permissions.
 * Generates a new Permission record — does not update an existing one.
 *
 * @param actingUserId - The user performing the grant (must be owner or have `write`).
 * @param targetUserId - The user receiving access.
 * @param collectionId - The collection to grant access on.
 * @param role         - The role to assign (`'read'` or `'write'`; default `'read'`).
 * @returns The newly created Permission record.
 * @throws {StashlyError} `NOT_FOUND` when the collection does not exist.
 * @throws {StashlyError} `FORBIDDEN` when `actingUserId` lacks the authority to grant.
 *
 * @example
 * // Share a collection as read-only:
 * await grantCollectionPermission(ownerId, viewerId, collectionId)
 *
 * @example
 * // Add a collaborator with write access:
 * await grantCollectionPermission(ownerId, editorId, collectionId, 'write')
 */
export async function grantCollectionPermission(
  actingUserId: string,
  targetUserId: string,
  collectionId: string,
  role: 'read' | 'write' = 'read'
) {
  const item = await findItem({ where: { id: collectionId } })
  if (!item) {
    throw new StashlyError(StashlyErrorCode.NOT_FOUND, 'Collection not found')
  }

  const isOwner = item.ownerId === actingUserId
  const canWrite = isOwner || (await hasItemPermission(actingUserId, collectionId, 'write'))
  if (!canWrite) {
    throw new StashlyError(
      StashlyErrorCode.FORBIDDEN,
      'You cannot grant permissions on this collection'
    )
  }

  return grantItemPermission(targetUserId, collectionId, role)
}
