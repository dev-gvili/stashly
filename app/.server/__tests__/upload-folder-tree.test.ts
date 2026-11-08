import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import pg from 'pg'
import { prisma } from '@/services/db'
import {
  copyItem,
  createFolder,
  createUploadedItem,
  getCardItems,
  moveItems,
  getFolderContent,
  resolveUploadFolders,
  trashItems,
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
 * An upload and a trash of its folder at the same moment must not leave a live
 * item inside a trashed folder. Each statement sees the database as it was when
 * it started, so without a lock between them neither saw the other: the upload
 * read the folder as live, the trash's walk never saw the new row (6 of 6 runs
 * on 7 Nov, both orders). A `blocker` connection holds each side at a fixed
 * point so the order is certain:
 *
 * - trash first: the upload waits for the trash, then is refused (404);
 * - upload or folder tree first: the trash waits for it, then trashes what it
 *   made.
 */
describe('an upload racing a trash of its folder', () => {
  let blocker: pg.Client
  let probe: pg.Client
  const url = () => process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL

  beforeAll(async () => {
    blocker = new pg.Client({ connectionString: url() })
    probe = new pg.Client({ connectionString: url() })
    await Promise.all([blocker.connect(), probe.connect()])
  })
  afterAll(async () => {
    await Promise.all([blocker.end(), probe.end()])
  })

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

  /** Waits until another transaction holds a write lock on the folder's row. */
  async function untilWriteLocked(folderId: string) {
    for (let i = 0; i < 400; i++) {
      try {
        await probe.query(
          `SELECT 1 FROM "Item" WHERE "id" = $1 FOR NO KEY UPDATE NOWAIT`,
          [folderId]
        )
      } catch (error) {
        if ((error as { code?: string }).code === '55P03') return
        throw error
      }
      await sleep(25)
    }
    throw new Error('the trash never locked the folder')
  }

  /** Waits until a statement matching `pattern` waits on the blocker. */
  async function untilBlocked(pattern: string) {
    const pid = (await blocker.query('SELECT pg_backend_pid() AS pid')).rows[0].pid
    for (let i = 0; i < 400; i++) {
      const { rows } = await probe.query(
        `SELECT count(*)::int AS n FROM pg_stat_activity
         WHERE $1 = ANY(pg_blocking_pids(pid)) AND query ILIKE $2`,
        [pid, pattern]
      )
      if (rows[0].n > 0) return
      await sleep(25)
    }
    throw new Error(`nothing matching ${pattern} waited on the blocker`)
  }

  /** Starts a trash of `folderId` that stops, uncommitted, after its UPDATE. */
  async function pausedTrash(folderId: string) {
    await blocker.query('BEGIN')
    await blocker.query('LOCK TABLE "TrashItem" IN SHARE MODE')
    const trash = trashItems([folderId], ownerId)
    await untilWriteLocked(folderId)
    return {
      trash,
      release: async () => {
        await blocker.query('COMMIT')
        await trash
      },
    }
  }

  const status = async (id: string) =>
    (await prisma.item.findUnique({ where: { id }, select: { status: true } }))
      ?.status ?? 'absent'

  it('refuses a file whose folder is being trashed (trash first)', async () => {
    const folderId = await makeFolder('race-trash-first', rootId)
    const before = await used()
    const { release } = await pausedTrash(folderId)
    const u = upload(folderId, 'late.txt')
    const filing = u.run().then(
      () => 'filed',
      (error) => error
    )
    await sleep(300)
    await release()

    expect(await filing).toMatchObject({ errorCode: 'ITEM_NOT_FOUND', status: 404 })
    expect(await status(folderId)).toBe('trashed')
    expect(await status(u.id)).toBe('absent')
    expect(await used()).toBe(before)
  })

  it('trashes a file filed while the trash started (upload first)', async () => {
    const folderId = await makeFolder('race-upload-first', rootId)
    const key = (
      await blocker.query(
        `SELECT hashtextextended('stashly.quota_charge:' || $1, 0) AS k`,
        [driveId]
      )
    ).rows[0].k
    // The upload has read its folder and waits in its quota charge.
    await blocker.query('SELECT pg_advisory_lock($1)', [key])
    const u = upload(folderId, 'early.txt')
    const filing = u.run()
    try {
      await untilBlocked('%stashly_charge_upload%')
      const trash = trashItems([folderId], ownerId)
      await Promise.race([trash, sleep(300)])
      await blocker.query('SELECT pg_advisory_unlock($1)', [key])
      await filing
      await trash
    } finally {
      await blocker.query('SELECT pg_advisory_unlock_all()')
    }

    expect(await status(folderId)).toBe('trashed')
    expect(await status(u.id)).toBe('trashed')
  })

  it('refuses a folder tree whose root is being trashed (trash first)', async () => {
    const folderId = await makeFolder('race-tree-trash-first', rootId)
    const { release } = await pausedTrash(folderId)
    const resolving = resolveUploadFolders({
      userId: ownerId,
      rootId: folderId,
      dirs: ['x/y'],
    }).then(
      () => 'resolved',
      (error) => error
    )
    await sleep(300)
    await release()

    expect(await resolving).toMatchObject({ errorCode: 'ITEM_NOT_FOUND', status: 404 })
    expect(await prisma.item.count({ where: { parentId: folderId } })).toBe(0)
  })

  it('trashes the folders a tree created while the trash started (tree first)', async () => {
    const folderId = await makeFolder('race-tree-first', rootId)
    // The tree has looked its folders up and waits to insert the new ones.
    await blocker.query('BEGIN')
    await blocker.query('LOCK TABLE "View" IN SHARE MODE')
    const resolving = resolveUploadFolders({
      userId: ownerId,
      rootId: folderId,
      dirs: ['x/y'],
    })
    let trash: Promise<unknown> | undefined
    try {
      await untilBlocked('%INSERT INTO "Item"%unnest%')
      trash = trashItems([folderId], ownerId)
      await Promise.race([trash, sleep(300)])
    } finally {
      await blocker.query('COMMIT')
    }
    const { folders } = await resolving
    await trash

    expect(await status(folderId)).toBe('trashed')
    expect(await status(folders['x'])).toBe('trashed')
    expect(await status(folders['x/y'])).toBe('trashed')
  })

  /**
   * Tech-debt item 67: the other writers that put an item into a folder hold it
   * the same way an upload does, so a destination in trash, or on its way
   * there, is refused and nothing lands in it.
   */
  describe('a create, move or copy into a folder in trash', () => {
    async function makeFile(name: string, parentId: string) {
      const id = uid('Item')
      await prisma.item.create({
        data: {
          id,
          name,
          type: 'file',
          category: 'unknown',
          status: 'normal',
          ownerId,
          driveId,
          parentId,
          size: 10n,
        },
      })
      return id
    }

    // Each prepares its source first, so only the write itself meets the trash.
    const writers: Record<string, () => Promise<(dest: string) => Promise<unknown>>> = {
      createFolder: async () => (dest) => createFolder('late-folder', dest, ownerId, driveId),
      moveItems: async () => {
        const fileId = await makeFile('moved.txt', rootId)
        return (dest) => moveItems([fileId], dest, ownerId)
      },
      copyItem: async () => {
        const fileId = await makeFile('copied.txt', rootId)
        return (dest) => copyItem(ownerId, fileId, dest)
      },
    }

    const inside = (folderId: string) => prisma.item.count({ where: { parentId: folderId } })

    for (const [writer, prepare] of Object.entries(writers)) {
      it(`${writer} refuses a folder already in trash`, async () => {
        const folderId = await makeFolder(`${writer}-in-trash`, rootId)
        await trashItems([folderId], ownerId)
        const write = await prepare()

        await expect(write(folderId)).rejects.toMatchObject({
          errorCode: 'ITEM_NOT_FOUND',
          status: 404,
        })
        expect(await inside(folderId)).toBe(0)
      })

      it(`${writer} refuses a folder being trashed (trash first)`, async () => {
        const folderId = await makeFolder(`${writer}-being-trashed`, rootId)
        const write = await prepare()
        const { release } = await pausedTrash(folderId)
        const writing = write(folderId).then(
          () => 'written',
          (error) => error
        )
        await sleep(300)
        await release()

        expect(await writing).toMatchObject({ errorCode: 'ITEM_NOT_FOUND', status: 404 })
        expect(await status(folderId)).toBe('trashed')
        expect(await inside(folderId)).toBe(0)
      })
    }
  })
})

