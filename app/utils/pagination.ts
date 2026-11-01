import type { Prisma } from '@/prisma/browser'
import type { PrismaClient } from '../prisma/client'

/**
 * Represents the Prisma delegate methods required for pagination.
 * This includes `findMany` for fetching records and `count` for calculating total records.
 * @template TModel The Prisma model type, which must have an `id` field.
 * @template TWhere The `WhereInput` type for the model.
 * @template TOrderBy The `OrderByWithRelationInput` type for the model.
 * @template TInclude The `Include` type for the model.
 */
export type DbDelegate<
  TModel extends { id: string },
  TWhere = any,
  TOrderBy = any,
  TInclude = any,
> = {
  findMany: (args: {
    where: TWhere
    orderBy?: TOrderBy
    include?: TInclude
    skip?: number
    take?: number
    cursor?: { id: string }
  }) => Promise<TModel[]>
  count: (args: { where: TWhere }) => Promise<number>
}

export type CDelegate<
  TModelName extends Uncapitalize<Prisma.ModelName>,
  TWhere = any,
  TOrderBy = any,
  TInclude = any,
> = {
  findMany: any
  count: any
}

// --- Pagination Return Types ---

/**
 * Defines the structure of the data returned for offset-based pagination.
 * @template TModel The Prisma model type.
 */
export type PaginationOffsetData<TModel> = {
  /** The array of records for the current page. */
  data: TModel[]
  /** Metadata about the pagination state. */
  metadata: {
    /** The total number of records matching the query. */
    count: number
    /** The total number of pages. */
    pages: number
    /** The current page number. */
    page: number
    /** The number of records per page. */
    take: number
    /** A boolean indicating if the last page has been reached. */
    isComplete: boolean
    strategy: 'offset'
  }
}

/**
 * Defines the structure of the data returned for cursor-based pagination.
 * @template TModel The Prisma model type.
 */
export type PaginationCursorData<TModel> = {
  /** The array of records for the current set. */
  data: TModel[]
  /** Metadata about the pagination state. */
  metadata: {
    /** The number of records returned in the current set. */
    count: number
    /** The cursor pointing to the previous set of records. */
    previousCursor?: string
    /** The cursor pointing to the next set of records. */
    nextCursor?: string
    /** The number of records requested per page. */
    take: number
    /** A boolean indicating if the last set of records has been reached. */
    isComplete: boolean
    strategy: 'cursor'
  }
}

/**
 * Defines the structure of the data returned for stream-based pagination.
 * It is an async generator that yields chunks of data.
 * @template TModel The Prisma model type.
 */
export type PaginationStreamData<TModel> = AsyncGenerator<
  {
    /** The array of records for the current chunk. */
    data: TModel[]
    /** Metadata about the pagination state for the current chunk. */
    metadata: {
      /** The number of records requested per chunk. */
      take: number
      /** The number of records in the current chunk. */
      count: number
      /** The cursor pointing to the next chunk of records. */
      nextCursor?: string
      /** The cursor that was used to fetch the current chunk. */
      previousCursor?: string
      /** A boolean indicating if the final chunk has been yielded. */
      isComplete: boolean
      strategy: 'stream'
    }
  },
  void,
  unknown
>

export type PaginationData<TModel> =
  | PaginationOffsetData<TModel>
  | PaginationCursorData<TModel>
  | PaginationStreamData<TModel>
// --- Pagination Options (Discriminated Union) ---

/**
 * Core pagination options common to all strategies.
 * @template TWhere The `WhereInput` type for the model.
 * @template TOrderBy The `OrderByWithRelationInput` type for the model.
 * @template TInclude The `Include` type for the model.
 */
interface PaginationCoreOptions<TWhere = any, TOrderBy = any, TInclude = any> {
  /** Prisma `where` clause to filter records. */
  where: TWhere
  /** Prisma `orderBy` clause to sort records. */
  orderBy?: TOrderBy
  /** Prisma `include` clause to include related records. */
  include?: TInclude
  /** The number of records to take per page/chunk. */
  take?: number
  strategy: 'offset' | 'cursor' | 'stream'
}

/**
 * Options for offset-based pagination.
 * @property {'offset'} strategy - The pagination strategy to use.
 * @property {number} [page] - The page number to retrieve. Defaults to 1.
 */
export interface PaginationOffsetOptions<
  TWhere = any,
  TOrderBy = any,
  TInclude = any,
> extends PaginationCoreOptions<TWhere, TOrderBy, TInclude> {
  strategy: 'offset'
  page?: number
}

