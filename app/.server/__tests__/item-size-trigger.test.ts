import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Prisma } from '@/prisma/client'
import { prisma } from '@/services/db'
import { getPrefixForModel, toObjectId } from '@/utils/converters'
import { flushItemSizes, withSizeRollupPaused } from './helpers/flush-item-sizes'
import { wipeTestUsers } from './helpers/wipe-test-users'

/**
 * `update_size()` keeps two rollups on every folder: `size` counts the active
 * contents and `inclusiveSize` counts everything, trash included, until it is
 * permanently deleted. Before `20261002090000_fix_inclusive_size_rollup` the
 * trigger passed a folder's `size` change up as an `inclusiveSize` change, so
 * trashing a file two levels down took its bytes off every ancestor's
 * `inclusiveSize` above the direct parent, and a moved folder's trashed
 * contents were never counted under its new parent (13 wrong values over
 * these steps on the old trigger).
 *
 * After every step each folder is compared with a recount from the files.
 * Needs a live database with migrations applied (CI provides one).
 */
const uid = (model: Parameters<typeof getPrefixForModel>[0]) => toObjectId(getPrefixForModel(model))

type Row = { id: string; name: string; type: string; status: string; parentId: string | null; size: bigint; inclusiveSize: bigint }

let ownerId: string
let driveId: string
const ids: Record<string, string> = {}

/** Folders whose stored rollups differ from a recount, as "name stored want". */
async function wrongFolders() {
  const rows = (await prisma.item.findMany({
    where: { ownerId },
    select: { id: true, name: true, type: true, status: true, parentId: true, size: true, inclusiveSize: true },
  })) as Row[]
  const children = new Map<string, Row[]>()
  for (const r of rows) if (r.parentId) children.set(r.parentId, [...(children.get(r.parentId) ?? []), r])
  const active = (f: Row): bigint =>
    (children.get(f.id) ?? []).reduce((n, c) => n + (c.status === 'trashed' ? 0n : c.type === 'folder' ? active(c) : c.size), 0n)
  const inclusive = (f: Row): bigint =>
    (children.get(f.id) ?? []).reduce((n, c) => n + (c.type === 'folder' ? inclusive(c) : c.size), 0n)
  return rows
    .filter((r) => r.type === 'folder' && (r.size !== active(r) || r.inclusiveSize !== inclusive(r)))
    .map((r) => `${r.name} ${r.size}/${r.inclusiveSize} want ${active(r)}/${inclusive(r)}`)
}

async function make(name: string, type: 'file' | 'folder', parent: string | null, size = 0) {
  ids[name] = uid('Item')
  await prisma.item.create({
    data: { id: ids[name], name, type, category: type === 'file' ? 'document' : 'unknown', status: 'normal', ownerId, driveId, parentId: parent ? ids[parent] : null, size },
  })
}

const subtree = (root: string) => Prisma.sql`
  WITH RECURSIVE "Subtree" AS (
    SELECT "id" FROM "Item" WHERE "id" = ${root}
    UNION SELECT i."id" FROM "Item" i JOIN "Subtree" s ON i."parentId" = s."id")`
const trashTree = (name: string) =>
  prisma.$executeRaw`${subtree(ids[name])} UPDATE "Item" i SET "status" = 'trashed' FROM "Subtree" s WHERE i."id" = s."id" AND i."status" <> 'trashed'`
const restoreTree = (name: string) =>
  prisma.$executeRaw`${subtree(ids[name])} UPDATE "Item" i SET "status" = 'normal' FROM "Subtree" s WHERE i."id" = s."id" AND i."status" = 'trashed'`
const setStatus = (name: string, status: 'trashed' | 'normal') => prisma.item.update({ where: { id: ids[name] }, data: { status } })

beforeAll(async () => {
  ownerId = uid('User')
  await prisma.user.create({ data: { id: ownerId, name: 'Size trigger', email: `size-${ownerId}@test.local`, emailVerified: true } })
  driveId = uid('Drive')
  await prisma.drive.create({ data: { id: driveId, ownerId } })
  // F ─ A(100), S ─ C(25), T ─ D(10)        G (empty, a move target)
  await make('F', 'folder', null)
  await make('A', 'file', 'F', 100)
  await make('S', 'folder', 'F')
  await make('C', 'file', 'S', 25)
  await make('T', 'folder', 'S')
  await make('D', 'file', 'T', 10)
  await make('G', 'folder', null)
})

