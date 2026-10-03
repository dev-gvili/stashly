import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { DeleteObjectsCommand } from '@aws-sdk/client-s3'
import { prisma } from '@/services/db'
import { s3 } from '@/services/s3'
import { createUploadedItem, discardUploadedObject } from '@/services/item-actions'
import { getPrefixForModel, toObjectId } from '@/utils/converters'
import { wipeTestUsers } from './helpers/wipe-test-users'

/**
 * Filing an uploaded file must never guess, and a refused file must not leave
 * its bytes behind.
 *
 * - The uploader needs write access to the folder the key starts at. The route
 *   used to take `ownerId` and the key from the form unchecked, so any
 *   signed-in user could file items into anyone's folder.
 * - Two live folders with the same name on the upload path are refused:
 *   `findFirst` has no order, so the file landed in whichever copy Postgres
 *   returned first (one patient's results filed under the other "john").
 * - When the row can't be created, `discardUploadedObject` deletes the bytes,
 *   but only an object nothing references, under a folder the user may write.
 *
 * Needs a live database (CI provides one). S3 is not available in CI, so the
 * client's `send` is intercepted and its DeleteObjects calls are asserted.
 */
const uid = (model: Parameters<typeof getPrefixForModel>[0]) => toObjectId(getPrefixForModel(model))
const BUCKET = 'stashly-test-upload-safety'
const STRANGER_BUCKET = 'stashly-test-upload-safety-stranger'

let ownerId: string
let strangerId: string
let bucketlessId: string
let driveId: string
let rootId: string

async function makeFolder(name: string, parentId: string, status: 'normal' | 'trashed' = 'normal') {
  const id = uid('Item')
  await prisma.item.create({
    data: { id, name, type: 'folder', category: 'unknown', status, ownerId, driveId, parentId, size: 0 },
  })
  return id
}

/** Files `<path>` under `root` as `userId`, the way a directory upload does. */
function upload(path: string, userId = ownerId, root = rootId) {
  const id = uid('Item')
  return {
    id,
    key: `${root}/${path}`,
    run: () =>
      createUploadedItem({
        id,
        name: path.split('/').pop()!,
        key: `${root}/${path}`,
        size: 10n,
        bucket: BUCKET,
        driveId,
        parentId: root,
        ownerId: userId,
        uploadId: `up-${id}`,
      }),
  }
}

/** Captures every DeleteObjects call; `failKeys` come back in `Errors`. */
function interceptDeletes(failKeys: string[] = []) {
  const calls: { bucket: string; keys: string[] }[] = []
  const realSend = s3.send.bind(s3)
  vi.spyOn(s3, 'send').mockImplementation(async (command: any) => {
    if (command instanceof DeleteObjectsCommand) {
      const keys = (command.input.Delete?.Objects ?? []).map((o) => o.Key!)
      calls.push({ bucket: command.input.Bucket!, keys })
      return { Errors: keys.filter((k) => failKeys.includes(k)).map((Key) => ({ Key, Code: 'InternalError', Message: 'simulated' })) } as any
    }
    return realSend(command)
  })
  return calls
}