/**
 * Options for cursor-based pagination.
 * @property {'cursor'} strategy - The pagination strategy to use.
 * @property {string} [cursor] - The cursor indicating the starting point of the records to fetch.
 */
export interface PaginationCursorOptions<
  TWhere = any,
  TOrderBy = any,
  TInclude = any,
> extends PaginationCoreOptions<TWhere, TOrderBy, TInclude> {
  strategy: 'cursor'
  cursor?: string | undefined
}

/**
 * Options for stream-based pagination.
 * @property {'stream'} strategy - The pagination strategy to use.
 */
export interface PaginationStreamOptions<
  TWhere = any,
  TOrderBy = any,
  TInclude = any,
> extends PaginationCoreOptions<TWhere, TOrderBy, TInclude> {
  strategy: 'stream'
  batchSize?: number
}

/**
 * A discriminated union of all possible pagination option types.
 * The `strategy` property determines which pagination method will be used.
 */
export type PaginationOptions<TWhere = any, TOrderBy = any, TInclude = any> =
  | PaginationOffsetOptions<TWhere, TOrderBy, TInclude>
  | PaginationCursorOptions<TWhere, TOrderBy, TInclude>
  | PaginationStreamOptions<TWhere, TOrderBy, TInclude>

export type PaginationInput<TWhere = any, TOrderBy = any, TInclude = any> =
  // Cursor based pagination input type with cursor, take, where and orderBy fields
  | (Omit<PaginationCursorOptions<TWhere, TOrderBy, TInclude>, 'cursor'> & {
      strategy: 'cursor'
      cursor?: string
    })
  // Offset based pagination input type with skip, take, where and orderBy fields
  | (Omit<PaginationOffsetOptions<TWhere, TOrderBy, TInclude>, 'page'> & {
      strategy: 'offset'
      page?: number
    })
  | (Omit<PaginationStreamOptions<TWhere, TOrderBy, TInclude>, 'batchSize'> & {
      strategy: 'stream'
      batchSize?: number
    })

// --- Paginate Function Overloads ---

// --- Paginate Function Implementation ---

/**
 * Paginates database queries using an offset strategy.
 *
 * @template TModel The Prisma model type, must have an 'id' field.
 * @template TWhere The Prisma `WhereInput` type for the model.
 * @template TOrderBy The Prisma `OrderByWithRelationInput` type for the model.
 * @template TInclude The Prisma `Include` type for the model.
 *
 * @param {DbDelegate<TModel, TWhere, TOrderBy, TInclude>} dbDelegate The Prisma delegate for the model (e.g., `prisma.item`).
 * @param {PaginationOffsetOptions<TWhere, TOrderBy, TInclude>} options Options for offset pagination.
 *
 * @returns {Promise<PaginationOffsetData<TModel>>} A promise resolving to offset-based pagination data.
 *
 * @example
 * const offsetResult = await paginateWithOffset(prisma.item, { strategy: 'offset', page: 1, take: 10, where: { ownerId: 'user123' } });
 */ export async function paginateWithOffset<
  TModel extends { id: string },
  TWhere = any,
  TOrderBy = any,
  TInclude = any,
>(
  dbDelegate: DbDelegate<TModel, TWhere, TOrderBy, TInclude>,
  options: PaginationOffsetOptions<TWhere, TOrderBy, TInclude>
): Promise<PaginationOffsetData<TModel>> {
  const { where, orderBy, include, page = 1, take = 10 } = options
  const skip = (page - 1) * take

  const [count, data] = await Promise.all([
    dbDelegate.count({ where }),
    dbDelegate.findMany({ where, orderBy, include, take, skip }),
  ])

  const hasNextPage = skip + data.length < count
  const isComplete = !hasNextPage
  const pages = Math.ceil(count / take)

  return {
    data,
    metadata: {
      page,
      count,
      pages,
      take: take,
      isComplete,
      strategy: 'offset',
    },
  }
}

/**
 * Creates cursor-based pagination data from a set of items.
 *
 * @template TModel The model type, must have an 'id' field.
 * @param {TModel[]} items The array of items, which should contain one more item than `take` if there are more pages.
 * @param {number} take The number of items requested per page.
 * @param {string | undefined} cursor The cursor used to fetch the current set of items.
 * @returns {PaginationCursorData<TModel>} The structured data for cursor-based pagination.
 */
