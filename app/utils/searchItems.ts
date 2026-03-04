import { z } from 'zod'
import { Prisma, PrismaClient } from '@/prisma/client'
import {
  paginate,
  type DbDelegate,
  type PaginationCursorData,
  type PaginationOffsetData,
  type PaginationStreamData,
} from './pagination'
import { itemFilterSchema, buildItemFilters } from './filters/item.filters'

// --- 1. Helper Type for Return Type Inference ---
// This magic type extracts the return type of findMany based on the 'include' arguments.
type InferredItemModel<TInclude extends Prisma.ItemInclude | undefined> =
  Prisma.Result<PrismaClient['item'], { include: TInclude }, 'findMany'>[number]

// --- 2. Define Your Search Filters ---
// Infer filters directly from the Zod schema provided in item.filters.ts
export type ItemFilters = z.infer<typeof itemFilterSchema>

// --- 3. Define the Combined Search Options ---
// We omit pagination fields from ItemFilters here to let the Discriminated Union
// handle them strictly (e.g., ensuring 'page' exists only for 'offset' strategy).
type BaseFilters = Omit<
  ItemFilters,
  'strategy' | 'take' | 'cursor' | 'orderBy' | 'include'
>

export type SearchOptions<
  TInclude extends Prisma.ItemInclude | undefined = undefined,
> = BaseFilters & {
  // Required: The Prisma Client instance
  client: PrismaClient

  // Optional: Prisma-specific options
  include?: TInclude
  orderBy?:
    | Prisma.ItemOrderByWithRelationInput
    | Prisma.ItemOrderByWithRelationInput[]
} & (
    | { strategy: 'offset'; page?: number; take?: number }
    | { strategy: 'cursor'; cursor?: string; take?: number }
    | { strategy: 'stream'; take?: number; batchSize?: number }
  )

// --- 4. The Unified Search Function ---

/**
 * A unified search function for Items that handles:
 * - Folder browsing (via parentId)
 * - Text search (via query)
 * - Filtering (types, status, etc) via item.filters.ts logic
 * - Type-safe inclusions
 * - Multiple pagination strategies
 */
export async function searchItems<
  TInclude extends Prisma.ItemInclude | undefined = undefined,
>(
  options: SearchOptions<TInclude>
): Promise<
  | PaginationOffsetData<InferredItemModel<TInclude>>
  | PaginationCursorData<InferredItemModel<TInclude>>
  | PaginationStreamData<InferredItemModel<TInclude>>
> {
  const {
    client,
    include,
    orderBy,
    // We separate the pagination strategy fields to pass them cleanly to paginate()
    // but the rest of 'options' acts as the filter parameters.
    ...rest
  } = options

  // --- A. Build the 'Where' Clause ---
  // We use the factory from item.filters.ts.
  // It iterates over the keys in 'options' and applies the matching filters defined in your file.
  // This handles complex logic like 'roles' checking 'workspaceId', or 'date' ranges.
  const where = buildItemFilters(rest as ItemFilters)

  // --- B. Determine Default Ordering ---
  // If no specific order is requested:
  // - We default to Folders first, then Alphabetical by Name.
  // - This is usually better for file explorers than the raw ID sort.
  const defaultOrderBy: Prisma.ItemOrderByWithRelationInput[] = orderBy
    ? Array.isArray(orderBy)
      ? orderBy
      : [orderBy]
    : [
        { type: 'asc' }, // Folders first
        { name: 'asc' }, // Then alphabetical
      ]

  // --- C. Execute Pagination ---
  // We explicitly cast the delegate to generic types required by 'paginate'
  const delegate = client.item as unknown as DbDelegate<
    InferredItemModel<TInclude> & { id: string },
    Prisma.ItemWhereInput,
    Prisma.ItemOrderByWithRelationInput, // OrderBy
    typeof include // Include
  >

  // Delegate to the 'paginate' utility which handles the complexity of Offset/Cursor/Stream
  return paginate(delegate, {
    ...options, // Passes strategy, page, take, cursor
    where, // The generated where clause from buildItemFilters
    orderBy: defaultOrderBy,
    include: include,
  } as any)
}
