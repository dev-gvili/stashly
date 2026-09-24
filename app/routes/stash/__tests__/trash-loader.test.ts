import { RouterContextProvider } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// The loader's only I/O is these two actions. Mocking them keeps the test off
// the database while still exercising the real loader's argument building —
// which is where the bug lives: the `view` filter is built in the route.
vi.mock('@/services/item-actions', () => ({
  getPaginatedItems: vi.fn(async () => ({
    items: [],
    nextCursor: null,
    hasMore: false,
  })),
  retrieveUserUsageMetrics: vi.fn(async () => ({
    folders: 0,
    files: 0,
    favorites: 0,
    trashed: 0,
    usedBytes: 0n,
    quotaBytes: 0n,
  })),
}))

import { getPaginatedItems } from '@/services/item-actions'
import { sessionContext } from '@/.server/middleware/context'
import { loader } from '../trash'

type ThumbnailWhere = { view?: unknown }
type TrashInclude = {
  thumbnails: { where: ThumbnailWhere }
  parent: { include: { thumbnails: { where: ThumbnailWhere } } }
}

async function runLoader(url: string) {
  const context = new RouterContextProvider()
  context.set(sessionContext, { user: { id: 'usr_test' } } as never)
  await loader({
    request: new Request(url),
    context,
    params: {},
  } as never)
  const args = vi.mocked(getPaginatedItems).mock.calls.at(-1)![0] as {
    include: TrashInclude
  }
  return {
    itemView: args.include.thumbnails.where.view,
    parentView: args.include.parent.include.thumbnails.where.view,
  }
}

describe('trash loader thumbnail view filter', () => {
  beforeEach(() => vi.mocked(getPaginatedItems).mockClear())

  // `Thumbnail.view` is a non-nullable enum, so Prisma rejects `view: null`
  // with "Argument `view` must not be null" — a 500 on a clean /trash URL.
  it('defaults to grid when the URL carries no ?layout=', async () => {
    const views = await runLoader('http://localhost/usr_test/stash/trash')
    expect(views).toEqual({ itemView: 'grid', parentView: 'grid' })
  })

  it('uses the layout from the URL when present', async () => {
    const views = await runLoader(
      'http://localhost/usr_test/stash/trash?layout=river'
    )
    expect(views).toEqual({ itemView: 'river', parentView: 'river' })
  })
})