export function createCursorPaginationMetadata<TModel extends { id: string }>(
  items: TModel[],
  take: number,
  cursor: string | undefined
): PaginationCursorData<TModel>['metadata'] {
  let data: TModel[]
  let nextCursor: string | undefined = undefined
  const previousCursor: string | undefined = cursor
  const hasMore = items.length > take

  if (hasMore) {
    data = items.slice(0, take)
    nextCursor = items[take]?.id
  } else {
    data = items
    nextCursor = undefined
  }

  return {
    take,
    count: data.length,
    previousCursor,
    nextCursor,
    isComplete: !nextCursor,
    strategy: 'cursor',
  }
}

/**
 * Paginates database queries using a cursor-based strategy.
 *
 * @template TModel The Prisma model type, must have an 'id' field.
 * @template TWhere The Prisma `WhereInput` type for the model.
 * @template TOrderBy The Prisma `OrderByWithRelationInput` type for the model.
 * @template TInclude The Prisma `Include` type for the model.
 *
 * @param {DbDelegate<TModel, TWhere, TOrderBy, TInclude>} dbDelegate The Prisma delegate for the model.
 * @param {PaginationCursorOptions<TWhere, TOrderBy, TInclude>} options Options for cursor pagination.
 *
 * @returns {Promise<PaginationCursorData<TModel>>} A promise resolving to cursor-based pagination data.
 *
 * @example
 * const cursorResult = await paginateWithCursor(prisma.item, { strategy: 'cursor', take: 5, cursor: 'item_abc', where: { status: 'active' } });
 */
export async function paginateWithCursor<
  TModel extends { id: string },
  TWhere = any,
  TOrderBy = any,
  TInclude = any,
>(
  dbDelegate: DbDelegate<TModel, TWhere, TOrderBy, TInclude>,
  options: PaginationCursorOptions<TWhere, TOrderBy, TInclude>
): Promise<PaginationCursorData<TModel>> {
  const { where, orderBy, include, cursor, take = 10 } = options
  const items = await dbDelegate.findMany({
    where: where || ([] as TWhere),
    orderBy,
    include,
    take: take + 1,
    // TODO: replace this default `{ id: cursor }` with user provided cursor, cursor can be any valide field on a model.
    // TODO: Support Cursor Composite
    ...(cursor ? { cursor: { id: cursor } } : {}), // No skip: 1
  })

  return {
    data: items,
    metadata: createCursorPaginationMetadata(items, take, cursor),
  }
}

/**
 * Paginates database queries using a stream-based strategy.
 *
 * @template TModel The Prisma model type, must have an 'id' field.
 * @template TWhere The Prisma `WhereInput` type for the model.
 * @template TOrderBy The Prisma `OrderByWithRelationInput` type for the model.
 * @template TInclude The Prisma `Include` type for the model.
 *
 * @param {DbDelegate<TModel, TWhere, TOrderBy, TInclude>} dbDelegate The Prisma delegate for the model.
 * @param {PaginationStreamOptions<TWhere, TOrderBy, TInclude>} options Options for stream pagination.
 *
 * @returns {Promise<PaginationStreamData<TModel>>} A promise resolving to an async generator for stream-based pagination.
 */
export async function paginateWithStream<
  TModel extends { id: string },
  TWhere = any,
  TOrderBy = any,
  TInclude = any,
>(
  dbDelegate: DbDelegate<TModel, TWhere, TOrderBy, TInclude>,
  options: PaginationStreamOptions<TWhere, TOrderBy, TInclude>
): Promise<PaginationStreamData<TModel>> {
  const { where, orderBy, include, take = 10 } = options
  async function* generator(): PaginationStreamData<TModel> {
    let cursor: string | undefined = undefined

    while (true) {
      const items = await dbDelegate.findMany({
        where,
        orderBy,
        include,
        take: take + 1,
        ...(cursor ? { cursor: { id: cursor } } : {}),
      })

      const hasNextPage = items.length > take
      const data = items.slice(0, take)

      if (data.length === 0) {
        break
      }
      // The previous cursor
      let previousCursor = cursor

      // The next cursor is the ID of the 'extra' item, if it exists.
      cursor = hasNextPage ? items[take]?.id : undefined

      yield {
        data: data,
        metadata: {
          take,
          count: data.length,
          previousCursor,
          nextCursor: cursor,
          isComplete: !cursor,
          strategy: 'stream',
        },
      }

      if (!hasNextPage) {
        break // End of stream
      }
    }
  }
  return generator()
}

/**
 * Paginates database queries using an offset strategy.
 * @param dbDelegate The Prisma delegate for the model.
 * @param options Options for offset pagination.
 * @returns A promise that resolves to offset-based pagination data.
 */
