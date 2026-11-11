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
  status: 'normal' | 'trashed' = 'normal',
  id = uid('Item')
) {
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

/** A file row with its File facet, as an upload leaves it (no size log: it cascades at once). */
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

/**
 * Two connections of their own for the race tests: `blocker` holds a lock so
 * the order of two transactions is certain, `probe` watches who waits on it.
 */
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

/** Waits until `count` statements matching `pattern` wait on `holder` (the blocker by default). */
async function untilBlocked(pattern: string, count = 1, holder = blocker) {
  const pid = (await holder.query('SELECT pg_backend_pid() AS pid')).rows[0].pid
  for (let i = 0; i < 400; i++) {
    const { rows } = await probe.query(
      `SELECT count(*)::int AS n FROM pg_stat_activity
       WHERE $1 = ANY(pg_blocking_pids(pid)) AND query ILIKE $2`,
      [pid, pattern]
    )
    if (rows[0].n >= count) return
    await sleep(25)
  }
  throw new Error(`fewer than ${count} statements matching ${pattern} waited on the blocker`)
}

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
   * Tech-debt item 72: trash takes its folders FOR UPDATE in id order, in one
   * statement. A folder tree took its root, then each level, in separate
   * statements. With a subfolder whose id sorts before the root's, the trash
   * held the subfolder and waited for the root while the tree held the root
   * and waited for the subfolder.
   */
  it('a folder tree and a trash of its root take their folders in one order (item 72)', async () => {
    // Ids chosen so the subfolder sorts before the root.
    const withLead = (lead: string) => {
      const id = uid('Item')
      return id.replace('_', `_${lead}`) as typeof id
    }
    const root = await makeFolder('order-root', rootId, 'normal', withLead('z'))
    const sub = await makeFolder('a', root, 'normal', withLead('0'))
    // Something else holds the root, so the trash takes the subfolder and waits there.
    await blocker.query('BEGIN')
    await blocker.query(`SELECT 1 FROM "Item" WHERE "id" = $1 FOR KEY SHARE`, [root])
    let trash: Promise<unknown> | undefined
    let resolving: Promise<unknown> | undefined
    try {
      trash = trashItems([root], ownerId).then(
        () => 'trashed',
        (error) => error
      )
      await untilBlocked('%"Held"%FOR UPDATE%')
      resolving = resolveUploadFolders({ userId: ownerId, rootId: root, dirs: ['a/new'] }).then(
        () => 'resolved',
        (error) => error
      )
      await sleep(300)
    } finally {
      await blocker.query('COMMIT')
    }

    const outcome = { trash: await trash, resolving: await resolving }
    expect(String(outcome.trash)).not.toMatch(/deadlock/i)
    expect(String((outcome.resolving as Error)?.message ?? outcome.resolving)).not.toMatch(/deadlock/i)
    expect(outcome.trash).toBe('trashed')
    expect(outcome.resolving).toMatchObject({ errorCode: 'ITEM_NOT_FOUND', status: 404 })
    expect(await status(root)).toBe('trashed')
    expect(await prisma.item.count({ where: { parentId: sub } })).toBe(0)
  })

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

  const parentOf = async (id: string) =>
    (await prisma.item.findUniqueOrThrow({ where: { id }, select: { parentId: true } }))
      .parentId

  /**
   * A move takes an item out of its folder as well as into another. Without a
   * lock on the folder it leaves, a trash of that folder and the move each
   * missed the other, and the item ended up trashed inside a live folder with
   * no Trash entry: invisible, and impossible to restore.
   */
  describe('a move out of a folder in trash', () => {
    it('refuses an item inside a folder already in trash', async () => {
      const folderId = await makeFolder('move-out-in-trash', rootId)
      const fileId = await makeFile('stuck.txt', folderId)
      const dest = await makeFolder('move-out-dest-1', rootId)
      await trashItems([folderId], ownerId)

      await expect(moveItems([fileId], dest, ownerId)).rejects.toMatchObject({
        status: 404,
      })
      expect(await parentOf(fileId)).toBe(folderId)
      expect(await status(fileId)).toBe('trashed')
    })

    it('refuses an item whose folder is being trashed (trash first)', async () => {
      const folderId = await makeFolder('move-out-trash-first', rootId)
      const fileId = await makeFile('late-move.txt', folderId)
      const dest = await makeFolder('move-out-dest-2', rootId)
      const { release } = await pausedTrash(folderId)
      const moving = moveItems([fileId], dest, ownerId).then(
        () => 'moved',
        (error) => error
      )
      await sleep(300)
      await release()

      expect(await moving).toMatchObject({ status: 404 })
      expect(await parentOf(fileId)).toBe(folderId)
      expect(await status(fileId)).toBe('trashed')
    })

    it('leaves the item live in its new folder (move first)', async () => {
      const folderId = await makeFolder('move-out-move-first', rootId)
      const fileId = await makeFile('early-move.txt', folderId)
      const dest = await makeFolder('move-out-dest-3', rootId)
      // The move has updated the item and waits in its child-count trigger.
      await blocker.query('BEGIN')
      await blocker.query('LOCK TABLE "Folder" IN SHARE MODE')
      const moving = moveItems([fileId], dest, ownerId)
      let trash: Promise<unknown> | undefined
      try {
        await untilBlocked('%UPDATE%"Item"%parentId%')
        trash = trashItems([folderId], ownerId)
        await Promise.race([trash, sleep(300)])
      } finally {
        await blocker.query('COMMIT')
      }
      await moving
      await trash

      expect(await status(folderId)).toBe('trashed')
      expect(await parentOf(fileId)).toBe(dest)
      expect(await status(fileId)).toBe('normal')
    })
  })

  /**
   * Tech-debt item 67: the other writers that put an item into a folder hold it
   * the same way an upload does, so a destination in trash, or on its way
   * there, is refused and nothing lands in it.
   */
  describe('a create, move or copy into a folder in trash', () => {
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

      // Tech-debt item 76: the other order. The writer holds the folder, so the
      // trash waits for it and then trashes what it put inside.
      it(`${writer} first: the trash waits, then takes what it wrote (writer first)`, async () => {
        const folderId = await makeFolder(`${writer}-writer-first`, rootId)
        const write = await prepare()
        // The writer has its folder and waits in its child-count trigger.
        await blocker.query('BEGIN')
        await blocker.query('LOCK TABLE "Folder" IN SHARE MODE')
        const writing = write(folderId)
        let trash: Promise<unknown> | undefined
        try {
          await untilBlocked('%"Item"%')
          trash = trashItems([folderId], ownerId)
          await Promise.race([trash, sleep(300)])
        } finally {
          await blocker.query('COMMIT')
        }
        await writing
        await trash

        expect(await status(folderId)).toBe('trashed')
        const written = await prisma.item.findMany({
          where: { parentId: folderId },
          select: { status: true },
        })
        expect(written.map((i) => i.status)).toEqual(['trashed'])
      })
    }

    /**
     * Tech-debt item 74: access is checked before the trash, so a caller with
     * no access to a folder gets the same 403 whether it is in trash or not,
     * and can't learn which.
     */
    it('answers a caller with no access 403 for a folder in trash, as for a live one (item 74)', async () => {
      const trashed = await makeFolder('no-access-in-trash', rootId)
      const live = await makeFolder('no-access-live', rootId)
      await trashItems([trashed], ownerId)
      const shared = await makeFile('shared-read.txt', rootId)
      await prisma.permission.create({
        data: { id: uid('Permission'), roles: 'read', itemId: shared, users: { connect: { id: strangerId } } },
      })

      for (const dest of [trashed, live]) {
        await expect(moveItems([shared], dest, strangerId)).rejects.toMatchObject({ status: 403 })
        await expect(copyItem(strangerId, shared, dest)).rejects.toMatchObject({ status: 403 })
      }
      expect(await inside(trashed)).toBe(0)
      expect(await inside(live)).toBe(0)
    })
  })

  /**
   * Tech-debt item 73: the trash's lock repeats until a pass finds only folders
   * it already holds. Comparing counts let one folder leaving the tree and one
   * arriving during the first pass look like no change, so a folder made under
   * the arriving one was never locked, and a create into it slipped past the
   * trash and stayed live inside it.
   */
  it('holds a folder made under one that moved in while the lock looked (item 73)', async () => {
    const top = await makeFolder('lock-set-top', rootId)
    const leaving = await makeFolder('lock-set-leaving', top)
    const away = await makeFolder('lock-set-away', rootId)
    const arriving = await makeFolder('lock-set-arriving', away)
    const late = uid('Item')
    const mover = new pg.Client({ connectionString: url() })
    const maker = new pg.Client({ connectionString: url() })
    await Promise.all([mover.connect(), maker.connect()])
    let trash: Promise<unknown> | undefined
    let creating: Promise<unknown> | undefined
    try {
      // One folder leaves the tree and one arrives, uncommitted, so the first
      // pass waits for them and counts the one leaving.
      await mover.query('BEGIN')
      await mover.query(`UPDATE "Item" SET "parentId" = $2 WHERE "id" = $1`, [leaving, rootId])
      await mover.query(`UPDATE "Item" SET "parentId" = $2 WHERE "id" = $1`, [arriving, top])
      // A folder being made under the arriving one holds it FOR KEY SHARE.
      await maker.query('BEGIN')
      await maker.query(
        `INSERT INTO "Item" ("id", "name", "type", "updatedAt", "ownerId", "driveId", "parentId")
         VALUES ($1, 'lock-set-late', 'folder', now(), $2, $3, $4)`,
        [late, ownerId, driveId, arriving]
      )
      // The trash stops, uncommitted, before its Trash entries.
      await blocker.query('BEGIN')
      await blocker.query('LOCK TABLE "TrashItem" IN SHARE MODE')
      trash = trashItems([top], ownerId)
      await untilBlocked('%FOR UPDATE%', 1, mover)
      await mover.query('COMMIT')
      // The second pass finds the arriving folder and waits for the one being made.
      await untilBlocked('%FOR UPDATE%', 1, maker)
      await maker.query('COMMIT')
      await untilBlocked('%TrashItem%')
      creating = createFolder('lock-set-inside', late, ownerId, driveId).then(
        () => 'written',
        (error) => error
      )
      await sleep(300)
    } finally {
      await mover.query('ROLLBACK').catch(() => {})
      await maker.query('ROLLBACK').catch(() => {})
      await blocker.query('COMMIT')
      await Promise.all([mover.end(), maker.end()])
    }
    await trash
    expect(await creating).toMatchObject({ errorCode: 'ITEM_NOT_FOUND', status: 404 })
    expect(await status(late)).toBe('trashed')
    expect(await prisma.item.count({ where: { parentId: late } })).toBe(0)
  })
})

