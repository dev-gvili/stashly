import { describe, expect, it } from 'vitest'
import {
  addCreatedToStats,
  growFolderCards,
  canInsertUnder,
  cardOrderFor,
  insertCardItems,
  reviveCardItem,
  showCreatedRows,
} from '../pagination'

/**
 * An upload inserts its new rows into the page instead of reloading the folder
 * (tech-debt item 45). The page must place each row where the folder loader
 * would have, and must not show a row the loader might have filtered out.
 */

type Row = {
  id: string
  name: string
  type: 'folder' | 'file' | 'collection'
  size?: bigint
  createdAt?: Date
}
const row = (id: string, name: string, type: Row['type'] = 'file', extra: Partial<Row> = {}): Row => ({
  id,
  name,
  type,
  ...extra,
})
const ids = (list: Row[]) => list.map((r) => r.id)
const params = (search: string) => new URLSearchParams(search)

describe('cardOrderFor', () => {
  // `getFolderContent` orders `type desc` over the ItemType enum, declared
  // folder, file, collection: files sort before folders (probed 1 Nov).
  it('orders like getFolderContent: type desc, then name, then id', () => {
    const compare = cardOrderFor(params(''), { foldersFirst: true })!
    const list = [row('3', 'b', 'folder'), row('2', 'a', 'folder'), row('1', 'b'), row('0', 'a')]
    expect(ids([...list].sort(compare))).toEqual(['0', '1', '2', '3'])
  })

  it('takes the sort from the URL, id breaking ties', () => {
    const compare = cardOrderFor(params('orderBy[createdAt]=desc'), { foldersFirst: false })!
    const at = (iso: string) => ({ createdAt: new Date(iso) })
    const list = [
      row('b', 'x', 'file', at('2026-01-01')),
      row('a', 'y', 'file', at('2026-01-01')),
      row('c', 'z', 'file', at('2026-02-01')),
    ]
    expect(ids([...list].sort(compare))).toEqual(['c', 'a', 'b'])
  })

  it('compares BigInt sizes as numbers', () => {
    const compare = cardOrderFor(params('orderBy[size]=asc'), { foldersFirst: false })!
    const list = [row('a', 'a', 'file', { size: 10n ** 12n }), row('b', 'b', 'file', { size: 9n })]
    expect(ids([...list].sort(compare))).toEqual(['b', 'a'])
  })

  it('has no order for a sort it cannot reproduce', () => {
    const count = 'orderBy[0][folder][childCount]=asc&orderBy[1][members][_count]=asc'
    expect(cardOrderFor(params(count), { foldersFirst: true })).toBeNull()
    expect(cardOrderFor(params('orderBy[owner]=asc'), { foldersFirst: true })).toBeNull()
    expect(cardOrderFor(params('orderBy[name]=up'), { foldersFirst: true })).toBeNull()
  })
})

describe('canInsertUnder', () => {
  it('allows a page that only sorts, lays out or paginates', () => {
    expect(canInsertUnder(params(''))).toBe(true)
    expect(canInsertUnder(params('layout=grid&take=50&cursor=item_x&orderBy[name]=desc'))).toBe(true)
    expect(canInsertUnder(params('selectedItems=item_a'))).toBe(true)
  })

  it('refuses any filter, since the row might not match it', () => {
    for (const search of ['query=report', 'type=file', 'favorited=true', 'extension=pdf', 'status=trashed', 'unknown=1']) {
      expect(canInsertUnder(params(search))).toBe(false)
    }
  })
})

describe('insertCardItems', () => {
  const compare = cardOrderFor(params(''), { foldersFirst: true })!
  const list = [row('f1', 'a'), row('f3', 'c'), row('d1', 'a', 'folder')]

  it('places a new row where the loader would', () => {
    expect(ids(insertCardItems(list, [row('f2', 'b')], { compare, hasMore: false }))).toEqual([
      'f1',
      'f2',
      'f3',
      'd1',
    ])
  })

  it('appends a row past the end only when the whole folder is loaded', () => {
    const late = row('d2', 'z', 'folder')
    expect(ids(insertCardItems(list, [late], { compare, hasMore: false }))).toEqual(['f1', 'f3', 'd1', 'd2'])
    // With more pages to come, the row belongs to a later page: `loadMore`
    // brings it, and inserting it now would put it above rows not yet loaded.
    expect(insertCardItems(list, [late], { compare, hasMore: true })).toBe(list)
  })

  it('never duplicates a row the page already has', () => {
    expect(insertCardItems(list, [row('f3', 'c')], { compare, hasMore: false })).toBe(list)
  })

  it('places several rows in one call', () => {
    const rows = [row('f4', 'd'), row('f0', '0'), row('f2', 'b')]
    expect(ids(insertCardItems(list, rows, { compare, hasMore: false }))).toEqual([
      'f0',
      'f1',
      'f2',
      'f3',
      'f4',
      'd1',
    ])
  })
})

