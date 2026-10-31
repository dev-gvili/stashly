import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '@/services/db'
import { createUploadedItem } from '@/services/item-actions'
import { getPrefixForModel, toObjectId, toObjectKey } from '@/utils/converters'
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
    driveId: as.driveId,
    parentId: as.rootId,
    ownerId: as.ownerId,
    uploadId: `up-${id}`,
  })
}

async function used() {
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
  await wipeTestUsers([ownerId, noQuotaId, tight.ownerId])
  await prisma.user.deleteMany({ where: { id: { in: [ownerId, noQuotaId, tight.ownerId] } } })
})

async function tightUsed() {
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