afterAll(async () => {
  await wipeTestUsers([ownerId])
  await prisma.user.deleteMany({ where: { id: ownerId } })
})

// The steps build on each other, in order.
const steps: Array<[string, () => Promise<unknown>]> = [
  ['start', async () => {}],
  ['trash C alone, 2 levels below F', () => setStatus('C', 'trashed')],
  ['trash D alone, 3 levels below F', () => setStatus('D', 'trashed')],
  ['restore C and D one by one', async () => { await setStatus('C', 'normal'); await setStatus('D', 'normal') }],
  ['trash S with its subtree in one statement', () => trashTree('S')],
  ['restore S with its subtree in one statement', () => restoreTree('S')],
  ['trash F with its subtree in one statement', () => trashTree('F')],
  ['restore F with its subtree in one statement', () => restoreTree('F')],
  ['trash D alone again', () => setStatus('D', 'trashed')],
  ['move T, holding trashed D, from S to G', () => prisma.item.update({ where: { id: ids.T }, data: { parentId: ids.G } })],
  ['upload E (7) into T', () => make('E', 'file', 'T', 7)],
  ['E grows to 9', () => prisma.item.update({ where: { id: ids.E }, data: { size: 9 } })],
  ['delete trashed D permanently', () => prisma.$executeRaw`DELETE FROM "Item" WHERE "id" = ${ids.D}`],
  ['trash F again', () => trashTree('F')],
  ['delete F with its subtree in one statement', () => prisma.$executeRaw`${subtree(ids.F)} DELETE FROM "Item" i USING "Subtree" s WHERE i."id" = s."id"`],
]

describe('update_size() keeps folder size and inclusiveSize equal to a recount', () => {
  it.each(steps)('%s', async (_step, run) => {
    await run()
    expect(await wrongFolders()).toEqual([])
  })
})

/**
 * An uploaded file (`uploadId` set) cascades in its INSERT only while the
 * database is idle: it can take the rollup lock without waiting and nothing is
 * pending. Otherwise it is logged in "ItemSizeDelta", and
 * apply_item_size_deltas() writes each affected folder once
 * (`20261030140000_upload_size_delta_log`,
 * `20261030160000_upload_size_inline_when_idle`). withSizeRollupPaused() holds
 * that lock, so an upload inside it takes the logged path and stays pending
 * (no other rollup, not even a dev server's loop on the same database, applies
 * it in between). Each step then flushes and compares every folder with both
 * recounts: the JS one above and recount_folder_sizes().
 */
const upload = async (name: string, parent: string, size: number) => {
  ids[name] = uid('Item')
  await prisma.item.create({
    data: { id: ids[name], name, type: 'file', category: 'document', status: 'normal', ownerId, driveId, parentId: ids[parent], size, uploadId: `up_${ids[name]}` },
  })
}
const sizeOf = async (name: string) => {
  const r = await prisma.item.findUniqueOrThrow({ where: { id: ids[name] }, select: { size: true, inclusiveSize: true } })
  return `${r.size}/${r.inclusiveSize}`
}
const pendingUnder = async (name: string) =>
  Number((await prisma.$queryRaw<{ n: bigint }[]>`SELECT count(*) AS n FROM "ItemSizeDelta" WHERE "parentId" = ${ids[name]} AND ("active" <> 0 OR "inclusive" <> 0)`)[0].n)
const recount = async (name: string) => (await prisma.$queryRaw<{ n: number }[]>`SELECT recount_folder_sizes(${ids[name]}) AS n`)[0].n

