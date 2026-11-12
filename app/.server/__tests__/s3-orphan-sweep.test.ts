import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import {
  AbortMultipartUploadCommand,
  DeleteObjectsCommand,
  ListMultipartUploadsCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3'
import { prisma } from '@/services/db'
import { s3 } from '@/services/s3'
import { ORPHAN_SWEEP_MIN_AGE_MS, sweepBucket } from '@/services/s3-orphan-sweep'
import { getPrefixForModel, toObjectId } from '@/utils/converters'
import { wipeTestUsers } from './helpers/wipe-test-users'

/**
 * The scheduled orphan sweep (tech-debt item 59): an upload whose bytes reached
 * the bucket but whose row was never filed is charged to no one, so the sweep
 * deletes it once it is older than the age floor. A filed upload is kept.
 *
 * Needs a live database for the `File` and `Item` lookups. S3 is not available
 * in CI, so the client's `send` serves a fake bucket listing and records the
 * deletes and aborts it receives.
 */
const uid = (model: Parameters<typeof getPrefixForModel>[0]) => toObjectId(getPrefixForModel(model))
const BUCKET = 'stashly-test-orphan-sweep'
const NOW = new Date('2026-11-12T20:00:00Z')
const OLD = new Date(NOW.getTime() - ORPHAN_SWEEP_MIN_AGE_MS - 3600_000)
const YOUNG = new Date(NOW.getTime() - 3600_000)

let ownerId: string
let filedItemId: string
const FILED_KEY = 'fld/filed.pdf'
const UNFILED_KEY = 'fld/never-filed.pdf'
const YOUNG_KEY = 'fld/in-flight.pdf'
const GONE_ITEM_ID = uid('Item')

function fakeBucket() {
  const calls = { deleted: [] as string[], aborted: [] as string[] }
  vi.spyOn(s3, 'send').mockImplementation(async (command: any) => {
    if (command.input.Bucket !== BUCKET) throw new Error(`unexpected bucket ${command.input.Bucket}`)
    if (command instanceof ListObjectsV2Command) {
      return {
        IsTruncated: false,
        Contents: [
          { Key: FILED_KEY, LastModified: OLD, Size: 100 },
          { Key: UNFILED_KEY, LastModified: OLD, Size: 2048 },
          { Key: YOUNG_KEY, LastModified: YOUNG, Size: 50 },
          { Key: `thumbnails/${filedItemId}.webp`, LastModified: OLD, Size: 10 },
          { Key: `thumbnails/${GONE_ITEM_ID}.webp`, LastModified: OLD, Size: 7 },
        ],
      } as any
    }
    if (command instanceof ListMultipartUploadsCommand) {
      return {
        Uploads: [
          { Key: 'fld/stale.bin', UploadId: 'up-stale', Initiated: OLD },
          { Key: 'fld/active.bin', UploadId: 'up-active', Initiated: YOUNG },
        ],
      } as any
    }
    if (command instanceof DeleteObjectsCommand) {
      calls.deleted.push(...(command.input.Delete?.Objects ?? []).map((o) => o.Key!))
      return { Errors: [] } as any
    }
    if (command instanceof AbortMultipartUploadCommand) {
      calls.aborted.push(command.input.UploadId!)
      return {} as any
    }
    throw new Error(`unexpected command ${command.constructor.name}`)
  })
  return calls
}

beforeAll(async () => {
  ownerId = uid('User')
  await prisma.user.create({ data: { id: ownerId, name: 'Orphan sweep', email: `sweep-${ownerId}@test.local`, emailVerified: true } })
  const driveId = uid('Drive')
  await prisma.drive.create({ data: { id: driveId, ownerId } })
  filedItemId = uid('Item')
  await prisma.item.create({
    data: { id: filedItemId, name: 'filed.pdf', type: 'file', category: 'document', ownerId, driveId, size: 100 },
  })
  await prisma.file.create({ data: { id: uid('File'), itemId: filedItemId, bucket: BUCKET, key: FILED_KEY, uploadPath: FILED_KEY } })
})

afterEach(() => {
  vi.restoreAllMocks()
})

afterAll(async () => {
  await wipeTestUsers([ownerId])
  await prisma.user.deleteMany({ where: { id: ownerId } })
})

describe('orphan sweep', () => {
  it('deletes an upload that was never filed and keeps the filed one', async () => {
    const calls = fakeBucket()
    const s = await sweepBucket(BUCKET, { apply: true, now: NOW })

    expect(calls.deleted.sort()).toEqual([UNFILED_KEY, `thumbnails/${GONE_ITEM_ID}.webp`].sort())
    expect(calls.deleted).not.toContain(FILED_KEY)
    expect(calls.deleted).not.toContain(`thumbnails/${filedItemId}.webp`)
    // Younger than the floor: an upload whose row may still be on its way.
    expect(calls.deleted).not.toContain(YOUNG_KEY)
    expect(calls.aborted).toEqual(['up-stale'])
    expect(s).toMatchObject({ objects: 5, referenced: 2, tooYoung: 1, orphanBytes: 2048 + 7, deleted: 2, aborted: 1, youngUploads: 1 })
    expect(s.deleteFailures).toEqual([])
    expect(s.abortFailures).toEqual([])
  })

  it('changes nothing on a dry run', async () => {
    const calls = fakeBucket()
    const s = await sweepBucket(BUCKET, { apply: false, now: NOW })

    expect(calls.deleted).toEqual([])
    expect(calls.aborted).toEqual([])
    expect(s.orphans.map((o) => o.key).sort()).toEqual([UNFILED_KEY, `thumbnails/${GONE_ITEM_ID}.webp`].sort())
    expect(s.staleUploads.map((u) => u.uploadId)).toEqual(['up-stale'])
  })

  it('keeps an upload once its row is filed', async () => {
    const itemId = uid('Item')
    const driveId = (await prisma.drive.findFirstOrThrow({ where: { ownerId } })).id
    await prisma.item.create({ data: { id: itemId, name: 'never-filed.pdf', type: 'file', category: 'document', ownerId, driveId, size: 2048 } })
    await prisma.file.create({ data: { id: uid('File'), itemId, bucket: BUCKET, key: UNFILED_KEY, uploadPath: UNFILED_KEY } })
    try {
      const calls = fakeBucket()
      await sweepBucket(BUCKET, { apply: true, now: NOW })
      expect(calls.deleted).toEqual([`thumbnails/${GONE_ITEM_ID}.webp`])
    } finally {
      await prisma.item.delete({ where: { id: itemId } })
    }
  })
})
