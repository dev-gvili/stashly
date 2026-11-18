import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '@/services/db'
import { emptyUserBucket } from '@/services/storage-actions'
import { StashlyErrorCode } from '@/utils/api.errors'
import { getPrefixForModel, toObjectId } from '@/utils/converters'
import { wipeTestUsers } from './helpers/wipe-test-users'

/**
 * "Empty bucket" deletes the user's rows, then the bucket's objects. When the
 * bucket was gone (dev-gvili, 17 Nov), the rows went first and the S3 step then
 * failed with NoSuchBucket: 10,066 items lost and a 500. The wipe now checks the
 * bucket before it touches a row and refuses if it can't be reached.
 *
 * Runs against the real database and the real S3 client, no stub. Locally the
 * bucket answers 404 (`BUCKET_NOT_FOUND`); CI has no S3 credentials, so the
 * check fails there instead (`EMPTY_BUCKET_FAILED`). Both are refusals, and in
 * both the rows must still be there.
 */
const uid = (model: Parameters<typeof getPrefixForModel>[0]) => toObjectId(getPrefixForModel(model))

let ownerId: string
let rootId: string

beforeAll(async () => {
  ownerId = uid('User')
  rootId = uid('Item')
  await prisma.user.create({
    data: {
      id: ownerId,
      name: 'Missing bucket',
      email: `missing-bucket-${ownerId}@test.local`,
      emailVerified: true,
      bucket: `stashly-test-missing-${ownerId.slice(4).toLowerCase().replace(/[^a-z0-9]/g, '')}`,
    },
  })
  const driveId = uid('Drive')
  await prisma.drive.create({ data: { id: driveId, ownerId } })
  await prisma.quota.create({ data: { id: uid('Quota'), driveId, total: 10n ** 12n } })
  await prisma.item.create({
    data: { id: rootId, name: 'root', type: 'folder', category: 'unknown', status: 'normal', ownerId, driveId, folder: { create: { id: uid('Folder') } } },
  })
  await prisma.user.update({ where: { id: ownerId }, data: { rootId } })
  await prisma.item.createMany({
    data: Array.from({ length: 3 }, (_, n) => ({
      id: uid('Item'), name: `f${n}`, type: 'file' as const, category: 'document' as const, status: 'normal' as const, ownerId, driveId, parentId: rootId, size: 1,
    })),
  })
}, 60_000)

afterAll(async () => {
  await wipeTestUsers([ownerId])
  await prisma.user.deleteMany({ where: { id: ownerId } })
}, 60_000)

describe('emptyUserBucket', () => {
  it('refuses, and deletes nothing, when the bucket cannot be reached', async () => {
    const error = await emptyUserBucket(ownerId).then(
      () => null,
      (e: unknown) => e
    )

    expect(error).toMatchObject({
      errorCode: expect.stringMatching(
        new RegExp(`^(${StashlyErrorCode.BUCKET_NOT_FOUND}|${StashlyErrorCode.EMPTY_BUCKET_FAILED})$`)
      ),
    })
    expect(await prisma.item.count({ where: { ownerId } })).toBe(4)
  }, 30_000)
})
