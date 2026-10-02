import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Prisma } from '@/prisma/client'
import { prisma } from '@/services/db'
import { getPrefixForModel, toObjectId } from '@/utils/converters'
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
