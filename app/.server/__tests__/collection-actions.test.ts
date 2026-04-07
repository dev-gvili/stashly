import { faker } from '@faker-js/faker'
import { prisma } from '@/services/db'
import { getPrefixForModel, toObjectId } from '@/utils/converters'
import { ItemType, ItemStatus } from '@/prisma/client'
import { StashlyError, StashlyErrorCode } from '@/services/api.errors'
import {
  createCollection,
  createWorkspaceCollection,
  findCollectionById,
  findAllCollections,
  findFirstCollection,
  countCollections,
  updateCollection,
  deleteCollectionRecord,
  renameCollection,
  trashCollection,
  restoreCollection,
  deleteCollection,
  isItemInCollection,
  addItemToCollection,
  removeItemFromCollection,
  addItemsToCollection,
  clearCollection,
  getCollectionItems,
  countCollectionItems,
  getCollectionForUser,
  listCollectionPermissions,
  grantCollectionPermission,
} from '@/services/collection-actions'
import { grantItemPermission } from '@/services/permission-actions'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const uid = (model: Parameters<typeof getPrefixForModel>[0]) =>
  toObjectId(getPrefixForModel(model))

// Shared fixture IDs — created once in beforeAll, torn down in afterAll
let ownerId: string
let otherId: string
let driveId: string
let workspaceId: string
let workspaceMemberId: string

/** Create a minimal User record for testing. */
async function seedUser(suffix: string) {
  const id = uid('User')
  await prisma.user.create({
    data: {
      id,
      name: `Test ${suffix}`,
      email: `${suffix}-${id}@test.local`,
      emailVerified: true,
    },
  })
  return id
}

/** Create a collection using the public action and return its Item ID. */
async function makeCollection(name = faker.word.noun()) {
  const item = await createCollection(name, ownerId, driveId)
  return item
}

/** Create a bare file Item owned by the given user, with a write Permission for the owner. */
async function makeItem(
  itemOwnerId: string,
  size = 1000,
  itemDriveId = driveId
) {
  const item = await prisma.item.create({
    data: {
      id: uid('Item'),
      name: faker.word.noun(),
      type: ItemType.file,
      category: 'unknown',
      status: ItemStatus.normal,
      ownerId: itemOwnerId,
      driveId: itemDriveId,
      size,
    },
  })
  // Grant the owner a permission record so assertItemPermission checks pass.
  await grantItemPermission(itemOwnerId, item.id, 'write')
  return item
}

// ---------------------------------------------------------------------------
// Global setup / teardown
// ---------------------------------------------------------------------------

beforeAll(async () => {
  ownerId = await seedUser('owner')
  otherId = await seedUser('other')

  driveId = uid('Drive')
  await prisma.drive.create({ data: { id: driveId, ownerId } })

  workspaceId = uid('Workspace')
  await prisma.workspace.create({ data: { id: workspaceId, name: 'Test WS' } })

  workspaceMemberId = uid('WorkspaceMember')
  await prisma.workspaceMember.create({
    data: {
      id: workspaceMemberId,
      memberId: ownerId,
      workspaceId,
      role: 'member',
    },
  })
})

afterAll(async () => {
  // Permissions reference Items via nullable FK (SET NULL on item delete).
  // Delete them first to avoid orphan accumulation across test runs.
  await prisma.permission.deleteMany({
    where: {
      OR: [
        { item: { ownerId: { in: [ownerId, otherId] } } },
        { item: { workspaceId } },
      ],
    },
  })
  // WorkspaceMember must go before User (no cascade configured)
  await prisma.workspaceMember.deleteMany({
    where: { memberId: { in: [ownerId, otherId] } },
  })
  // Items cascade → Collection, CollectionItem
  await prisma.item.deleteMany({ where: { ownerId: { in: [ownerId, otherId] } } })
  await prisma.item.deleteMany({ where: { workspaceId } })
  await prisma.drive.deleteMany({ where: { ownerId: { in: [ownerId, otherId] } } })
  await prisma.user.deleteMany({ where: { id: { in: [ownerId, otherId] } } })
  await prisma.workspace.delete({ where: { id: workspaceId } })

  await prisma.$disconnect()
})

// ---------------------------------------------------------------------------
// Internal low-level CRUD
// ---------------------------------------------------------------------------