export function paginate<
  TModel extends { id: string },
  TWhere = any,
  TOrderBy = any,
  TInclude = any,
>(
  dbDelegate: DbDelegate<TModel, TWhere, TOrderBy, TInclude>,
  options: PaginationOffsetOptions<TWhere, TOrderBy, TInclude>
): Promise<PaginationOffsetData<TModel>>

/**
 * Paginates database queries using a cursor strategy.
 * @param dbDelegate The Prisma delegate for the model.
 * @param options Options for cursor pagination.
 * @returns A promise that resolves to cursor-based pagination data.
 */
export function paginate<
  TModel extends { id: string },
  TWhere = any,
  TOrderBy = any,
  TInclude = any,
>(
  dbDelegate: DbDelegate<TModel, TWhere, TOrderBy, TInclude>,
  options: PaginationCursorOptions<TWhere, TOrderBy, TInclude>
): Promise<PaginationCursorData<TModel>>

/**
 * Paginates database queries using a stream strategy.
 * @param dbDelegate The Prisma delegate for the model.
 * @param options Options for stream pagination.
 * @returns A promise that resolves to an async generator for stream-based pagination.
 */
export function paginate<
  TModel extends { id: string },
  TWhere = any,
  TOrderBy = any,
  TInclude = any,
>(
  dbDelegate: DbDelegate<TModel, TWhere, TOrderBy, TInclude>,
  options: PaginationStreamOptions<TWhere, TOrderBy, TInclude>
): Promise<PaginationStreamData<TModel>>

/**
 * Paginates database queries using offset, cursor, or stream strategies.
 *
 * @template TModel The Prisma model type, must have an 'id' field.
 * @template TWhere The Prisma `WhereInput` type for the model.
 * @template TOrderBy The Prisma `OrderByWithRelationInput` type for the model.
 * @template TInclude The Prisma `Include` type for the model.
 *
 * @param {DbDelegate<TModel, TWhere, TOrderBy, TInclude>} dbDelegate The Prisma delegate for the model (e.g., `prisma.item`).
 * @param {PaginationOptions<TWhere, TOrderBy, TInclude>} options Pagination options, including strategy, filters, ordering, and inclusion.
 *
 * @returns {Promise<PaginationOffsetData<TModel> | PaginationCursorData<TModel> | PaginationStreamData<TModel>>}
 * A promise resolving to pagination data based on the chosen strategy.
 *
 * @example
 * // Offset pagination
 * const offsetResult = await paginate(prisma.item, { strategy: 'offset', page: 1, take: 10, where: { ownerId: 'user123' } });
 *
 * // Cursor pagination
 * const cursorResult = await paginate(prisma.item, { strategy: 'cursor', take: 5, cursor: 'item_abc', where: { status: 'active' } });
 */
export async function paginate<
  TModel extends { id: string },
  TWhere = any,
  TOrderBy = any,
  TInclude = any,
>(
  dbDelegate: DbDelegate<TModel, TWhere, TOrderBy, TInclude>,
  options: PaginationOptions<TWhere, TOrderBy, TInclude>
): Promise<
  | PaginationCursorData<TModel>
  | PaginationOffsetData<TModel>
  | PaginationStreamData<TModel>
> {
  switch (options.strategy) {
    case 'offset':
      return paginateWithOffset(dbDelegate, options)
    case 'cursor':
      return paginateWithCursor(dbDelegate, options)
    case 'stream':
      return paginateWithStream(dbDelegate, options)
  }
}

/**
 * Retrieves the contents of a specific folder, including both files and subfolders.
 * This function uses cursor-based pagination to efficiently fetch items within a given folder.
 *
 * @param {object} params - The parameters for fetching folder contents.
 * @param {string} params.folderId - The ID of the folder whose contents are to be retrieved.
 * @param {string} params.ownerId - The ID of the owner of the folder.
 * @param {string} [params.cursor] - An optional cursor for pagination, indicating the starting point for fetching items.
 * @param {number} [params.take=10] - The maximum number of items to retrieve per page. Defaults to 10.
 *   A promise that resolves to cursor-based pagination data containing the folder's items (files and subfolders).
 *
 * @example
 * // To get the first 10 items in a folder:
 * const folderContents = await getFolderContents({ folderId: 'folder_abc', ownerId: 'user_xyz' });
 *
 * // To get the next 10 items using a cursor:
 * const nextFolderContents = await getFolderContents({
 *   folderId: 'folder_abc',
 *   ownerId: 'user_xyz',
 *   cursor: folderContents.metadata.nextCursor
 * });
 */
