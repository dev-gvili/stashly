import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/services/db'
import { deleteItem, restoreItem, restoreItems, trashItem, trashItems } from '@/services/item-actions'
import { getPrefixForModel, toObjectId } from '@/utils/converters'
import { wipeTestUsers } from './helpers/wipe-test-users'

/**
 * Trash and restore need `write` access to every item asked for. Before this,
 * neither checked anything: any signed-in user could trash or restore anyone's
 * item by id. Needs a live database (CI provides one).
 */
const uid = (model: Parameters<typeof getPrefixForModel>[0]) => toObjectId(getPrefixForModel(model))

let ownerId: string
let strangerId: string
let driveId: string

async function makeItem(name: string, status: 'normal' | 'trashed' = 'normal') {
  const id = uid('Item')
  await prisma.item.create({
    data: { id, name, type: 'folder', category: 'unknown', status, ownerId, driveId, parentId: null, size: 0 },
  })
  return id
}

async function grant(userId: string, itemId: string, role: 'read' | 'write' | 'owner') {
  await prisma.permission.create({
    data: { id: uid('Permission'), itemId, roles: role, users: { connect: { id: userId } } },
  })
}

const statusOf = async (id: string) => (await prisma.item.findUniqueOrThrow({ where: { id } })).status

beforeAll(async () => {
  ownerId = uid('User')
  await prisma.user.create({ data: { id: ownerId, name: 'Trash owner', email: `trash-${ownerId}@test.local`, emailVerified: true } })
  driveId = uid('Drive')
  await prisma.drive.create({ data: { id: driveId, ownerId } })
  strangerId = uid('User')
  await prisma.user.create({ data: { id: strangerId, name: 'Trash stranger', email: `trash-${strangerId}@test.local`, emailVerified: true } })
})

afterAll(async () => {
  await prisma.permission.deleteMany({ where: { users: { some: { id: strangerId } } } })
  await wipeTestUsers([ownerId, strangerId])
  await prisma.user.deleteMany({ where: { id: { in: [ownerId, strangerId] } } })
})

describe('trash requires write access', () => {
  it('refuses a user with no access: 403, item untouched', async () => {
    const item = await makeItem('not-yours')
    await expect(trashItem(item, strangerId)).rejects.toMatchObject({ errorCode: 'FORBIDDEN', status: 403 })
    expect(await statusOf(item)).toBe('normal')
  })

  it('refuses a user with only read access', async () => {
    const item = await makeItem('read-only')
    await grant(strangerId, item, 'read')
    await expect(trashItem(item, strangerId)).rejects.toMatchObject({ errorCode: 'FORBIDDEN', status: 403 })
    expect(await statusOf(item)).toBe('normal')
  })

  it('allows a user granted write access', async () => {
    const item = await makeItem('shared-write')
    await grant(strangerId, item, 'write')
    await trashItem(item, strangerId)
    expect(await statusOf(item)).toBe('trashed')
  })

  it('allows the owner', async () => {
    const item = await makeItem('own')
    await trashItem(item, ownerId)
    expect(await statusOf(item)).toBe('trashed')
  })

  it('refuses a workspace item to a non-member, even one holding write on it', async () => {
    const workspaceId = uid('Workspace')
    await prisma.workspace.create({ data: { id: workspaceId, name: 'Trash test WS' } })
    try {
      const item = await makeItem('workspace-item')
      await prisma.item.update({ where: { id: item }, data: { workspaceId } })
      await grant(strangerId, item, 'write')

      await expect(trashItem(item, strangerId)).rejects.toMatchObject({ errorCode: 'FORBIDDEN', status: 403 })
      expect(await statusOf(item)).toBe('normal')

      await prisma.item.update({ where: { id: item }, data: { workspaceId: null } })
    } finally {
      await prisma.workspace.deleteMany({ where: { id: workspaceId } })
    }
  })

  it('trashItems is all-or-nothing: one item without access refuses the whole batch', async () => {
    const mine = await makeItem('batch-mine')
    const theirs = await makeItem('batch-theirs')
    await grant(strangerId, mine, 'write')

    await expect(trashItems([mine, theirs], strangerId)).rejects.toMatchObject({ errorCode: 'FORBIDDEN', status: 403 })
    expect(await statusOf(mine)).toBe('normal')
    expect(await statusOf(theirs)).toBe('normal')
  })
})

describe('restore requires write access', () => {
  it('refuses a user with no access: 403, item stays trashed', async () => {
    const item = await makeItem('trashed-not-yours', 'trashed')
    await expect(restoreItem(item, strangerId)).rejects.toMatchObject({ errorCode: 'FORBIDDEN', status: 403 })
    expect(await statusOf(item)).toBe('trashed')
  })

  it('refuses a user with only read access', async () => {
    const item = await makeItem('trashed-read-only', 'trashed')
    await grant(strangerId, item, 'read')
    await expect(restoreItem(item, strangerId)).rejects.toMatchObject({ errorCode: 'FORBIDDEN', status: 403 })
    expect(await statusOf(item)).toBe('trashed')
  })

  it('allows the owner', async () => {
    const item = await makeItem('trashed-own', 'trashed')
    await restoreItem(item, ownerId)
    expect(await statusOf(item)).toBe('normal')
  })

  it('restoreItems is all-or-nothing', async () => {
    const mine = await makeItem('trashed-batch-mine', 'trashed')
    const theirs = await makeItem('trashed-batch-theirs', 'trashed')
    await grant(strangerId, mine, 'write')

    await expect(restoreItems([mine, theirs], strangerId)).rejects.toMatchObject({ errorCode: 'FORBIDDEN', status: 403 })
    expect(await statusOf(mine)).toBe('trashed')
    expect(await statusOf(theirs)).toBe('trashed')
  })
})

