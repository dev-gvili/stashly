import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { faker } from '@faker-js/faker'
import { prisma } from '@/services/db'
import { getPrefixForModel, toObjectId } from '@/utils/converters'
import { ItemType, ItemStatus } from '@/prisma/client'
import { StashlyError, StashlyErrorCode } from '@/utils/api.errors'
import {
  createCollection,
  createWorkspaceCollection,
  findCollectionById,
  findAllCollections,
  findFirstCollection,
  countCollections,
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
import { wipeTestUsers } from './helpers/wipe-test-users'

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

/** Create a collection using the public action and return its Item. */
async function makeCollection(name = faker.word.noun()) {
  return createCollection({ name, ownerId, driveId })
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

/** Create a bare folder Item owned by `ownerId`, with a write Permission. */
async function makeFolder() {
  const folder = await prisma.item.create({
    data: {
      id: uid('Item'),
      name: faker.word.noun(),
      type: ItemType.folder,
      category: 'unknown',
      status: ItemStatus.normal,
      ownerId,
      driveId,
    },
  })
  await grantItemPermission(ownerId, folder.id, 'write')
  return folder
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
  try {
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
    // WorkspaceMember must go before Workspace (ON DELETE RESTRICT) and before
    // User (no cascade configured).
    await prisma.workspaceMember.deleteMany({
      where: { memberId: { in: [ownerId, otherId] } },
    })
    // Items, drive and users in one trigger-bypassed pass. A plain deleteMany
    // here used to abort on the rollup triggers and skip every statement
    // below it — see wipeTestUsers for the mechanism.
    await wipeTestUsers([ownerId, otherId])
    // deleteMany, not delete: this must not throw when a failed run already
    // removed the row, or the leak comes straight back.
    await prisma.workspace.deleteMany({ where: { id: workspaceId } })
  } finally {
    await prisma.$disconnect()
  }
})

// ---------------------------------------------------------------------------
// Internal low-level CRUD
// ---------------------------------------------------------------------------

describe('findCollectionById', () => {
  it('returns the collection Item with members relation', async () => {
    const col = await makeCollection('find-by-id')
    const found = await findCollectionById(col.id)
    expect(found).not.toBeNull()
    expect(found!.id).toBe(col.id)
    expect(found!.name).toBe('find-by-id')
    expect(Array.isArray(found!.members)).toBe(true)
  })

  it('returns null for a non-existent ID', async () => {
    const result = await findCollectionById('nonexistent_id')
    expect(result).toBeNull()
  })
})

describe('findAllCollections', () => {
  it('returns collections matching a where clause', async () => {
    const name = `findall-${uid('Item')}`
    await makeCollection(name)
    const results = await findAllCollections({ where: { name } })
    expect(results.length).toBeGreaterThanOrEqual(1)
    expect(results.every((c) => c.name === name)).toBe(true)
  })
})

describe('findFirstCollection', () => {
  it('returns the first matching collection', async () => {
    const name = `findfirst-${uid('Item')}`
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
    const name = `count-${uid('Item')}`
    await makeCollection(name)
    await makeCollection(name)
    const count = await countCollections({ where: { name } })
    expect(count).toBe(2)
  })
})

// ---------------------------------------------------------------------------
// createCollection
// ---------------------------------------------------------------------------

describe('createCollection', () => {
  it('creates an Item of type collection', async () => {
    const item = await createCollection({ name: 'My Docs', ownerId, driveId })
    expect(item.type).toBe(ItemType.collection)
    expect(item.name).toBe('My Docs')
    expect(item.ownerId).toBe(ownerId)
    expect(item.size).toBe(0n)
    expect(Array.isArray(item.members)).toBe(true)
  })

  it('automatically grants the creator write permission', async () => {
    const item = await createCollection({ name: 'Perm Test', ownerId, driveId })
    const perms = await prisma.permission.findMany({
      where: { itemId: item.id },
      include: { users: true },
    })
    const writePerm = perms.find(
      (p) => p.roles === 'write' && p.users.some((u) => u.id === ownerId)
    )
    expect(writePerm).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// createWorkspaceCollection
// ---------------------------------------------------------------------------

describe('createWorkspaceCollection', () => {
  it('creates a collection scoped to the workspace', async () => {
    const item = await createWorkspaceCollection({
      name: 'WS Col',
      ownerId,
      driveId,
      workspaceId,
    })
    expect(item.workspaceId).toBe(workspaceId)
    expect(item.type).toBe(ItemType.collection)
  })

  it('grants the creator write permission', async () => {
    const item = await createWorkspaceCollection({
      name: 'WS Perm',
      ownerId,
      driveId,
      workspaceId,
    })
    const perm = await prisma.permission.findFirst({
      where: { itemId: item.id, roles: 'write' },
      include: { users: true },
    })
    expect(perm?.users.some((u) => u.id === ownerId)).toBe(true)
  })

  it('throws when the caller is not a workspace member', async () => {
    await expect(
      createWorkspaceCollection({ name: 'Blocked', ownerId: otherId, driveId, workspaceId })
    ).rejects.toThrow('You must be a workspace member to create collections')
  })
})

// ---------------------------------------------------------------------------
// renameCollection
// ---------------------------------------------------------------------------

describe('renameCollection', () => {
  it('updates the Item name', async () => {
    const col = await makeCollection('original-name')
    const updated = await renameCollection({ userId: ownerId, collectionId: col.id, newName: 'renamed' })
    expect(updated.name).toBe('renamed')
  })

  it('throws FORBIDDEN when the caller has no write access', async () => {
    const col = await makeCollection()
    await expect(
      renameCollection({ userId: otherId, collectionId: col.id, newName: 'hacked' })
    ).rejects.toMatchObject({ errorCode: StashlyErrorCode.FORBIDDEN })
  })
})

// ---------------------------------------------------------------------------
// trashCollection / restoreCollection
// ---------------------------------------------------------------------------

describe('trashCollection', () => {
  it('sets the Item status to trashed', async () => {
    const col = await makeCollection()
    await trashCollection({ userId: ownerId, collectionId: col.id })
    const item = await prisma.item.findUnique({ where: { id: col.id } })
    expect(item!.status).toBe(ItemStatus.trashed)
  })

  it('throws FORBIDDEN when the caller has no write access', async () => {
    const col = await makeCollection()
    await expect(
      trashCollection({ userId: otherId, collectionId: col.id })
    ).rejects.toMatchObject({ errorCode: StashlyErrorCode.FORBIDDEN })
  })
})

describe('restoreCollection', () => {
  it('restores a trashed collection back to normal', async () => {
    const col = await makeCollection()
    await trashCollection({ userId: ownerId, collectionId: col.id })
    await restoreCollection({ userId: ownerId, collectionId: col.id })
    const item = await prisma.item.findUnique({ where: { id: col.id } })
    expect(item!.status).toBe(ItemStatus.normal)
  })

  it('throws FORBIDDEN when the caller has no write access', async () => {
    const col = await makeCollection()
    await expect(
      restoreCollection({ userId: otherId, collectionId: col.id })
    ).rejects.toMatchObject({ errorCode: StashlyErrorCode.FORBIDDEN })
  })
})

// ---------------------------------------------------------------------------
// deleteCollection
// ---------------------------------------------------------------------------

describe('deleteCollection', () => {
  it('hard-deletes the Item and cascades to CollectionMember links', async () => {
    const col = await makeCollection()
    const file = await makeItem(ownerId)
    await addItemToCollection(ownerId, col.id, file.id)

    await deleteCollection({ userId: ownerId, collectionId: col.id })

    expect(await prisma.item.findUnique({ where: { id: col.id } })).toBeNull()
    expect(
      await prisma.collectionMember.findFirst({ where: { collectionId: col.id } })
    ).toBeNull()
  })

  it('throws FORBIDDEN when the caller has no write access', async () => {
    const col = await makeCollection()
    await expect(
      deleteCollection({ userId: otherId, collectionId: col.id })
    ).rejects.toMatchObject({ errorCode: StashlyErrorCode.FORBIDDEN })
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
  it('creates a CollectionMember link and increments the collection size', async () => {
    const col = await makeCollection()
    const file = await makeItem(ownerId, 2500)
    await addItemToCollection(ownerId, col.id, file.id)

    const updatedCol = await prisma.item.findUnique({ where: { id: col.id } })
    expect(updatedCol!.size).toBe(2500n)

    const link = await prisma.collectionMember.findUnique({
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

  it.each([
    ['a folder', () => makeFolder()],
    ['a collection', () => makeCollection()],
  ])('rejects %s with a 400 and adds nothing', async (_label, make) => {
    const col = await makeCollection()
    const notAFile = await make()
    await expect(addItemToCollection(ownerId, col.id, notAFile.id)).rejects.toMatchObject({
      errorCode: StashlyErrorCode.INVALID_INPUT,
      status: 400,
    })
    expect(await prisma.collectionMember.count({ where: { collectionId: col.id } })).toBe(0)
  })
})

describe('removeItemFromCollection', () => {
  it('removes the CollectionMember link and decrements the collection size', async () => {
    const col = await makeCollection()
    const file = await makeItem(ownerId, 1000)
    await addItemToCollection(ownerId, col.id, file.id)
    await removeItemFromCollection({
      userId: ownerId,
      collectionId: col.id,
      itemId: file.id,
    })

    const updatedCol = await prisma.item.findUnique({ where: { id: col.id } })
    expect(updatedCol!.size).toBe(0n)
    expect(await isItemInCollection(ownerId, col.id, file.id)).toBe(false)
  })

  it('throws FORBIDDEN when the caller has no write access', async () => {
    const col = await makeCollection()
    const file = await makeItem(ownerId)
    await addItemToCollection(ownerId, col.id, file.id)
    await expect(
      removeItemFromCollection({
        userId: otherId,
        collectionId: col.id,
        itemId: file.id,
      })
    ).rejects.toMatchObject({ errorCode: StashlyErrorCode.FORBIDDEN })
  })
})

// ---------------------------------------------------------------------------
// addItemsToCollection
// ---------------------------------------------------------------------------

describe('addItemsToCollection', () => {
  // addItemsToCollection returns the created CollectionMember rows (ff70589),
  // so these compare their itemIds.
  it('adds multiple items, returns their member rows, and sums their sizes', async () => {
    const col = await makeCollection()
    const a = await makeItem(ownerId, 100)
    const b = await makeItem(ownerId, 200)
    const added = await addItemsToCollection({ userId: ownerId, collectionId: col.id, itemIds: [a.id, b.id] })

    expect(added.map((m) => m.itemId).sort()).toEqual([a.id, b.id].sort())
    const updatedCol = await prisma.item.findUnique({ where: { id: col.id } })
    expect(updatedCol!.size).toBe(300n)
  })

  it('skips items that are already in the collection', async () => {
    const col = await makeCollection()
    const file = await makeItem(ownerId)
    await addItemToCollection(ownerId, col.id, file.id)

    const added = await addItemsToCollection({ userId: ownerId, collectionId: col.id, itemIds: [file.id] })
    expect(added).toHaveLength(0)
  })

  it('silently skips items the caller cannot read', async () => {
    const col = await makeCollection()
    const accessible = await makeItem(ownerId)
    const inaccessible = await makeItem(otherId) // ownerId has no permission

    const added = await addItemsToCollection({ userId: ownerId, collectionId: col.id, itemIds: [accessible.id, inaccessible.id] })
    expect(added.map((m) => m.itemId)).toEqual([accessible.id])
  })

  it('rejects the whole request with a 400 when any item is not a file', async () => {
    const col = await makeCollection()
    const file = await makeItem(ownerId)
    const folder = await makeFolder()
    await expect(
      addItemsToCollection({ userId: ownerId, collectionId: col.id, itemIds: [file.id, folder.id] })
    ).rejects.toMatchObject({ errorCode: StashlyErrorCode.INVALID_INPUT, status: 400 })
    expect(await prisma.collectionMember.count({ where: { collectionId: col.id } })).toBe(0)
  })

  it('rejects an empty itemIds list as invalid input (400)', async () => {
    const col = await makeCollection()
    await expect(
      addItemsToCollection({ userId: ownerId, collectionId: col.id, itemIds: [] })
    ).rejects.toMatchObject({ errorCode: StashlyErrorCode.INVALID_INPUT, status: 400 })
  })

  it('throws FORBIDDEN when the caller has no write access on the collection', async () => {
    const col = await makeCollection()
    const file = await makeItem(ownerId)
    await expect(
      addItemsToCollection({ userId: otherId, collectionId: col.id, itemIds: [file.id] })
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
    await addItemsToCollection({ userId: ownerId, collectionId: col.id, itemIds: [a.id, b.id] })

    await clearCollection({ userId: ownerId, collectionId: col.id })

    const updatedCol = await prisma.item.findUnique({ where: { id: col.id } })
    expect(updatedCol!.size).toBe(0n)
    const links = await prisma.collectionMember.findMany({
      where: { collectionId: col.id },
    })
    expect(links).toHaveLength(0)
  })

  it('throws FORBIDDEN when the caller has no write access', async () => {
    const col = await makeCollection()
    await expect(
      clearCollection({ userId: otherId, collectionId: col.id })
    ).rejects.toMatchObject({ errorCode: StashlyErrorCode.FORBIDDEN })
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
    await prisma.collectionMember.createMany({
      data: [
        {
          id: uid('CollectionMember'),
          collectionId: col.id,
          itemId: visible.id,
        },
        {
          id: uid('CollectionMember'),
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

  it('returns files only, never a folder member', async () => {
    const col = await makeCollection()
    const file = await makeItem(ownerId)
    const folder = await makeFolder()
    // Bypass the add actions, which refuse folders: this is a row that got in some other way.
    await prisma.collectionMember.createMany({
      data: [file, folder].map((item) => ({
        id: uid('CollectionMember'),
        collectionId: col.id,
        itemId: item.id,
      })),
    })

    const { items } = await getCollectionItems(ownerId, col.id)
    expect(items.map((i) => i.id)).toEqual([file.id])
  })

  describe('sorting by the sort pill orderBy', () => {
    // Lowercase ASCII names order the same under any collation; sizes are
    // distinct, so name and size each have exactly one right answer.
    const SEED = [
      { name: 'delta', size: 100 },
      { name: 'alpha', size: 200 },
      { name: 'charlie', size: 300 },
      { name: 'bravo', size: 400 },
      { name: 'echo', size: 500 },
    ]
    let collectionId: string

    beforeAll(async () => {
      collectionId = (await makeCollection()).id
      for (const { name, size } of SEED) {
        const item = await makeItem(ownerId, size)
        await prisma.item.update({ where: { id: item.id }, data: { name } })
        await addItemToCollection(ownerId, collectionId, item.id)
      }
    })

    /** Every page, `pageSize` at a time, following nextCursor to the end. */
    async function walk(orderBy: unknown, pageSize: number) {
      const items: Awaited<ReturnType<typeof getCollectionItems>>['items'] = []
      let cursor: string | undefined
      do {
        const page = await getCollectionItems(ownerId, collectionId, pageSize, cursor, orderBy)
        items.push(...page.items)
        cursor = page.nextCursor
      } while (cursor)
      return items
    }

    it('defaults to name ascending, as the sort pill shows', async () => {
      const { items } = await getCollectionItems(ownerId, collectionId)
      expect(items.map((i) => i.name)).toEqual(['alpha', 'bravo', 'charlie', 'delta', 'echo'])
    })

    it('sorts by name descending', async () => {
      const { items } = await getCollectionItems(ownerId, collectionId, 50, undefined, { name: 'desc' })
      expect(items.map((i) => i.name)).toEqual(['echo', 'delta', 'charlie', 'bravo', 'alpha'])
    })

    it('sorts by size', async () => {
      const { items } = await getCollectionItems(ownerId, collectionId, 50, undefined, { size: 'desc' })
      expect(items.map((i) => Number(i.size))).toEqual([500, 400, 300, 200, 100])
    })

    it.each(['name', 'updatedAt', 'createdAt', 'size', 'type'].flatMap((column) =>
      (['asc', 'desc'] as const).map((dir) => [column, dir] as const)
    ))('pages through %s %s with no gaps or repeats', async (column, dir) => {
      const orderBy = { [column]: dir }
      const onePage = await walk(orderBy, 100)
      const paged = await walk(orderBy, 2)
      expect(onePage).toHaveLength(SEED.length)
      expect(paged.map((i) => i.id)).toEqual(onePage.map((i) => i.id))
    })

    it('rejects a sort the sort pill does not offer here with INVALID_INPUT', async () => {
      await expect(
        getCollectionItems(ownerId, collectionId, 50, undefined, { members: { _count: 'desc' } })
      ).rejects.toMatchObject({ errorCode: StashlyErrorCode.INVALID_INPUT })
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
    await addItemsToCollection({ userId: ownerId, collectionId: col.id, itemIds: [a.id, b.id] })

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
  it('returns the collection Item for an authorised user', async () => {
    const col = await makeCollection('get-for-user')
    const result = await getCollectionForUser(ownerId, col.id)
    expect(result.name).toBe('get-for-user')
    expect(result.type).toBe(ItemType.collection)
  })

  it('throws COLLECTION_NOT_FOUND for a non-existent collection ID', async () => {
    // Existence is checked before permission on purpose: when the collection is
    // gone, a 403 is misleading — the caller is not being refused access, there
    // is nothing to access. Reversing these two also means a deleted collection
    // renders "not found" rather than "you do not have access".
    await expect(getCollectionForUser(ownerId, 'nonexistent')).rejects.toMatchObject({
      errorCode: StashlyErrorCode.COLLECTION_NOT_FOUND,
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

  it('throws COLLECTION_NOT_FOUND when the collection does not exist', async () => {
    await expect(
      listCollectionPermissions(ownerId, 'nonexistent')
    ).rejects.toMatchObject({ errorCode: StashlyErrorCode.COLLECTION_NOT_FOUND, status: 404 })
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

    const result = await getCollectionForUser(otherId, col.id)
    expect(result.id).toBe(col.id)
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

  it('throws COLLECTION_NOT_FOUND when the collection does not exist', async () => {
    await expect(
      grantCollectionPermission(ownerId, otherId, 'nonexistent', 'read')
    ).rejects.toMatchObject({ errorCode: StashlyErrorCode.COLLECTION_NOT_FOUND, status: 404 })
  })
})
