import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '@/services/db'
import { getPrefixForModel, toObjectId } from '@/utils/converters'
import { toErrorInfo } from '@/utils/api.errors'
import { ItemType, ItemStatus } from '@/prisma/client'
import {
  addFavorite,
  addFavorites,
  getFavoritedItems,
  removeFavorite,
  retrieveUserUsageMetrics,
} from '@/services/item-actions'

// `Favorite` has no unique constraint (migration
// 20260812030000_sync_favorite_indexes dropped it), so duplicate rows are
// possible and the app has to keep favoriting idempotent itself.

const uid = (model: Parameters<typeof getPrefixForModel>[0]) =>
  toObjectId(getPrefixForModel(model))

let userId: string
let otherUserId: string
let driveId: string
let otherDriveId: string
/** Owned by `userId`. */
let itemId: string
/** Owned by `otherUserId`, never shared. */
let privateItemId: string
/** Owned by `otherUserId`, shared with `userId` for reading. */
let sharedItemId: string
/** Owned by `otherUserId`, shared with `userId` and then revoked. */
let revokedItemId: string

async function seedUser(suffix: string) {
  const id = uid('User')
  await prisma.user.create({
    data: {
      id,
      name: `FavTest ${suffix}`,
      email: `fav-test-${suffix}-${id}@test.local`,
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
      name: `fav-test-item-${id}`,
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

async function grantRead(granteeId: string, onItemId: string, deletedAt: Date | null = null) {
  await prisma.permission.create({
    data: {
      id: uid('Permission'),
      itemId: onItemId,
      roles: 'read',
      deletedAt,
      users: { connect: { id: granteeId } },
    },
  })
}

const rows = (favoritedById: string, onItemId = itemId) =>
  prisma.favorite.count({ where: { itemId: onItemId, favoritedById } })

const statusOf = (e: unknown) => toErrorInfo(e).status

beforeAll(async () => {
  userId = await seedUser('main')
  otherUserId = await seedUser('other')

  driveId = uid('Drive')
  await prisma.drive.create({ data: { id: driveId, ownerId: userId } })
  otherDriveId = uid('Drive')
  await prisma.drive.create({ data: { id: otherDriveId, ownerId: otherUserId } })

  itemId = await makeItem(userId, driveId)
  privateItemId = await makeItem(otherUserId, otherDriveId)
  sharedItemId = await makeItem(otherUserId, otherDriveId)
  revokedItemId = await makeItem(otherUserId, otherDriveId)

  await grantRead(userId, sharedItemId)
  await grantRead(userId, revokedItemId, new Date())
  // The other user may read `itemId` too, so the two-user cases favorite
  // something both can see — favoriting is refused without read access.
  await grantRead(otherUserId, itemId)

  // The usage metrics read the drive's quota.
  await prisma.quota.create({
    data: { id: uid('Quota'), driveId, total: 10n ** 9n, used: 0n, deleted: 0n },
  })
})

beforeEach(async () => {
  await prisma.favorite.deleteMany({
    where: { favoritedById: { in: [userId, otherUserId] } },
  })
})

afterAll(async () => {
  const items = [itemId, privateItemId, sharedItemId, revokedItemId]
  await prisma.favorite.deleteMany({
    where: { favoritedById: { in: [userId, otherUserId] } },
  })
  await prisma.permission.deleteMany({ where: { itemId: { in: items } } })
  await prisma.quota.deleteMany({ where: { driveId } })
  await prisma.item.deleteMany({ where: { id: { in: items } } })
  await prisma.drive.deleteMany({ where: { id: { in: [driveId, otherDriveId] } } })
  await prisma.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } })
  await prisma.$disconnect()
})

describe('addFavorite', () => {
  it('creates one row', async () => {
    await addFavorite(itemId, userId)
    expect(await rows(userId)).toBe(1)
  })

  it('is idempotent: favoriting twice still leaves one row', async () => {
    await addFavorite(itemId, userId)
    await addFavorite(itemId, userId)
    expect(await rows(userId)).toBe(1)
  })

  it('keeps each user’s favorite separate', async () => {
    await addFavorite(itemId, userId)
    await addFavorite(itemId, otherUserId)
    expect(await rows(userId)).toBe(1)
    expect(await rows(otherUserId)).toBe(1)
  })

  it('accepts an item shared with the user', async () => {
    await addFavorite(sharedItemId, userId)
    expect(await rows(userId, sharedItemId)).toBe(1)
  })

  // Before the check, any user holding an id could favorite someone else's
  // file and then read it off their own Favorites page.
  it('refuses another user’s unshared item with 403, writing nothing', async () => {
    const err = await addFavorite(privateItemId, userId).catch((e) => e)
    expect(statusOf(err)).toBe(403)
    expect(await rows(userId, privateItemId)).toBe(0)
  })

  it('refuses an item whose share was revoked', async () => {
    const err = await addFavorite(revokedItemId, userId).catch((e) => e)
    expect(statusOf(err)).toBe(403)
    expect(await rows(userId, revokedItemId)).toBe(0)
  })

  it('refuses an item id that does not exist, the same way', async () => {
    const err = await addFavorite(uid('Item'), userId).catch((e) => e)
    expect(statusOf(err)).toBe(403)
  })
})

describe('addFavorites (bulk)', () => {
  it('adds the readable items and skips ones already favorited', async () => {
    await addFavorite(itemId, userId)
    expect(await addFavorites([itemId, sharedItemId], userId)).toBe(1)
    expect(await rows(userId)).toBe(1)
    expect(await rows(userId, sharedItemId)).toBe(1)
  })

  it('refuses the whole batch when one item is unreadable', async () => {
    const err = await addFavorites([itemId, privateItemId], userId).catch((e) => e)
    expect(statusOf(err)).toBe(403)
    expect(await rows(userId)).toBe(0)
    expect(await rows(userId, privateItemId)).toBe(0)
  })
})

describe('removeFavorite', () => {
  it('removes the row', async () => {
    await addFavorite(itemId, userId)
    await removeFavorite(itemId, userId)
    expect(await rows(userId)).toBe(0)
  })

  // Before the fix this deleted only the first row, so an item with a
  // duplicate could never be unfavorited: the request succeeded and it stayed.
  it('clears duplicate rows left from before favoriting was idempotent', async () => {
    await prisma.favorite.createMany({
      data: [
        { id: uid('Favorite'), itemId, favoritedById: userId },
        { id: uid('Favorite'), itemId, favoritedById: userId },
      ],
    })
    await removeFavorite(itemId, userId)
    expect(await rows(userId)).toBe(0)
  })

  it('leaves another user’s favorite in place', async () => {
    await addFavorite(itemId, userId)
    await addFavorite(itemId, otherUserId)
    await removeFavorite(itemId, userId)
    expect(await rows(userId)).toBe(0)
    expect(await rows(otherUserId)).toBe(1)
  })

  it('is a no-op when the item is not favorited', async () => {
    await expect(removeFavorite(itemId, userId)).resolves.toBeUndefined()
  })

  // The row is the user's own, so losing access to the item must not trap it.
  it('still removes the user’s own favorite after the share was revoked', async () => {
    await prisma.favorite.create({
      data: { id: uid('Favorite'), itemId: revokedItemId, favoritedById: userId },
    })
    await removeFavorite(revokedItemId, userId)
    expect(await rows(userId, revokedItemId)).toBe(0)
  })
})

describe('getFavoritedItems', () => {
  it('lists own and shared favorites, but not ones the user can no longer read', async () => {
    await addFavorite(itemId, userId)
    await addFavorite(sharedItemId, userId)
    // Favorited while the share was live, then revoked.
    await prisma.favorite.create({
      data: { id: uid('Favorite'), itemId: revokedItemId, favoritedById: userId },
    })

    const { items } = await getFavoritedItems({ userId })
    expect(items.map((i) => i.id).sort()).toEqual([itemId, sharedItemId].sort())
  })
})

describe('retrieveUserUsageMetrics favorites', () => {
  it('counts favorited items the page would list, not rows', async () => {
    await prisma.favorite.createMany({
      data: [
        { id: uid('Favorite'), itemId, favoritedById: userId },
        { id: uid('Favorite'), itemId, favoritedById: userId },
        { id: uid('Favorite'), itemId: revokedItemId, favoritedById: userId },
      ],
    })
    expect((await retrieveUserUsageMetrics(userId)).favorites).toBe(1)
  })
})
