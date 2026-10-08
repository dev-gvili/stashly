import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '@/services/db'
import { getItemsSharedWithUser } from '@/services/share-actions'
import { getGalleryMedia } from '@/services/thumbnail-actions'
import { getPrefixForModel, toObjectId } from '@/utils/converters'
import { wipeTestUsers } from './helpers/wipe-test-users'

/**
 * The queries moved out of `routes/stash/shares.tsx` and `routes/stash/gallery.tsx`
 * (tech-debt item 23) read only what the signed-in user may see.
 *
 * Needs a live database (CI provides one).
 */
const uid = (model: Parameters<typeof getPrefixForModel>[0]) =>
  toObjectId(getPrefixForModel(model))

let ownerId: string
let viewerId: string
let expiredId: string
let ownerDrive: string
let viewerDrive: string
let sharedId: string
let ownerImageId: string
let viewerImageId: string

async function makeItem(owner: string, drive: string, name: string, category: 'image' | 'document' = 'document') {
  const id = uid('Item')
  await prisma.item.create({
    data: { id, name, type: 'file', category, status: 'normal', ownerId: owner, driveId: drive, size: 0 },
  })
  return id
}

async function grant(userId: string, itemId: string, expiresAt?: Date) {
  await prisma.permission.create({
    data: { id: uid('Permission'), itemId, roles: 'read', expiresAt, users: { connect: { id: userId } } },
  })
}

async function storedThumbnail(itemId: string) {
  await prisma.thumbnail.create({
    data: { id: uid('Thumbnail'), itemId, bucket: 'stashly-test-route-queries', stage: 2, width: 512, height: 384 },
  })
}

beforeAll(async () => {
  ;[ownerId, viewerId, expiredId] = [uid('User'), uid('User'), uid('User')]
  await prisma.user.createMany({
    data: [ownerId, viewerId, expiredId].map((id, i) => ({
      id,
      name: `Route queries ${i}`,
      email: `routeq-${id}@test.local`,
      emailVerified: true,
    })),
  })
  ;[ownerDrive, viewerDrive] = [uid('Drive'), uid('Drive')]
  await prisma.drive.createMany({
    data: [
      { id: ownerDrive, ownerId },
      { id: viewerDrive, ownerId: viewerId },
    ],
  })

  sharedId = await makeItem(ownerId, ownerDrive, 'shared.txt')
  await makeItem(ownerId, ownerDrive, 'private.txt')
  await grant(viewerId, sharedId)
  await grant(expiredId, sharedId, new Date(Date.now() - 60_000))

  ownerImageId = await makeItem(ownerId, ownerDrive, 'owner.png', 'image')
  viewerImageId = await makeItem(viewerId, viewerDrive, 'viewer.png', 'image')
  await storedThumbnail(ownerImageId)
  await storedThumbnail(viewerImageId)
})

afterAll(async () => {
  const users = [ownerId, viewerId, expiredId]
  await prisma.permission.deleteMany({ where: { users: { some: { id: { in: users } } } } })
  await wipeTestUsers(users)
  await prisma.user.deleteMany({ where: { id: { in: users } } })
})

describe('getItemsSharedWithUser', () => {
  it('returns the items shared with the user, and nothing else', async () => {
    const { items, hasMore } = await getItemsSharedWithUser(viewerId)
    expect(items.map((i) => i.id)).toEqual([sharedId])
    expect(hasMore).toBe(false)
  })

  it('ignores an expired grant', async () => {
    expect((await getItemsSharedWithUser(expiredId)).items).toEqual([])
  })

  it('does not list the owner’s own items as shared with them', async () => {
    expect((await getItemsSharedWithUser(ownerId)).items).toEqual([])
  })
})

describe('getGalleryMedia', () => {
  it('returns only the user’s own media, with a signed thumbnail', async () => {
    const media = await getGalleryMedia(ownerId, {})
    expect(media.map((m) => m.id)).toEqual([ownerImageId])
    expect(media[0].thumbnails[0].url).toMatch(/^https?:\/\//)
  })

  // The owner is written after the URL filters, so no filter can widen it.
  it('a filter naming another owner still returns only the user’s own media', async () => {
    const media = await getGalleryMedia(ownerId, { ownerId: viewerId })
    expect(media.map((m) => m.id)).toEqual([ownerImageId])
  })
})
