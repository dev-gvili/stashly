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
import { buildItemFilters } from '@/utils/filters/item.filters'
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

  // A workspace gallery would hand every member the other members' keys.
  it('sends no storage key', async () => {
    const [media] = await getGalleryMedia(ownerId, {})
    expect(media).not.toHaveProperty('file')
  })

  // The owner scope is AND-ed with the URL filters, so a filter can only
  // narrow it: naming another owner finds nothing rather than their media.
  it('a filter naming another owner never returns their media', async () => {
    expect(await getGalleryMedia(ownerId, { ownerId: viewerId })).toEqual([])
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
  let trashedWorkspaceImageId: string
  let trashedPersonalImageId: string

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
    // `memberId`'s workspace upload and personal image, both in trash.
    trashedWorkspaceImageId = await makeItem(memberId, memberDrive, 'ws-trashed.png', 'image', workspaceId)
    trashedPersonalImageId = await makeItem(memberId, memberDrive, 'personal-trashed.png', 'image')
    await prisma.item.updateMany({
      where: { id: { in: [trashedWorkspaceImageId, trashedPersonalImageId] } },
      data: { status: 'trashed' },
    })
    for (const id of [
      workspaceImageId,
      hiddenWorkspaceImageId,
      memberPersonalImageId,
      otherWorkspaceImageId,
      trashedWorkspaceImageId,
      trashedPersonalImageId,
    ]) {
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

  // The URL filters are one `{ AND: [...] }`, and so is the access scope: spread
  // after them, the scope replaced the filters, the default status with them.
  it('keeps trash out with the default filters, and applies a URL filter', async () => {
    const defaults = buildItemFilters({ status: ['normal'] } as never)
    const ids = (await getGalleryMedia(memberId, defaults, undefined, workspaceId)).map((m) => m.id)
    expect(ids).not.toContain(trashedWorkspaceImageId)

    const named = { AND: [{ name: 'ws-shared.png' }] }
    const media = await getGalleryMedia(memberId, named, undefined, workspaceId)
    expect(media.map((m) => m.id)).toEqual([workspaceImageId])
  })

  it('keeps trash out of either gallery whatever the URL asks', async () => {
    const trashed = buildItemFilters({ status: ['trashed'] } as never)
    const workspace = await getGalleryMedia(memberId, trashed, undefined, workspaceId)
    const personal = await getGalleryMedia(memberId, trashed)
    expect([...workspace, ...personal]).toEqual([])
  })

  it('refuses a user who is not a member of the workspace', async () => {
    await expect(getGalleryMedia(outsiderId, {}, undefined, workspaceId)).rejects.toMatchObject({
      status: 403,
    })
  })

  it('keeps the personal gallery on the user’s own media', async () => {
    const ids = (await getGalleryMedia(memberId, {})).map((m) => m.id)
    expect(ids).toContain(memberPersonalImageId)
    // Their own upload into a workspace belongs to that workspace's gallery.
    expect(ids).not.toContain(otherWorkspaceImageId)
    expect(ids).not.toContain(workspaceImageId)
    expect(ids).not.toContain(hiddenWorkspaceImageId)
  })
})
