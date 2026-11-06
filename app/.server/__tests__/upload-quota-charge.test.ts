import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/services/db'
import { createUploadedItem, trashItems } from '@/services/item-actions'
import { getPrefixForModel, toObjectId, toObjectKey } from '@/utils/converters'
import { flushItemSizes, withSizeRollupPaused } from './helpers/flush-item-sizes'
import { wipeTestUsers } from './helpers/wipe-test-users'

/**
 * An upload is charged on the server, in the same transaction that creates its
 * row, and nowhere else. The client used to post the charge to `/api/quota`
 * after the row existed, which let it skip the charge or name its own size.
 *
 * Needs a live database (CI provides one).
 */
const uid = (model: Parameters<typeof getPrefixForModel>[0]) =>
  toObjectId(getPrefixForModel(model))

let ownerId: string
let driveId: string
let rootId: string
let quotaId: string
let noQuotaId: string
let noQuotaRootId: string
let tight: { ownerId: string; driveId: string; rootId: string; quotaId: string }

async function makeUser(label: string) {
  const id = uid('User')
  await prisma.user.create({
    data: { id, name: label, email: `upquota-${id}@test.local`, emailVerified: true },
  })
  const drive = uid('Drive')
  await prisma.drive.create({ data: { id: drive, ownerId: id } })
  const root = uid('Item')
  await prisma.item.create({
    data: { id: root, name: 'root', type: 'folder', category: 'unknown', status: 'normal', ownerId: id, driveId: drive, parentId: null, size: 0 },
  })
  return { id, drive, root }
}

function upload(size: bigint, as = { ownerId, driveId, rootId }) {
  const id = uid('Item')
  return createUploadedItem({
    id,
    name: `${id}.bin`,
    key: toObjectKey(`${as.rootId}/${id}.bin`, id),
    uploadPath: `${as.rootId}/${id}.bin`,
    size,
    bucket: 'stashly-test-upload-quota',
    parentId: as.rootId,
    ownerId: as.ownerId,
    uploadId: `up-${id}`,
  })
}

async function used() {
  await flushItemSizes()
  const q = await prisma.quota.findUniqueOrThrow({ where: { id: quotaId }, select: { used: true } })
  return q.used
}

beforeAll(async () => {
  const owner = await makeUser('Upload quota')
  ownerId = owner.id
  driveId = owner.drive
  rootId = owner.root
  quotaId = uid('Quota')
  await prisma.quota.create({ data: { id: quotaId, driveId, total: 10n ** 12n } })

  const bare = await makeUser('Upload quota, none defined')
  noQuotaId = bare.id
  noQuotaRootId = bare.root

  const small = await makeUser('Upload quota, 1000 bytes')
  tight = { ownerId: small.id, driveId: small.drive, rootId: small.root, quotaId: uid('Quota') }
  await prisma.quota.create({ data: { id: tight.quotaId, driveId: small.drive, total: 1000n } })
})

afterAll(async () => {
  await wipeTestUsers([ownerId, noQuotaId, tight.ownerId, ...extraUsers])
  await prisma.user.deleteMany({ where: { id: { in: [ownerId, noQuotaId, tight.ownerId, ...extraUsers] } } })
})

const extraUsers: string[] = []

/** A user with a fresh quota of `total`, for a test that reads exact numbers. */
async function freshDrive(total: bigint) {
  const user = await makeUser('Upload quota, logged')
  extraUsers.push(user.id)
  await prisma.quota.create({ data: { id: uid('Quota'), driveId: user.drive, total } })
  return {
    as: { ownerId: user.id, driveId: user.drive, rootId: user.root },
    quota: () => prisma.quota.findUniqueOrThrow({ where: { driveId: user.drive }, select: { used: true, deleted: true, status: true } }),
    pending: () => prisma.quotaDelta.count({ where: { driveId: user.drive } }),
  }
}

