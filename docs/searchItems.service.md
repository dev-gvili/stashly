```ts
// .server/filters/item.filters.ts
import { z } from 'zod'
import { Prisma, ItemCategory, ItemType, ItemStatus } from '@/prisma/client'
import { createFilter, buildFiltersFactory } from '@/utils/filters'
import { toZodArraySchema } from '@/utils/converters'
import { PermissionRole, WorkspaceMemberRole } from '@/prisma/enums'
import { date } from './schema.zod'

export const itemFilterSchema = z
  .object({
    category: toZodArraySchema(z.nativeEnum(ItemCategory)),
    collection: z.string().nonempty(),
    date,
    favorited: z.boolean(),
    parent: z.string().nonempty(),
    query: z.string().min(1),
    status: z.nativeEnum(ItemStatus),
    tags: toZodArraySchema(z.string().trim().min(1)),
    type: toZodArraySchema(z.nativeEnum(ItemType)),
    workspace: z.string().nonempty(),
    locked: z.boolean(),
    trashed: z.boolean(),
    owner: z.string().nonempty(),
    roles: toZodArraySchema(
      z.nativeEnum(PermissionRole).or(z.nativeEnum(WorkspaceMemberRole))
    ),
    id: z.string().nonempty(),
    permission: toZodArraySchema(z.string().nonempty()),
    hasChildren: z.boolean(),
    extension: toZodArraySchema(z.string().nonempty()),
  })
  .partial()

/**
 * Factory for creating item-specific filters.
 * Uses `createFilterFactory` from the generic filters utility.
 * @see {@link createFilter} for details.
 */
const createItemFilter = createFilter<
  Prisma.ItemWhereInput,
  z.infer<typeof itemFilterSchema>
>()

/**
 * All available item filters.
 * Each filter is defined using `createItemFilter`, which ensures type safety.
 * The key is the filter name, the value is a function that takes the filter value
 * and returns a Prisma `ItemWhereInput` condition.
 */
export const itemFilters = {
  id: createItemFilter(z.string(), (id) => ({ id })),
  collection: createItemFilter(z.string(), (collectionId) => ({
    id: collectionId,
  })),
  /**
   * Filter items by creation date.
   * Accepts an object with optional `before` and `after` Date properties.
   * At least one of the properties must be provided.
   * Example: { before: new Date('2023-01-01'), after: new Date('2022-01-01') }
   * This will filter items created between Jan 1, 2022 and Jan 1, 2023.
   * If only `before` is provided, it filters items created before that date.
   * If only `after` is provided, it filters items created after that date.
   * If neither is provided, the filter is ignored.
   * If both are provided, it filters items created within the range.
   * If the input is invalid, an error is logged and the filter is ignored.
   * @see {@link itemFilterSchema} for input validation.
   * @example
   * // Filter items created before Jan 1, 2023
   * { date: { before: new Date('2023-01-01') } }
   * // Filter items created after Jan 1, 2022
   * { date: { after: new Date('2022-01-01') } }
   * // Filter items created between Jan 1, 2022 and Jan 1, 2023
   * { date: { before: new Date('2023-01-01'), after: new Date('2022-01-01') } }
   * @throws Will log an error if the input is invalid.
   */
  date: createItemFilter(
    date.refine(({ before, after }) => before || after, {
      message: 'At least one of before or after must be provided.',
    }),
    ({ before, after }) => ({
      createdAt: { lte: before, gte: after },
    })
  ),
  type: createItemFilter(z.array(z.nativeEnum(ItemType)), (types) => ({
    type: { in: types },
  })),
  extension: createItemFilter(z.array(z.string()), (extensions) => ({
    file: {
      extension: { in: extensions },
    },
  })),

  category: createItemFilter(
    z.array(z.nativeEnum(ItemCategory)),
    (categories) => ({
      category: { in: categories },
    })
  ),
  status: createItemFilter(z.nativeEnum(ItemStatus), (status) => ({
    status,
  })),
  parent: createItemFilter(z.string(), (parentId) => ({
    parentId,
  })),
  workspace: createItemFilter(z.string(), (workspaceId) => ({
    workspaceId,
  })),
  tags: createItemFilter(z.array(z.string()), (tags) => ({
    tags: {
      hasSome: tags,
    },
  })),
  /** Filter items by their favorited status.
   * If false, filters for items not favorited by any user.
   * @example
   * // Filter items that have been favorited
   * { favorited: true }
   * @example
   * // Filter items that have NOT been favorited
   * { favorited: false }
   */
  favorited: createItemFilter(z.boolean(), (isFavorited) => ({
    favoritedBy: isFavorited
      ? { some: {} } // If true, favorited by *some* user
      : { none: {} }, // If false, favorited by *no* user
  })),
  /** Filter items by their locked status.
   * If false, filters for items not locked.
   */
  locked: createItemFilter(z.boolean(), (isLocked) => ({
    locked: isLocked ? { isNot: null } : null,
  })),
  /** Filter items by their trash status.
   * If false, filters for items not in trash.
   */
  trashed: createItemFilter(z.boolean(), (inTrash) => ({
    trash: inTrash ? { isNot: null } : null,
  })),
  /** Filter items by their owner. */
  owner: createItemFilter(z.string(), (ownerId) => ({
    ownerId,
  })),
  /**
   * Filter items by specific permission IDs.
   * Accepts a single string ID or an array of string IDs.
   */
  permission: createItemFilter(
    z.union([z.string(), z.array(z.string())]),
    (ids) => ({
      permissions: {
        some: {
          users: {
            some: {
              id: Array.isArray(ids) ? { in: ids } : { equals: ids },
            },
          },
        },
      },
    })
  ),
  /**
   * Filter items by specific permission roles.
   * @example
   *  // Filter items that have 'owner' or 'write' roles
   *  { role: ['owner', 'write'] }
   */
  roles: createItemFilter(
    z
      .array(z.nativeEnum(PermissionRole))
      .or(z.array(z.nativeEnum(WorkspaceMemberRole))),
    (roles, params) => {
      if (params.workspace) {
        return {
          workspace: {
            id: params.workspace,
            members: {
              some: {
                role: {
                  in: roles as WorkspaceMemberRole[],
                },
              },
            },
          },
        }
      }
      return {
        permissions: {
          some: {
            roles: { in: roles as PermissionRole[] },
          },
        },
      }
    }
  ),

  /**
   * Filter items by a search query.
   * If `params.workspace` is provided, the search is scoped to item fields (name, description).
   * Otherwise, the search is global, including item and workspace fields (name, description).
   * @param {string} query - The search string.
   * @param {object} params - The full filter parameters, used to check for `workspace` context.
   * @example
   * // Filter items whose name or description contains 'document' within a specific workspace
   * { query: 'document', workspace: 'workspace_id_123' }
   * @example
   * // Filter items whose name, description, or associated workspace's name/description contains 'report'
   * { query: 'report' }
   */
  query: createItemFilter(z.string().min(1), (query, params) => {
    if (params.workspace) {
      // Scoped query: only item fields
      return { name: { search: query } }
    }
    // Global query: item + workspace fields
    return {
      OR: [
        { name: { search: query } },
        {
          workspace: {
            name: { search: query },
            description: { search: query },
          },
        },
      ],
    }
  }),
  hasChildren: createItemFilter(z.boolean(), (hasChildren) => ({
    folder: hasChildren ? { childCount: { gt: 0 } } : null,
  })),
}

/** Build item filters from provided params.
 * Uses `itemFilters` and `itemFilterSchema` to ensure type safety and correct filtering.
 * @param params - Partial filter parameters matching `itemFilterSchema`.
 * @returns Prisma `ItemWhereInput` object to be used in queries.
 * @example
 * // Example usage:
 * const filters = buildItemFilters({
 *   id: 'item-id',
 *   collection: 'collection-id',
 *   date: { before: new Date('2023-01-01'), after: new Date('2022-01-01') },
 * });
 * const items = await prisma.item.findMany({ where: filters });
 * @see itemFilters for available filters.
 * @see itemFilterSchema for expected input types
 * @link [itemFilters] {@link itemFilters}
 * @throws Will log errors for any invalid filter values.
 * @example
 * // Valid input
 * { date: { before: new Date('2023-01-01') } }
 * // Invalid input (will log an error)
 * { date: { } }
 * @example
 * // Another valid input
 * { status: 'published' }
 * // Invalid input (will log an error)
 * { status: 'invalid-status' }
 */
export const buildItemFilters = buildFiltersFactory({
  filters: itemFilters,
  schema: itemFilterSchema,
})
```

