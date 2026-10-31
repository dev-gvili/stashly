import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { DeleteObjectsCommand } from '@aws-sdk/client-s3'
import { prisma } from '@/services/db'
import { s3 } from '@/services/s3'
import { deleteItem, deleteItems } from '@/services/item-actions'
import { getPrefixForModel, toObjectId } from '@/utils/converters'
import { wipeTestUsers } from './helpers/wipe-test-users'

/**
 * Permanent delete must remove the deleted items' bytes and thumbnails from
 * S3. Before this, `deleteItems` removed only the rows: every "deleted" file
 * stayed in the bucket (335 such objects were found in one dev bucket).
 *
 * Needs a live database (CI provides one). S3 is not available in CI, so the
 * client's `send` is intercepted and the DeleteObjects calls it receives are
 * asserted instead.
 */
const uid = (model: Parameters<typeof getPrefixForModel>[0]) => toObjectId(getPrefixForModel(model))
const BUCKET = 'stashly-test-delete-objects'

let ownerId: string
let driveId: string

// Permanent delete only takes items from trash, so fixtures start there.
async function makeItem(
  type: 'file' | 'folder',
  parentId: string | null,
  name: string,
  status: 'trashed' | 'normal' = 'trashed'
) {
  const id = uid('Item')
  await prisma.item.create({
    data: { id, name, type, category: type === 'file' ? 'document' : 'unknown', status, ownerId, driveId, parentId, size: 0 },
  })
  if (type === 'file') {
    await prisma.file.create({ data: { id: uid('File'), itemId: id, bucket: BUCKET, key: `${parentId ?? 'root'}/${name}` } })
    await prisma.thumbnail.create({ data: { id: uid('Thumbnail'), itemId: id, bucket: BUCKET, stage: 3 } })
  }
  return id
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

let strangerId: string

beforeAll(async () => {
  ownerId = uid('User')
  await prisma.user.create({ data: { id: ownerId, name: 'Delete objects', email: `del-${ownerId}@test.local`, emailVerified: true } })
  driveId = uid('Drive')
  await prisma.drive.create({ data: { id: driveId, ownerId } })
  strangerId = uid('User')
  await prisma.user.create({ data: { id: strangerId, name: 'Delete stranger', email: `del-${strangerId}@test.local`, emailVerified: true } })
})

afterEach(() => {
  vi.restoreAllMocks()
})

afterAll(async () => {
  await prisma.permission.deleteMany({ where: { users: { some: { id: strangerId } } } })
  await wipeTestUsers([ownerId, strangerId])
  await prisma.user.deleteMany({ where: { id: { in: [ownerId, strangerId] } } })
})

/** Grant `userId` a permission with `role` on `itemId`. */
async function grant(userId: string, itemId: string, role: 'read' | 'write' | 'owner') {
  await prisma.permission.create({
    data: { id: uid('Permission'), itemId, roles: role, users: { connect: { id: userId } } },
  })
}

describe('permanent delete requires owner access', () => {
  it('deleteItem refuses a user with no access: 403, nothing deleted, nothing sent to S3', async () => {
    const file = await makeItem('file', null, 'not-yours.pdf')
    const calls = interceptDeletes()

    await expect(deleteItem(file, strangerId)).rejects.toMatchObject({ errorCode: 'FORBIDDEN', status: 403 })

    expect(await prisma.item.count({ where: { id: file } })).toBe(1)
    expect(calls).toEqual([])
  })

  it('deleteItem refuses a user with only write access', async () => {
    const file = await makeItem('file', null, 'shared-write.pdf')
    await grant(strangerId, file, 'write')
    interceptDeletes()

    await expect(deleteItem(file, strangerId)).rejects.toMatchObject({ errorCode: 'FORBIDDEN', status: 403 })
    expect(await prisma.item.count({ where: { id: file } })).toBe(1)
  })

  it('deleteItem allows a user granted owner access', async () => {
    const file = await makeItem('file', null, 'shared-owner.pdf')
    await grant(strangerId, file, 'owner')
    interceptDeletes()

    await expect(deleteItem(file, strangerId)).resolves.toMatchObject({ id: file })
  })

  it('refuses a workspace item to a non-member, even one holding an owner permission on it', async () => {
    // The membership check comes from the item's own workspaceId, not from the
    // caller, so leaving the workspace out of the request can't skip it.
    const workspaceId = uid('Workspace')
    await prisma.workspace.create({ data: { id: workspaceId, name: 'Delete test WS' } })
    try {
      const file = await makeItem('file', null, 'workspace-file.pdf')
      await prisma.item.update({ where: { id: file }, data: { workspaceId } })
      await grant(strangerId, file, 'owner')
      const calls = interceptDeletes()

      await expect(deleteItem(file, strangerId)).rejects.toMatchObject({ errorCode: 'FORBIDDEN', status: 403 })
      expect(await prisma.item.count({ where: { id: file } })).toBe(1)
      expect(calls).toEqual([])

      await prisma.item.update({ where: { id: file }, data: { workspaceId: null } })
    } finally {
      await prisma.workspace.deleteMany({ where: { id: workspaceId } })
    }
  })

  it('deleteItems is all-or-nothing: one item without access refuses the whole batch', async () => {
    const mine = await makeItem('file', null, 'mine.pdf')
    const theirs = await makeItem('file', null, 'theirs.pdf')
    await grant(strangerId, mine, 'owner')
    const calls = interceptDeletes()

    await expect(deleteItems([mine, theirs], strangerId)).rejects.toMatchObject({ errorCode: 'FORBIDDEN', status: 403 })

    expect(await prisma.item.count({ where: { id: { in: [mine, theirs] } } })).toBe(2)
    expect(calls).toEqual([])
  })
})

describe('permanent delete only takes items from trash', () => {
  it('refuses an item that is not in trash: 400, nothing deleted, nothing sent to S3', async () => {
    const file = await makeItem('file', null, 'still-active.pdf', 'normal')
    const calls = interceptDeletes()

    await expect(deleteItem(file, ownerId)).rejects.toMatchObject({ errorCode: 'INVALID_INPUT', status: 400 })

    expect(await prisma.item.count({ where: { id: file } })).toBe(1)
    expect(calls).toEqual([])
  })

  it('refuses the whole batch when one item is not in trash', async () => {
    const trashed = await makeItem('file', null, 'in-trash.pdf')
    const active = await makeItem('file', null, 'active.pdf', 'normal')
    const calls = interceptDeletes()

    await expect(deleteItems([trashed, active], ownerId)).rejects.toMatchObject({ errorCode: 'INVALID_INPUT', status: 400 })

    expect(await prisma.item.count({ where: { id: { in: [trashed, active] } } })).toBe(2)
    expect(calls).toEqual([])
  })

  it('deletes a locked item, and its lock with it', async () => {
    // LockedItem_itemId_fkey was RESTRICT: one lock anywhere in the subtree
    // failed the delete with a foreign-key violation.
    const folder = await makeItem('folder', null, 'locked-inside')
    const file = await makeItem('file', folder, 'locked.pdf')
    await prisma.lockedItem.create({ data: { id: uid('LockedItem'), itemId: file, lockedById: strangerId } })
    interceptDeletes()

    await deleteItems([folder], ownerId)

    expect(await prisma.item.count({ where: { id: { in: [folder, file] } } })).toBe(0)
    expect(await prisma.lockedItem.count({ where: { itemId: file } })).toBe(0)
  })
})

describe('permanent delete removes stored objects', () => {
  it('deleteItems removes a folder subtree’s files and thumbnails', async () => {
    const folder = await makeItem('folder', null, 'docs')
    const a = await makeItem('file', folder, 'a.pdf')
    const sub = await makeItem('folder', folder, 'sub')
    const b = await makeItem('file', sub, 'b.pdf')
    const calls = interceptDeletes()

    await deleteItems([folder], ownerId)

    expect(calls).toHaveLength(1)
    expect(calls[0].bucket).toBe(BUCKET)
    expect(calls[0].keys.sort()).toEqual(
      [`${folder}/a.pdf`, `${sub}/b.pdf`, `thumbnails/${a}.webp`, `thumbnails/${b}.webp`].sort()
    )
    expect(await prisma.item.count({ where: { id: { in: [folder, a, sub, b] } } })).toBe(0)
  })

  it('deleteItem removes a single file’s bytes and thumbnail', async () => {
    const file = await makeItem('file', null, 'single.txt')
    const calls = interceptDeletes()

    await deleteItem(file, ownerId)

    expect(calls).toHaveLength(1)
    expect(calls[0].bucket).toBe(BUCKET)
    expect(calls[0].keys.sort()).toEqual(['root/single.txt', `thumbnails/${file}.webp`].sort())
  })

  it('deleteItem on a folder also removes what was inside it', async () => {
    const folder = await makeItem('folder', null, 'nested')
    const inner = await makeItem('file', folder, 'inner.png')
    const calls = interceptDeletes()

    await deleteItem(folder, ownerId)

    expect(calls[0].keys.sort()).toEqual([`${folder}/inner.png`, `thumbnails/${inner}.webp`].sort())
  })

  it('logs S3 keys it could not delete, and still completes the delete', async () => {
    const file = await makeItem('file', null, 'stuck.bin')
    interceptDeletes(['root/stuck.bin'])
    const logged = vi.spyOn(console, 'error')

    await expect(deleteItem(file, ownerId)).resolves.toMatchObject({ id: file })

    expect(await prisma.item.count({ where: { id: file } })).toBe(0)
    const call = logged.mock.calls.find((c) =>
      String(c[0]).includes('S3 objects left behind after a delete')
    )
    expect(call?.[1]).toMatchObject({ bucket: BUCKET, failed_count: 1, object_count: 2 })
  })
})
