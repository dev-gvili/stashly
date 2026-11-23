import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '@/services/db'
import { getFolderContent, trashItems } from '@/services/item-actions'
import {
  SCOPE_MAX,
  countSelection,
  listingWhere,
  parseListingParams,
  resolveSelection,
} from '@/services/selection-actions'
import { countSelectionLoaderInput, selectionField } from '@/schemas/api.schemas'
import type { SelectionScope } from '@/types/stash.types'
import { getPrefixForModel, toObjectId } from '@/utils/converters'
import { wipeTestUsers } from './helpers/wipe-test-users'

/**
 * "Select all" resolves a listing on the server. These pin that the rows it
 * resolves are exactly the rows the page lists (one `listingWhere` for both),
 * that the caller can't widen the scope through its filter string, and the
 * two refusals. Needs a live database (CI provides one).
 */
const uid = (model: Parameters<typeof getPrefixForModel>[0]) =>
  toObjectId(getPrefixForModel(model))

let ownerId: string
let strangerId: string
let driveId: string
let folderId: string
let otherFolderId: string
const imageIds: string[] = []

async function make(
  name: string,
  type: 'file' | 'folder',
  parentId: string | null,
  category: 'image' | 'document' | 'unknown' = type === 'file' ? 'document' : 'unknown'
) {
  const id = uid('Item')
  await prisma.item.create({
    data: { id, name, type, category, status: 'normal', ownerId, driveId, parentId, size: 0 },
  })
  return id
}

const folderScope = (filters = ''): SelectionScope => ({ kind: 'folder', folderId, filters })

/** Every id the folder page lists for `filters`, page by page, as the loader does. */
async function listedIds(filters: string) {
  const scope = folderScope(filters)
  const params = parseListingParams(ownerId, scope, new URLSearchParams(filters))
  const ids: string[] = []
  let cursor: string | undefined
  for (;;) {
    const page = await getFolderContent({
      userId: ownerId,
      cursor,
      limit: 50,
      where: listingWhere(ownerId, scope, params),
      foldersFirst: true,
    })
    ids.push(...page.items.map((i) => i.id))
    if (!page.hasMore || !page.nextCursor) return ids
    cursor = page.nextCursor
  }
}

beforeAll(async () => {
  ownerId = uid('User')
  strangerId = uid('User')
  await prisma.user.createMany({
    data: [
      { id: ownerId, name: 'Selection owner', email: `sel-${ownerId}@test.local`, emailVerified: true },
      { id: strangerId, name: 'Selection stranger', email: `sel-${strangerId}@test.local`, emailVerified: true },
    ],
  })
  driveId = uid('Drive')
  await prisma.drive.create({ data: { id: driveId, ownerId } })
  folderId = await make('selection-folder', 'folder', null)
  otherFolderId = await make('selection-other', 'folder', null)
  await make('other-child', 'file', otherFolderId)
  // 120 children: 80 images, 30 documents, 10 folders.
  for (let i = 0; i < 80; i++) imageIds.push(await make(`img-${i}`, 'file', folderId, 'image'))
  for (let i = 0; i < 30; i++) await make(`doc-${i}`, 'file', folderId)
  for (let i = 0; i < 10; i++) await make(`sub-${i}`, 'folder', folderId)
}, 60_000)

afterAll(async () => {
  await wipeTestUsers([ownerId, strangerId])
  await prisma.user.deleteMany({ where: { id: { in: [ownerId, strangerId] } } })
}, 120_000)

