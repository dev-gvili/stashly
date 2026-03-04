import {
  Prisma,
  type Item,
  type ItemCategory,
  type ItemType,
} from '@/prisma/client'
import type { SearchResponse } from 'algoliasearch'

// Shared Algolia index record (derived from Prisma Item)
export type ItemIndexRecord = Pick<
  Item,
  | 'id'
  | 'name'
  | 'category'
  | 'type'
  | 'tags'
  | 'status'
  | 'size'
  | 'createdAt'
  | 'updatedAt'
> & {
  createdAt: string
  updatedAt: string
}

export type ItemHit = SearchResponse<ItemIndexRecord>['hits'][number]

export type SearchOutput<TData> = {
  data: TData[]
  metadata: {
    take: number
    count: number
    previousCursor?: string
    nextCursor?: string
    isComplete: boolean
  }
}

export type SearchMode = 'postgres' | 'algolia'

export interface BaseSearchOptions<TParams> {
  query?: string
  mode: SearchMode
  take?: number
}

export interface PostgresSearchOptions<
  TParams,
  TInclude = Prisma.ItemInclude,
  TOrderBy = Prisma.ItemOrderByWithRelationInput,
> extends BaseSearchOptions<TParams> {
  cursorId?: string
  mode: 'postgres'
  include?: TInclude
  orderBy?: TOrderBy
  buildFilters: (params: TParams) => Prisma.ItemWhereInput
}

export interface AlgoliaSearchOptions<
  TParams,
> extends BaseSearchOptions<TParams> {
  mode: 'algolia'
  page?: number
  buildFilters: (params: TParams) => string
}

export type SearchOptions<TParams, TInclude, TMode> =
  | PostgresSearchOptions<TParams, TInclude>
  | AlgoliaSearchOptions<TParams>

// Conditional return type
export type SearchReturn<
  TInclude extends Prisma.ItemInclude | undefined,
  TMode extends SearchMode,
> = TMode extends 'postgres'
  ? TInclude extends Prisma.ItemInclude
    ? SearchOutput<Prisma.ItemGetPayload<{ include: TInclude }>>
    : SearchOutput<Item>
  : ItemHit[]