export function getFolderContents<
  TInclude extends Prisma.ItemInclude = Prisma.ItemInclude,
>(
  opts: PaginationOffsetOptions<
    Prisma.ItemWhereInput,
    Prisma.ItemOrderByWithRelationInput,
    TInclude
  > & {
    client: PrismaClient
  }
): Promise<PaginationOffsetData<Prisma.ItemGetPayload<{ include: TInclude }>>>

export function getFolderContents<
  TInclude extends Prisma.ItemInclude = Prisma.ItemInclude,
>(
  opts: PaginationCursorOptions<
    Prisma.ItemWhereInput,
    Prisma.ItemOrderByWithRelationInput,
    TInclude
  > & {
    client: PrismaClient
  }
): Promise<PaginationCursorData<Prisma.ItemGetPayload<{ include: TInclude }>>>

export function getFolderContents<
  TInclude extends Prisma.ItemInclude = Prisma.ItemInclude,
>(
  opts: PaginationStreamOptions<
    Prisma.ItemWhereInput,
    Prisma.ItemOrderByWithRelationInput,
    TInclude
  > & {
    client: PrismaClient
  }
): Promise<PaginationStreamData<Prisma.ItemGetPayload<{ include: TInclude }>>>

export async function getFolderContents<
  TInclude extends Prisma.ItemInclude = Prisma.ItemInclude,
>(
  opts: PaginationOptions<
    Prisma.ItemWhereInput,
    Prisma.ItemOrderByWithRelationInput,
    TInclude
  > & { client: PrismaClient }
): Promise<PaginationData<Prisma.ItemGetPayload<{ include: TInclude }>>> {
  const { client, ...rest } = opts
  return getCollectionContents({ client, model: 'item', ...rest } as any)
}

/**
 * Generic helper to fetch paginated contents from any Prisma collection/model.
 *
 * This abstracts the common pattern of selecting a model delegate from a PrismaClient
 * and calling the shared paginate helper. It keeps the getFolderContents implementation
 * small and makes the same functionality available for other models.
 */
// Preferred overloads: model-specific overloads allow inference of the payload type
// when calling getCollectionContents({ model: 'item', include: {...} }).
// Overloads that map strategy -> specific return type for the 'item' model.
export function getCollectionContents<
  TWhere,
  TOrderBy,
  TInclude extends Prisma.ItemInclude = Prisma.ItemInclude,
>(
  params: PaginationOffsetOptions<TWhere, TOrderBy, TInclude> & {
    client: PrismaClient
    model: 'item'
  }
): Promise<PaginationOffsetData<Prisma.ItemGetPayload<{ include: TInclude }>>>

export function getCollectionContents<
  TWhere,
  TOrderBy,
  TInclude extends Prisma.ItemInclude = Prisma.ItemInclude,
>(
  params: PaginationCursorOptions<TWhere, TOrderBy, TInclude> & {
    client: PrismaClient
    model: 'item'
  }
): Promise<PaginationCursorData<Prisma.ItemGetPayload<{ include: TInclude }>>>

export function getCollectionContents<
  TWhere,
  TOrderBy,
  TInclude extends Prisma.ItemInclude = Prisma.ItemInclude,
>(
  params: PaginationStreamOptions<TWhere, TOrderBy, TInclude> & {
    client: PrismaClient
    model: 'item'
  }
): Promise<PaginationStreamData<Prisma.ItemGetPayload<{ include: TInclude }>>>

export async function getCollectionContents<
  TModelName extends Uncapitalize<Prisma.ModelName>,
  TWhere,
  TOrderBy,
  TInclude,
  TModel,
>(
  params: PaginationOptions<TWhere, TOrderBy, TInclude> & {
    client: PrismaClient
    model: TModelName
  }
): Promise<PaginationData<TModel>> {
  const { client, model, ...rest } = params

  // Access the model delegate dynamically (e.g. client.item)
  const dbDelegate = client[model] as unknown as
    | DbDelegate<TModel & { id: string }, TWhere, TOrderBy, TInclude>
    | CDelegate<TModelName, TWhere, TOrderBy, TInclude>

  // Delegate to the unified paginate helper. Use casts because the Prisma delegate
  // types are complex; callers of this helper will receive properly typed PaginationData<TModel>.
  return paginate(
    dbDelegate as DbDelegate<
      TModel & { id: string },
      TWhere,
      TOrderBy,
      TInclude
    >,
    rest as any
  ) as Promise<PaginationData<TModel>>
}

