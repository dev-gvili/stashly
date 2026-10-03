import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/services/db'
import {
  getTrashFolderTrail,
  restoreItem,
  retrieveUserUsageMetrics,
  trashItem,
  trashItems,
  TRASH_CRUMB_ID,
  TRASH_ROOTS,
} from '@/services/item-actions'
import { getPrefixForModel, toObjectId } from '@/utils/converters'
import { wipeTestUsers } from './helpers/wipe-test-users'

/**
 * Trash lists only what the user trashed directly.
 *
 * Trashing a folder marks its whole subtree trashed, and Trash used to list
 * every row: the folder and each file inside it, side by side. Now only the
 * items the user trashed get a `TrashItem` row, and `TRASH_ROOTS` is "has a
 * row". That has to survive the order the user did things in: a file trashed
 * *before* its folder is still its own entry, and stays in Trash when the
 * folder is restored. Driven through the real `trashItems` / `restoreItem`.
 *
 * Needs a live database with the `trash_items_direct` migration (CI provides one).
 */
const uid = (model: Parameters<typeof getPrefixForModel>[0]) => toObjectId(getPrefixForModel(model))

let ownerId: string
let driveId: string

async function make(name: string, type: 'file' | 'folder', parentId: string | null) {
  const id = uid('Item')
  await prisma.item.create({
    data: { id, name, type, category: type === 'file' ? 'document' : 'unknown', status: 'normal', ownerId, driveId, parentId, size: 0 },
  })
  return id
}

/** Names of the Trash entries under `top`, sorted. */
async function entriesUnder(top: string) {
  const rows = await prisma.item.findMany({
    where: { ownerId, ...TRASH_ROOTS },
    select: { id: true, name: true, parentId: true },
  })
  // Scope to one scenario's tree, so the describes don't see each other.
  const inTree = async (id: string | null): Promise<boolean> => {
    if (!id) return false
    if (id === top) return true
    const p = await prisma.item.findUniqueOrThrow({ where: { id }, select: { parentId: true } })
    return inTree(p.parentId)
  }
  const names: string[] = []
  for (const r of rows) if (await inTree(r.id)) names.push(r.name)
  return names.sort()
}

const statusOf = async (id: string) =>
  (await prisma.item.findUniqueOrThrow({ where: { id }, select: { status: true } })).status

beforeAll(async () => {
  ownerId = uid('User')
  await prisma.user.create({ data: { id: ownerId, name: 'Trash roots', email: `roots-${ownerId}@test.local`, emailVerified: true } })
  driveId = uid('Drive')
  await prisma.drive.create({ data: { id: driveId, ownerId } })
  // Trash, restore and the toolbar stats all read the drive's quota.
  await prisma.quota.create({
    data: { id: uid('Quota'), driveId, total: 10n ** 9n, used: 0n, deleted: 0n },
  })
})

afterAll(async () => {
  await wipeTestUsers([ownerId])
  await prisma.user.deleteMany({ where: { id: ownerId } })
})

describe('a trashed folder is one entry', () => {
  let top: string
  let deepFile: string

  beforeAll(async () => {
    // top/
    //   live/          (stays live)
    //     single.pdf   (trashed on its own)
    //   project/       (trashed as a whole)
    //     a.ts
    //     sub/b.ts
    top = await make('top', 'folder', null)
    const live = await make('live', 'folder', top)
    const single = await make('single.pdf', 'file', live)
    const project = await make('project', 'folder', top)
    await make('a.ts', 'file', project)
    const sub = await make('sub', 'folder', project)
    deepFile = await make('b.ts', 'file', sub)

    await trashItem(single, ownerId)
    await trashItem(project, ownerId)
  })

  it('lists the folder, not everything inside it', async () => {
    expect(await entriesUnder(top)).toEqual(['project', 'single.pdf'])
    expect(await prisma.trashItem.count({ where: { trashedById: ownerId } })).toBe(2)
  })

  it('gives the toolbar the same count as the list', async () => {
    expect((await retrieveUserUsageMetrics(ownerId)).trashed).toBe(2)
  })

  // The DB session's time zone is local (Asia/Jerusalem on dev) and these
  // columns have none, so a bare SQL now() stored local time that Prisma read
  // back as UTC: hours in the future. Both writers must agree with the clock.
  it('stamps trash times in UTC, the way Prisma reads them', async () => {
    const tolerance = 5 * 60_000
    const project = await prisma.item.findFirstOrThrow({ where: { ownerId, name: 'project' } })
    expect(Math.abs(project.updatedAt!.getTime() - Date.now())).toBeLessThan(tolerance)
    const entry = await prisma.trashItem.findUniqueOrThrow({ where: { itemId: project.id } })
    expect(Math.abs(entry.trashedAt.getTime() - Date.now())).toBeLessThan(tolerance)
    // The trash activity is written by the same kind of raw statement, after
    // the commit and without awaiting, so wait for it.
    await vi.waitFor(async () => {
      const activity = await prisma.activity.findFirstOrThrow({
        where: { itemId: project.id, action: { deleteActionId: { not: null } } },
        select: { time: { select: { observedAt: true } } },
      })
      expect(Math.abs(activity.time!.observedAt!.getTime() - Date.now())).toBeLessThan(tolerance)
    })
  })

  it('after a partial restore, the folder contents still trashed become entries', async () => {
    // Restoring b.ts brings sub and project back with it, so a.ts is left
    // trashed under a live folder, and is listed on its own now.
    await restoreItem(deepFile, ownerId)

    expect(await statusOf(deepFile)).toBe('normal')
    expect(await entriesUnder(top)).toEqual(['a.ts', 'single.pdf'])
    // Its entry carries the time its folder was trashed, not hours ahead.
    const a = await prisma.item.findFirstOrThrow({ where: { ownerId, name: 'a.ts' } })
    const entry = await prisma.trashItem.findUniqueOrThrow({ where: { itemId: a.id } })
    expect(Math.abs(entry.trashedAt.getTime() - Date.now())).toBeLessThan(5 * 60_000)
  })
})