describe('trash, restore and delete move the right bytes in the quota', () => {
  // Folder sizes are trigger rollups of their active contents, so only files
  // may be summed; summing folders too counted those bytes again (325 for 175).
  let quotaId: string

  beforeAll(async () => {
    quotaId = uid('Quota')
    await prisma.quota.create({ data: { id: quotaId, driveId, total: 10n ** 12n } })
  })

  async function setQuota(used: bigint, deleted: bigint) {
    await prisma.quota.update({ where: { id: quotaId }, data: { used, deleted } })
  }

  /** The quota hooks run fire-and-forget, so wait for the expected numbers. */
  async function expectQuota(used: bigint, deleted: bigint) {
    await vi.waitFor(async () => {
      const q = await prisma.quota.findUniqueOrThrow({ where: { id: quotaId }, select: { used: true, deleted: true } })
      expect({ used: q.used, deleted: q.deleted }).toEqual({ used, deleted })
    })
  }

  async function makeFile(parentId: string, name: string, size: number) {
    const id = uid('Item')
    await prisma.item.create({
      data: { id, name, type: 'file', category: 'document', status: 'normal', ownerId, driveId, parentId, size },
    })
    return id
  }

  /** F holds A (100), B (50, already in trash) and folder S, which holds C (25). */
  async function makeTree() {
    const F = await makeItem('tree')
    const A = await makeFile(F, 'A', 100)
    const B = await makeFile(F, 'B', 50)
    const S = uid('Item')
    await prisma.item.create({
      data: { id: S, name: 'S', type: 'folder', category: 'unknown', status: 'normal', ownerId, driveId, parentId: F, size: 0 },
    })
    const C = await makeFile(S, 'C', 25)
    await prisma.item.update({ where: { id: B }, data: { status: 'trashed' } })
    await setQuota(125n, 50n)
    return { F, A, B, S, C }
  }

  it('trashing a folder moves only its active files: 125, not 325', async () => {
    const { F } = await makeTree()
    await trashItem(F, ownerId)
    await expectQuota(0n, 175n)
  })

  it('a selection that overlaps itself counts each file once', async () => {
    const { F, A, C } = await makeTree()
    await trashItems([F, A, C], ownerId)
    await expectQuota(0n, 175n)
  })

  it('restoring the folder moves every restored file back to used', async () => {
    const { F } = await makeTree()
    await trashItem(F, ownerId)
    await expectQuota(0n, 175n)
    await restoreItem(F, ownerId)
    await expectQuota(175n, 0n)
  })

  it('deleting the trashed folder removes its bytes from deleted', async () => {
    const { F, A, B, S, C } = await makeTree()
    await trashItem(F, ownerId)
    await expectQuota(0n, 175n)
    await deleteItem(F, ownerId)
    await expectQuota(0n, 0n)
    expect(await prisma.item.count({ where: { id: { in: [F, A, B, S, C] } } })).toBe(0)
  })
})

describe('trash and restore record one activity per changed item, in one statement', () => {
  const activitiesOf = (ids: string[]) =>
    prisma.activity.findMany({
      where: { itemId: { in: ids } },
      include: { time: true, action: { include: { delete: true, restore: true } } },
    })

  it('trashItems records a delete activity per item, with time, name and type', async () => {
    const a = await makeItem('act-a')
    const b = await makeItem('act-b')
    await trashItems([a, b], ownerId)

    await vi.waitFor(async () => {
      const rows = await activitiesOf([a, b])
      expect(rows).toHaveLength(2)
      for (const row of rows) {
        expect(row.time?.observedAt).toBeInstanceOf(Date)
        expect(row.action?.delete).toMatchObject({ itemType: 'folder' })
      }
      expect(rows.map((r) => r.action?.delete?.name).sort()).toEqual(['act-a', 'act-b'])
    })
  })

  it('restoreItems records a restore activity per item', async () => {
    const a = await makeItem('act-restore-a', 'trashed')
    const b = await makeItem('act-restore-b', 'trashed')
    await restoreItems([a, b], ownerId)

    await vi.waitFor(async () => {
      const rows = await activitiesOf([a, b])
      expect(rows).toHaveLength(2)
      expect(rows.every((r) => r.action?.restore?.id)).toBe(true)
    })
  })

  it('records nothing for an item that was already in trash', async () => {
    const a = await makeItem('act-already', 'trashed')
    await trashItems([a], ownerId)
    await new Promise((r) => setTimeout(r, 300))
    expect(await activitiesOf([a])).toHaveLength(0)
  })
})
