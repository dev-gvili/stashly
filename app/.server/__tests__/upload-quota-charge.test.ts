import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '@/services/db'
import { createUploadedItem } from '@/services/item-actions'
import { getPrefixForModel, toObjectId } from '@/utils/converters'
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
    key: `${as.rootId}/${id}.bin`,
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
})

afterAll(async () => {
  await wipeTestUsers([ownerId, noQuotaId])
  await prisma.user.deleteMany({ where: { id: { in: [ownerId, noQuotaId] } } })
})

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
