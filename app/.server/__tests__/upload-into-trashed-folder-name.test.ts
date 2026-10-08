import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '@/services/db'
import { createUploadedItem } from '@/services/item-actions'
import { getPrefixForModel, toObjectId } from '@/utils/converters'
import { wipeTestUsers } from './helpers/wipe-test-users'

/**
 * A directory upload must never land in a trashed folder of the same name.
 *
 * `findOrCreateFolderPath` reused any folder with the right name and parent,
 * trashed or not. Uploading `prisma/` into a folder whose previous `prisma/`
 * was in the trash filed all 64 new files inside the trashed one: they were
 * invisible where the user uploaded them and only showed up in Trash, which
 * reported the folder at double its size. Needs a live database (CI provides
 * one).
 */
const uid = (model: Parameters<typeof getPrefixForModel>[0]) =>
  toObjectId(getPrefixForModel(model))

let ownerId: string
let driveId: string
let rootId: string
let trashedFolderId: string

beforeAll(async () => {
  ownerId = uid('User')
  await prisma.user.create({
    data: {
      id: ownerId,
      name: 'Upload into trashed name',
      email: `uptrash-${ownerId}@test.local`,
      emailVerified: true,
    },
  })
  driveId = uid('Drive')
  await prisma.drive.create({ data: { id: driveId, ownerId } })
  // `createUploadedItem` charges the uploader's quota in the row's transaction,
  // and refuses the upload when there is no quota to charge.
  await prisma.quota.create({ data: { id: uid('Quota'), driveId, total: 10n ** 12n } })
  rootId = uid('Item')
  await prisma.item.create({
    data: {
      id: rootId,
      name: 'root',
      type: 'folder',
      category: 'unknown',
      status: 'normal',
      ownerId,
      driveId,
      parentId: null,
      size: 0,
    },
  })
  trashedFolderId = uid('Item')
  await prisma.item.create({
    data: {
      id: trashedFolderId,
      name: 'prisma',
      type: 'folder',
      category: 'unknown',
      status: 'trashed',
      ownerId,
      driveId,
      parentId: rootId,
      size: 0,
    },
  })
})

afterAll(async () => {
  await wipeTestUsers([ownerId])
  await prisma.user.deleteMany({ where: { id: ownerId } })
})

/** Uploads `prisma/<name>` into the root, the way a directory upload does. */
async function uploadIntoPrisma(name: string) {
  const id = uid('Item')
  await createUploadedItem({
    id,
    name,
    key: `${rootId}/prisma/${name}`,
    size: 10n,
    bucket: 'stashly-test-upload-trashed-name',
    driveId,
    parentId: rootId,
    ownerId,
    uploadId: `up-${id}`,
  })
  return prisma.item.findUniqueOrThrow({
    where: { id },
    select: { parent: { select: { id: true, status: true } } },
  })
}

describe('directory upload next to a trashed folder of the same name', () => {
  it('creates a new folder instead of filing into the trashed one', async () => {
    const { parent } = await uploadIntoPrisma('a.ts')

    expect(parent?.id).not.toBe(trashedFolderId)
    expect(parent?.status).toBe('normal')
  })

  it('reuses that new folder for the rest of the upload', async () => {
    const first = await uploadIntoPrisma('b.ts')
    const second = await uploadIntoPrisma('c.ts')

    expect(second.parent?.id).toBe(first.parent?.id)
    const live = await prisma.item.count({
      where: {
        parentId: rootId,
        name: 'prisma',
        type: 'folder',
        status: 'normal',
      },
    })
    expect(live).toBe(1)
  })
})