// --- Inserting created rows (tech-debt item 45) ---
//
// An upload hands the page each new row (`getCardItems` via `/api/items`), and
// the page inserts it where the folder loader would have put it, instead of
// reloading the whole folder after every few files.

type CardRow = { id: string; [field: string]: unknown }

/** Orders two rows the way `getFolderContent`'s `orderBy` does. */
export type CardCompare = (a: CardRow, b: CardRow) => number

/**
 * `type desc` sorts by the ItemType enum's declared order, which Postgres uses
 * for ORDER BY: folder, file, collection (probed 2026-11-01). So "folders
 * first" in `getFolderContent` actually puts files before folders.
 */
const TYPE_RANK: Record<string, number> = { folder: 0, file: 1, collection: 2 }

/** The columns the sort pill offers that compare the same in the browser. */
const SORTABLE = new Set(['name', 'createdAt', 'updatedAt', 'size', 'type'])

/** Search params that only sort, lay out or paginate: they never hide a row. */
const NON_FILTER_PARAMS = new Set(['layout', 'take', 'cursor', 'selectedItems', 'index'])
const ORDER_PARAM = /^orderBy(?:\[\d+\])?\[(\w+)\]$/

// Close to the database's locale-aware text order (case-insensitive at first,
// numbers before letters). Not identical: the dev database's Windows collation
// ignores hyphens, so `p45-10.bin` sorts before `p45 2` there and after it here.
const nameCollator = new Intl.Collator(undefined, { sensitivity: 'variant' })

function compareValues(column: string, a: unknown, b: unknown): number {
  // Postgres: NULLs sort last ascending (and first descending).
  if (a == null || b == null) return a == null ? (b == null ? 0 : 1) : -1
  if (column === 'name') return nameCollator.compare(String(a), String(b))
  if (column === 'type') return (TYPE_RANK[String(a)] ?? 9) - (TYPE_RANK[String(b)] ?? 9)
  const x = column === 'size' ? BigInt(a as bigint) : new Date(a as string).getTime()
  const y = column === 'size' ? BigInt(b as bigint) : new Date(b as string).getTime()
  return x < y ? -1 : x > y ? 1 : 0
}

/**
 * The page's sort as a comparator, mirroring `getFolderContent`: `type desc`
 * when `foldersFirst`, then the URL's `orderBy[col]=dir` (or name ascending),
 * then `id`. Null for a sort the browser cannot reproduce (Count, a relation,
 * an unknown column or direction): such a page inserts nothing.
 *
 * @param searchParams - The page's URL search params.
 * @param options.foldersFirst - Whether the loader passes `foldersFirst: true`.
 * @returns The comparator, or null.
 *
 * @example
 * const compare = cardOrderFor(new URLSearchParams('orderBy[size]=desc'), { foldersFirst: true })
 */
export function cardOrderFor(
  searchParams: URLSearchParams,
  { foldersFirst }: { foldersFirst: boolean }
): CardCompare | null {
  const keys: [string, 'asc' | 'desc'][] = foldersFirst ? [['type', 'desc']] : []
  let sorted = false
  for (const [param, dir] of searchParams) {
    if (!param.startsWith('orderBy')) continue
    const column = ORDER_PARAM.exec(param)?.[1]
    if (!column || !SORTABLE.has(column) || (dir !== 'asc' && dir !== 'desc')) return null
    keys.push([column, dir])
    sorted = true
  }
  if (!sorted) keys.push(['name', 'asc'])

  return (a, b) => {
    for (const [column, dir] of keys) {
      const order = compareValues(column, a[column], b[column])
      if (order !== 0) return dir === 'asc' ? order : -order
    }
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  }
}

/**
 * Whether a created row can be shown without asking the server. Any filter
 * (search, type, favorites, extension, status…) could exclude it, so only a
 * page that sorts, lays out or paginates takes inserts.
 *
 * @param searchParams - The page's URL search params.
 * @returns True when no param filters the list.
 *
 * @example
 * canInsertUnder(new URLSearchParams('layout=grid&orderBy[name]=desc')) // → true
 * canInsertUnder(new URLSearchParams('query=report'))                   // → false
 */
export function canInsertUnder(searchParams: URLSearchParams): boolean {
  for (const param of searchParams.keys()) {
    if (!NON_FILTER_PARAMS.has(param) && !param.startsWith('orderBy')) return false
  }
  return true
}