/** Size, inclusive size and child counts of a folder, read after the rollup. */
async function totalsOf(id: string) {
  await flushItemSizes()
  return prisma.item.findUniqueOrThrow({
    where: { id },
    select: {
      size: true,
      inclusiveSize: true,
      folder: { select: { childCount: true, inclusiveChildCount: true } },
    },
  })
}

/** A grant of `roles` on `itemId` to `userId`. Grants cover their own item only. */
function grant(itemId: string, userId: string, roles: 'read' | 'write') {
  return prisma.permission.create({
    data: { id: uid('Permission'), roles, itemId, users: { connect: { id: userId } } },
  })
}

const parentOf = async (id: string) => (await prisma.item.findUniqueOrThrow({ where: { id } })).parentId

/**
 * Tech-debt item 13: a move changes `parentId` only, so the triggers move the
 * bytes and counts from the old folder to the new one. It needs `write` on the
 * destination and on every item, and refuses the whole batch for any one item.
 * (Moves between drives: upload-item-safety.test.ts; into its own subtree and
 * into a folder in trash: above and below.)
 */
describe('moveItems', () => {
  it('moves a folder and a file, taking their bytes and counts from the old folder to the new one', async () => {
    const from = (await createFolder('move-from', rootId, ownerId, driveId)).id
    const to = (await createFolder('move-to', rootId, ownerId, driveId)).id
    const folder = (await createFolder('moved-folder', from, ownerId, driveId)).id
    await makeFile('inner-1.txt', folder, 100n)
    await makeFile('inner-2.txt', folder, 50n)
    const file = await makeFile('moved.txt', from, 30n)
    const stays = await makeFile('stays.txt', from, 7n)
    const [fromBefore, toBefore, folderBefore, rootBefore] = [
      await totalsOf(from),
      await totalsOf(to),
      await totalsOf(folder),
      await totalsOf(rootId),
    ]
    expect(fromBefore).toMatchObject({ size: 187n, folder: { childCount: 3 } })

    const moved = await moveItems([folder, file], to, ownerId)

    expect(moved?.map((i) => i.id).sort()).toEqual([folder, file].sort())
    expect([await parentOf(folder), await parentOf(file), await parentOf(stays)]).toEqual([to, to, from])
    expect(await totalsOf(from)).toEqual({
      size: 7n,
      inclusiveSize: fromBefore.inclusiveSize - 180n,
      folder: {
        childCount: 1,
        inclusiveChildCount: (fromBefore.folder?.inclusiveChildCount ?? 0) - 2,
      },
    })
    expect(await totalsOf(to)).toEqual({
      size: toBefore.size + 180n,
      inclusiveSize: toBefore.inclusiveSize + 180n,
      folder: {
        childCount: (toBefore.folder?.childCount ?? 0) + 2,
        inclusiveChildCount: (toBefore.folder?.inclusiveChildCount ?? 0) + 2,
      },
    })
    // The moved folder keeps its own totals, and the tree above both is unchanged.
    expect(await totalsOf(folder)).toEqual(folderBefore)
    expect((await totalsOf(rootId)).size).toBe(rootBefore.size)
  })

  it('lets a collaborator with write on the items and the destination move them in the owner’s drive', async () => {
    const from = await makeFolder('collab-move-from', rootId)
    const to = await makeFolder('collab-move-to', rootId)
    const file = await makeFile('collab-moved.txt', from, 5n)
    await grant(file, strangerId, 'write')
    await grant(to, strangerId, 'write')

    await moveItems([file], to, strangerId)

    expect(await prisma.item.findUniqueOrThrow({ where: { id: file } })).toMatchObject({
      parentId: to,
      ownerId,
      driveId,
    })
  })

  it('refuses without write on the destination, or on any one item, and moves nothing', async () => {
    const from = await makeFolder('perm-move-from', rootId)
    const readOnly = await makeFolder('perm-move-read-only', rootId)
    const writable = await makeFolder('perm-move-writable', rootId)
    const mine = await makeFile('perm-writable.txt', from, 5n)
    const notMine = await makeFile('perm-read-only.txt', from, 5n)
    await grant(readOnly, strangerId, 'read')
    await grant(writable, strangerId, 'write')
    await grant(mine, strangerId, 'write')
    await grant(notMine, strangerId, 'read')

    await expect(moveItems([mine], readOnly, strangerId)).rejects.toMatchObject({ status: 403 })
    await expect(moveItems([mine, notMine], writable, strangerId)).rejects.toMatchObject({ status: 403 })
    expect([await parentOf(mine), await parentOf(notMine)]).toEqual([from, from])
  })

  it('refuses an item in trash, a missing one, one already there and a folder into itself, moving nothing', async () => {
    const from = await makeFolder('refuse-move-from', rootId)
    const to = await makeFolder('refuse-move-to', rootId)
    const live = await makeFile('refuse-live.txt', from, 5n)
    const trashed = await makeFile('refuse-trashed.txt', from, 5n)
    await trashItems([trashed], ownerId)
    const already = await makeFile('refuse-already.txt', to, 5n)

    await expect(moveItems([live, trashed], to, ownerId)).rejects.toMatchObject({ status: 404 })
    await expect(moveItems([live, uid('Item')], to, ownerId)).rejects.toMatchObject({ status: 404 })
    await expect(moveItems([live, already], to, ownerId)).rejects.toMatchObject({
      errorCode: 'MOVE_ITEM_FAILED',
    })
    await expect(moveItems([to], to, ownerId)).rejects.toMatchObject({ errorCode: 'MOVE_ITEM_FAILED' })
    await expect(moveItems([live], '', ownerId)).rejects.toMatchObject({ errorCode: 'MOVE_ITEM_FAILED' })
    expect([await parentOf(live), await parentOf(trashed), await parentOf(to)]).toEqual([from, from, rootId])
  })

  it('refuses to move a root folder, and does nothing for an empty list', async () => {
    const elsewhere = await makeFolder('root-move-target', rootId)

    await expect(moveItems([rootId], elsewhere, ownerId)).rejects.toMatchObject({
      errorCode: 'MOVE_ITEM_FAILED',
    })
    expect(await parentOf(rootId)).toBeNull()
    expect(await moveItems([], elsewhere, ownerId)).toBeUndefined()
  })
})

