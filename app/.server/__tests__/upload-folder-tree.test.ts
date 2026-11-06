import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import pg from 'pg'
import { prisma } from '@/services/db'
import {
  createUploadedItem,
  getCardItems,
  getFolderContent,
  resolveUploadFolders,
} from '@/services/item-actions'
import { itemsApiRouteInput } from '@/schemas/api.schemas'
import { getPrefixForModel, toObjectId, toObjectKey } from '@/utils/converters'
import { wipeTestUsers } from './helpers/wipe-test-users'
import { flushItemSizes, withSizeRollupPaused } from './helpers/flush-item-sizes'

/**
 * A folder upload resolves its whole folder tree in one request
 * (`resolveUploadFolders`), then files each file straight into its leaf folder
 * with a single statement: no per-file folder walk, lock or transaction.
 *
 * - The tree is created once, with each folder's `Folder` and `View` rows, and a
 *   second batch reuses it without writing anything.
 * - It never guesses: two live folders with the same name on a path refuse that
 *   path, even when one of the copies leads nowhere, and a trashed folder never
 *   matches. The same rules the per-file walk applied.
 * - The client names the leaf, so `createUploadedItem` checks it like any
 *   destination: write access, and a live folder at the moment of the insert.
 *   A refusal writes nothing and charges nothing.
 *
 * Needs a live database (CI provides one).
 */
const uid = (model: Parameters<typeof getPrefixForModel>[0]) =>
  toObjectId(getPrefixForModel(model))

let ownerId: string
let strangerId: string
let driveId: string
let rootId: string

async function makeFolder(
  name: string,
  parentId: string,
  status: 'normal' | 'trashed' = 'normal'
) {
  const id = uid('Item')
  await prisma.item.create({
    data: {
      id,
      name,
      type: 'folder',
      category: 'unknown',
      status,
      ownerId,
      driveId,
      parentId,
      size: 0,
    },
  })
  return id
}

function upload(parentId: string, name: string, userId = ownerId, size = 10n) {
  const id = uid('Item')
  return {
    id,
    run: () =>
      createUploadedItem({
        id,
        name,
        key: toObjectKey(`${rootId}/some/path/${name}`, id),
        uploadPath: `${rootId}/some/path/${name}`,
        size,
        bucket: 'stashly-test-folder-tree',
        parentId,
        ownerId: userId,
        uploadId: `up-${id}`,
      }),
  }
}

const used = async () => {
  await flushItemSizes()
  return (
    await prisma.quota.findFirstOrThrow({
      where: { driveId },
      select: { used: true },
    })
  ).used
}

beforeAll(async () => {
  ownerId = uid('User')
  strangerId = uid('User')
  await prisma.user.createMany({
    data: [
      {
        id: ownerId,
        name: 'Folder tree',
        email: `tree-${ownerId}@test.local`,
        emailVerified: true,
        bucket: 'stashly-test-folder-tree',
      },
      {
        id: strangerId,
        name: 'Tree stranger',
        email: `tree-${strangerId}@test.local`,
        emailVerified: true,
      },
    ],
  })
  driveId = uid('Drive')
  await prisma.drive.create({ data: { id: driveId, ownerId } })
  await prisma.quota.create({
    data: { id: uid('Quota'), driveId, total: 10n ** 12n },
  })
  rootId = uid('Item')
  await prisma.item.create({
    data: {
      id: rootId,
      name: 'root',
      type: 'folder',
      category: 'unknown',
      status: 'normal',
      ownerId,
      driveId,
      parentId: null,
      size: 0,
    },
  })
})

afterAll(async () => {
  await wipeTestUsers([ownerId, strangerId])
  await prisma.user.deleteMany({ where: { id: { in: [ownerId, strangerId] } } })
})