describe('while the database is busy, the charge goes through the log', () => {
  it("logs a charge far from the limit, leaving the shared row alone until the rollup", async () => {
    const d = await freshDrive(10n ** 9n)

    await withSizeRollupPaused(async () => {
      await upload(500n, d.as)
      expect((await d.quota()).used).toBe(0n)
      expect(await d.pending()).toBe(1)
    })

    await flushItemSizes()
    expect((await d.quota()).used).toBe(500n)
    expect(await d.pending()).toBe(0)
  })

  it('counts logged charges against the limit', async () => {
    const d = await freshDrive(100_000n)

    await withSizeRollupPaused(async () => {
      await upload(900n, d.as)
      expect(await d.pending()).toBe(1)
      await expect(upload(99_101n, d.as)).rejects.toMatchObject({ status: 507 })
      await upload(99_100n, d.as)
    })

    await flushItemSizes()
    expect((await d.quota()).used).toBe(100_000n)
  })

  it('fills a drive to exactly its limit under parallel uploads', async () => {
    const d = await freshDrive(4_000n)

    const results = await withSizeRollupPaused(() =>
      Promise.allSettled(Array.from({ length: 60 }, () => upload(100n, d.as)))
    )

    await flushItemSizes()
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(40)
    expect(await d.quota()).toMatchObject({ used: 4_000n, status: 'critical' })
  })

  it("logs a folder's child count, and the rollup adds it", async () => {
    const d = await freshDrive(10n ** 9n)
    await prisma.folder.create({ data: { id: uid('Folder'), itemId: d.as.rootId } })
    const count = () =>
      prisma.folder.findUniqueOrThrow({ where: { itemId: d.as.rootId }, select: { childCount: true, inclusiveChildCount: true } })

    await withSizeRollupPaused(async () => {
      await upload(10n, d.as)
      expect(await count()).toEqual({ childCount: 0, inclusiveChildCount: 0 })
    })

    await flushItemSizes()
    expect(await count()).toEqual({ childCount: 1, inclusiveChildCount: 1 })
  })

  // `used` is clamped at 0, so a refund landing before its own charge would
  // floor there and the charge would then count the file twice.
  it('applies a logged charge before refunding it', async () => {
    const d = await freshDrive(10n ** 9n)
    const item = await withSizeRollupPaused(() => upload(300n, d.as))

    await trashItems([item.id], d.as.ownerId)

    await vi.waitFor(async () => {
      await flushItemSizes()
      expect(await d.quota()).toMatchObject({ used: 0n, deleted: 300n })
    })
  })
})

async function tightUsed() {
  await flushItemSizes()
  const q = await prisma.quota.findUniqueOrThrow({ where: { id: tight.quotaId }, select: { used: true } })
  return q.used
}

async function setTightUsed(value: bigint) {
  await prisma.quota.update({ where: { id: tight.quotaId }, data: { used: value } })
}

describe('createUploadedItem charges quota', () => {
  it('charges the uploader exactly the item size, once', async () => {
    const before = await used()
    await upload(1234n)
    expect((await used()) - before).toBe(1234n)
  })

  it('charges nothing for an empty file', async () => {
    const before = await used()
    await upload(0n)
    expect(await used()).toBe(before)
  })

  // The other half of "together or not at all": a charge that cannot be made
  // takes the row down with it, so no Item ever exists unbilled.
  it('files no row when the uploader has no quota to charge', async () => {
    const drive = await prisma.drive.findFirstOrThrow({ where: { ownerId: noQuotaId } })
    await expect(
      upload(10n, { ownerId: noQuotaId, driveId: drive.id, rootId: noQuotaRootId })
    ).rejects.toThrow()
    const rows = await prisma.item.count({ where: { ownerId: noQuotaId, type: 'file' } })
    expect(rows).toBe(0)
  })

  // Every upload of one user updates the same Quota row, so parallel uploads
  // queue on its lock. The charge is the transaction's last statement, which
  // keeps that wait to about one commit; a lost update would show as a total
  // short of the sum.
  it('sums parallel uploads exactly, well inside the transaction timeout', async () => {
    const before = await used()
    const sizes = Array.from({ length: 10 }, (_, i) => BigInt(100 + i))
    const started = performance.now()
    await Promise.all(sizes.map((size) => upload(size)))
    const elapsed = performance.now() - started
    console.log(`10 parallel uploads charged in ${elapsed.toFixed(0)} ms`)

    expect((await used()) - before).toBe(sizes.reduce((a, b) => a + b, 0n))
    expect(elapsed).toBeLessThan(5000)
  })
})

// The client's quota check can be skipped, so this is the enforcement.
describe('createUploadedItem refuses an upload that does not fit', () => {
  const tightRows = () => prisma.item.count({ where: { ownerId: tight.ownerId, type: 'file' } })

  it('answers 507 INSUFFICIENT_QUOTA, files no row and charges nothing', async () => {
    await setTightUsed(900n)
    const rowsBefore = await tightRows()
    const error = await upload(101n, tight).then(
      () => null,
      (e) => e
    )
    expect(error).toMatchObject({ errorCode: 'INSUFFICIENT_QUOTA', status: 507 })
    expect(await tightRows()).toBe(rowsBefore)
    expect(await tightUsed()).toBe(900n)
  })

  it('accepts an upload that exactly fills the quota', async () => {
    await setTightUsed(900n)
    await upload(100n, tight)
    expect(await tightUsed()).toBe(1000n)
  })

  // Two uploads that each fit alone but not together: the check sits in the
  // UPDATE's WHERE, so the second waits on the row lock and then sees the
  // first one's charge.
  it('lets only one of two concurrent uploads take the last free space', async () => {
    await setTightUsed(400n)
    const rowsBefore = await tightRows()
    const results = await Promise.allSettled([upload(500n, tight), upload(500n, tight)])
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    expect(await tightUsed()).toBe(900n)
    expect((await tightRows()) - rowsBefore).toBe(1)
  })
})