/**
 * Tech-debt item 13: a folder is made with its Folder row and default view, on
 * its parent's drive, and counted in its parent. (A collaborator's folder and
 * one without any grant: upload-item-safety.test.ts; into a folder in trash:
 * below.)
 */
describe('createFolder', () => {
  it('makes the folder with its Folder row and default view, and counts it in its parent', async () => {
    const parent = (await createFolder('create-parent', rootId, ownerId, driveId)).id
    const before = await totalsOf(parent)

    const made = await createFolder('created', parent, ownerId, driveId)

    expect(made).toMatchObject({
      name: 'created',
      type: 'folder',
      status: 'normal',
      parentId: parent,
      ownerId,
      driveId,
      size: 0n,
    })
    const folder = await prisma.folder.findFirstOrThrow({ where: { itemId: made.id }, include: { view: true } })
    expect(folder).toMatchObject({ childCount: 0, view: { viewType: 'grid', sortBy: 'type', sortOrder: 'ascending' } })
    expect(await totalsOf(parent)).toEqual({
      ...before,
      folder: {
        childCount: (before.folder?.childCount ?? 0) + 1,
        inclusiveChildCount: (before.folder?.inclusiveChildCount ?? 0) + 1,
      },
    })
  })

  it('makes a folder with no parent on the drive it is given', async () => {
    const made = await createFolder('top-level', null, ownerId, driveId)
    expect(made).toMatchObject({ parentId: null, driveId, ownerId })
  })

  it('refuses a user granted only read on the parent, and creates nothing', async () => {
    const parent = await makeFolder('create-read-only', rootId)
    await grant(parent, strangerId, 'read')

    await expect(createFolder('not-allowed', parent, strangerId, driveId)).rejects.toMatchObject({ status: 403 })
    expect(await prisma.item.count({ where: { parentId: parent } })).toBe(0)
  })
})

