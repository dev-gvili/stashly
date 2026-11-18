import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '@/services/db'
import { ensureUserBucket, repointUserBucket } from '@/services/storage-actions'
import { getPrefixForModel, toObjectId } from '@/utils/converters'
import { wipeTestUsers } from './helpers/wipe-test-users'

/**
 * A user whose bucket was deleted gets a new one at sign-in, and every row that
 * named the old bucket moves to it in one statement (`repointUserBucket`).
 * These cases need the live database only; the S3 half (HeadBucket, create,
 * the duplicate-bucket cleanup after a race) runs against real Tigris in
 * `tests/e2e/bucket-repair.spec.ts`, where CI has the keys.
 */
const uid = (model: Parameters<typeof getPrefixForModel>[0]) => toObjectId(getPrefixForModel(model))

const OLD = `stashly-test-repair-old-${Date.now()}`
const NEW = `stashly-test-repair-new-${Date.now()}`
const OTHER = `stashly-test-repair-other-${Date.now()}`

let ownerId: string
let otherId: string
let ownerDriveId: string
const ids = {
  ownFile: '', ownThumb: '', copyFile: '', copyThumb: '', otherFile: '', otherThumb: '', placeholderThumb: '',
}

async function makeUser(name: string, bucket: string, driveName: string) {
  const id = uid('User')
  const driveId = uid('Drive')
  await prisma.user.create({ data: { id, name, email: `${id}@test.local`, emailVerified: true, bucket } })
  await prisma.drive.create({ data: { id: driveId, ownerId: id, name: driveName } })
  await prisma.user.update({ where: { id }, data: { driveId } })
  return { id, driveId }
}

/** A file item with a stage-2 thumbnail, both naming `bucket`. */
async function makeFile(ownerIdArg: string, driveId: string, bucket: string, thumbBucket: string | null = bucket) {
  const itemId = uid('Item')
  await prisma.item.create({
    data: { id: itemId, name: `f-${itemId}`, type: 'file', category: 'document', status: 'normal', ownerId: ownerIdArg, driveId, size: 1 },
  })
  const fileId = uid('File')
  await prisma.file.create({ data: { id: fileId, itemId, bucket, key: `k/${itemId}`, uploadPath: `k/${itemId}` } })
  const thumbId = uid('Thumbnail')
  await prisma.thumbnail.create({ data: { id: thumbId, itemId, bucket: thumbBucket, stage: thumbBucket ? 2 : 0 } })
  return { fileId, thumbId }
}

beforeAll(async () => {
  const owner = await makeUser('Repair owner', OLD, OLD)
  const other = await makeUser('Repair other', OTHER, 'Stashly Drive')
  ownerId = owner.id
  otherId = other.id
  ownerDriveId = owner.driveId
  const own = await makeFile(ownerId, owner.driveId, OLD)
  // A copy another user owns still names the original's bucket (`copyItem`).
  const copy = await makeFile(otherId, other.driveId, OLD)
  const unrelated = await makeFile(otherId, other.driveId, OTHER)
  // A stage-0 placeholder has no bucket and must stay that way.
  const placeholder = await makeFile(ownerId, owner.driveId, OLD, null)
  Object.assign(ids, {
    ownFile: own.fileId, ownThumb: own.thumbId,
    copyFile: copy.fileId, copyThumb: copy.thumbId,
    otherFile: unrelated.fileId, otherThumb: unrelated.thumbId,
    placeholderThumb: placeholder.thumbId,
  })
}, 60_000)

afterAll(async () => {
  await wipeTestUsers([ownerId, otherId])
  await prisma.user.deleteMany({ where: { id: { in: [ownerId, otherId] } } })
}, 60_000)

describe('repointUserBucket', () => {
  it('moves the user, every file and thumbnail naming the old bucket, and the drive name, in one statement', async () => {
    expect(await repointUserBucket(ownerId, OLD, NEW)).toEqual({ users: 1, files: 3, thumbnails: 2, drives: 1 })

    expect((await prisma.user.findUniqueOrThrow({ where: { id: ownerId } })).bucket).toBe(NEW)
    expect((await prisma.drive.findUniqueOrThrow({ where: { id: ownerDriveId } })).name).toBe(NEW)
    const files = await prisma.file.findMany({ where: { id: { in: [ids.ownFile, ids.copyFile, ids.otherFile] } } })
    expect(Object.fromEntries(files.map((f) => [f.id, f.bucket]))).toEqual({
      [ids.ownFile]: NEW,
      [ids.copyFile]: NEW,
      [ids.otherFile]: OTHER,
    })
    const thumbs = await prisma.thumbnail.findMany({
      where: { id: { in: [ids.ownThumb, ids.copyThumb, ids.otherThumb, ids.placeholderThumb] } },
    })
    expect(Object.fromEntries(thumbs.map((t) => [t.id, t.bucket]))).toEqual({
      [ids.ownThumb]: NEW,
      [ids.copyThumb]: NEW,
      [ids.otherThumb]: OTHER,
      [ids.placeholderThumb]: null,
    })
  })

  it('changes nothing when another sign-in already moved the user', async () => {
    // The row names NEW now; a second repair from OLD to a third bucket loses.
    expect(await repointUserBucket(ownerId, OLD, `${NEW}-late`)).toEqual({ users: 0, files: 0, thumbnails: 0, drives: 0 })
    expect((await prisma.user.findUniqueOrThrow({ where: { id: ownerId } })).bucket).toBe(NEW)
    expect((await prisma.file.findUniqueOrThrow({ where: { id: ids.ownFile } })).bucket).toBe(NEW)
  })

  it("leaves a drive renamed since onboarding alone", async () => {
    // The other user's drive is called "Stashly Drive", not its bucket.
    expect(await repointUserBucket(otherId, OTHER, `${OTHER}-new`)).toMatchObject({ users: 1, drives: 0 })
    expect((await prisma.drive.findFirstOrThrow({ where: { ownerId: otherId } })).name).toBe('Stashly Drive')
  })
})

describe('ensureUserBucket', () => {
  it.each([
    ['the placeholder bucket', 'default-bucket'],
    ['no bucket', ''],
    ['a null bucket', null],
  ])('skips a user with %s, without asking S3', async (_, bucket) => {
    expect(await ensureUserBucket({ id: 'usr_none', name: 'n', email: 'n@test.local', bucket })).toEqual({ status: 'skipped' })
  })
})