```ts
// utils/filters.ts
import { z } from 'zod'
/**
 * A single filter definition.
 * @template T - The type of the filter's own value.
 * @template TWhereInput - The Prisma WhereInput type for the model.
 * @template TParams - The full params object type (from schema).
 */
type Filter<T, TWhereInput, TParams> = {
  schema: z.ZodType<T>
  apply: (value: unknown, params: TParams) => TWhereInput
}

/**
 * Factory function for creating a specific model's WhereInput type.
 * @template TWhereInput - Prisma WhereInput type.
 * @template TParams - The full params object type (from zod schema).
 * @returns A function that takes a Zod schema and a filter function,
 * and returns a Filter definition.
 * @see {@link Filter} for details.
 * @example
 * // Example usage:
 * const createItemFilter = createFilter<Prisma.ItemWhereInput, z.infer<typeof itemFilterSchema>>()
 * const idFilter = createItemFilter(z.string(), (id) => ({ id }))
 */
export const createFilter = <
  TWhereInput,
  TParams = Record<string, unknown>,
>() => {
  return <T>(
    schema: z.ZodType<T>,
    filterFn: (value: T, params: TParams) => TWhereInput
  ): Filter<T, TWhereInput, TParams> => ({
    schema,
    apply: (value: unknown, params: TParams) =>
      filterFn(schema.parse(value), params),
  })
}

/**
 * FilterBuilder class to manage and build complex filters.
 * @template TWhereInput - The Prisma WhereInput type for the model.
 * @template TFilters - Record of available filters for the model.
 * @template TParams - Full params type from Zod schema.
 * @example
 * // Example usage:
 * const builder = new FilterBuilder<Prisma.ItemWhereInput, typeof itemFilters, z.infer<typeof itemFilterSchema>>(itemFilters, params)
 * builder.addFilter('id', 'some-id')
 * const whereInput = builder.build()
 * // whereInput can be used in a Prisma query
 * @see {@link Filter} for details.
 */
export class FilterBuilder<
  TWhereInput,
  TFilters extends Record<string, Filter<any, TWhereInput, TParams>>,
  TParams,
> {
  private filters: Map<keyof TFilters, TWhereInput> = new Map()
  private conditions: TWhereInput[] = []

  constructor(
    private availableFilters: TFilters,
    private params: TParams
  ) {}

  addFilter<TKey extends keyof TFilters>(key: TKey, value: unknown): this {
    if (
      value !== undefined &&
      value !== null &&
      (Array.isArray(value) ? value.length > 0 : true)
    ) {
      try {
        this.filters.set(
          key,
          this.availableFilters[key].apply(value, this.params)
        )
        this.rebuildConditions()
      } catch (error) {
        console.error(`Invalid value for filter '${String(key)}':`, error)
      }
    }
    return this
  }

  private rebuildConditions(): void {
    this.conditions = Array.from(this.filters.values())
  }

  build(): TWhereInput {
    if (this.conditions.length === 0) {
      return [] as TWhereInput
    }
    return { AND: this.conditions } as TWhereInput
  }
}

/**
 * Factory to build a type‑safe filter builder function.
 */
interface BuildFiltersFactoryInput<
  TWhereInput,
  TSchema extends z.ZodType<any>,
> {
  schema: TSchema
  filters: Record<string, Filter<unknown, TWhereInput, z.infer<TSchema>>>
}

/**
 *  Builds a type-safe filter builder function.
 *
 * @template TWhereInput - The Prisma WhereInput type for the model.
 * @template TSchema - The Zod schema type for the full params object.
 * @returns A function that takes the full params object and returns the Prisma WhereInput.
 */
export const buildFiltersFactory = <
  TWhereInput,
  TSchema extends z.ZodType<any>,
>({
  filters,
  schema,
}: BuildFiltersFactoryInput<TWhereInput, TSchema>) => {
  return (params: z.infer<typeof schema>): TWhereInput => {
    const builder = new FilterBuilder<
      TWhereInput,
      typeof filters,
      z.infer<TSchema>
    >(filters, params)

    const keys = Object.keys(params) as Array<keyof typeof params>
    for (const key of keys) {
      if (key in filters) {
        builder.addFilter(key as keyof typeof filters, params[key])
      }
    }

    return builder.build()
  }
}
```

