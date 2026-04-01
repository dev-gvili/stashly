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
