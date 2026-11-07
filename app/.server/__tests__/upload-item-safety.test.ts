import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { DeleteObjectsCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import { prisma } from '@/services/db'
import { headUploadedObject, s3 } from '@/services/s3'
import {
  assertCanUploadTo,
  assertKeyUnfiled,
  createFolder,
  createUploadedItem,
  discardUploadedObject,
  moveItems,
  resolveUploadFolders,
  trashItems,
} from '@/services/item-actions'
import { toErrorInfo } from '@/utils/api.errors'
import { getPrefixForModel, toObjectId, toObjectKey } from '@/utils/converters'
import { flushItemSizes } from './helpers/flush-item-sizes'
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
let strangerDriveId: string
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
  const key = toObjectKey(`${root}/${path}`, id)
  return {
    id,
    key,
    run: () =>
      createUploadedItem({
        id,
        name: path.split('/').pop()!,
        key,
        uploadPath: `${root}/${path}`,
        size: 10n,
        bucket: BUCKET,
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
  // `createUploadedItem` charges the quota of the folder's drive, and refuses
  // the upload when there is no quota to charge. The stranger uploads into the
  // owner's folder under a grant, and the owner is the one billed.
  strangerDriveId = uid('Drive')
  await prisma.drive.create({ data: { id: strangerDriveId, ownerId: strangerId } })
  await prisma.quota.createMany({
    data: [
      { id: uid('Quota'), driveId, total: 10n ** 12n },
      { id: uid('Quota'), driveId: strangerDriveId, total: 10n ** 12n },
    ],
  })
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

describe('the drive owner pays', () => {
  const quotaOf = async (drive: string) => {
    await flushItemSizes()
    return prisma.quota.findUniqueOrThrow({ where: { driveId: drive }, select: { used: true, deleted: true } })
  }

  /** A collaborator's upload, with the session drive the route passes. */
  function collaboratorUpload(name: string, parentId: string, size = 10n) {
    const id = uid('Item')
    return {
      id,
      run: () =>
        createUploadedItem({
          id,
          name,
          key: toObjectKey(`${parentId}/${name}`, id),
          uploadPath: `${parentId}/${name}`,
          size,
          bucket: STRANGER_BUCKET,
          parentId,
          ownerId: strangerId,
          uploadId: `up-${id}`,
        }),
    }
  }

  async function sharedFolder(name: string) {
    const shared = await makeFolder(name, rootId)
    await grant(strangerId, shared, 'write')
    return shared
  }

  it("charges a collaborator's upload to the folder's drive, and files it there", async () => {
    const shared = await sharedFolder('pays-upload')
    const owner = await quotaOf(driveId)
    const stranger = await quotaOf(strangerDriveId)

    const u = collaboratorUpload('pays.bin', shared, 40n)
    await u.run()

    expect((await quotaOf(driveId)).used).toBe(owner.used + 40n)
    expect((await quotaOf(strangerDriveId)).used).toBe(stranger.used)
    const row = await prisma.item.findUniqueOrThrow({ where: { id: u.id }, select: { driveId: true, ownerId: true } })
    expect(row).toEqual({ driveId, ownerId: strangerId })
  })

  // Trashing a folder takes whatever is in it, whoever uploaded that.
  it('refunds the drive that was charged, whoever trashes the file', async () => {
    const shared = await sharedFolder('pays-trash')
    const u = collaboratorUpload('refund.bin', shared, 70n)
    await u.run()
    const owner = await quotaOf(driveId)
    const stranger = await quotaOf(strangerDriveId)

    await trashItems([shared], ownerId)

    // The refund settles logged charges first, which waits for the rollup lock;
    // another test file holding it (withSizeRollupPaused) delays it past 1 s.
    await vi.waitFor(
      async () => {
        expect(await quotaOf(driveId)).toEqual({ used: owner.used - 70n, deleted: owner.deleted + 70n })
      },
      { timeout: 10_000, interval: 100 }
    )
    expect(await quotaOf(strangerDriveId)).toEqual(stranger)
  })

  it("puts a collaborator's new folder on the parent's drive", async () => {
    const shared = await sharedFolder('pays-folder')

    const folder = await createFolder('made-by-stranger', shared, strangerId, strangerDriveId)

    const row = await prisma.item.findUniqueOrThrow({ where: { id: folder.id }, select: { driveId: true } })
    expect(row.driveId).toBe(driveId)
  })

  it('refuses a new folder without write access on the parent, and creates nothing', async () => {
    const unshared = await makeFolder('no-grant', rootId)
    const readOnly = await makeFolder('read-grant', rootId)
    await grant(strangerId, readOnly, 'read')

    for (const parent of [unshared, readOnly]) {
      await expect(createFolder('intruder', parent, strangerId, strangerDriveId)).rejects.toMatchObject({
        errorCode: 'FORBIDDEN',
        status: 403,
      })
      expect(await prisma.item.count({ where: { parentId: parent } })).toBe(0)
    }

    const mine = await createFolder('mine', unshared, ownerId, driveId)
    expect(mine.parentId).toBe(unshared)
  })

  it("puts the folders of a collaborator's folder upload on the parent's drive", async () => {
    const shared = await sharedFolder('pays-tree')

    const { folders } = await resolveUploadFolders({ userId: strangerId, rootId: shared, dirs: ['deep/er'] })

    const rows = await prisma.item.findMany({ where: { id: { in: Object.values(folders) } }, select: { driveId: true } })
    expect(rows.map((r) => r.driveId)).toEqual([driveId, driveId])
  })

  it('refuses a move between drives', async () => {
    const shared = await sharedFolder('pays-move')
    const mine = uid('Item')
    await prisma.item.create({
      data: { id: mine, name: 'mine.bin', type: 'file', category: 'document', status: 'normal', ownerId: strangerId, driveId: strangerDriveId, parentId: null, size: 5 },
    })

    await expect(moveItems([mine], shared, strangerId)).rejects.toMatchObject({ errorCode: 'MOVE_ITEM_FAILED' })
    const row = await prisma.item.findUniqueOrThrow({ where: { id: mine }, select: { parentId: true } })
    expect(row.parentId).toBeNull()
  })

  it("doesn't tell a collaborator how much of the owner's space is free", async () => {
    const shared = await sharedFolder('pays-refuse')
    const refusal = await collaboratorUpload('too-big.bin', shared, 10n ** 13n).run().catch((e) => e)

    expect(toErrorInfo(refusal).status).toBe(507)
    expect(toErrorInfo(refusal).message).not.toMatch(/free/i)
  })
})

/** Grant `userId` a permission with `role` on `itemId`. */
async function grant(userId: string, itemId: string, role: 'read' | 'write' | 'owner') {
  await prisma.permission.create({
    data: { id: uid('Permission'), itemId, roles: role, users: { connect: { id: userId } } },
  })
}

// The same check `/api/s3/upload` runs before creating and completing a
// multipart upload, so a revoked user's next file sends no bytes.
describe('assertCanUploadTo', () => {
  it('allows the owner of the root folder', async () => {
    await expect(assertCanUploadTo(ownerId, `${rootId}/a/b.pdf`)).resolves.toBeUndefined()
  })

  it('allows a write grant, and refuses as soon as it is revoked', async () => {
    const shared = await makeFolder('revoke-check', rootId)
    await grant(strangerId, shared, 'write')
    await expect(assertCanUploadTo(strangerId, `${shared}/x.pdf`)).resolves.toBeUndefined()

    await prisma.permission.deleteMany({ where: { itemId: shared, users: { some: { id: strangerId } } } })

    await expect(assertCanUploadTo(strangerId, `${shared}/x.pdf`)).rejects.toMatchObject({ errorCode: 'FORBIDDEN', status: 403 })
  })
})

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

describe('assertKeyUnfiled', () => {
  it('refuses a key a File row already serves, with 409', async () => {
    const u = upload('filed/f.pdf')
    await u.run()
    await expect(assertKeyUnfiled(BUCKET, u.key)).rejects.toMatchObject({ status: 409 })
  })

  // Its bytes are the trashed item's: restoring it must not serve someone's
  // newer upload.
  it('refuses the key of a trashed file too', async () => {
    const u = upload('filed/t.pdf')
    await u.run()
    await prisma.item.update({ where: { id: u.id }, data: { status: 'trashed' } })
    await expect(assertKeyUnfiled(BUCKET, u.key)).rejects.toMatchObject({ status: 409 })
  })

  it('allows a key no row serves, and the same key in another bucket', async () => {
    const u = upload('filed/g.pdf')
    await u.run()
    await expect(assertKeyUnfiled(BUCKET, `${rootId}/filed/new.pdf`)).resolves.toBeUndefined()
    await expect(assertKeyUnfiled(STRANGER_BUCKET, u.key)).resolves.toBeUndefined()
  })
})

/** Answers HeadObject with each of `answers` in turn; other commands pass through. */
function interceptHeads(...answers: (Record<string, unknown> | Error)[]) {
  const heads: string[] = []
  const realSend = s3.send.bind(s3)
  vi.spyOn(s3, 'send').mockImplementation(async (command: any) => {
    if (!(command instanceof HeadObjectCommand)) return realSend(command)
    heads.push(`${command.input.Bucket}/${command.input.Key}`)
    const answer = answers[Math.min(heads.length, answers.length) - 1]
    if (answer instanceof Error) throw answer
    return answer as any
  })
  return heads
}

const notFound = () => Object.assign(new Error('NotFound'), { name: 'NotFound', $metadata: { httpStatusCode: 404 } })

describe('headUploadedObject', () => {
  it('reads the stored size as a bigint, with its ETag', async () => {
    const heads = interceptHeads({ ContentLength: 5243904, ETag: '"abc-2"' })
    await expect(headUploadedObject(BUCKET, 'k')).resolves.toEqual({ size: 5243904n, etag: '"abc-2"' })
    expect(heads).toEqual([`${BUCKET}/k`])
  })

  it('reads an empty object as 0', async () => {
    interceptHeads({ ContentLength: 0, ETag: '"e"' })
    await expect(headUploadedObject(BUCKET, 'k')).resolves.toEqual({ size: 0n, etag: '"e"' })
  })

  it('looks once more before calling an object missing', async () => {
    const heads = interceptHeads(notFound(), { ContentLength: 7, ETag: '"e"' })
    await expect(headUploadedObject(BUCKET, 'k')).resolves.toEqual({ size: 7n, etag: '"e"' })
    expect(heads).toHaveLength(2)
  })

  it('answers null for an object still missing on the second look', async () => {
    const heads = interceptHeads(notFound())
    await expect(headUploadedObject(BUCKET, 'k')).resolves.toBeNull()
    expect(heads).toHaveLength(2)
  })

  it('throws 503 on any other storage error', async () => {
    interceptHeads(Object.assign(new Error('InternalError'), { name: 'InternalError', $metadata: { httpStatusCode: 500 } }))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(headUploadedObject(BUCKET, 'k')).rejects.toMatchObject({ status: 503 })
  })

  // 0 would charge nothing for a file of any size.
  it('throws 503 when storage reports no length, rather than reading it as 0', async () => {
    interceptHeads({ ETag: '"e"' })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(headUploadedObject(BUCKET, 'k')).rejects.toMatchObject({ status: 503 })
  })
})

/**
 * Each upload has its own object (`toObjectKey`): two uploads of one name into
 * one folder are two items with their own bytes, which versions and the
 * duplicates comparison both need. The folders come from the upload path.
 */
describe('one object per upload', () => {
  it('files two uploads of one name into one folder as two items, each with its own object', async () => {
    const first = upload('twice/same.pdf')
    const second = upload('twice/same.pdf')
    await first.run()
    await second.run()

    const files = await prisma.file.findMany({
      where: { itemId: { in: [first.id, second.id] } },
      select: { key: true, uploadPath: true, item: { select: { parentId: true } } },
    })
    expect(files).toHaveLength(2)
    expect(new Set(files.map((f) => f.key)).size).toBe(2)
    expect(new Set(files.map((f) => f.item.parentId)).size).toBe(1)
    expect(files.map((f) => f.uploadPath)).toEqual([`${rootId}/twice/same.pdf`, `${rootId}/twice/same.pdf`])
  })

  it('makes the folders of the upload path, none from the key', async () => {
    const u = upload('deep/er/d.pdf')
    await u.run()

    const item = await prisma.item.findUniqueOrThrow({ where: { id: u.id }, select: { parent: { select: { name: true, parent: { select: { name: true } } } } } })
    expect(item.parent?.name).toBe('er')
    expect(item.parent?.parent?.name).toBe('deep')
    expect(await prisma.item.count({ where: { name: u.id, type: 'folder' } })).toBe(0)
  })

  it.each([
    ["another item's key", () => toObjectKey(`${rootId}/keyed/k.pdf`, uid('Item'))],
    ['the bare upload path', () => `${rootId}/keyed/k.pdf`],
    ['another root', (id: string) => `${uid('Item')}/${id}/k.pdf`],
  ])('refuses %s as the key with 400, and files nothing', async (_, keyFor) => {
    const id = uid('Item')
    await expect(
      createUploadedItem({
        id,
        name: 'k.pdf',
        key: keyFor(id),
        uploadPath: `${rootId}/keyed/k.pdf`,
        size: 10n,
        bucket: BUCKET,
        parentId: rootId,
        ownerId,
        uploadId: `up-${id}`,
      })
    ).rejects.toMatchObject({ status: 400 })
    expect(await prisma.item.count({ where: { id } })).toBe(0)
  })
})