describe('uploaded files reach their folders through the size log', () => {
  beforeAll(async () => {
    // U ─ V ─ W        X (another root, a move target)
    await make('U', 'folder', null)
    await make('V', 'folder', 'U')
    await make('W', 'folder', 'V')
    await make('X', 'folder', null)
  })

  it('an upload into an idle database cascades at once and logs nothing', async () => {
    // Another session can hold the lock for a moment (an upload cascading, a
    // dev server's rollup); then this upload is logged instead, so try again.
    let inline = false
    for (let attempt = 0; attempt < 10 && !inline; attempt++) {
      await flushItemSizes()
      const before = await sizeOf('W')
      await upload(`i${attempt}`, 'W', 1)
      inline = (await pendingUnder('W')) === 0 && (await sizeOf('W')) !== before
    }
    expect(inline).toBe(true)
    await flushItemSizes()
    expect(await wrongFolders()).toEqual([])
  })

  it('an upload while the database is busy waits in the log until the rollup, which writes each folder above it once', async () => {
    await flushItemSizes()
    const [w, v, u] = [await sizeOf('W'), await sizeOf('V'), await sizeOf('U')]
    const plus100 = (s: string) => s.split('/').map((n) => Number(n) + 100).join('/')
    await withSizeRollupPaused(async () => {
      await upload('u1', 'W', 100)
      expect([await sizeOf('W'), await sizeOf('V'), await sizeOf('U')]).toEqual([w, v, u])
      expect(await pendingUnder('W')).toBe(1)
    })
    await flushItemSizes()
    expect([await sizeOf('W'), await sizeOf('V'), await sizeOf('U')]).toEqual([plus100(w), plus100(v), plus100(u)])
    expect(await pendingUnder('W')).toBe(0)
  })

  const pendingSteps: Array<[string, () => Promise<unknown>]> = [
    ['upload, then trash its folder', async () => { await upload('u2', 'W', 30); await setStatus('W', 'trashed') }],
    ['restore that folder', () => setStatus('W', 'normal')],
    ['upload, then move its folder to another root', async () => { await upload('u3', 'W', 20); await prisma.item.update({ where: { id: ids.W }, data: { parentId: ids.X } }) }],
    ['upload, then delete the file', async () => { await upload('u4', 'V', 10); await prisma.$executeRaw`DELETE FROM "Item" WHERE "id" = ${ids.u4}` }],
    ['upload, then change its size', async () => { await upload('u5', 'V', 40); await prisma.item.update({ where: { id: ids.u5 }, data: { size: 45 } }) }],
    ['uploads and plain inserts mixed in one folder', async () => { await upload('u6', 'V', 7); await make('p1', 'file', 'V', 3); await upload('u7', 'V', 5) }],
    ['upload, then delete its folder with it', async () => {
      await make('Y', 'folder', 'U')
      await upload('u8', 'Y', 9)
      await prisma.$executeRaw`${subtree(ids.Y)} DELETE FROM "Item" i USING "Subtree" s WHERE i."id" = s."id"`
    }],
  ]

  it.each(pendingSteps)('%s, then the rollup: every folder equals a recount', async (_step, run) => {
    await withSizeRollupPaused(run)
    await flushItemSizes()
    expect(await wrongFolders()).toEqual([])
    expect(await recount('U')).toBe(0)
    expect(await recount('X')).toBe(0)
  })

  it('recount_folder_sizes() puts a corrupted folder right', async () => {
    await prisma.$executeRaw`UPDATE "Item" SET "size" = 999, "inclusiveSize" = 999 WHERE "id" = ${ids.V}`
    expect(await wrongFolders()).not.toEqual([])
    expect(await recount('U')).toBeGreaterThan(0)
    expect(await wrongFolders()).toEqual([])
  })
})