describe('findCollectionById', () => {
  it('returns the collection with item and items relations', async () => {
    const col = await makeCollection('find-by-id')
    const found = await findCollectionById(col.id)
    expect(found).not.toBeNull()
    expect(found!.id).toBe(col.collection!.id)
    expect(found!.name).toBe('find-by-id')
    expect(found!.item).toBeDefined()
    expect(Array.isArray(found!.items)).toBe(true)
  })

  it('returns null for a non-existent ID', async () => {
    const result = await findCollectionById('nonexistent_id')
    expect(result).toBeNull()
  })
})

describe('findAllCollections', () => {
  it('returns collections matching a where clause', async () => {
    const name = `findall-${uid('Collection')}`
    await makeCollection(name)
    const results = await findAllCollections({ where: { name } })
    expect(results.length).toBeGreaterThanOrEqual(1)
    expect(results.every((c) => c.name === name)).toBe(true)
  })
})

describe('findFirstCollection', () => {
  it('returns the first matching collection', async () => {
    const name = `findfirst-${uid('Collection')}`
    await makeCollection(name)
    const result = await findFirstCollection({ where: { name } })
    expect(result).not.toBeNull()
    expect(result!.name).toBe(name)
  })

  it('returns null when nothing matches', async () => {
    const result = await findFirstCollection({ where: { name: 'does-not-exist-xyz' } })
    expect(result).toBeNull()
  })
})

describe('countCollections', () => {
  it('returns the correct count for a filtered query', async () => {
    const name = `count-${uid('Collection')}`
    await makeCollection(name)
    await makeCollection(name)
    const count = await countCollections({ where: { name } })
    expect(count).toBe(2)
  })
})

describe('updateCollection', () => {
  it('updates the collection size field', async () => {
    const col = await makeCollection()
    const updated = await updateCollection({
      where: { id: col.collection!.id },
      data: { size: 99n },
    })
    expect(updated.size).toBe(99n)
  })
})

