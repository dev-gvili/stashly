import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '@/services/db'
import { getMediaSiblings, trashItems } from '@/services/item-actions'
import { getPrefixForModel, toObjectId } from '@/utils/converters'
import { wipeTestUsers } from './helpers/wipe-test-users'

/**
 * The file viewer's prev/next arrows and its "n of N" counter come from
 * `getMediaSiblings`. A trashed file keeps its `parentId`, so a sibling query
 * without a status filter counted it ("1 of 16" in a folder of 10 images) and
 * pointed an arrow at it. Trashed through the real `trashItems`.
 *
 * Needs a live database (CI provides one).
 */
const uid = (model: Parameters<typeof getPrefixForModel>[0]) => toObjectId(getPrefixForModel(model))

let ownerId: string
let driveId: string
let folderId: string

async function make(name: string, type: 'file' | 'folder', category: 'image' | 'video' | 'document' | 'unknown', parentId: string | null) {
  const id = uid('Item')
  await prisma.item.create({
    data: { id, name, type, category, status: 'normal', ownerId, driveId, parentId, size: 0 },
  })
  return id
}

beforeAll(async () => {
  ownerId = uid('User')
  await prisma.user.create({ data: { id: ownerId, name: 'Media siblings', email: `siblings-${ownerId}@test.local`, emailVerified: true } })
  driveId = uid('Drive')
  await prisma.drive.create({ data: { id: driveId, ownerId } })
  await prisma.quota.create({ data: { id: uid('Quota'), driveId, total: 10n ** 9n, used: 0n, deleted: 0n } })
  folderId = await make('Photos', 'folder', 'unknown', null)
})

afterAll(async () => {
  await wipeTestUsers([ownerId])
  await prisma.user.deleteMany({ where: { id: ownerId } })
})

describe('getMediaSiblings', () => {
  it('lists only live images and videos, by name, leaving out trashed ones', async () => {
    await make('a.jpg', 'file', 'image', folderId)
    const trashedB = await make('b.jpg', 'file', 'image', folderId)
    await make('c.mp4', 'file', 'video', folderId)
    const trashedD = await make('d.png', 'file', 'image', folderId)
    await make('e.pdf', 'file', 'document', folderId)
    await make('Sub', 'folder', 'unknown', folderId)

    await trashItems([trashedB, trashedD], ownerId)

    const siblings = await getMediaSiblings(ownerId, folderId)
    // b.jpg sat between a.jpg and c.mp4: the arrows must step over it.
    expect(siblings.map((s) => s.name)).toEqual(['a.jpg', 'c.mp4'])
  })
})
