import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

// Signing needs the S3 endpoint from `.env`, which CI does not set: the first
// run of this file failed there with `Invalid URL` (input 'undefined'). These
// tests are about which rows come back, so signing is replaced, not exercised.
vi.mock('@/services/s3', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/s3')>()),
  getPresignedUrl: vi.fn(async () => 'https://signed.test/thumbnail.webp'),
}))

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

async function makeItem(
  owner: string,
  drive: string,
  name: string,
  category: 'image' | 'document' = 'document',
  workspaceId?: string
) {
  const id = uid('Item')
  await prisma.item.create({
    data: { id, name, type: 'file', category, status: 'normal', ownerId: owner, driveId: drive, size: 0, workspaceId },
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
    expect(media[0].thumbnails[0].url).toBe('https://signed.test/thumbnail.webp')
  })

  // The owner is written after the URL filters, so no filter can widen it.
  it('a filter naming another owner still returns only the user’s own media', async () => {
    const media = await getGalleryMedia(ownerId, { ownerId: viewerId })
    expect(media.map((m) => m.id)).toEqual([ownerImageId])
  })
})

// The workspace gallery lists the workspace's media, not the viewer's own
// (the loader used to ignore `:workspaceId`).
describe('getGalleryMedia in a workspace', () => {
  let workspaceId: string
  let memberId: string
  let outsiderId: string
  let uploaderId: string
  let memberDrive: string
  let uploaderDrive: string
  let workspaceImageId: string
  let otherWorkspaceImageId: string
  let memberPersonalImageId: string
  let hiddenWorkspaceImageId: string

  beforeAll(async () => {
    ;[memberId, outsiderId, uploaderId] = [uid('User'), uid('User'), uid('User')]
    await prisma.user.createMany({
      data: [memberId, outsiderId, uploaderId].map((id, i) => ({
        id,
        name: `Gallery ws ${i}`,
        email: `galleryws-${id}@test.local`,
        emailVerified: true,
      })),
    })
    ;[memberDrive, uploaderDrive] = [uid('Drive'), uid('Drive')]
    await prisma.drive.createMany({
      data: [
        { id: memberDrive, ownerId: memberId },
        { id: uploaderDrive, ownerId: uploaderId },
      ],
    })

    workspaceId = uid('Workspace')
    await prisma.workspace.create({ data: { id: workspaceId, name: 'Gallery test WS' } })
    await prisma.workspaceMember.createMany({
      data: [
        { id: uid('WorkspaceMember'), memberId, workspaceId, role: 'member' },
        { id: uid('WorkspaceMember'), memberId: uploaderId, workspaceId, role: 'member' },
      ],
    })

    // Uploaded by `uploaderId`, shared with `memberId` through a grant.
    workspaceImageId = await makeItem(uploaderId, uploaderDrive, 'ws-shared.png', 'image', workspaceId)
    await grant(memberId, workspaceImageId)
    // Uploaded by `uploaderId`, no grant: `memberId` may not read it.
    hiddenWorkspaceImageId = await makeItem(uploaderId, uploaderDrive, 'ws-hidden.png', 'image', workspaceId)
    // The member's own personal image: not part of the workspace.
    memberPersonalImageId = await makeItem(memberId, memberDrive, 'personal.png', 'image')
    // `memberId`'s own upload into the workspace.
    otherWorkspaceImageId = await makeItem(memberId, memberDrive, 'ws-own.png', 'image', workspaceId)
    for (const id of [workspaceImageId, hiddenWorkspaceImageId, memberPersonalImageId, otherWorkspaceImageId]) {
      await storedThumbnail(id)
    }
  })

  afterAll(async () => {
    const users = [memberId, outsiderId, uploaderId]
    await prisma.permission.deleteMany({ where: { users: { some: { id: { in: users } } } } })
    await prisma.workspaceMember.deleteMany({ where: { workspaceId } })
    await wipeTestUsers(users)
    await prisma.workspace.deleteMany({ where: { id: workspaceId } })
  })

  it('lists the workspace media the member may read, not their personal images', async () => {
    const media = await getGalleryMedia(memberId, {}, undefined, workspaceId)
    expect(media.map((m) => m.id).sort()).toEqual([workspaceImageId, otherWorkspaceImageId].sort())
  })

  it('refuses a user who is not a member of the workspace', async () => {
    await expect(getGalleryMedia(outsiderId, {}, undefined, workspaceId)).rejects.toMatchObject({
      status: 403,
    })
  })

  it('keeps the personal gallery on the user’s own media', async () => {
    const ids = (await getGalleryMedia(memberId, {})).map((m) => m.id)
    expect(ids).toContain(memberPersonalImageId)
    expect(ids).not.toContain(workspaceImageId)
    expect(ids).not.toContain(hiddenWorkspaceImageId)
  })
})