describe('a folder scope', () => {
  it('counts what the listing shows across all its pages', async () => {
    expect(await countSelection(ownerId, folderScope())).toBe(120)
    expect(await countSelection(ownerId, folderScope('category=image'))).toBe(80)
  })

  it('resolves to exactly the rows the folder page lists, filtered or not', async () => {
    for (const filters of ['', 'category=image', 'type=folder']) {
      const listed = await listedIds(filters)
      const resolved = await resolveSelection(ownerId, {
        by: 'scope',
        scope: folderScope(filters),
        excluded: [],
        expectedCount: listed.length,
      })
      expect(new Set(resolved)).toEqual(new Set(listed))
    }
  })

  it('leaves out the rows the user unticked', async () => {
    const excluded = imageIds.slice(0, 3)
    const resolved = await resolveSelection(ownerId, {
      by: 'scope',
      scope: folderScope('category=image'),
      excluded,
      expectedCount: 77,
    })
    expect(resolved).toHaveLength(77)
    for (const id of excluded) expect(resolved).not.toContain(id)
  })

  it('ignores a parentId, pagination or sort in the filter string', async () => {
    const filters = `parentId=${otherFolderId}&currentUserId=${strangerId}&cursor=${imageIds[5]}&take=1&orderBy[name]=desc`
    expect(await countSelection(ownerId, folderScope(filters))).toBe(120)
  })

  it('refuses a user with no access to the folder: 403', async () => {
    await expect(countSelection(strangerId, folderScope())).rejects.toMatchObject({
      errorCode: 'FORBIDDEN',
      status: 403,
    })
    await expect(
      resolveSelection(strangerId, { by: 'scope', scope: folderScope(), excluded: [], expectedCount: 120 })
    ).rejects.toMatchObject({ errorCode: 'FORBIDDEN', status: 403 })
  })

  it('refuses with 409 when the folder changed after the count was confirmed', async () => {
    const confirmed = await countSelection(ownerId, folderScope())
    const added = await make('arrived-later', 'file', folderId)
    try {
      await expect(
        resolveSelection(ownerId, { by: 'scope', scope: folderScope(), excluded: [], expectedCount: confirmed })
      ).rejects.toMatchObject({ errorCode: 'SELECTION_CHANGED', status: 409 })
    } finally {
      await prisma.item.delete({ where: { id: added } })
    }
  })

  it(`refuses more than ${SCOPE_MAX} roots: 400, before any count check`, async () => {
    const big = await make('selection-big', 'folder', null)
    await prisma.item.createMany({
      data: Array.from({ length: SCOPE_MAX + 1 }, (_, i) => ({
        id: uid('Item'),
        name: `f-${i}`,
        type: 'file' as const,
        category: 'document' as const,
        status: 'normal' as const,
        ownerId,
        driveId,
        parentId: big,
        size: 0,
      })),
    })
    await expect(
      resolveSelection(ownerId, {
        by: 'scope',
        scope: { kind: 'folder', folderId: big, filters: '' },
        excluded: [],
        expectedCount: SCOPE_MAX + 1,
      })
    ).rejects.toMatchObject({ errorCode: 'SELECTION_TOO_LARGE', status: 400 })
  }, 120_000)
})

describe('a trash scope', () => {
  let trashedFolder: string

  beforeAll(async () => {
    trashedFolder = await make('trashed-folder', 'folder', null)
    for (let i = 0; i < 3; i++) await make(`inside-${i}`, 'file', trashedFolder)
    const loose = [await make('loose-a', 'file', otherFolderId), await make('loose-b', 'file', otherFolderId)]
    await trashItems([trashedFolder, ...loose], ownerId)
  }, 60_000)

  it('counts the Trash entries at the top, a trashed folder as one', async () => {
    expect(await countSelection(ownerId, { kind: 'trash', filters: '' })).toBe(3)
  })

  it("counts a trashed folder's contents inside it", async () => {
    expect(await countSelection(ownerId, { kind: 'trash', folderId: trashedFolder, filters: '' })).toBe(3)
  })

  it('holds only the caller’s own rows, whatever the filters say', async () => {
    expect(await countSelection(strangerId, { kind: 'trash', filters: '' })).toBe(0)
    expect(
      await countSelection(strangerId, { kind: 'trash', folderId: trashedFolder, filters: `owner=${ownerId}` })
    ).toBe(0)
    // `status` is server-owned in Trash: asking for live rows still gets Trash entries.
    expect(await countSelection(ownerId, { kind: 'trash', filters: 'status=normal' })).toBe(3)
  })
})

describe('ticked ids', () => {
  it('come back as sent, without duplicates', async () => {
    const [a, b] = imageIds
    expect(await resolveSelection(ownerId, { by: 'ids', selectedItems: [a, b, a] })).toEqual([a, b])
  })
})

describe('the selection schemas', () => {
  it('read one JSON field, so ids and filters arrive as written', () => {
    const parsed = selectionField.parse(
      JSON.stringify({
        by: 'scope',
        scope: { kind: 'folder', folderId: '2024', filters: 'query=true' },
        excluded: ['a,b'],
        expectedCount: 3,
      })
    )
    expect(parsed).toEqual({
      by: 'scope',
      scope: { kind: 'folder', folderId: '2024', filters: 'query=true' },
      excluded: ['a,b'],
      expectedCount: 3,
    })
  })

  it('refuse text that is not JSON, and more than 1,000 unticked rows', () => {
    expect(selectionField.safeParse('not json').success).toBe(false)
    const excluded = Array.from({ length: 1001 }, (_, i) => `id-${i}`)
    expect(
      selectionField.safeParse(
        JSON.stringify({ by: 'scope', scope: { kind: 'trash', filters: '' }, excluded, expectedCount: 0 })
      ).success
    ).toBe(false)
  })

  it('parse the count_selection query', () => {
    const scope = { kind: 'trash', filters: '' }
    expect(
      countSelectionLoaderInput.parse({ intent: 'count_selection', scope: JSON.stringify(scope) })
    ).toEqual({ intent: 'count_selection', scope })
  })
})
