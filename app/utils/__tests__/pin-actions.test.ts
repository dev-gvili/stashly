import { prisma } from '@/services/db'
import { getPrefixForModel, toObjectId } from '@/utils/converters'
import { ItemType, ItemStatus } from '@/prisma/client'
import {
  pinItem,
  unpinItem,
  reorderPin,
  isPinned,
  getPinnedItems,
} from '@/services/pin-actions'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const uid = (model: Parameters<typeof getPrefixForModel>[0]) =>
  toObjectId(getPrefixForModel(model))

// Shared fixture IDs — created once in beforeAll, torn down in afterAll
let userId: string
let otherUserId: string
let driveId: string
let itemIdA: string
let itemIdB: string
let itemIdC: string

async function seedUser(suffix: string) {
  const id = uid('User')
  await prisma.user.create({
    data: {
      id,
      name: `PinTest ${suffix}`,
      email: `pin-test-${suffix}-${id}@test.local`,
      emailVerified: true,
    },
  })
  return id
}

async function makeItem(ownerId: string, itemDriveId: string) {
  const id = uid('Item')
  await prisma.item.create({
    data: {
      id,
      name: `pin-test-item-${id}`,
      type: ItemType.file,
      category: 'unknown',
      status: ItemStatus.normal,
      ownerId,
      driveId: itemDriveId,
      size: 0,
    },
  })
  return id
}

// ---------------------------------------------------------------------------
// Global setup / teardown
// ---------------------------------------------------------------------------

beforeAll(async () => {
  userId = await seedUser('main')
  otherUserId = await seedUser('other')

  driveId = uid('Drive')
  await prisma.drive.create({ data: { id: driveId, ownerId: userId } })

  itemIdA = await makeItem(userId, driveId)
  itemIdB = await makeItem(userId, driveId)
  itemIdC = await makeItem(userId, driveId)
})

beforeEach(async () => {
  // Wipe all PinItem rows for both test users to keep tests isolated
  await prisma.pinItem.deleteMany({
    where: { pinnedById: { in: [userId, otherUserId] } },
  })
})

afterAll(async () => {
  await prisma.pinItem.deleteMany({
    where: { pinnedById: { in: [userId, otherUserId] } },
  })
  await prisma.item.deleteMany({
    where: { id: { in: [itemIdA, itemIdB, itemIdC] } },
  })
  await prisma.drive.deleteMany({ where: { id: driveId } })
  await prisma.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } })
  await prisma.$disconnect()
})

// ---------------------------------------------------------------------------
// pinItem
// ---------------------------------------------------------------------------

describe('pinItem', () => {
  it('creates a PinItem row with id matching /^pin_/ and correct fields at position 0', async () => {
    const pin = await pinItem(itemIdA, userId)

    expect(pin.id).toMatch(/^pin_/)
    expect(pin.itemId).toBe(itemIdA)
    expect(pin.pinnedById).toBe(userId)
    expect(pin.position).toBe(0)
  })

  it('is idempotent — calling twice returns the same id and leaves only 1 DB row', async () => {
    const first = await pinItem(itemIdA, userId)
    const second = await pinItem(itemIdA, userId)

    expect(second.id).toBe(first.id)

    const count = await prisma.pinItem.count({
      where: { itemId: itemIdA, pinnedById: userId },
    })
    expect(count).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// unpinItem
// ---------------------------------------------------------------------------

describe('unpinItem', () => {
  it('removes the PinItem row', async () => {
    await pinItem(itemIdA, userId)
    await unpinItem(itemIdA, userId)

    const row = await prisma.pinItem.findFirst({
      where: { itemId: itemIdA, pinnedById: userId },
    })
    expect(row).toBeNull()
  })

  it('is a no-op when the item is not pinned — does not throw', async () => {
    await expect(unpinItem(itemIdA, userId)).resolves.toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// isPinned
// ---------------------------------------------------------------------------

describe('isPinned', () => {
  it('returns false before pinning', async () => {
    expect(await isPinned(itemIdA, userId)).toBe(false)
  })

  it('returns true after pinning', async () => {
    await pinItem(itemIdA, userId)
    expect(await isPinned(itemIdA, userId)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// reorderPin
// ---------------------------------------------------------------------------

describe('reorderPin', () => {
  it('updates position correctly when the owner calls it', async () => {
    const pin = await pinItem(itemIdA, userId)
    await reorderPin(pin.id, userId, 5)

    const updated = await prisma.pinItem.findUnique({ where: { id: pin.id } })
    expect(updated?.position).toBe(5)
  })

  it('throws when called with a different userId (not the owner)', async () => {
    const pin = await pinItem(itemIdA, userId)
    await expect(reorderPin(pin.id, otherUserId, 3)).rejects.toThrow()
  })
})

// ---------------------------------------------------------------------------
// getPinnedItems
// ---------------------------------------------------------------------------

describe('getPinnedItems', () => {
  it('returns pinned items ordered by position ASC then createdAt DESC', async () => {
    // Pin three items with explicit positions
    const pinA = await pinItem(itemIdA, userId)
    const pinB = await pinItem(itemIdB, userId)
    const pinC = await pinItem(itemIdC, userId)

    // Set distinct positions
    await reorderPin(pinA.id, userId, 2)
    await reorderPin(pinB.id, userId, 0)
    await reorderPin(pinC.id, userId, 1)

    const { items, hasMore } = await getPinnedItems({ userId })

    expect(items.length).toBe(3)
    expect(hasMore).toBe(false)

    // Should come back in position order: B(0), C(1), A(2)
    expect(items[0].id).toBe(itemIdB)
    expect(items[1].id).toBe(itemIdC)
    expect(items[2].id).toBe(itemIdA)
  })
})
