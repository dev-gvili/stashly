import { RouterContextProvider } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

// A malformed query string must be refused by the parser before any action
// runs, so every action module the routes import is mocked: nothing here
// touches the database.
vi.mock('@/services/item-actions', () => ({
  getFolder: vi.fn(),
  getFolderContent: vi.fn(),
  getPaginatedItems: vi.fn(),
  getTrashFolderTrail: vi.fn(),
  paginateItems: vi.fn(),
  retrieveFolderStats: vi.fn(),
  retrieveUserUsageMetrics: vi.fn(),
  trashItems: vi.fn(),
  TRASH_ROOTS: {},
}))
vi.mock('@/services/breadcrumbs', () => ({ breadcrumbs: vi.fn() }))
vi.mock('@/services/collection-actions', () => ({
  findAllCollections: vi.fn(),
  getCollectionCovers: vi.fn(),
  getCollectionForUser: vi.fn(),
  getCollectionItems: vi.fn(),
}))
vi.mock('@/services/thumbnail-actions', () => ({ getGalleryMedia: vi.fn() }))
vi.mock('@/services/search-actions', () => ({
  getSearchIndexStats: vi.fn(),
  searchItemsHybrid: vi.fn(),
}))
vi.mock('@/services/storage-actions', () => ({ getDuplicateGroups: vi.fn() }))

import { sessionContext } from '@/.server/middleware/context'
import { trashItems } from '@/services/item-actions'
import * as all from '../all'
import * as collection from '../collection'
import * as collections from '../collections'
import * as duplicates from '../duplicates'
import * as folder from '../folder'
import * as gallery from '../gallery'
import * as search from '../search'
import * as trash from '../trash'

type Handler = (args: never) => unknown

/** The status of the `data()` response the handler threw, or of what it returned. */
async function statusOf(handler: Handler, request: Request, params: Record<string, string> = {}) {
  const context = new RouterContextProvider()
  context.set(sessionContext, { user: { id: 'usr_test', rootId: 'item_root' } } as never)
  try {
    const result = await handler({ request, params, context } as never)
    return (result as { init?: { status?: number } } | null)?.init?.status ?? 200
  } catch (thrown) {
    return (thrown as { init?: { status?: number } }).init?.status ?? 500
  }
}

// `take` is `z.coerce.number()`: a word in its place fails the schema.
const BAD = '?take=abc'

describe('stash page loaders refuse a malformed query string with 400, not 500', () => {
  it.each([
    ['all', all.loader, 'http://localhost/usr_test/stash/all', {}],
    ['collection', collection.loader, 'http://localhost/usr_test/stash/collections/col_a', { collectionId: 'col_a' }],
    ['collections', collections.loader, 'http://localhost/usr_test/stash/collections', {}],
    ['folder', folder.loader, 'http://localhost/usr_test/stash/folders/item_f', { folderId: 'item_f' }],
    ['gallery', gallery.loader, 'http://localhost/usr_test/stash/gallery', {}],
    ['search', search.loader, 'http://localhost/usr_test/stash/search', {}],
    ['trash', trash.loader, 'http://localhost/usr_test/stash/trash', {}],
  ] as [string, Handler, string, Record<string, string>][])('%s', async (_name, loader, url, params) => {
    expect(await statusOf(loader, new Request(url + BAD), params)).toBe(400)
  })
})

describe('duplicates action refuses a malformed body with 400, not 500', () => {
  it('an unknown intent, and trashes nothing', async () => {
    const body = new FormData()
    body.append('intent', 'resolve_everything')
    const request = new Request('http://localhost/usr_test/stash/duplicates', { method: 'POST', body })
    expect(await statusOf(duplicates.action as Handler, request)).toBe(400)
    expect(trashItems).not.toHaveBeenCalled()
  })
})