describe('reviveCardItem', () => {
  it('turns the JSON row back into the loader’s BigInt and Date values', () => {
    const revived = reviveCardItem({
      id: 'item_a',
      size: 1024,
      inclusiveSize: 0,
      createdAt: '2026-11-01T00:00:00.000Z',
      updatedAt: '2026-11-01T00:00:01.000Z',
      locked: null,
      parent: {
        size: 2048,
        inclusiveSize: 4096,
        createdAt: '2026-10-01T00:00:00.000Z',
        updatedAt: '2026-10-01T00:00:00.000Z',
        locked: { lockedAt: '2026-10-02T00:00:00.000Z', expiresAt: null },
        parent: { size: 1, inclusiveSize: 1, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', openedAt: null },
      },
    }) as any
    expect(revived.size).toBe(1024n)
    expect(revived.inclusiveSize).toBe(0n)
    expect(revived.createdAt).toEqual(new Date('2026-11-01T00:00:00.000Z'))
    expect(revived.parent.size).toBe(2048n)
    expect(revived.parent.locked.lockedAt).toEqual(new Date('2026-10-02T00:00:00.000Z'))
    expect(revived.parent.locked.expiresAt).toBeNull()
    expect(revived.parent.parent.inclusiveSize).toBe(1n)
    expect(revived.parent.parent.openedAt).toBeNull()
  })
})

describe('addCreatedToStats', () => {
  const file = (id: string, parentId: string, size: number, uploadPath: string) =>
    ({ id, type: 'file', parentId, size: BigInt(size), file: { uploadPath } }) as const
  const folder = (id: string, parentId: string) => ({ id, type: 'folder', parentId, size: 0n, file: null }) as const

  it('counts a folder page’s direct children and every byte uploaded into it', () => {
    const rows = [
      folder('d1', 'item_here'),
      file('f1', 'item_here', 100, 'item_here/a.txt'),
      // A file in a dropped folder: not a direct child, but its bytes are inside.
      file('f2', 'd1', 50, 'item_here/d1/b.txt'),
      // Uploaded elsewhere.
      file('f3', 'item_other', 999, 'item_other/c.txt'),
    ]
    expect(
      addCreatedToStats({ folders: 1, files: 2, sizeBytes: 1000 }, rows, { folderId: 'item_here' })
    ).toEqual({ folders: 2, files: 3, sizeBytes: 1150 })
  })

  it('counts every row on the drive-wide page', () => {
    const rows = [folder('d1', 'item_root'), file('f1', 'd1', 100, 'item_root/d1/a.txt')]
    expect(addCreatedToStats({ folders: 0, files: 0, sizeBytes: 0 }, rows, { folderId: null })).toEqual({
      folders: 1,
      files: 1,
      sizeBytes: 100,
    })
  })

  it('counts a row only once when it arrives twice', () => {
    const f = file('f1', 'item_here', 100, 'item_here/a.txt')
    expect(addCreatedToStats({ folders: 0, files: 0, sizeBytes: 0 }, [f, f], { folderId: 'item_here' })).toEqual({
      folders: 0,
      files: 1,
      sizeBytes: 100,
    })
  })
})

describe('growFolderCards', () => {
  const folderCard = (id: string, name: string) => ({
    id,
    name,
    type: 'folder',
    parentId: 'item_here',
    size: 0n,
    inclusiveSize: 0n,
    folder: { childCount: 1, inclusiveChildCount: 1 },
  })
  const file = (id: string, parentId: string, size: number, uploadPath: string) => ({
    id,
    name: uploadPath.split('/').pop()!,
    type: 'file',
    parentId,
    size: BigInt(size),
    file: { uploadPath },
  })

  // A folder upload's folder card is read before its files land, so each file
  // grows the card it sits inside, as the next load of the page would show.
  it('adds each file to the listed folder it was uploaded into', () => {
    const list = [folderCard('d1', 'photos'), folderCard('d2', 'docs')]
    const next = growFolderCards(
      list as any,
      [
        file('f1', 'd1', 300, 'item_here/photos/a.jpg'),
        file('f2', 'd_inner', 200, 'item_here/photos/2026/b.jpg'),
        file('f3', 'item_here', 50, 'item_here/c.txt'),
        file('f4', 'x', 70, 'item_other/photos/d.jpg'),
      ] as any,
      'item_here'
    ) as any[]
    expect(next[0]).toMatchObject({
      size: 500n,
      inclusiveSize: 500n,
      // Both counts are direct children (`inclusive` adds trashed ones), so
      // only f1 adds to them: measured on a dropped folder, 2 and 2.
      folder: { childCount: 2, inclusiveChildCount: 2 },
    })
    expect(next[1]).toBe(list[1])
  })

  it('returns the list itself when no card grows', () => {
    const list = [folderCard('d1', 'photos')]
    expect(growFolderCards(list as any, [file('f3', 'item_here', 50, 'item_here/c.txt')] as any, 'item_here')).toBe(list)
  })
})

/**
 * A page reports which new rows it showed for certain; when a batch ends, the
 * upload runner reloads once if any created row was not among them (item 45).
 */
describe('showCreatedRows', () => {
  const compare = cardOrderFor(params(''), { foldersFirst: true })!
  const fileRow = (id: string, name: string, parentId: string, uploadPath: string, size = 10) => ({
    id,
    name,
    type: 'file',
    parentId,
    size: BigInt(size),
    file: { uploadPath },
  })
  const dirRow = (id: string, name: string, parentId: string) => ({
    id,
    name,
    type: 'folder',
    parentId,
    size: 0n,
    inclusiveSize: 0n,
    folder: { childCount: 0, inclusiveChildCount: 0 },
  })
  const shown = (r: { shown: Set<string> }) => [...r.shown].sort()

  it('shows a folder upload: its folder, the folders inside it and their files', () => {
    const rows = [
      dirRow('d1', 'photos', 'here'),
      dirRow('d2', '2026', 'd1'),
      fileRow('f1', 'a.jpg', 'd1', 'here/photos/a.jpg'),
      fileRow('f2', 'b.jpg', 'd2', 'here/photos/2026/b.jpg'),
    ]
    const r = showCreatedRows([] as any[], rows as any, { compare, hasMore: false, parentId: 'here', sortsBySize: false })
    expect(r.list.map((i: any) => i.id)).toEqual(['d1'])
    expect(shown(r)).toEqual(['d1', 'd2', 'f1', 'f2'])
  })

  // The cursor names the first row not loaded, so `loadMore` would not fetch
  // a row that sorts between the last loaded one and it.
  it('does not claim a row past the loaded window', () => {
    const list = [fileRow('f1', 'a', 'here', 'here/a')]
    const r = showCreatedRows(list as any, [fileRow('f2', 'b', 'here', 'here/b')] as any, {
      compare,
      hasMore: true,
      parentId: 'here',
      sortsBySize: false,
    })
    expect(r.list).toBe(list)
    expect(shown(r)).toEqual([])
  })

  it('does not claim rows it cannot place', () => {
    const rows = [
      // Under a filter there is no order to place by.
      fileRow('f1', 'a', 'here', 'here/a'),
      // Uploaded into a folder the page does not list.
      fileRow('f2', 'b', 'elsewhere', 'elsewhere/b'),
      // A folder made for this file on the server, with no card sent.
      fileRow('f3', 'c', 'd9', 'here/docs/c'),
    ]
    const r = showCreatedRows([] as any[], rows as any, { compare: null, hasMore: false, parentId: 'here', sortsBySize: false })
    expect(shown(r)).toEqual([])
  })

  it('does not claim a grown folder card under a size sort, which may now sit elsewhere', () => {
    const list = [dirRow('d1', 'photos', 'here')]
    const rows = [fileRow('f1', 'a', 'd1', 'here/photos/a', 500)]
    const bySize = cardOrderFor(params('orderBy[size]=desc'), { foldersFirst: true })!
    const r = showCreatedRows(list as any, rows as any, { compare: bySize, hasMore: false, parentId: 'here', sortsBySize: true })
    expect((r.list[0] as any).inclusiveSize).toBe(500n)
    expect(shown(r)).toEqual([])
  })

  it('claims a row the page already has', () => {
    const list = [fileRow('f1', 'a', 'here', 'here/a')]
    const r = showCreatedRows(list as any, list as any, { compare, hasMore: true, parentId: 'here', sortsBySize: false })
    expect(shown(r)).toEqual(['f1'])
  })
})