```ts
// src/services/searchService.ts
import {
  Prisma,
  type Item,
  type ItemCategory,
  type ItemType,
} from '@/prisma/client'
import { algoliasearch } from 'algoliasearch'
import { prisma } from '../db'
import { config } from '@dotenvx/dotenvx'
import {
  buildItemFilters,
  type itemFilterSchema,
} from '../filters/item.filters'
import type { z } from 'zod'

config()

// Algolia client
const ALGOLIA_APP_ID = process.env.ALGOLIA_APP_ID!
const ALGOLIA_SEARCH_KEY = process.env.VITE_ALGOLIA_SEARCH_KEY!
const ALGOLIA_INDEX = process.env.ALGOLIA_INDEX || 'items_index'

const client = algoliasearch(ALGOLIA_APP_ID, ALGOLIA_SEARCH_KEY)

type SearchMode = 'postgres' | 'algolia'

interface BaseSearchOptions {
  query: string
  mode: SearchMode
  limit?: number
  page?: number // offset pagination
  cursorId?: string // cursor pagination
}

type PostgresSearchOptions<TParams> = BaseSearchOptions & {
  mode: 'postgres'
  include?: Prisma.ItemInclude
  orderBy?: Prisma.ItemOrderByWithRelationInput
  buildFilters: (params: TParams) => Prisma.ItemWhereInput
} & TParams

type AlgoliaSearchOptions<TParams> = BaseSearchOptions & {
  mode: 'algolia'
  category?: ItemCategory
  type?: ItemType
  tags?: string[]
} & TParams

type SearchOptions<TParams> = {
  mode: SearchMode
} & (PostgresSearchOptions<TParams> | AlgoliaSearchOptions<TParams>)

// Generic type parameter for Postgres include

export async function searchItems<TParams>(opts: SearchOptions<TParams>) {
  const { mode, limit = 20, page } = opts

  if (mode === 'postgres') {
    const { include, buildFilters, limit = 20, page, cursorId, ...rest } = opts
    const where = buildFilters(rest as TParams)

    // const where: Prisma.ItemWhereInput = {
    // 	AND: [
    // 		{ name: { search: query } },
    // 		category ? { category } : {},
    // 		type ? { type } : {},
    // 		tags && tags.length > 0 ? { tags: { hasSome: tags } } : {},
    // 	],
    // }

    if (page !== undefined) {
      return prisma.item.findMany({
        where,
        orderBy: {
          _relevance: {
            fields: ['name'],
            search: opts.query!,
            sort: 'desc',
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        include: include,
      })
    }

    let items = await prisma.item.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
      take: limit + 1,
      ...(cursorId ? { cursor: { id: cursorId } } : {}), // No skip: 1
      include,
    })
    let hasMore = items.length > limit
    let data: typeof items
    let nextCursor: string | undefined = undefined
    let previousCursor: string | undefined = cursorId

    if (hasMore) {
      data = items.slice(0, limit)
      nextCursor = items[limit]?.id
    } else {
      data = items
      nextCursor = undefined
    }
    return {
      data,
      metadata: {
        take: limit,
        count: data.length,
        previousCursor,
        nextCursor,
        isComplete: !nextCursor,
      },
    }
  }

  if (mode === 'algolia') {
    const { query, ...props } = opts as AlgoliaSearchOptions<TParams>
    const { category, type, tags } = props

    const filters: string[] = []
    if (category) filters.push(`category:${category}`)
    if (type) filters.push(`type:${type}`)
    if (tags && tags.length > 0) {
      filters.push(tags.map((t) => `tags:${t}`).join(' OR '))
    }
    const { results } = await client.searchForHits({
      requests: [
        {
          indexName: ALGOLIA_INDEX,
          query,
          filters: filters.join(' AND '),
          hitsPerPage: limit,
          page: page ? page - 1 : 0,
        },
      ],
    })
    return results[0].hits as any
  }

  throw new Error(`Unsupported search mode: ${mode}`)
}
```