describe('getTrashFolderTrail (browsing a trashed folder inside Trash)', () => {
  let docs: string
  let inner: string
  let liveFolder: string

  beforeAll(async () => {
    // home/ (live) → docs/ (trashed as a whole) → inner/
    const home = await make('home', 'folder', null)
    docs = await make('docs', 'folder', home)
    inner = await make('inner', 'folder', docs)
    await make('note.md', 'file', inner)
    liveFolder = await make('still-live', 'folder', home)
    await trashItem(docs, ownerId)
  })

  it('runs from Trash down through trashed folders only, never the live ones above', async () => {
    const trail = await getTrashFolderTrail(ownerId, inner)
    expect(trail.map((c) => c.name)).toEqual(['Trash', 'docs', 'inner'])
    expect(trail[0].id).toBe(TRASH_CRUMB_ID)
  })

  it('refuses a live folder: it opens in its own route, not in Trash', async () => {
    await expect(getTrashFolderTrail(ownerId, liveFolder)).rejects.toMatchObject({ status: 404 })
  })

  it("refuses someone else's trashed folder", async () => {
    const strangerId = uid('User')
    await prisma.user.create({ data: { id: strangerId, name: 'Trash stranger', email: `roots-${strangerId}@test.local`, emailVerified: true } })
    try {
      await expect(getTrashFolderTrail(strangerId, inner)).rejects.toMatchObject({ status: 404 })
    } finally {
      await prisma.user.delete({ where: { id: strangerId } })
    }
  })

  // Why the restore action redirects to Trash from this view (the reported
  // bug): restoring a file inside the folder brings the folder back, so
  // reloading its Trash view can only 404.
  it('a restore inside the folder takes the folder out of Trash too', async () => {
    const note = await prisma.item.findFirstOrThrow({ where: { ownerId, name: 'note.md' } })
    await restoreItem(note.id, ownerId)
    expect(await statusOf(inner)).toBe('normal')
    await expect(getTrashFolderTrail(ownerId, inner)).rejects.toMatchObject({ status: 404 })
  })
})

describe('items trashed before their folder (the owner reported this)', () => {
  let components: string
  let core: string
  let kids: string[]

  beforeAll(async () => {
    // components/
    //   core-components/
    //     page-toolbar/ (folder, with a file inside)
    //     rename-dialog.tsx, share-dialog.tsx, search-input.tsx
    //     kept.tsx      (never trashed on its own)
    components = await make('components', 'folder', null)
    core = await make('core-components', 'folder', components)
    const toolbar = await make('page-toolbar', 'folder', core)
    await make('toolbar.tsx', 'file', toolbar)
    kids = [
      toolbar,
      await make('rename-dialog.tsx', 'file', core),
      await make('share-dialog.tsx', 'file', core),
      await make('search-input.tsx', 'file', core),
    ]
    await make('kept.tsx', 'file', core)
  })

  it('lists the four, then the folder too, five entries', async () => {
    await trashItems(kids, ownerId)
    expect(await entriesUnder(components)).toEqual([
      'page-toolbar',
      'rename-dialog.tsx',
      'search-input.tsx',
      'share-dialog.tsx',
    ])

    await trashItem(core, ownerId)
    expect(await entriesUnder(components)).toEqual([
      'core-components',
      'page-toolbar',
      'rename-dialog.tsx',
      'search-input.tsx',
      'share-dialog.tsx',
    ])
  })

  it('restoring the folder leaves the four in Trash', async () => {
    await restoreItem(core, ownerId)

    expect(await statusOf(core)).toBe('normal')
    for (const id of kids) expect(await statusOf(id)).toBe('trashed')
    expect(await entriesUnder(components)).toEqual([
      'page-toolbar',
      'rename-dialog.tsx',
      'search-input.tsx',
      'share-dialog.tsx',
    ])
  })

  it('a restored item can be trashed again', async () => {
    await restoreItem(kids[1], ownerId)
    expect(await statusOf(kids[1])).toBe('normal')
    expect(await prisma.trashItem.count({ where: { itemId: kids[1] } })).toBe(0)

    await trashItem(kids[1], ownerId)
    expect(await prisma.trashItem.count({ where: { itemId: kids[1] } })).toBe(1)
  })

  it('trashing an entry again keeps its original trashedAt', async () => {
    const before = await prisma.trashItem.findUniqueOrThrow({ where: { itemId: kids[2] } })
    await trashItem(kids[2], ownerId)
    const after = await prisma.trashItem.findUniqueOrThrow({ where: { itemId: kids[2] } })
    expect(after.trashedAt).toEqual(before.trashedAt)
  })
})