/**
 * Inserts rows into a loaded list at the place the loader would have put them.
 * A row the list already has is skipped. A row that sorts after the last loaded
 * one is appended only when the whole folder is loaded; otherwise it belongs to
 * a later page, which `loadMore` brings (the id check there skips duplicates).
 *
 * @param list - The rows on the page, in loader order.
 * @param rows - The new rows.
 * @param options.compare - The page's order (`cardOrderFor`).
 * @param options.hasMore - Whether more pages remain.
 * @param placed - Collects the ids of rows now on the page (inserted, or
 *   already there); a skipped row is left out.
 * @returns A new list, or `list` itself when nothing was inserted.
 *
 * @example
 * setItems((list) => insertCardItems(list, rows, { compare, hasMore }))
 */
export function insertCardItems<T extends { id: string }>(
  list: T[],
  rows: T[],
  { compare, hasMore }: { compare: CardCompare; hasMore: boolean },
  placed?: Set<string>
): T[] {
  let next = list
  const have = new Set(list.map((item) => item.id))
  for (const row of rows) {
    if (have.has(row.id)) {
      placed?.add(row.id)
      continue
    }
    const at = next.findIndex((item) => compare(row as unknown as CardRow, item as unknown as CardRow) < 0)
    if (at === -1 && hasMore) continue
    next = next === list ? [...list] : next
    next.splice(at === -1 ? next.length : at, 0, row)
    have.add(row.id)
    placed?.add(row.id)
  }
  return next
}

const BYTE_FIELDS = ['size', 'inclusiveSize']
const DATE_FIELDS = ['createdAt', 'updatedAt', 'openedAt', 'lockedAt', 'expiresAt']

/**
 * Turns a row `/api/items` sent as JSON (`cardItemOutput`) back into the
 * loader's values: BigInt byte counts and Date stamps, on the row, its `locked`
 * and its ancestors.
 *
 * @param row - The JSON row.
 * @returns The same shape with BigInts and Dates restored.
 *
 * @example
 * reviveCardItem({ id: 'item_a', size: 1024, createdAt: '2026-11-01T00:00:00Z' })
 * // → { id: 'item_a', size: 1024n, createdAt: Date }
 */
export function reviveCardItem(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...row }
  for (const field of BYTE_FIELDS)
    if (typeof out[field] === 'number') out[field] = BigInt(out[field] as number)
  for (const field of DATE_FIELDS)
    if (typeof out[field] === 'string') out[field] = new Date(out[field] as string)
  for (const nested of ['parent', 'locked'])
    if (out[nested] && typeof out[nested] === 'object')
      out[nested] = reviveCardItem(out[nested] as Record<string, unknown>)
  return out
}

type CreatedRow = {
  id: string
  type: unknown
  parentId?: unknown
  size?: unknown
  file?: { uploadPath?: unknown } | null
}

/** The counts and bytes a page's stats show, before formatting. */
export type RawStats = { folders: number; files: number; sizeBytes: number }

/**
 * Adds created rows to a page's stats, so the toolbar keeps up without a reload.
 * A folder page counts its direct children, and the bytes of every file
 * uploaded into it (a dropped folder's files included: their upload path starts
 * with the folder). The drive-wide page (`folderId: null`) counts every row.
 * A row seen twice counts once.
 *
 * @param stats - The loader's counts.
 * @param rows - Every row created since that load.
 * @param scope.folderId - The folder the page shows, or null for the drive.
 * @returns The counts with the rows added.
 *
 * @example
 * addCreatedToStats({ folders: 1, files: 2, sizeBytes: 1000 }, rows, { folderId: params.folderId })
 */
export function addCreatedToStats<S extends RawStats>(
  stats: S,
  rows: CreatedRow[],
  { folderId }: { folderId: string | null }
): S {
  const next = { ...stats }
  const seen = new Set<string>()
  for (const row of rows) {
    if (seen.has(row.id)) continue
    seen.add(row.id)
    const child = folderId === null || row.parentId === folderId
    if (child && row.type === 'folder') next.folders += 1
    if (child && row.type === 'file') next.files += 1
    const inside =
      folderId === null || String(row.file?.uploadPath ?? '').startsWith(`${folderId}/`)
    if (row.type === 'file' && inside) next.sizeBytes += Number(row.size ?? 0)
  }
  return next
}

type FolderCard = {
  id: string
  name?: unknown
  type?: unknown
  parentId?: unknown
  size?: unknown
  inclusiveSize?: unknown
  folder?: { childCount?: number; inclusiveChildCount?: number } | null
}

