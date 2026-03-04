# Pagination helpers — examples

This document shows example usage for the pagination helpers and the new generic `getCollectionContents` helper.

1. Fetch a folder's contents (existing helper)

```ts
import { getFolderContents } from '@/utils/pagination'
import { prisma } from '@/services/db'

// cursor strategy example
const res = await getFolderContents({
  client: prisma,
  strategy: 'cursor',
  take: 10,
  where: { parentId: 'folder_abc' },
  include: { file: true, folder: true },
})

// res will be a PaginationCursorData / PaginationOffsetData / PaginationStreamData
// depending on the strategy used
```

2. Fetch from any Prisma collection/model using `getCollectionContents`

```ts
import { getCollectionContents } from '@/utils/pagination'
import { prisma } from '@/services/db'

// Get items using the 'item' model on the prisma client
const data = await getCollectionContents({
  client: prisma,
  model: 'item',
  strategy: 'cursor',
  take: 25,
  where: { workspaceId: 'ws_123' },
  include: { file: true },
})

// `data` is a typed pagination result (broadly typed as PaginationData<any>)
```

3. Unit test style example (mock delegate)

```ts
// Instead of invoking Prisma, you can mock a delegate for unit tests.
const mockDelegate = {
  findMany: async (args) => [{ id: '1' }, { id: '2' }],
  count: async () => 2,
}

const result = await paginateWithOffset(mockDelegate, {
  strategy: 'offset',
  page: 1,
  take: 10,
  where: {},
})
// assert result.metadata.count === 2
```

These examples should make it easier to adapt the simplified generics and the new collection helper in real code.