/**
 * A copy shares its original's bytes but is the copier's: they own it, with an
 * owner grant, on their own drive, which pays for it. A folder copy takes only
 * live contents, and its size and counts come from the triggers (item 67).
 */
describe('copyItem', () => {
  async function makeFile(name: string, parentId: string, size: bigint, userId = ownerId, drive = driveId) {
    const id = uid('Item')
    await prisma.item.create({
      data: {
        id,
        name,
        type: 'file',
        category: 'unknown',
        status: 'normal',
        ownerId: userId,
        driveId: drive,
        parentId,
        size,
        file: {
          create: {
            id: uid('File'),
            bucket: 'stashly-test-folder-tree',
            key: `copy-test/${id}`,
            uploadPath: `copy-test/${name}`,
          },
        },
      },
    })
    return id
  }

  const quotaOf = async (drive: string) => {
    await flushItemSizes()
    return (await prisma.quota.findFirstOrThrow({ where: { driveId: drive } })).used
  }

  it('copies a folder’s live contents for the copier, sharing the bytes and charging once', async () => {
    const src = await makeFolder('copy-src', rootId)
    const sub = await makeFolder('sub', src)
    const a = await makeFile('a.txt', src, 100n)
    await makeFile('b.txt', sub, 50n)
    const gone = await makeFile('gone.txt', src, 7n)
    await trashItems([gone], ownerId)
    const dest = await makeFolder('copy-dest', rootId)
    const before = await quotaOf(driveId)

    const copy = await copyItem(ownerId, src, dest)
    await flushItemSizes()

    const tree = await prisma.item.findMany({
      where: { OR: [{ parentId: copy.id }, { parent: { parentId: copy.id } }] },
      select: { id: true, name: true, status: true, file: { select: { key: true } } },
    })
    expect(tree.map((i) => i.name).sort()).toEqual(['a.txt', 'b.txt', 'sub'])
    expect(tree.every((i) => i.status === 'normal')).toBe(true)
    const aKey = (await prisma.file.findUniqueOrThrow({ where: { itemId: a } })).key
    expect(tree.find((i) => i.name === 'a.txt')?.file?.key).toBe(aKey)

    const copied = await prisma.item.findUniqueOrThrow({
      where: { id: copy.id },
      select: { size: true, parentId: true, ownerId: true, folder: { select: { childCount: true } } },
    })
    expect(copied).toMatchObject({ size: 150n, parentId: dest, ownerId, folder: { childCount: 2 } })
    expect(await quotaOf(driveId)).toBe(before + 150n)

    const ids = [copy.id, ...tree.map((i) => i.id)]
    expect(
      await prisma.permission.count({
        where: { itemId: { in: ids }, roles: 'owner', users: { some: { id: ownerId } } },
      })
    ).toBe(ids.length)
  })

  it('charges the bytes it copied while the source folder’s size still trails its uploads', async () => {
    const src = await makeFolder('copy-trailing', rootId)
    const dest = await makeFolder('copy-trailing-dest', rootId)
    const before = await quotaOf(driveId)

    const { copy, srcSize } = await withSizeRollupPaused(async () => {
      // Uploads into a busy database are logged, so the folder's size stays 0.
      for (const [name, size] of [['u1.txt', 100n], ['u2.txt', 50n]] as const) {
        const id = await makeFile(name, src, size)
        await prisma.item.update({ where: { id }, data: { uploadId: `up-${id}` } })
      }
      const u3 = uid('Item')
      await prisma.item.create({
        data: {
          id: u3, name: 'u3.txt', type: 'file', category: 'unknown', status: 'normal',
          ownerId, driveId, parentId: src, size: 25n, uploadId: `up-${u3}`,
        },
      })
      const srcSize = (await prisma.item.findUniqueOrThrow({ where: { id: src } })).size
      return { copy: await copyItem(ownerId, src, dest), srcSize }
    })

    expect(srcSize).toBe(150n) // u3 trails: logged, not yet in the folder's size
    expect(await quotaOf(driveId)).toBe(before + 175n)
    expect((await prisma.item.findUniqueOrThrow({ where: { id: copy.id } })).size).toBe(175n)
  })

  it('lets a user a file was shared with copy it into their own drive, and charges them', async () => {
    const strangerDrive = uid('Drive')
    await prisma.drive.create({ data: { id: strangerDrive, ownerId: strangerId } })
    await prisma.quota.create({ data: { id: uid('Quota'), driveId: strangerDrive, total: 10n ** 9n } })
    const strangerRoot = await prisma.item.create({
      data: {
        id: uid('Item'),
        name: 'stranger root',
        type: 'folder',
        category: 'unknown',
        ownerId: strangerId,
        driveId: strangerDrive,
      },
    })
    const shared = await makeFile('shared.txt', rootId, 30n)
    await prisma.permission.create({
      data: { id: uid('Permission'), roles: 'read', itemId: shared, users: { connect: { id: strangerId } } },
    })
    const [ownerBefore, strangerBefore] = [await quotaOf(driveId), await quotaOf(strangerDrive)]

    const copy = await copyItem(strangerId, shared, strangerRoot.id)

    expect(copy).toMatchObject({ ownerId: strangerId, driveId: strangerDrive, parentId: strangerRoot.id })
    expect(await quotaOf(strangerDrive)).toBe(strangerBefore + 30n)
    expect(await quotaOf(driveId)).toBe(ownerBefore)

    // Read alone doesn't let them copy into the owner's folders.
    await expect(copyItem(strangerId, shared, rootId)).rejects.toMatchObject({ status: 403 })
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