/**
 * Grows the listed folder cards an upload's files land inside. A folder
 * upload's folder card is read before its files are filed, so without this it
 * would keep showing the folder empty. A file uploaded into `parentId` names
 * the listed folder it sits in as the second segment of its upload path
 * (`<parentId>/<folder>/…/<name>`); that card gains its bytes, and one child
 * when the file sits directly in it (`inclusiveChildCount` counts direct
 * children too, trashed ones included, not descendants).
 *
 * @param list - The rows on the page.
 * @param rows - New rows, each seen once (`useCreatedItems` skips repeats).
 * @param parentId - The folder the page lists.
 * @param grew - Collects the ids of the rows that grew a card.
 * @returns A new list, or `list` itself when no card grew.
 *
 * @example
 * setItems((list) => growFolderCards(list, rows, params.folderId))
 */
export function growFolderCards<T extends { id: string }>(
  list: T[],
  rows: CreatedRow[],
  parentId: string,
  grew?: Set<string>
): T[] {
  let next = list
  for (const row of rows) {
    if (row.type !== 'file') continue
    const [root, top, ...rest] = String(row.file?.uploadPath ?? '').split('/')
    if (root !== parentId || rest.length === 0) continue
    const at = next.findIndex((item) => {
      const card = item as unknown as FolderCard
      return card.type === 'folder' && card.parentId === parentId && card.name === top
    })
    if (at === -1) continue
    const card = next[at] as unknown as FolderCard
    const bytes = BigInt(Number(row.size ?? 0))
    const child = row.parentId === card.id ? 1 : 0
    const grown: FolderCard = {
      ...card,
      size: BigInt((card.size as bigint | number | undefined) ?? 0) + bytes,
      inclusiveSize: BigInt((card.inclusiveSize as bigint | number | undefined) ?? 0) + bytes,
      folder: card.folder && {
        ...card.folder,
        childCount: (card.folder.childCount ?? 0) + child,
        inclusiveChildCount: (card.folder.inclusiveChildCount ?? 0) + child,
      },
    }
    next = next === list ? [...list] : next
    next[at] = grown as unknown as T
    grew?.add(row.id)
  }
  return next
}

/**
 * Shows an upload's new rows on a page, and reports which ones it showed for
 * certain. When a batch ends, the upload runner reloads the page once if any
 * row it created was not reported (tech-debt item 45). The page cannot be
 * certain about a row under a filter (`compare` null), past its loaded window
 * (the cursor names the first row `loadMore` returns, so a row before it would
 * never arrive), in a folder it does not list, or in a folder card that grew
 * under a size sort (the card may now belong elsewhere).
 *
 * Shown for certain: a row directly in `parentId` that was placed (or was
 * already there), a file that grew a listed folder card, and a folder made
 * inside a shown or listed folder, which that card's counts already include.
 *
 * @param list - The rows on the page, in loader order.
 * @param rows - New rows, each seen once.
 * @param options.compare - The page's order, or null when it can't be reproduced.
 * @param options.hasMore - Whether more pages remain.
 * @param options.parentId - The folder the page lists.
 * @param options.sortsBySize - Whether the page sorts by size.
 * @returns The new list and the ids shown for certain.
 *
 * @example
 * const { list, shown } = showCreatedRows(items, rows, { compare, hasMore, parentId, sortsBySize: false })
 */
export function showCreatedRows<T extends { id: string }>(
  list: T[],
  rows: (T & CreatedRow)[],
  options: { compare: CardCompare | null; hasMore: boolean; parentId: string; sortsBySize: boolean }
): { list: T[]; shown: Set<string> } {
  const { compare, hasMore, parentId, sortsBySize } = options
  const shown = new Set<string>()
  const grew = new Set<string>()
  let next = list
  if (compare) {
    const children = rows.filter((row) => row.parentId === parentId)
    next = insertCardItems(next, children, { compare, hasMore }, shown)
  }
  // After the inserts, so a folder upload’s files grow its new card.
  next = growFolderCards(next, rows, parentId, grew)
  if (!sortsBySize) for (const id of grew) shown.add(id)
  // Folders inside a shown or listed folder, outermost first.
  const listed = new Set(next.map((item) => item.id))
  let added = true
  while (added) {
    added = false
    for (const row of rows) {
      if (row.type !== 'folder' || shown.has(row.id)) continue
      const parent = String(row.parentId ?? '')
      if ((listed.has(parent) && !(sortsBySize && grew.size > 0)) || shown.has(parent)) {
        shown.add(row.id)
        added = true
      }
    }
  }
  return { list: next, shown }
}
