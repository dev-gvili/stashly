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
  favoriteItemSelect,
} from '@/services/item-actions'
import { itemAccessWhere } from '@/services/permission-actions'
import { signThumbnails } from '@/services/thumbnail-actions'

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

/**
 * `getFavoritedItems` is one raw statement that filters before it joins. It must
 * return exactly what the Prisma `findMany` it replaced returned (kept here as
 * the reference): the same rows in the same order, every relation the card
 * shows, and Prisma's cursor (a page starts at the cursor row).
 */
describe('getFavoritedItems matches the Prisma query it replaced', () => {
  const made: { items: string[]; workspaces: string[]; links: string[] } = { items: [], workspaces: [], links: [] }
  let favorited: string[] = []

  const prismaReference = async (cursor: string | undefined, limit: number) => {
    const items = await prisma.item.findMany({
      where: { favorites: { some: { favoritedById: userId } }, ...itemAccessWhere(userId, 'read') },
      take: limit + 1,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      cursor: cursor ? { id: cursor } : undefined,
      select: favoriteItemSelect,
    })
    const hasMore = items.length > limit
    const data = await signThumbnails(items.slice(0, limit))
    return { items: data, nextCursor: hasMore ? (data[data.length - 1]?.id ?? null) : null, hasMore }
  }

  /** Relation arrays carry no order in either query, so compare them sorted. */
  const canonical = (value: unknown): unknown =>
    Array.isArray(value)
      ? value.map(canonical).sort((a, b) => (JSON.stringify(a, big) < JSON.stringify(b, big) ? -1 : 1))
      : value && typeof value === 'object' && !(value instanceof Date)
        ? Object.fromEntries(Object.keys(value).sort().map((k) => [k, canonical((value as Record<string, unknown>)[k])]))
        : value
  const big = (_: string, v: unknown) => (typeof v === 'bigint' ? `${v}n` : v)

  const item = async (data: { ownerId?: string; drive?: string; type?: ItemType; parentId?: string; createdAt?: Date; workspaceId?: string; tags?: string[] }) => {
    const id = uid('Item')
    made.items.push(id)
    await prisma.item.create({
      data: {
        id,
        name: `fav-ref-${id}`,
        type: data.type ?? ItemType.file,
        category: 'unknown',
        status: ItemStatus.normal,
        ownerId: data.ownerId ?? userId,
        driveId: data.drive ?? driveId,
        parentId: data.parentId,
        createdAt: data.createdAt,
        workspaceId: data.workspaceId,
        tags: data.tags,
        size: 1234n,
      },
    })
    return id
  }

  beforeAll(async () => {
    const at = (s: number) => new Date(Date.UTC(2026, 9, 31, 12, 0, s))
    // A grandparent and a parent folder carrying every relation the card reads.
    const grandparent = await item({ type: ItemType.folder, createdAt: at(0) })
    const parent = await item({ type: ItemType.folder, parentId: grandparent, createdAt: at(1), tags: ['p'] })
    await prisma.folder.create({ data: { id: uid('Folder'), itemId: parent } })
    await prisma.lockedItem.create({ data: { id: uid('LockedItem'), itemId: parent, lockedById: userId } })
    await prisma.thumbnail.create({ data: { id: uid('Thumbnail'), itemId: parent, width: 10, height: 20, color: '#abc' } })

    const full = await item({ parentId: parent, createdAt: at(10), tags: ['x', 'y'] })
    await prisma.file.create({ data: { id: uid('File'), itemId: full, bucket: 'b', key: `k/${full}`, uploadPath: `k/${full}`, mimeType: 'image/png', extension: 'png' } })
    await prisma.thumbnail.createMany({
      data: [
        { id: uid('Thumbnail'), itemId: full, size: 'small', stage: 2, width: 1, height: 2 },
        { id: uid('Thumbnail'), itemId: full, size: 'medium', stage: 3, color: '#fff' },
      ],
    })
    await prisma.pinItem.create({ data: { id: uid('PinItem'), itemId: full, pinnedById: userId } })
    await prisma.lockedItem.create({ data: { id: uid('LockedItem'), itemId: full, lockedById: otherUserId } })
    await grantRead(otherUserId, full)

    const folder = await item({ type: ItemType.folder, createdAt: at(9) })
    await prisma.folder.create({ data: { id: uid('Folder'), itemId: folder } })
    // Two items with the same createdAt: the id decides their order.
    const tieA = await item({ createdAt: at(5) })
    const tieB = await item({ createdAt: at(5) })
    const plain = await item({ createdAt: at(3) })

    // Shared with the user: a live read grant, one expiring later, one expired.
    const shared = await item({ ownerId: otherUserId, drive: otherDriveId, createdAt: at(8) })
    await grantRead(userId, shared)
    const later = await item({ ownerId: otherUserId, drive: otherDriveId, createdAt: at(7) })
    await prisma.permission.create({
      data: { id: uid('Permission'), itemId: later, roles: 'write', expiresAt: new Date(Date.now() + 3_600_000), users: { connect: { id: userId } } },
    })
    const expired = await item({ ownerId: otherUserId, drive: otherDriveId, createdAt: at(6) })
    await prisma.permission.create({
      data: { id: uid('Permission'), itemId: expired, roles: 'read', expiresAt: new Date(Date.now() - 60_000), users: { connect: { id: userId } } },
    })

    // Workspace items: listed while the user is a member, not otherwise.
    const [member, stranger] = [uid('Workspace'), uid('Workspace')]
    made.workspaces.push(member, stranger)
    await prisma.workspace.createMany({ data: [{ id: member, name: 'fav-ref-member' }, { id: stranger, name: 'fav-ref-stranger' }] })
    await prisma.workspaceMember.create({ data: { id: uid('WorkspaceMember'), memberId: userId, workspaceId: member } })
    const inMember = await item({ workspaceId: member, createdAt: at(4) })
    const inStranger = await item({ workspaceId: stranger, createdAt: at(2) })

    favorited = [parent, full, folder, tieA, tieB, plain, shared, later, expired, inMember, inStranger, privateItemId]
  })

  afterAll(async () => {
    await prisma.favorite.deleteMany({ where: { itemId: { in: made.items } } })
    await prisma.permission.deleteMany({ where: { itemId: { in: made.items } } })
    await prisma.workspaceMember.deleteMany({ where: { workspaceId: { in: made.workspaces } } })
    // Children first: Item.parentId does not cascade.
    for (const id of [...made.items].reverse()) await prisma.item.deleteMany({ where: { id } })
    await prisma.workspace.deleteMany({ where: { id: { in: made.workspaces } } })
  })

  it.each([1, 2, 3, 50])('on every page of %i', async (limit) => {
    await prisma.favorite.createMany({
      data: favorited.map((id) => ({ id: uid('Favorite'), itemId: id, favoritedById: userId })),
    })
    // A duplicate row (Favorite has no unique constraint) must not list the item twice.
    await prisma.favorite.create({ data: { id: uid('Favorite'), itemId: favorited[1], favoritedById: userId } })

    let cursor: string | undefined
    let pages = 0
    do {
      const [expected, actual] = await Promise.all([prismaReference(cursor, limit), getFavoritedItems({ userId, cursor, limit })])
      expect(canonical(actual)).toEqual(canonical(expected))
      cursor = actual.nextCursor ?? undefined
      pages++
    } while (cursor && pages < 20)
    expect(pages).toBeGreaterThan(limit === 50 ? 0 : 2)
  })

  it('lists 9 of the 12 favorites: the expired grant, the stranger workspace and the private item stay out', async () => {
    await prisma.favorite.createMany({
      data: favorited.map((id) => ({ id: uid('Favorite'), itemId: id, favoritedById: userId })),
    })
    const { items } = await getFavoritedItems({ userId })
    expect(items).toHaveLength(9)
    expect(items.map((i) => i.id)).not.toContain(favorited[8])
    expect(items.map((i) => i.id)).not.toContain(favorited[10])
    expect(items.map((i) => i.id)).not.toContain(privateItemId)
  })

  it('a cursor that no longer exists gives an empty page, as Prisma does', async () => {
    await prisma.favorite.create({ data: { id: uid('Favorite'), itemId: favorited[1], favoritedById: userId } })
    expect(await getFavoritedItems({ userId, cursor: 'item_gone' })).toEqual(await prismaReference('item_gone', 50))
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