/**
 * A copy shares its original's bytes but is the copier's: they own it, with an
 * owner grant, on their own drive, which pays for it. A folder copy takes only
 * live contents, and its size and counts come from the triggers (item 67).
 */
describe('moveItems into its own subtree', () => {
  // Empty folders: a moved folder with no bytes cascades nothing, so a cycle the
  // old code made stays put until `finally` takes it apart again.
  it.each([
    ['its child', 1],
    ['its grandchild', 2],
    ['a folder five levels down', 5],
  ])('refuses a move of a folder into %s and writes nothing', async (_label, depth) => {
    const top = await makeFolder('move-top', rootId)
    let target = top
    for (let i = 0; i < depth; i++) target = await makeFolder(`level-${i + 1}`, target)

    try {
      await expect(moveItems([top], target, ownerId)).rejects.toMatchObject({
        message: 'Cannot move a folder into its own subfolder',
      })
      const { parentId } = await prisma.item.findUniqueOrThrow({ where: { id: top } })
      expect(parentId).toBe(rootId)
    } finally {
      await prisma.item.update({ where: { id: top }, data: { parentId: rootId } })
    }
  })

  it('still moves a folder into a sibling’s subfolder', async () => {
    const a = await makeFolder('move-a', rootId)
    const b = await makeFolder('move-b', rootId)
    const bChild = await makeFolder('move-b-child', b)

    await moveItems([a], bChild, ownerId)
    const { parentId } = await prisma.item.findUniqueOrThrow({ where: { id: a } })
    expect(parentId).toBe(bChild)
  })
})