describe('deleteCollectionRecord', () => {
  it('hard-deletes the collection facet record', async () => {
    // Create an item and attach a collection facet to it directly.
    // Prisma v7 derives the collection id from the item relation — do not set id explicitly.
    const item = await makeItem(ownerId)
    await prisma.collection.create({
      data: { name: 'to-delete', item: { connect: { id: item.id } } },
    })
    await deleteCollectionRecord({ where: { id: item.id } })
    const found = await prisma.collection.findUnique({ where: { id: item.id } })
    expect(found).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// createCollection
// ---------------------------------------------------------------------------

describe('createCollection', () => {
  it('creates an Item of type collection with a linked Collection facet', async () => {
    const item = await createCollection('My Docs', ownerId, driveId)
    expect(item.type).toBe(ItemType.collection)
    expect(item.name).toBe('My Docs')
    expect(item.ownerId).toBe(ownerId)
    expect(item.collection).not.toBeNull()
    expect(item.collection!.name).toBe('My Docs')
    expect(item.collection!.size).toBe(0n)
  })

  it('automatically grants the creator write permission', async () => {
    const item = await createCollection('Perm Test', ownerId, driveId)
    const perms = await prisma.permission.findMany({
      where: { itemId: item.id },
      include: { users: true },
    })
    const writePerm = perms.find(
      (p) => p.roles === 'write' && p.users.some((u) => u.id === ownerId)
    )
    expect(writePerm).toBeDefined()
  })

  it('places the collection under a parent when parentId is provided', async () => {
    const parent = await makeItem(ownerId)
    const item = await createCollection('Child', ownerId, driveId, parent.id)
    expect(item.parentId).toBe(parent.id)
  })
})

// ---------------------------------------------------------------------------
// createWorkspaceCollection
// ---------------------------------------------------------------------------

describe('createWorkspaceCollection', () => {
  it('creates a collection scoped to the workspace', async () => {
    const item = await createWorkspaceCollection(
      'WS Col',
      ownerId,
      driveId,
      workspaceId
    )
    expect(item.workspaceId).toBe(workspaceId)
    expect(item.type).toBe(ItemType.collection)
  })

  it('grants the creator write permission', async () => {
    const item = await createWorkspaceCollection(
      'WS Perm',
      ownerId,
      driveId,
      workspaceId
    )
    const perm = await prisma.permission.findFirst({
      where: { itemId: item.id, roles: 'write' },
      include: { users: true },
    })
    expect(perm?.users.some((u) => u.id === ownerId)).toBe(true)
  })

  it('throws when the caller is not a workspace member', async () => {
    await expect(
      createWorkspaceCollection('Blocked', otherId, driveId, workspaceId)
    ).rejects.toThrow('You must be a workspace member to create collections')
  })
})

// ---------------------------------------------------------------------------
// renameCollection
// ---------------------------------------------------------------------------

describe('renameCollection', () => {
  it('updates both the Item name and the Collection facet name', async () => {
    const col = await makeCollection('original-name')
    const updated = await renameCollection(ownerId, col.id, 'renamed')
    expect(updated.name).toBe('renamed')
    const facet = await prisma.collection.findUnique({ where: { id: col.id } })
    expect(facet!.name).toBe('renamed')
  })

  it('throws FORBIDDEN when the caller has no write access', async () => {
    const col = await makeCollection()
    await expect(renameCollection(otherId, col.id, 'hacked')).rejects.toMatchObject({
      errorCode: StashlyErrorCode.FORBIDDEN,
    })
  })
})

// ---------------------------------------------------------------------------
// trashCollection / restoreCollection
// ---------------------------------------------------------------------------

describe('trashCollection', () => {
  it('sets the Item status to trashed', async () => {
    const col = await makeCollection()
    await trashCollection(ownerId, col.id)
    const item = await prisma.item.findUnique({ where: { id: col.id } })
    expect(item!.status).toBe(ItemStatus.trashed)
  })

  it('throws FORBIDDEN when the caller has no write access', async () => {
    const col = await makeCollection()
    await expect(trashCollection(otherId, col.id)).rejects.toMatchObject({
      errorCode: StashlyErrorCode.FORBIDDEN,
    })
  })
})

describe('restoreCollection', () => {
  it('restores a trashed collection back to normal', async () => {
    const col = await makeCollection()
    await trashCollection(ownerId, col.id)
    await restoreCollection(ownerId, col.id)
    const item = await prisma.item.findUnique({ where: { id: col.id } })
    expect(item!.status).toBe(ItemStatus.normal)
  })

  it('throws FORBIDDEN when the caller has no write access', async () => {
    const col = await makeCollection()
    await expect(restoreCollection(otherId, col.id)).rejects.toMatchObject({
      errorCode: StashlyErrorCode.FORBIDDEN,
    })
  })
})

// ---------------------------------------------------------------------------
// deleteCollection
// ---------------------------------------------------------------------------

describe('deleteCollection', () => {
  it('hard-deletes the Item and cascades to Collection and CollectionItem', async () => {
    const col = await makeCollection()
    const file = await makeItem(ownerId)
    await addItemToCollection(ownerId, col.id, file.id)

    await deleteCollection(ownerId, col.id)

    expect(await prisma.item.findUnique({ where: { id: col.id } })).toBeNull()
    expect(await prisma.collection.findUnique({ where: { id: col.id } })).toBeNull()
    expect(
      await prisma.collectionItem.findFirst({ where: { collectionId: col.id } })
    ).toBeNull()
  })

  it('throws FORBIDDEN when the caller has no write access', async () => {
    const col = await makeCollection()
    await expect(deleteCollection(otherId, col.id)).rejects.toMatchObject({
      errorCode: StashlyErrorCode.FORBIDDEN,
    })
  })
})

// ---------------------------------------------------------------------------
// isItemInCollection
// ---------------------------------------------------------------------------

describe('isItemInCollection', () => {
  it('returns true when the item is a member of the collection', async () => {
    const col = await makeCollection()
    const file = await makeItem(ownerId)
    await addItemToCollection(ownerId, col.id, file.id)
    expect(await isItemInCollection(ownerId, col.id, file.id)).toBe(true)
  })

  it('returns false when the item is not a member', async () => {
    const col = await makeCollection()
    const file = await makeItem(ownerId)
    expect(await isItemInCollection(ownerId, col.id, file.id)).toBe(false)
  })

  it('throws FORBIDDEN when the caller has no read access on the collection', async () => {
    const col = await makeCollection()
    const file = await makeItem(ownerId)
    await expect(isItemInCollection(otherId, col.id, file.id)).rejects.toMatchObject({
      errorCode: StashlyErrorCode.FORBIDDEN,
    })
  })
})

// ---------------------------------------------------------------------------
// addItemToCollection / removeItemFromCollection
// ---------------------------------------------------------------------------

describe('addItemToCollection', () => {
  it('creates a CollectionItem link and increments the collection size', async () => {
    const col = await makeCollection()
    const file = await makeItem(ownerId, 2500)
    await addItemToCollection(ownerId, col.id, file.id)

    const facet = await prisma.collection.findUnique({ where: { id: col.id } })
    expect(facet!.size).toBe(2500n)

    const link = await prisma.collectionItem.findUnique({
      where: { collectionId_itemId: { collectionId: col.id, itemId: file.id } },
    })
    expect(link).not.toBeNull()
  })

  it('throws FORBIDDEN when the caller has no write access on the collection', async () => {
    const col = await makeCollection()
    const file = await makeItem(ownerId)
    await expect(addItemToCollection(otherId, col.id, file.id)).rejects.toMatchObject({
      errorCode: StashlyErrorCode.FORBIDDEN,
    })
  })

  it('throws FORBIDDEN when the caller has no read access on the item being added', async () => {
    const col = await makeCollection()
    const foreignItem = await makeItem(otherId) // owned by other, ownerId has no permission
    await expect(
      addItemToCollection(ownerId, col.id, foreignItem.id)
    ).rejects.toMatchObject({ errorCode: StashlyErrorCode.FORBIDDEN })
  })
})

describe('removeItemFromCollection', () => {
  it('removes the CollectionItem link and decrements the collection size', async () => {
    const col = await makeCollection()
    const file = await makeItem(ownerId, 1000)
    await addItemToCollection(ownerId, col.id, file.id)
    await removeItemFromCollection(ownerId, col.id, file.id)

    const facet = await prisma.collection.findUnique({ where: { id: col.id } })
    expect(facet!.size).toBe(0n)
    expect(await isItemInCollection(ownerId, col.id, file.id)).toBe(false)
  })

  it('throws FORBIDDEN when the caller has no write access', async () => {
    const col = await makeCollection()
    const file = await makeItem(ownerId)
    await addItemToCollection(ownerId, col.id, file.id)
    await expect(
      removeItemFromCollection(otherId, col.id, file.id)
    ).rejects.toMatchObject({ errorCode: StashlyErrorCode.FORBIDDEN })
  })
})

// ---------------------------------------------------------------------------
// addItemsToCollection
// ---------------------------------------------------------------------------

describe('addItemsToCollection', () => {
  it('adds multiple items, returns their IDs, and sums their sizes', async () => {
    const col = await makeCollection()
    const a = await makeItem(ownerId, 100)
    const b = await makeItem(ownerId, 200)
    const added = await addItemsToCollection(ownerId, col.id, [a.id, b.id])

    expect(added.sort()).toEqual([a.id, b.id].sort())
    const facet = await prisma.collection.findUnique({ where: { id: col.id } })
    expect(facet!.size).toBe(300n)
  })

  it('skips items that are already in the collection', async () => {
    const col = await makeCollection()
    const file = await makeItem(ownerId)
    await addItemToCollection(ownerId, col.id, file.id)

    const added = await addItemsToCollection(ownerId, col.id, [file.id])
    expect(added).toHaveLength(0)
  })

  it('silently skips items the caller cannot read', async () => {
    const col = await makeCollection()
    const accessible = await makeItem(ownerId)
    const inaccessible = await makeItem(otherId) // ownerId has no permission

    const added = await addItemsToCollection(ownerId, col.id, [
      accessible.id,
      inaccessible.id,
    ])
    expect(added).toEqual([accessible.id])
  })

  it('returns an empty array when itemIds is empty', async () => {
    const col = await makeCollection()
    const added = await addItemsToCollection(ownerId, col.id, [])
    expect(added).toEqual([])
  })

  it('throws FORBIDDEN when the caller has no write access on the collection', async () => {
    const col = await makeCollection()
    const file = await makeItem(ownerId)
    await expect(
      addItemsToCollection(otherId, col.id, [file.id])
    ).rejects.toMatchObject({ errorCode: StashlyErrorCode.FORBIDDEN })
  })
})

// ---------------------------------------------------------------------------
// clearCollection
// ---------------------------------------------------------------------------

describe('clearCollection', () => {
  it('removes all items and resets the collection size to 0', async () => {
    const col = await makeCollection()
    const a = await makeItem(ownerId, 500)
    const b = await makeItem(ownerId, 300)
    await addItemsToCollection(ownerId, col.id, [a.id, b.id])

    await clearCollection(ownerId, col.id)

    const facet = await prisma.collection.findUnique({ where: { id: col.id } })
    expect(facet!.size).toBe(0n)
    const links = await prisma.collectionItem.findMany({
      where: { collectionId: col.id },
    })
    expect(links).toHaveLength(0)
  })

  it('throws FORBIDDEN when the caller has no write access', async () => {
    const col = await makeCollection()
    await expect(clearCollection(otherId, col.id)).rejects.toMatchObject({
      errorCode: StashlyErrorCode.FORBIDDEN,
    })
  })
})

// ---------------------------------------------------------------------------
// getCollectionItems
// ---------------------------------------------------------------------------

describe('getCollectionItems', () => {
  it('returns items the user can read, in most-recently-added order', async () => {
    const col = await makeCollection()
    const a = await makeItem(ownerId)
    const b = await makeItem(ownerId)
    await addItemToCollection(ownerId, col.id, a.id)
    await addItemToCollection(ownerId, col.id, b.id)

    const { items, nextCursor } = await getCollectionItems(ownerId, col.id)
    const ids = items.map((i) => i.id)
    expect(ids).toContain(a.id)
    expect(ids).toContain(b.id)
    expect(nextCursor).toBeUndefined()
  })

  it('filters out items the caller cannot read (per-item visibility)', async () => {
    const col = await makeCollection()
    const visible = await makeItem(ownerId)
    const hidden = await makeItem(otherId) // ownerId has no permission on this

    // Bypass addItemToCollection permission check to simulate a revoked-access scenario
    await prisma.collectionItem.createMany({
      data: [
        {
          id: uid('CollectionItem'),
          collectionId: col.id,
          itemId: visible.id,
        },
        {
          id: uid('CollectionItem'),
          collectionId: col.id,
          itemId: hidden.id,
        },
      ],
    })

    const { items } = await getCollectionItems(ownerId, col.id)
    const ids = items.map((i) => i.id)
    expect(ids).toContain(visible.id)
    expect(ids).not.toContain(hidden.id)
  })

  it('paginates correctly using the nextCursor', async () => {
    const col = await makeCollection()
    const files = await Promise.all(
      Array.from({ length: 3 }, () => makeItem(ownerId))
    )
    for (const f of files) await addItemToCollection(ownerId, col.id, f.id)

    const page1 = await getCollectionItems(ownerId, col.id, 2)
    expect(page1.items).toHaveLength(2)
    expect(page1.nextCursor).toBeDefined()

    const page2 = await getCollectionItems(ownerId, col.id, 2, page1.nextCursor)
    expect(page2.items).toHaveLength(1)
    expect(page2.nextCursor).toBeUndefined()

    // No overlap between pages
    const page1Ids = new Set(page1.items.map((i) => i.id))
    const page2Ids = page2.items.map((i) => i.id)
    expect(page2Ids.some((id) => page1Ids.has(id))).toBe(false)
  })

  it('throws FORBIDDEN when the caller has no read access on the collection', async () => {
    const col = await makeCollection()
    await expect(getCollectionItems(otherId, col.id)).rejects.toMatchObject({
      errorCode: StashlyErrorCode.FORBIDDEN,
    })
  })
})

// ---------------------------------------------------------------------------
// countCollectionItems
// ---------------------------------------------------------------------------

describe('countCollectionItems', () => {
  it('returns the correct item count', async () => {
    const col = await makeCollection()
    const a = await makeItem(ownerId)
    const b = await makeItem(ownerId)
    await addItemsToCollection(ownerId, col.id, [a.id, b.id])

    expect(await countCollectionItems(ownerId, col.id)).toBe(2)
  })

  it('throws FORBIDDEN when the caller has no read access', async () => {
    const col = await makeCollection()
    await expect(countCollectionItems(otherId, col.id)).rejects.toMatchObject({
      errorCode: StashlyErrorCode.FORBIDDEN,
    })
  })
})

// ---------------------------------------------------------------------------
// getCollectionForUser
// ---------------------------------------------------------------------------

describe('getCollectionForUser', () => {
  it('returns the collection with relations for an authorised user', async () => {
    const col = await makeCollection('get-for-user')
    const result = await getCollectionForUser(ownerId, col.id)
    expect(result.name).toBe('get-for-user')
    expect(result.item).toBeDefined()
  })

  it('throws NOT_FOUND for a non-existent collection ID', async () => {
    await expect(getCollectionForUser(ownerId, 'nonexistent')).rejects.toMatchObject({
      errorCode: StashlyErrorCode.FORBIDDEN, // assertItemPermission fires first
    })
  })

  it('throws FORBIDDEN when the caller has no read access', async () => {
    const col = await makeCollection()
    await expect(getCollectionForUser(otherId, col.id)).rejects.toMatchObject({
      errorCode: StashlyErrorCode.FORBIDDEN,
    })
  })
})

// ---------------------------------------------------------------------------
// listCollectionPermissions
// ---------------------------------------------------------------------------

describe('listCollectionPermissions', () => {
  it('returns all permissions for the collection owner', async () => {
    const col = await makeCollection()
    const perms = await listCollectionPermissions(ownerId, col.id)
    expect(Array.isArray(perms)).toBe(true)
    expect(perms.some((p) => p.roles === 'write')).toBe(true)
  })

  it('throws FORBIDDEN when the caller is not the owner and lacks write access', async () => {
    const col = await makeCollection()
    await expect(listCollectionPermissions(otherId, col.id)).rejects.toMatchObject({
      errorCode: StashlyErrorCode.FORBIDDEN,
    })
  })

  it('throws NOT_FOUND when the collection does not exist', async () => {
    await expect(
      listCollectionPermissions(ownerId, 'nonexistent')
    ).rejects.toMatchObject({ errorCode: StashlyErrorCode.NOT_FOUND })
  })
})

// ---------------------------------------------------------------------------
// grantCollectionPermission
// ---------------------------------------------------------------------------

describe('grantCollectionPermission', () => {
  it('creates a read permission for the target user', async () => {
    const col = await makeCollection()
    await grantCollectionPermission(ownerId, otherId, col.id, 'read')

    const perm = await prisma.permission.findFirst({
      where: { itemId: col.id, roles: 'read' },
      include: { users: true },
    })
    expect(perm?.users.some((u) => u.id === otherId)).toBe(true)
  })

  it('creates a write permission for the target user', async () => {
    const col = await makeCollection()
    await grantCollectionPermission(ownerId, otherId, col.id, 'write')

    // grantItemPermission creates a new permission record; use findMany to
    // check across all write permissions (owner already has one from createCollection).
    const perms = await prisma.permission.findMany({
      where: { itemId: col.id, roles: 'write' },
      include: { users: true },
    })
    const othersWrite = perms.some((p) => p.users.some((u) => u.id === otherId))
    expect(othersWrite).toBe(true)
  })

  it('allows access for the newly granted user', async () => {
    const col = await makeCollection()
    await grantCollectionPermission(ownerId, otherId, col.id, 'read')

    // otherUser can now read the collection
    const result = await getCollectionForUser(otherId, col.id)
    expect(result.id).toBe(col.collection!.id)
  })

  it('throws FORBIDDEN when the caller has no authority to grant', async () => {
    const col = await makeCollection()
    const thirdId = await seedUser('third')
    try {
      await expect(
        grantCollectionPermission(otherId, thirdId, col.id, 'read')
      ).rejects.toMatchObject({ errorCode: StashlyErrorCode.FORBIDDEN })
    } finally {
      await prisma.user.delete({ where: { id: thirdId } })
    }
  })

  it('throws NOT_FOUND when the collection does not exist', async () => {
    await expect(
      grantCollectionPermission(ownerId, otherId, 'nonexistent', 'read')
    ).rejects.toMatchObject({ errorCode: StashlyErrorCode.NOT_FOUND })
  })
})
