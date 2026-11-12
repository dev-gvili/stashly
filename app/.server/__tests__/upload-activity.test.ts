import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/services/db'
import { createUploadedItem } from '@/services/item-actions'
import { getPrefixForModel, toObjectId, toObjectKey } from '@/utils/converters'
import { wipeTestUsers } from './helpers/wipe-test-users'

/**
 * The upload activity must be written after the item's transaction commits.
 * It used to be started inside that transaction on the global client, so its
 * lookup of the item ran on another connection before the commit: under
 * upload load it failed with P2025, silently, and 376 of 575 files in one
 * directory upload had no activity.
 *
 * Timing made the old failure intermittent, so this test checks the order
 * directly: no activity write may start while a transaction is still open.
 * Needs a live database (CI provides one).
 */
const uid = (model: Parameters<typeof getPrefixForModel>[0]) => toObjectId(getPrefixForModel(model))

let ownerId: string
let driveId: string
let rootId: string

beforeAll(async () => {
  ownerId = uid('User')
  await prisma.user.create({ data: { id: ownerId, name: 'Upload activity', email: `upact-${ownerId}@test.local`, emailVerified: true } })
  driveId = uid('Drive')
  await prisma.drive.create({ data: { id: driveId, ownerId } })
  // `createUploadedItem` charges the uploader's quota in the row's transaction,
  // and refuses the upload when there is no quota to charge.
  await prisma.quota.create({ data: { id: uid('Quota'), driveId, total: 10n ** 12n } })
  rootId = uid('Item')
  await prisma.item.create({
    data: { id: rootId, name: 'root', type: 'folder', category: 'unknown', status: 'normal', ownerId, driveId, parentId: null, size: 0 },
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

afterAll(async () => {
  await wipeTestUsers([ownerId])
  await prisma.user.deleteMany({ where: { id: ownerId } })
})

/**
 * For every activity write about `fileId`, whether any transaction was still
 * open at the moment it was called. Tracked in-process, so it can't be won by
 * timing the way a visibility query can.
 */
function watchActivityWrites(fileId: string) {
  const openAtWrite: boolean[] = []
  let open = 0
  const transaction = prisma.$transaction.bind(prisma)
  vi.spyOn(prisma, '$transaction').mockImplementation(((...args: any[]) => {
    open++
    // eslint-disable-next-line no-restricted-syntax -- spy wrapper around a Prisma method whose overloads are not worth reproducing in a test
    return (transaction as any)(...args).finally(() => open--)
  // eslint-disable-next-line no-restricted-syntax -- spy wrapper around a Prisma method whose overloads are not worth reproducing in a test
  }) as any)
  const create = prisma.activity.create.bind(prisma.activity)
  vi.spyOn(prisma.activity, 'create').mockImplementation(((args: any) => {
    if (args?.data?.item?.connect?.id === fileId) openAtWrite.push(open > 0)
    return create(args)
  // eslint-disable-next-line no-restricted-syntax -- spy wrapper around a Prisma method whose overloads are not worth reproducing in a test
  }) as any)
  const executeRaw = prisma.$executeRaw.bind(prisma)
  vi.spyOn(prisma, '$executeRaw').mockImplementation(((...args: any[]) => {
    if (args.slice(1).flat().includes(fileId)) openAtWrite.push(open > 0)
    // eslint-disable-next-line no-restricted-syntax -- spy wrapper around a Prisma method whose overloads are not worth reproducing in a test
    return (executeRaw as any)(...args)
  // eslint-disable-next-line no-restricted-syntax -- spy wrapper around a Prisma method whose overloads are not worth reproducing in a test
  }) as any)
  return openAtWrite
}

describe('upload activity', () => {
  it('is written only after the item is committed, for the file and the folders created for it', async () => {
    const fileId = uid('Item')
    const uploadId = `up-${fileId}`
    const openAtWrite = watchActivityWrites(fileId)

    await createUploadedItem({
      id: fileId,
      name: 'a.ts',
      key: toObjectKey(`${rootId}/created-folder/a.ts`, fileId),
      uploadPath: `${rootId}/created-folder/a.ts`,
      size: 10n,
      bucket: 'stashly-test-upload-activity',
      parentId: rootId,
      ownerId,
      uploadId,
    })

    await vi.waitFor(async () => {
      const folder = await prisma.item.findFirstOrThrow({ where: { parentId: rootId, name: 'created-folder' } })
      const rows = await prisma.activity.findMany({
        where: { itemId: { in: [fileId, folder.id] } },
        include: { action: { include: { upload: true } } },
      })
      expect(rows).toHaveLength(2)
      expect(rows.map((r) => r.action?.upload?.uploadId)).toEqual([uploadId, uploadId])
    })

    expect(openAtWrite.length).toBeGreaterThan(0)
    expect(openAtWrite).not.toContain(true)
  })
})