describe('copyItem', () => {
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

  /** Tech-debt item 75: a copy joins the workspace of the folder it lands in, or none. */
  it('puts a copy in the workspace of the folder it lands in, or none (item 75)', async () => {
    const workspaceId = uid('Workspace')
    await prisma.workspace.create({
      data: {
        id: workspaceId,
        name: 'copy workspace',
        members: { create: { id: uid('WorkspaceMember'), memberId: ownerId, role: 'owner' } },
      },
    })
    try {
      const wsFolder = await makeFolder('ws-folder', rootId)
      const wsFile = await makeFile('ws.txt', wsFolder, 5n)
      await prisma.item.updateMany({ where: { id: { in: [wsFolder, wsFile] } }, data: { workspaceId } })
      const personal = await makeFolder('personal-dest', rootId)

      expect((await copyItem(ownerId, wsFile, personal)).workspaceId).toBeNull()
      expect((await copyItem(ownerId, wsFile, wsFolder)).workspaceId).toBe(workspaceId)
    } finally {
      await prisma.item.updateMany({ where: { workspaceId }, data: { workspaceId: null } })
      await prisma.workspaceMember.deleteMany({ where: { workspaceId } })
      await prisma.workspace.delete({ where: { id: workspaceId } })
    }
  })

  /**
   * A copy lists a folder's contents after it has made the folder's copy, so a
   * copy into the folder itself, or anywhere under it, found its own copy among
   * the contents and copied it again, until the transaction timed out.
   */
  it('refuses a copy into the folder itself or one of its subfolders, quickly, and writes nothing', async () => {
    const src = await makeFolder('loop-src', rootId)
    const sub = await makeFolder('loop-sub', src)
    const deeper = await makeFolder('loop-deeper', sub)
    await makeFile('loop.txt', sub, 10n)
    const before = await quotaOf(driveId)

    for (const into of [src, sub, deeper]) {
      const started = performance.now()
      await expect(copyItem(ownerId, src, into)).rejects.toMatchObject({ status: 400 })
      expect(performance.now() - started).toBeLessThan(1_000)
    }

    expect(await prisma.item.count({ where: { name: 'loop-src' } })).toBe(1)
    expect(await quotaOf(driveId)).toBe(before)
  })

  /**
   * The free space was read, then charged later in the same transaction, so two
   * copies that each fit alone could both pass on the same free space. The
   * blocker holds both after their read and before their first write.
   */
  it('lets only one of two racing copies have free space only one fits in', async () => {
    const tightId = uid('User')
    await prisma.user.create({
      data: { id: tightId, name: 'Tight quota', email: `tight-${tightId}@test.local`, emailVerified: true },
    })
    try {
      const tightDrive = uid('Drive')
      await prisma.drive.create({ data: { id: tightDrive, ownerId: tightId } })
      await prisma.quota.create({ data: { id: uid('Quota'), driveId: tightDrive, total: 60n } })
      const tightRoot = uid('Item')
      await prisma.item.create({
        data: {
          id: tightRoot, name: 'tight root', type: 'folder', category: 'unknown',
          ownerId: tightId, driveId: tightDrive,
        },
      })
      const file = await makeFile('forty.txt', tightRoot, 40n, tightId, tightDrive)

      await blocker.query('BEGIN')
      await blocker.query('LOCK TABLE "Item" IN SHARE MODE')
      const copies = [copyItem(tightId, file, tightRoot), copyItem(tightId, file, tightRoot)]
      let results: PromiseSettledResult<unknown>[]
      try {
        await untilBlocked('%INSERT INTO%"Item"%', 2)
      } finally {
        await blocker.query('COMMIT')
        results = await Promise.allSettled(copies)
      }

      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
      expect(results.find((r) => r.status === 'rejected')).toMatchObject({ reason: { status: 507 } })
      expect(await quotaOf(tightDrive)).toBe(40n)
    } finally {
      await wipeTestUsers([tightId])
      await prisma.user.deleteMany({ where: { id: tightId } })
    }
  })

  // Tech-debt item 13: what a copy must keep doing however it is written (item
  // 68 replaces the row-by-row walk with set-based statements).

  /** A user with their own drive, quota and root folder; `drop` removes all of it. */
  async function makeCopier(label: string, total = 10n ** 9n) {
    const userId = uid('User')
    await prisma.user.create({
      data: { id: userId, name: `Copy ${label}`, email: `copy-${label}-${userId}@test.local`, emailVerified: true },
    })
    const drive = uid('Drive')
    await prisma.drive.create({ data: { id: drive, ownerId: userId } })
    await prisma.quota.create({ data: { id: uid('Quota'), driveId: drive, total } })
    const root = uid('Item')
    await prisma.item.create({
      data: { id: root, name: `${label} root`, type: 'folder', category: 'unknown', ownerId: userId, driveId: drive },
    })
    const drop = async () => {
      await wipeTestUsers([userId])
      await prisma.user.deleteMany({ where: { id: userId } })
    }
    return { userId, drive, root, drop }
  }

  it('copies each item’s own fields and facets as new rows, and leaves the source as it was', async () => {
    const src = await makeFolder('facet-src', rootId)
    const photo = await makeFile('photo.jpg', src, 64n)
    await prisma.item.update({
      where: { id: photo },
      data: {
        category: 'image',
        tags: ['holiday', 'beach'],
        image: { create: { id: uid('Image'), width: 640, height: 480, cameraMake: 'Test camera' } },
      },
    })
    const dest = await makeFolder('facet-dest', rootId)

    const copy = await copyItem(ownerId, src, dest)

    const original = await prisma.item.findUniqueOrThrow({
      where: { id: photo },
      include: { file: true, image: true },
    })
    const copies = await prisma.item.findMany({ where: { parentId: copy.id }, include: { file: true, image: true } })
    expect(copies).toHaveLength(1)
    const [copied] = copies
    expect(copied).toMatchObject({
      name: 'photo.jpg',
      type: 'file',
      category: 'image',
      tags: ['holiday', 'beach'],
      size: 64n,
      status: 'normal',
      ownerId,
      driveId,
      image: { width: 640, height: 480, cameraMake: 'Test camera' },
      file: { bucket: original.file!.bucket, key: original.file!.key, uploadPath: original.file!.uploadPath },
    })
    expect(copied.id).not.toBe(photo)
    expect(copied.file!.id).not.toBe(original.file!.id)
    expect(copied.image!.id).not.toBe(original.image!.id)
    // The original keeps its place and its own facet rows.
    expect(original).toMatchObject({ parentId: src, file: { itemId: photo }, image: { itemId: photo, width: 640 } })

    // A copied folder gets its own Folder row with the default view, as `createFolder` gives one.
    const folder = await prisma.folder.findFirstOrThrow({ where: { itemId: copy.id }, include: { view: true } })
    expect(folder.view).toMatchObject({ viewType: 'grid', sortBy: 'type', sortOrder: 'ascending' })
  })

  it('gives the copy the source’s totals and adds them to the destination’s', async () => {
    const src = (await createFolder('totals-src', rootId, ownerId, driveId)).id
    const sub = (await createFolder('totals-sub', src, ownerId, driveId)).id
    await makeFile('t1.txt', src, 100n)
    await makeFile('t2.txt', sub, 50n)
    await makeFile('t3.txt', sub, 25n)
    const dest = (await createFolder('totals-dest', rootId, ownerId, driveId)).id
    await flushItemSizes()
    const totals = (id: string) =>
      prisma.item.findUniqueOrThrow({
        where: { id },
        select: {
          size: true,
          inclusiveSize: true,
          folder: { select: { childCount: true, inclusiveChildCount: true } },
        },
      })
    const [srcBefore, subBefore, destBefore] = [await totals(src), await totals(sub), await totals(dest)]
    expect(srcBefore).toMatchObject({ size: 175n, folder: { childCount: 2 } })

    const copy = await copyItem(ownerId, src, dest)
    await flushItemSizes()

    expect(await totals(copy.id)).toEqual(srcBefore)
    const copiedSub = await prisma.item.findFirstOrThrow({ where: { parentId: copy.id, type: 'folder' } })
    expect(await totals(copiedSub.id)).toEqual(subBefore)
    expect(await totals(dest)).toEqual({
      size: destBefore.size + 175n,
      inclusiveSize: destBefore.inclusiveSize + 175n,
      folder: {
        childCount: (destBefore.folder?.childCount ?? 0) + 1,
        inclusiveChildCount: (destBefore.folder?.inclusiveChildCount ?? 0) + 1,
      },
    })
    // The source is untouched.
    expect(await totals(src)).toEqual(srcBefore)
  })

  it('refuses a collaborator’s copy into the owner’s folder, even with write on it, and writes and charges nothing', async () => {
    const collab = await makeCopier('collab')
    try {
      const shared = await makeFolder('collab-shared', rootId)
      await prisma.permission.create({
        data: { id: uid('Permission'), roles: 'write', itemId: shared, users: { connect: { id: collab.userId } } },
      })
      const file = await makeFile('collab.txt', shared, 20n)
      // A grant covers its own item only (`hasItemPermission`), so the file gets one too.
      await prisma.permission.create({
        data: { id: uid('Permission'), roles: 'read', itemId: file, users: { connect: { id: collab.userId } } },
      })
      const [ownerBefore, collabBefore] = [await quotaOf(driveId), await quotaOf(collab.drive)]

      // The owner's drive would hold it, but a copy is paid for by the copier.
      await expect(copyItem(collab.userId, file, shared)).rejects.toMatchObject({ errorCode: 'COPY_ITEM_FAILED' })
      expect(await prisma.item.count({ where: { parentId: shared } })).toBe(1)
      expect(await quotaOf(driveId)).toBe(ownerBefore)
      expect(await quotaOf(collab.drive)).toBe(collabBefore)

      // Into their own drive the copy is theirs, and they pay for it.
      const copy = await copyItem(collab.userId, file, collab.root)
      expect(copy).toMatchObject({ ownerId: collab.userId, driveId: collab.drive, parentId: collab.root })
      expect(await quotaOf(collab.drive)).toBe(collabBefore + 20n)
      expect(await quotaOf(driveId)).toBe(ownerBefore)
    } finally {
      await collab.drop()
    }
  })

  it('refuses a copy of an item the user has no access to, and writes and charges nothing', async () => {
    const outsider = await makeCopier('outsider')
    try {
      const secret = await makeFile('secret.txt', rootId, 9n)
      const before = await quotaOf(outsider.drive)

      await expect(copyItem(outsider.userId, secret, outsider.root)).rejects.toMatchObject({
        errorCode: 'UNAUTHORIZED',
      })
      expect(await prisma.item.count({ where: { parentId: outsider.root } })).toBe(0)
      expect(await quotaOf(outsider.drive)).toBe(before)
    } finally {
      await outsider.drop()
    }
  })

  it('refuses a source in trash with 404, and a missing item or destination before reading anything', async () => {
    const file = await makeFile('trashed-src.txt', rootId, 5n)
    await trashItems([file], ownerId)
    const dest = await makeFolder('trashed-src-dest', rootId)

    await expect(copyItem(ownerId, file, dest)).rejects.toMatchObject({ status: 404 })
    await expect(copyItem(ownerId, file, null)).rejects.toMatchObject({ errorCode: 'COPY_ITEM_FAILED' })
    await expect(copyItem(ownerId, '', dest)).rejects.toMatchObject({ errorCode: 'COPY_ITEM_FAILED' })
    expect(await prisma.item.count({ where: { parentId: dest } })).toBe(0)
  })

  it('rolls the whole copy back when it doesn’t fit: 507, no rows, no charge', async () => {
    const small = await makeCopier('small', 100n)
    try {
      const src = uid('Item')
      await prisma.item.create({
        data: {
          id: src, name: 'too-big', type: 'folder', category: 'unknown',
          ownerId: small.userId, driveId: small.drive, parentId: small.root,
        },
      })
      await makeFile('sixty-1.txt', src, 60n, small.userId, small.drive)
      await makeFile('sixty-2.txt', src, 60n, small.userId, small.drive)
      const before = await quotaOf(small.drive)
      const rowsBefore = await prisma.item.count({ where: { driveId: small.drive } })

      await expect(copyItem(small.userId, src, small.root)).rejects.toMatchObject({ status: 507 })
      expect(await prisma.item.count({ where: { driveId: small.drive } })).toBe(rowsBefore)
      expect(await quotaOf(small.drive)).toBe(before)
    } finally {
      await small.drop()
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