describe('resolveUploadFolders', () => {
  it('creates every missing folder once, with its Folder and View rows', async () => {
    const { folders, refused, createdFolderIds } = await resolveUploadFolders({
      userId: ownerId,
      rootId,
      dirs: ['tree/a/b', 'tree/c'],
    })

    expect(Object.keys(folders).sort()).toEqual([
      'tree',
      'tree/a',
      'tree/a/b',
      'tree/c',
    ])
    expect(refused).toEqual({})
    expect(createdFolderIds).toHaveLength(4)
    const rows = await prisma.item.findMany({
      where: { id: { in: Object.values(folders) } },
      select: {
        parentId: true,
        type: true,
        status: true,
        ownerId: true,
        driveId: true,
        folder: { select: { childCount: true, view: true } },
      },
    })
    expect(
      rows.every(
        (r) =>
          r.type === 'folder' &&
          r.status === 'normal' &&
          r.ownerId === ownerId &&
          r.driveId === driveId
      )
    ).toBe(true)
    expect(
      rows.every(
        (r) =>
          r.folder?.view?.viewType === 'grid' &&
          r.folder.view.sortBy === 'type' &&
          r.folder.view.sortOrder === 'ascending'
      )
    ).toBe(true)
    const tree = await prisma.item.findUniqueOrThrow({
      where: { id: folders['tree'] },
      select: { parentId: true, folder: { select: { childCount: true } } },
    })
    expect(tree.parentId).toBe(rootId)
    expect(tree.folder?.childCount).toBe(2)
  })

  it('reuses the folders on a second batch and creates nothing', async () => {
    const first = await resolveUploadFolders({
      userId: ownerId,
      rootId,
      dirs: ['again/x'],
    })
    const second = await resolveUploadFolders({
      userId: ownerId,
      rootId,
      dirs: ['again/x', 'again'],
    })

    expect(second.folders).toEqual(first.folders)
    expect(second.createdFolderIds).toEqual([])
  })

  it('refuses a path through two live folders of the same name, even when one copy leads nowhere', async () => {
    const { folders } = await resolveUploadFolders({
      userId: ownerId,
      rootId,
      dirs: ['family/john/2024'],
    })
    // A second, empty "john": the joined path still exists in the first copy.
    await makeFolder('john', folders['family'])

    const r = await resolveUploadFolders({
      userId: ownerId,
      rootId,
      dirs: ['family/john/2024', 'family/jane'],
    })

    expect(r.folders['family/john/2024']).toBeUndefined()
    expect(r.refused['family/john/2024']).toMatch(/"john" at "family\/john"/)
    expect(r.folders['family/jane']).toBeDefined()
  })

  it('ignores a trashed folder of the same name', async () => {
    const trashed = await makeFolder('bin', rootId, 'trashed')

    const { folders, createdFolderIds } = await resolveUploadFolders({
      userId: ownerId,
      rootId,
      dirs: ['bin'],
    })

    expect(folders['bin']).not.toBe(trashed)
    expect(createdFolderIds).toEqual([folders['bin']])
  })

  it('refuses a user without write access to the root, and creates nothing', async () => {
    await expect(
      resolveUploadFolders({
        userId: strangerId,
        rootId,
        dirs: ['intruder/x'],
      })
    ).rejects.toMatchObject({ errorCode: 'FORBIDDEN', status: 403 })
    expect(await prisma.item.count({ where: { name: 'intruder' } })).toBe(0)
  })

  // Each prefix used to be re-joined from its parts, so a deep path cost its
  // depth squared before any query: 2.4 s of blocked event loop for one 32 KB
  // key (31 Oct). Paths are capped at S3's 1,024-character key, and a request
  // at 20,000 folders.
  it('refuses a batch of more than 20,000 folders before any lock or write, quickly', async () => {
    const dirs = Array.from({ length: 101 }, (_, i) => `toomany${i}/${'a/'.repeat(199)}`)
    const started = performance.now()
    await expect(resolveUploadFolders({ userId: ownerId, rootId, dirs })).rejects.toMatchObject({
      errorCode: 'INVALID_INPUT',
      status: 400,
    })
    expect(performance.now() - started).toBeLessThan(1000)
    expect(await prisma.item.count({ where: { name: { startsWith: 'toomany' }, parentId: rootId } })).toBe(0)
  })

  it('resolves the deepest path a 1,024-character key allows', async () => {
    const dir = `deep/${'d/'.repeat(509)}`
    expect(dir.length).toBeLessThanOrEqual(1024)
    const started = performance.now()
    const { folders, createdFolderIds } = await resolveUploadFolders({ userId: ownerId, rootId, dirs: [dir] })
    expect(performance.now() - started).toBeLessThan(5000)
    expect(createdFolderIds).toHaveLength(510)
    expect(folders[dir.replace(/\/$/, '')]).toBe(createdFolderIds.at(-1))
  })

  it('rejects a key, an upload path or a folder path longer than S3 allows', () => {
    const long = `${rootId}/${'x'.repeat(1024)}`
    const upload = (fields: { key: string; uploadPath: string }) =>
      itemsApiRouteInput.safeParse({
        intent: 'create_upload_item', id: 'i', name: 'f', size: '1', bucket: 'b',
        driveId, parentId: rootId, ownerId, uploadId: 'u', ...fields,
      }).success
    expect(upload({ key: `${rootId}/i/f`, uploadPath: `${rootId}/f` })).toBe(true)
    expect(upload({ key: long, uploadPath: `${rootId}/f` })).toBe(false)
    expect(upload({ key: `${rootId}/i/f`, uploadPath: long })).toBe(false)
    const resolve = itemsApiRouteInput.safeParse({
      intent: 'resolve_upload_folders', rootId, dirs: JSON.stringify(['y'.repeat(1025)]),
    })
    expect(resolve.success).toBe(false)
  })
})

