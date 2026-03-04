import { Prisma } from '@/prisma/client'
import {
  paginate,
  type DbDelegate,
  type PaginationCursorData,
  type PaginationOffsetData,
  type PaginationStreamData,
} from '@/utils/pagination'

// --- Utility Type ---

type InferredModel<
  TDelegate extends DbDelegate<any, any, any, any>,
  TInclude,
> = Prisma.Result<
  TDelegate,
  { include: TInclude & Parameters<TDelegate['findMany']>[0]['include'] },
  'findMany'
>[number]

// --- Factory Configuration Type ---

export interface SearchFactoryConfig<
  TWhereInput,
  TOrderBy,
  TParams,
  TDelegate extends DbDelegate<any, TWhereInput, TOrderBy, any>,
> {
  dbDelegate: TDelegate
  buildFilters: (params: TParams) => Promise<TWhereInput>
  defaultOrderBy?: (params: TParams) => TOrderBy
}

// --- Search Function Overloaded Type (Public API) ---

export type SearchFunction<
  TWhereInput,
  TOrderBy,
  TParams,
  TDelegate extends DbDelegate<any, TWhereInput, TOrderBy, any>,
> = {
  <TInclude = undefined>(
    options: {
      strategy: 'offset'
      page: number
      take: number
      include?: TInclude
      orderBy?: TOrderBy
    } & TParams
  ): Promise<PaginationOffsetData<InferredModel<TDelegate, TInclude>>>

  <TInclude = undefined>(
    options: {
      strategy: 'cursor'
      cursor?: string
      take: number
      include?: TInclude
      orderBy?: TOrderBy
    } & TParams
  ): Promise<PaginationCursorData<InferredModel<TDelegate, TInclude>>>

  <TInclude = undefined>(
    options: {
      strategy: 'stream'
      take: number
      include?: TInclude
      orderBy?: TOrderBy
    } & TParams
  ): Promise<PaginationStreamData<InferredModel<TDelegate, TInclude>>>
}

// --- Explicit Search Options for Implementation (Internal Type) ---

type OffsetSearchImplementationOptions<TParams, TOrderBy, TInclude> = {
  strategy: 'offset'
  page: number
  take: number
  include?: TInclude
  orderBy?: TOrderBy
} & TParams

type CursorSearchImplementationOptions<TParams, TOrderBy, TInclude> = {
  strategy: 'cursor'
  cursor?: string
  take: number
  include?: TInclude
  orderBy?: TOrderBy
} & TParams

type StreamSearchImplementationOptions<TParams, TOrderBy, TInclude> = {
  strategy: 'stream'
  take: number
  include?: TInclude
  orderBy?: TOrderBy
} & TParams

export type SearchImplementationOptions<TParams, TOrderBy, TInclude> =
  | OffsetSearchImplementationOptions<TParams, TOrderBy, TInclude>
  | CursorSearchImplementationOptions<TParams, TOrderBy, TInclude>
  | StreamSearchImplementationOptions<TParams, TOrderBy, TInclude>

// --- searchFactory Implementation ---

export function searchFactory<
  TWhereInput,
  TOrderBy,
  TParams,
  TDelegate extends DbDelegate<any, TWhereInput, TOrderBy, any>,
>({
  dbDelegate,
  buildFilters,
  defaultOrderBy,
}: SearchFactoryConfig<
  TWhereInput,
  TOrderBy,
  TParams,
  TDelegate
>): SearchFunction<TWhereInput, TOrderBy, TParams, TDelegate> {
  const search = async <TInclude>(
    options: SearchImplementationOptions<TParams, TOrderBy, TInclude>
  ): Promise<
    | PaginationOffsetData<InferredModel<TDelegate, TInclude>>
    | PaginationCursorData<InferredModel<TDelegate, TInclude>>
    | PaginationStreamData<InferredModel<TDelegate, TInclude>>
  > => {
    const where = await buildFilters(options as TParams)
    const orderBy = options.orderBy ?? defaultOrderBy?.(options as TParams)

    type TModel = InferredModel<TDelegate, TInclude> & {
      id: string
    }

    switch (options.strategy) {
      case 'offset': {
        return await paginate<TModel, TWhereInput, TOrderBy, TInclude>(
          dbDelegate,
          {
            ...options,
            where,
            orderBy,
            strategy: 'offset',
          }
        )
      }
      case 'cursor': {
        return await paginate<TModel, TWhereInput, TOrderBy, TInclude>(
          dbDelegate,
          {
            ...options,
            where: where ?? ([] as TWhereInput),
            orderBy,
            strategy: 'cursor',
          }
        )
      }
      case 'stream': {
        return paginate<TModel, TWhereInput, TOrderBy, TInclude>(dbDelegate, {
          ...options,
          where,
          orderBy,
          strategy: 'stream',
        })
      }
      default: {
        throw new Error(
          `Unsupported pagination strategy: ${(options as any).strategy}`
        )
      }
    }
  }
  return search as unknown as SearchFunction<
    TWhereInput,
    TOrderBy,
    TParams,
    TDelegate
  >
}