beforeAll(async () => {
  ownerId = uid('User')
  strangerId = uid('User')
  bucketlessId = uid('User')
  await prisma.user.createMany({
    data: [
      { id: ownerId, name: 'Upload safety', email: `upsafe-${ownerId}@test.local`, emailVerified: true, bucket: BUCKET },
      { id: strangerId, name: 'Upload stranger', email: `upsafe-${strangerId}@test.local`, emailVerified: true, bucket: STRANGER_BUCKET },
      { id: bucketlessId, name: 'Upload no bucket', email: `upsafe-${bucketlessId}@test.local`, emailVerified: true },
    ],
  })
  driveId = uid('Drive')
  await prisma.drive.create({ data: { id: driveId, ownerId } })
  rootId = uid('Item')
  await prisma.item.create({
    data: { id: rootId, name: 'root', type: 'folder', category: 'unknown', status: 'normal', ownerId, driveId, parentId: null, size: 0 },
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

afterAll(async () => {
  await prisma.permission.deleteMany({ where: { users: { some: { id: strangerId } } } })
  await wipeTestUsers([ownerId, strangerId, bucketlessId])
  await prisma.user.deleteMany({ where: { id: { in: [ownerId, strangerId, bucketlessId] } } })
})

describe('who may file an upload', () => {
  it('refuses a user with no write access to the folder the key starts at', async () => {
    const u = upload('not-yours.pdf', strangerId)

    await expect(u.run()).rejects.toMatchObject({ errorCode: 'FORBIDDEN', status: 403 })
    expect(await prisma.item.count({ where: { id: u.id } })).toBe(0)
  })

  // Personal folders shared with someone: a `write` grant lets them upload, a
  // `read` grant does not.
  it('lets a user granted write on a personal folder upload into it', async () => {
    const shared = await makeFolder('shared-write', rootId)
    await grant(strangerId, shared, 'write')
    const u = upload('from-stranger.pdf', strangerId, shared)

    await u.run()

    const row = await prisma.item.findUniqueOrThrow({ where: { id: u.id }, select: { parentId: true } })
    expect(row.parentId).toBe(shared)
  })

  it('refuses a user granted only read on a personal folder', async () => {
    const shared = await makeFolder('shared-read', rootId)
    await grant(strangerId, shared, 'read')
    const u = upload('from-reader.pdf', strangerId, shared)

    await expect(u.run()).rejects.toMatchObject({ errorCode: 'FORBIDDEN', status: 403 })
    expect(await prisma.item.count({ where: { id: u.id } })).toBe(0)
  })
})

/** Grant `userId` a permission with `role` on `itemId`. */
async function grant(userId: string, itemId: string, role: 'read' | 'write' | 'owner') {
  await prisma.permission.create({
    data: { id: uid('Permission'), itemId, roles: role, users: { connect: { id: userId } } },
  })
}

describe('folder names on the upload path', () => {
  it('refuses when two live folders share the name, and files nothing', async () => {
    const family = await makeFolder('family-a', rootId)
    await makeFolder('john', family)
    await makeFolder('john', family)
    const u = upload('family-a/john/results.pdf')

    await expect(u.run()).rejects.toMatchObject({ errorCode: 'CONFLICT', status: 409 })
    await expect(u.run()).rejects.toThrow(/"john" at "family-a\/john"/)
    expect(await prisma.item.count({ where: { id: u.id } })).toBe(0)
  })

  it('files into the folder when exactly one live folder has the name', async () => {
    const family = await makeFolder('family-b', rootId)
    const john = await makeFolder('john', family)
    const u = upload('family-b/john/results.pdf')

    await u.run()

    const row = await prisma.item.findUniqueOrThrow({ where: { id: u.id }, select: { parentId: true } })
    expect(row.parentId).toBe(john)
  })

  it('ignores a trashed folder of the same name', async () => {
    const family = await makeFolder('family-c', rootId)
    const live = await makeFolder('john', family)
    await makeFolder('john', family, 'trashed')
    const u = upload('family-c/john/results.pdf')

    await u.run()

    const row = await prisma.item.findUniqueOrThrow({ where: { id: u.id }, select: { parentId: true } })
    expect(row.parentId).toBe(live)
  })
})

describe('discardUploadedObject', () => {
  it('deletes the bytes of an upload whose row was refused', async () => {
    const calls = interceptDeletes()
    const key = `${rootId}/refused/r.pdf`

    await expect(discardUploadedObject(ownerId, key)).resolves.toBe('deleted')
    expect(calls).toEqual([{ bucket: BUCKET, keys: [key] }])
  })

  it('still deletes after the uploader lost access to the folder mid-upload', async () => {
    // The bytes went to the uploader's own bucket while they had access; the
    // revoke refuses the row, and must not strand the bytes.
    const shared = await makeFolder('revoked', rootId)
    await grant(strangerId, shared, 'write')
    await prisma.permission.deleteMany({ where: { itemId: shared, users: { some: { id: strangerId } } } })
    const u = upload('late.pdf', strangerId, shared)
    await expect(u.run()).rejects.toMatchObject({ errorCode: 'FORBIDDEN' })
    const calls = interceptDeletes()

    await expect(discardUploadedObject(strangerId, u.key)).resolves.toBe('deleted')
    expect(calls).toEqual([{ bucket: STRANGER_BUCKET, keys: [u.key] }])
  })

  it("only ever deletes in the user's own bucket", async () => {
    // A key naming someone else's folder still resolves to the caller's bucket,
    // so the owner's object is out of reach.
    const calls = interceptDeletes()

    await discardUploadedObject(strangerId, `${rootId}/someone-elses.pdf`)

    expect(calls.map((c) => c.bucket)).toEqual([STRANGER_BUCKET])
  })

  it('never deletes an object a File row points at', async () => {
    const u = upload('kept/k.pdf')
    await u.run()
    const calls = interceptDeletes()

    await expect(discardUploadedObject(ownerId, u.key)).resolves.toBe('referenced')
    expect(calls).toEqual([])
  })

  // Created without a bucket, the row gets the schema default `default-bucket`,
  // which several users share.
  it('keeps everything for a user still on the placeholder bucket', async () => {
    const calls = interceptDeletes()

    await expect(discardUploadedObject(bucketlessId, `${rootId}/x.pdf`)).resolves.toBe('no-bucket')
    expect(calls).toEqual([])
  })

  it('reports a failed delete instead of throwing', async () => {
    const key = `${rootId}/stuck/s.pdf`
    interceptDeletes([key])
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(discardUploadedObject(ownerId, key)).resolves.toBe('failed')
    expect(log).toHaveBeenCalled()
  })
})