describe('the size rollup runs one at a time and gives way to user writes', () => {
  beforeAll(async () => {
    await make('C1', 'folder', null)
    await make('C2', 'folder', 'C1')
  })

  it('a rollup skips while another holds the lock, leaving its deltas for the next', async () => {
    await withSizeRollupPaused(async () => {
      await upload('c1', 'C2', 11)
      const [r] = await prisma.$queryRaw<{ deltas: number; ancestors: number }[]>`SELECT * FROM apply_item_size_deltas()`
      expect(r).toMatchObject({ deltas: 0, ancestors: 0 })
      expect(await pendingUnder('C2')).toBe(1)
    })
    await flushItemSizes()
    expect(await sizeOf('C1')).toBe('11/11')
  })

  it('a rollup that meets a locked folder gives up after 100 ms and keeps its deltas', async () => {
    await prisma.$transaction(async (tx) => {
      // C1 is held before the delta exists, so no other rollup can apply it
      // first: one that tries times out on C1 and rolls back, like this one.
      await tx.$queryRaw`SELECT 1 FROM "Item" WHERE "id" = ${ids.C1} FOR UPDATE`
      await withSizeRollupPaused(() => upload('c2', 'C2', 4))
      // Wait for the rollup's lock, then run the rollup under it (an advisory
      // lock is re-entrant, so its own try succeeds). Polling the non-waiting
      // call lost in CI: other test files' flushItemSizes() loops each held the
      // lock for the 100 ms it took them to time out on C1, retried 10 ms
      // later, and all 40 tries here found the lock taken ('skipped').
      const outcome = await prisma
        .$transaction(async (rollup) => {
          await rollup.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('stashly.item_size_rollup'))`
          const [r] = await rollup.$queryRaw<{ deltas: number }[]>`SELECT * FROM apply_item_size_deltas()`
          return r.deltas === 0 ? 'skipped' : 'applied'
        })
        .catch((e: unknown) =>
          /lock timeout|55P03/.test(String(e) + JSON.stringify((e as { meta?: unknown }).meta ?? '')) ? 'timed out' : String(e)
        )
      expect(outcome).toBe('timed out')
      // Inside the lock: once it is released, a rollup may apply this at any time.
      expect(await pendingUnder('C2')).toBe(1)
    }, { timeout: 10_000 })
    await flushItemSizes()
    expect(await sizeOf('C1')).toBe('15/15')
  })

  it('three flushes racing apply every delta once', async () => {
    await withSizeRollupPaused(async () => {
      for (let k = 0; k < 20; k++) await upload(`r${k}`, 'C2', 1)
    })
    await Promise.all([flushItemSizes(), flushItemSizes(), flushItemSizes()])
    expect(await sizeOf('C1')).toBe('35/35')
    expect(await wrongFolders()).toEqual([])
  })
})

/**
 * A status change moves no bytes between files, only a folder's `size` and
 * `childCount`, so one statement can write each folder once. Per-row triggers
 * wrote every ancestor once per file inside one transaction, and each write of
 * the same row costs more than the last: restoring 20,000 files took 122 s.
 */
describe('a status change writes each folder once', () => {
  const FILES = 40
  const folderWithFacet = async (name: string, parent: string | null) => {
    ids[name] = uid('Item')
    await prisma.item.create({
      data: {
        id: ids[name], name, type: 'folder', category: 'unknown', status: 'normal', ownerId, driveId,
        parentId: parent ? ids[parent] : null, folder: { create: { id: uid('Folder') } },
      },
    })
  }
  const filesIn = async (parent: string) => {
    for (let k = 0; k < FILES; k++) await make(`${parent}-${k}`, 'file', parent, 5)
  }
  const trashSql = (name: string) =>
    Prisma.sql`${subtree(ids[name])} UPDATE "Item" i SET "status" = 'trashed' FROM "Subtree" s WHERE i."id" = s."id" AND i."status" <> 'trashed'`
  const restoreSql = (name: string) =>
    Prisma.sql`${subtree(ids[name])} UPDATE "Item" i SET "status" = 'normal' FROM "Subtree" s WHERE i."id" = s."id" AND i."status" = 'trashed'`

  /** `Item` rows `statement` updates, triggers included. Rolled back. */
  const itemUpdates = async (statement: Prisma.Sql) => {
    let updates = -1
    await prisma
      .$transaction(async (tx) => {
        // Read before too: the view also holds this connection's earlier
        // transactions until Postgres flushes them, at most once a second.
        const read = async () =>
          Number((await tx.$queryRaw<{ n: bigint }[]>`SELECT n_tup_upd AS n FROM pg_stat_xact_user_tables WHERE relname = 'Item'`)[0].n)
        const before = await read()
        await tx.$executeRaw(statement)
        updates = (await read()) - before
        throw new Error('roll back')
      })
      .catch((e) => {
        if ((e as Error).message !== 'roll back') throw e
      })
    return updates
  }

  /** Folders whose child counts differ from their rows. */
  const wrongChildCounts = async () => {
    const rows = await prisma.$queryRaw<{ name: string }[]>`
      SELECT i."name" FROM "Folder" f JOIN "Item" i ON i."id" = f."itemId"
      WHERE i."ownerId" = ${ownerId} AND (
        f."childCount" <> (SELECT count(*) FROM "Item" c WHERE c."parentId" = i."id" AND c."status" <> 'trashed')
        OR f."inclusiveChildCount" <> (SELECT count(*) FROM "Item" c WHERE c."parentId" = i."id"))`
    return rows.map((r) => r.name)
  }
  const expectExact = async () => {
    await flushItemSizes()
    expect(await wrongFolders()).toEqual([])
    expect(await wrongChildCounts()).toEqual([])
  }

  beforeAll(async () => {
    // P ─ Q ─ R ─ S, 40 files of 5 bytes in R and in S
    await folderWithFacet('P', null)
    await folderWithFacet('Q', 'P')
    await folderWithFacet('R', 'Q')
    await folderWithFacet('S2', 'R')
    await filesIn('R')
    await filesIn('S2')
  })

  it('trashing a subtree updates its rows and each folder once', async () => {
    // 83 rows change status, and Q, R, S2 and P each take one size write.
    expect(await itemUpdates(trashSql('Q'))).toBeLessThanOrEqual(87)
  })

  it('restoring a subtree updates its rows and each folder once', async () => {
    await prisma.$executeRaw(trashSql('Q'))
    expect(await itemUpdates(restoreSql('Q'))).toBeLessThanOrEqual(87)
    await prisma.$executeRaw(restoreSql('Q'))
    await expectExact()
  })

  it('a subtree trash and restore keep every rollup exact', async () => {
    await prisma.$executeRaw(trashSql('Q'))
    await expectExact()
    expect(await sizeOf('Q')).toBe(`0/${FILES * 10}`)
    expect(await sizeOf('P')).toBe(`0/${FILES * 10}`)
    await prisma.$executeRaw(restoreSql('Q'))
    await expectExact()
    expect(await sizeOf('P')).toBe(`${FILES * 10}/${FILES * 10}`)
  })

  it('a file trashed before its folder stays out of the restored total', async () => {
    await setStatus('S2-0', 'trashed')
    await prisma.$executeRaw(trashSql('Q'))
    await prisma.$executeRaw`${subtree(ids.Q)} UPDATE "Item" i SET "status" = 'normal' FROM "Subtree" s WHERE i."id" = s."id" AND i."id" <> ${ids['S2-0']}`
    await expectExact()
    expect(await sizeOf('P')).toBe(`${FILES * 10 - 5}/${FILES * 10}`)
    await setStatus('S2-0', 'normal')
    await expectExact()
  })

  it('restoring one deep file brings only its bytes up through its folders', async () => {
    await prisma.$executeRaw(trashSql('Q'))
    await prisma.$executeRaw`UPDATE "Item" SET "status" = 'normal' WHERE "id" IN (${ids.Q}, ${ids.R}, ${ids.S2}, ${ids['S2-1']})`
    await expectExact()
    expect(await sizeOf('P')).toBe(`5/${FILES * 10}`)
    await prisma.$executeRaw(restoreSql('Q'))
    await expectExact()
  })

  it('a folder trashed alone takes its size off its ancestors and keeps it', async () => {
    await setStatus('S2', 'trashed')
    await expectExact()
    expect(await sizeOf('S2')).toBe(`${FILES * 5}/${FILES * 5}`)
    expect(await sizeOf('P')).toBe(`${FILES * 5}/${FILES * 10}`)
    await setStatus('S2', 'normal')
    await expectExact()
    expect(await sizeOf('P')).toBe(`${FILES * 10}/${FILES * 10}`)
  })

  it('a trash with an upload still in the log ends exact', async () => {
    await withSizeRollupPaused(async () => {
      await upload('late', 'S2', 7)
      await prisma.$executeRaw(trashSql('Q'))
    })
    await expectExact()
    await prisma.$executeRaw(restoreSql('Q'))
    await expectExact()
    await prisma.$executeRaw`DELETE FROM "Item" WHERE "id" = ${ids.late}`
    await expectExact()
  })
})
