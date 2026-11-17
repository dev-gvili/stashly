import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '@/services/db'
import { emptyUserBucket } from '@/services/storage-actions'
import { getPrefixForModel, toObjectId } from '@/utils/converters'
import { wipeTestUsers } from './helpers/wipe-test-users'

/**
 * "Empty bucket" deletes every item a user owns in one transaction. Each
 * deleted `Item` row fires about 26 per-row foreign-key triggers (one per table
 * that references `Item`, plus the cascades they start), so the delete costs a
 * fixed amount per item: 0.5–1.1 ms on the dev database, measured on an
 * account of 10,066 items in a rolled-back transaction (18 Nov). That account
 * took 9.8 s, and Prisma's default 5 s transaction limit rolled the wipe back
 * every time.
 *
 * A tree that big takes too long to build here, so a trigger scoped to this
 * test's user adds 4 ms to each deleted row: 1,500 items cost the wipe about
 * 6 s, past the old limit and inside a budget that grows with the item count.
 * Needs a live database with migrations applied (CI provides one).
 */
const uid = (model: Parameters<typeof getPrefixForModel>[0]) => toObjectId(getPrefixForModel(model))

const ITEMS = 1_500
const DELAY_FN = 'stashly_test_slow_item_delete'

let ownerId: string
let rootId: string
let trigger: string

beforeAll(async () => {
  ownerId = uid('User')
  rootId = uid('Item')
  trigger = `slow_delete_${ownerId.replace(/\W/g, '_')}`
  // An empty bucket name skips the S3 step.
  await prisma.user.create({
    data: { id: ownerId, name: 'Bucket wipe', email: `wipe-${ownerId}@test.local`, emailVerified: true, bucket: '' },
  })
  const driveId = uid('Drive')
  await prisma.drive.create({ data: { id: driveId, ownerId } })
  await prisma.quota.create({ data: { id: uid('Quota'), driveId, total: 10n ** 12n } })
  await prisma.item.create({
    data: { id: rootId, name: 'root', type: 'folder', category: 'unknown', status: 'normal', ownerId, driveId, folder: { create: { id: uid('Folder') } } },
  })
  await prisma.user.update({ where: { id: ownerId }, data: { rootId } })
  await prisma.item.createMany({
    data: Array.from({ length: ITEMS }, (_, n) => ({
      id: uid('Item'), name: `f${n}`, type: 'file' as const, category: 'document' as const, status: 'normal' as const, ownerId, driveId, parentId: rootId, size: 1,
    })),
  })
  await prisma.$executeRawUnsafe(`
    CREATE OR REPLACE FUNCTION ${DELAY_FN}() RETURNS trigger LANGUAGE plpgsql AS $$
    DECLARE until timestamptz := clock_timestamp() + interval '4 ms';
    BEGIN
      -- Spin rather than pg_sleep, which sleeps about 16 ms on Windows.
      WHILE clock_timestamp() < until LOOP END LOOP;
      RETURN OLD;
    END $$`)
  await prisma.$executeRawUnsafe(`
    CREATE TRIGGER ${trigger} BEFORE DELETE ON "Item" FOR EACH ROW
    WHEN (OLD."ownerId" = '${ownerId}') EXECUTE FUNCTION ${DELAY_FN}()`)
}, 60_000)

afterAll(async () => {
  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${trigger} ON "Item"`)
  await wipeTestUsers([ownerId])
  await prisma.user.deleteMany({ where: { id: ownerId } })
}, 60_000)

describe('emptyUserBucket', () => {
  it('wipes a tree whose delete takes longer than 5 s', async () => {
    await emptyUserBucket(ownerId)

    expect(await prisma.item.findMany({ where: { ownerId }, select: { id: true } })).toEqual([{ id: rootId }])
    const root = await prisma.item.findUniqueOrThrow({ where: { id: rootId }, include: { folder: true } })
    expect([root.size, root.folder?.childCount]).toEqual([0n, 0])
  }, 60_000)
})