describe('createUploadedItem into a resolved folder', () => {
  it('files into the leaf and charges the quota, in one statement after the access check', async () => {
    const { folders } = await resolveUploadFolders({
      userId: ownerId,
      rootId,
      dirs: ['docs/2026'],
    })
    const before = await used()
    const u = upload(folders['docs/2026'], 'report.pdf')

    // Count the statements the call sends: the access check and the write.
    const proto = pg.Client.prototype as any
    const real = proto.query
    let statements = 0
    proto.query = function (...args: unknown[]) {
      statements++
      return real.apply(this, args)
    }
    try {
      await u.run()
    } finally {
      proto.query = real
    }

    expect(statements).toBe(2)
    const row = await prisma.item.findUniqueOrThrow({
      where: { id: u.id },
      select: {
        parentId: true,
        size: true,
        file: { select: { key: true, uploadPath: true } },
        permissions: {
          select: { roles: true, users: { select: { id: true } } },
        },
      },
    })
    expect(row.parentId).toBe(folders['docs/2026'])
    expect(row.file?.key).toBe(toObjectKey(`${rootId}/some/path/report.pdf`, u.id))
    expect(row.file?.uploadPath).toBe(`${rootId}/some/path/report.pdf`)
    expect(row.permissions).toEqual([
      { roles: 'owner', users: [{ id: ownerId }] },
    ])
    expect((await used()) - before).toBe(10n)
  })

  it('refuses a resolved folder the uploader cannot write to', async () => {
    const { folders } = await resolveUploadFolders({
      userId: ownerId,
      rootId,
      dirs: ['private'],
    })
    const u = upload(folders['private'], 'peek.txt', strangerId)

    await expect(u.run()).rejects.toMatchObject({
      errorCode: 'FORBIDDEN',
      status: 403,
    })
    expect(await prisma.item.count({ where: { id: u.id } })).toBe(0)
  })

  it('refuses a folder trashed after it was resolved, and charges nothing', async () => {
    const { folders } = await resolveUploadFolders({
      userId: ownerId,
      rootId,
      dirs: ['gone'],
    })
    await prisma.item.update({
      where: { id: folders['gone'] },
      data: { status: 'trashed' },
    })
    const before = await used()
    const u = upload(folders['gone'], 'late.txt')

    await expect(u.run()).rejects.toMatchObject({
      errorCode: 'ITEM_NOT_FOUND',
      status: 404,
    })
    expect(await prisma.item.count({ where: { id: u.id } })).toBe(0)
    expect(await used()).toBe(before)
  })

  it('refuses a file that does not fit, and writes nothing', async () => {
    const { folders } = await resolveUploadFolders({
      userId: ownerId,
      rootId,
      dirs: ['full'],
    })
    const quota = await prisma.quota.findFirstOrThrow({ where: { driveId } })
    await prisma.quota.update({
      where: { id: quota.id },
      data: { total: quota.used + 5n },
    })
    try {
      const u = upload(folders['full'], 'big.bin')

      await expect(u.run()).rejects.toMatchObject({
        errorCode: 'INSUFFICIENT_QUOTA',
        status: 507,
      })
      expect(await prisma.item.count({ where: { id: u.id } })).toBe(0)
      expect(await used()).toBe(quota.used)
    } finally {
      await prisma.quota.update({
        where: { id: quota.id },
        data: { total: 10n ** 12n },
      })
    }
  })
})

/**
 * An upload hands the page the new row itself (tech-debt item 45), so the page
 * can insert it instead of reloading the folder. That row must be exactly the
 * one the folder listing would have returned, or the card renders differently
 * once the page next loads.
 */
describe('getCardItems', () => {
  it('returns the row the folder listing returns, and only the caller’s own', async () => {
    const { folders } = await resolveUploadFolders({
      userId: ownerId,
      rootId,
      dirs: ['cards'],
    })
    const u = upload(folders['cards'], 'card.txt')
    // Logged rather than cascaded, as under a busy database: a flush between
    // the two reads below would otherwise change the parent's size.
    await withSizeRollupPaused(() => u.run())
    await flushItemSizes()

    const listing = await getFolderContent({
      userId: ownerId,
      limit: 50,
      where: { parentId: folders['cards'] },
    })
    const [card] = await getCardItems(ownerId, [u.id])

    expect(card).toEqual(listing.items.find((i) => i.id === u.id))
    expect(await getCardItems(strangerId, [u.id])).toEqual([])
  })
})
