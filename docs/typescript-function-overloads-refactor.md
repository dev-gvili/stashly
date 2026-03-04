### User

can you fix this code so the function overloads type will be corrected

```ts
// utils/queryHelpers.ts

export type PageBasedResult<TModel> = {
  data: TModel[]
  total: number
  page: number
  pageSize: number
}

export type CursorBasedResult<TModel> = {
  data: TModel[]
  nextCursor?: string
}

export type AllResults<TModel> = {
  data: TModel[]
  warning?: string
}

export type StreamResult<TModel> = AsyncGenerator<
  { data: TModel[] },
  void,
  unknown
>

export interface BasePaginationOptions<TWhereInput, TOrderBy, TInclude> {
  where: TWhereInput
  orderBy: TOrderBy
  include?: TInclude
}

// --- Options Types ---
interface PageBasedOptions<
  TWhereInput,
  TOrderBy,
  TInclude,
> extends BasePaginationOptions<TWhereInput, TOrderBy, TInclude> {
  page: number
  pageSize: number
}

interface CursorBasedOptions<
  TWhereInput,
  TOrderBy,
  TInclude,
> extends BasePaginationOptions<TWhereInput, TOrderBy, TInclude> {
  cursor: string
  limit: number
}

interface StreamOptions<
  TWhereInput,
  TOrderBy,
  TInclude,
> extends BasePaginationOptions<TWhereInput, TOrderBy, TInclude> {
  batchSize: number
  stream: true
}

interface NoPaginationOptions<
  TWhereInput,
  TOrderBy,
  TInclude,
> extends BasePaginationOptions<TWhereInput, TOrderBy, TInclude> {
  maxNoPaginationLimit: number
}

interface RunSearchOptions<
  TWhereInput,
  TOrderBy,
  TInclude,
> extends PageBasedOptions<TWhereInput, TOrderBy, TInclude> {
  page?: number
  pageSize?: number
}

interface RunSearchOptions<
  TWhereInput,
  TOrderBy,
  TInclude,
> extends CursorBasedOptions<TWhereInput, TOrderBy, TInclude> {
  cursor?: string
  limit?: number
}

interface RunSearchOptions<
  TWhereInput,
  TOrderBy,
  TInclude,
> extends StreamOptions<TWhereInput, TOrderBy, TInclude> {
  stream?: true
}

interface RunSearchOptions<
  TWhereInput,
  TOrderBy,
  TInclude,
> extends NoPaginationOptions<TWhereInput, TOrderBy, TInclude> {
  maxNoPaginationLimit?: number
}

// --- DB Delegate Type ---
export type DbDelegate<TModel, TWhereInput, TOrderBy, TInclude> = {
  findMany: (args: {
    where: TWhereInput
    orderBy: TOrderBy
    include?: TInclude
    skip?: number
    take?: number
    cursor?: { id: string }
  }) => Promise<TModel[]>
  count: (args: { where: TWhereInput }) => Promise<number>
}

// --- Overloads ---
// Page-based
export function runSearch<TModel, TWhereInput, TOrderBy, TInclude>(
  dbDelegate: DbDelegate<TModel, TWhereInput, TOrderBy, TInclude>,
  options: PageBasedOptions<TWhereInput, TOrderBy, TInclude>
): Promise<PageBasedResult<TModel>>

// Cursor-based
export function runSearch<TModel, TWhereInput, TOrderBy, TInclude>(
  dbDelegate: DbDelegate<TModel, TWhereInput, TOrderBy, TInclude>,
  options: CursorBasedOptions<TWhereInput, TOrderBy, TInclude>
): Promise<CursorBasedResult<TModel>>

// Streaming
export function runSearch<TModel, TWhereInput, TOrderBy, TInclude>(
  dbDelegate: DbDelegate<TModel, TWhereInput, TOrderBy, TInclude>,
  options: StreamOptions<TWhereInput, TOrderBy, TInclude>
): Promise<StreamResult<TModel>>

// No pagination
export function runSearch<TModel, TWhereInput, TOrderBy, TInclude>(
  dbDelegate: DbDelegate<TModel, TWhereInput, TOrderBy, TInclude>,
  options: NoPaginationOptions<TWhereInput, TOrderBy, TInclude>
): Promise<AllResults<TModel>>

// --- Implementation ---
export async function runSearch<TModel, TWhereInput, TOrderBy, TInclude>(
  dbDelegate: DbDelegate<TModel, TWhereInput, TOrderBy, TInclude>,
  options: RunSearchOptions<TWhereInput, TOrderBy, TInclude>
): Promise<
  | PageBasedResult<TModel>
  | CursorBasedResult<TModel>
  | AllResults<TModel>
  | StreamResult<TModel>
> {
  const { where, orderBy, include, maxNoPaginationLimit = 1000 } = options // Streaming mode

  if (options.stream) {
    const { batchSize = 100 } = options
    async function* generator(): StreamResult<TModel> {
      let lastId: string | undefined
      while (true) {
        const batch = await dbDelegate.findMany({
          where,
          take: batchSize + 1,
          ...(lastId ? { skip: 1, cursor: { id: lastId } } : {}),
          orderBy,
          include,
        })
        if (batch.length === 0) break
        if (batch.length > batchSize) {
          lastId = (batch.pop() as any)?.id
        } else {
          lastId = undefined
        }
        yield { data: batch }
        if (!lastId) break
      }
    }
    return generator()
  } // Cursor-based

  if ('cursor' in options) {
    const { cursor, limit } = options
    const data = await dbDelegate.findMany({
      where,
      take: limit + 1,
      skip: 1,
      cursor: { id: cursor },
      orderBy,
      include,
    })
    let nextCursor: string | undefined
    if (data.length > limit) {
      const nextItem = data.pop()
      nextCursor = (nextItem as any)?.id
    }
    return { data, nextCursor }
  } // Page-based

  if ('page' in options && options.page) {
    const { page, pageSize } = options
    const [total, data] = await Promise.all([
      dbDelegate.count({ where }),
      dbDelegate.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy,
        include,
      }),
    ])
    return { data, total, page, pageSize }
  } // No pagination

  const totalCount = await dbDelegate.count({ where })
  if (totalCount > maxNoPaginationLimit) {
    throw new Error(
      `Too many results (${totalCount}). Please use pagination, streaming, or refine your filters.`
    )
  }
  const data = await dbDelegate.findMany({
    where,
    orderBy,
    include,
  })
  return {
    data,
    warning:
      totalCount > maxNoPaginationLimit / 2
        ? `Warning: returning ${totalCount} records without pagination may impact performance.`
        : undefined,
  }
}
```

### Gemini

Of course. The issue in your code is how `RunSearchOptions` is defined. When you declare an `interface` with the same name multiple times, TypeScript merges them into a single interface. This resulted in `RunSearchOptions` having all the properties (`page`, `cursor`, `stream`, etc.) as optional, which conflicts with your more specific option types (`PageBasedOptions`, `CursorBasedOptions`, etc.) where those properties are required. This conflict is what breaks the function overload compatibility.

The solution is to define `RunSearchOptions` as a **union type** of all the possible option variants. This correctly tells TypeScript that the `options` parameter will be one of, but not a combination of, the different pagination strategies.

Here is the corrected code:

```typescript
// utils/queryHelpers.ts

export type PageBasedResult<TModel> = {
  data: TModel[]
  total: number
  page: number
  pageSize: number
}

export type CursorBasedResult<TModel> = {
  data: TModel[]
  nextCursor?: string
}

export type AllResults<TModel> = {
  data: TModel[]
  warning?: string
}

export type StreamResult<TModel> = AsyncGenerator<
  { data: TModel[] },
  void,
  unknown
>

export interface BasePaginationOptions<TWhereInput, TOrderBy, TInclude> {
  where: TWhereInput
  orderBy: TOrderBy
  include?: TInclude
}

// --- Options Types ---
interface PageBasedOptions<
  TWhereInput,
  TOrderBy,
  TInclude,
> extends BasePaginationOptions<TWhereInput, TOrderBy, TInclude> {
  page: number
  pageSize: number
}

interface CursorBasedOptions<
  TWhereInput,
  TOrderBy,
  TInclude,
> extends BasePaginationOptions<TWhereInput, TOrderBy, TInclude> {
  cursor: string
  limit: number
}

interface StreamOptions<
  TWhereInput,
  TOrderBy,
  TInclude,
> extends BasePaginationOptions<TWhereInput, TOrderBy, TInclude> {
  stream: true
  batchSize?: number
}

interface NoPaginationOptions<
  TWhereInput,
  TOrderBy,
  TInclude,
> extends BasePaginationOptions<TWhereInput, TOrderBy, TInclude> {
  maxNoPaginationLimit?: number
}

// --- CORRECTED: Use a Union Type for the implementation ---
type RunSearchOptions<TWhereInput, TOrderBy, TInclude> =
  | PageBasedOptions<TWhereInput, TOrderBy, TInclude>
  | CursorBasedOptions<TWhereInput, TOrderBy, TInclude>
  | StreamOptions<TWhereInput, TOrderBy, TInclude>
  | NoPaginationOptions<TWhereInput, TOrderBy, TInclude>

// --- DB Delegate Type ---
export type DbDelegate<
  TModel extends { id: string },
  TWhereInput,
  TOrderBy,
  TInclude,
> = {
  findMany: (args: {
    where: TWhereInput
    orderBy: TOrderBy
    include?: TInclude
    skip?: number
    take?: number
    cursor?: { id: string }
  }) => Promise<TModel[]>
  count: (args: { where: TWhereInput }) => Promise<number>
}

// --- Overloads ---
// Page-based
export function runSearch<
  TModel extends { id: string },
  TWhereInput,
  TOrderBy,
  TInclude,
>(
  dbDelegate: DbDelegate<TModel, TWhereInput, TOrderBy, TInclude>,
  options: PageBasedOptions<TWhereInput, TOrderBy, TInclude>
): Promise<PageBasedResult<TModel>>

// Cursor-based
export function runSearch<
  TModel extends { id: string },
  TWhereInput,
  TOrderBy,
  TInclude,
>(
  dbDelegate: DbDelegate<TModel, TWhereInput, TOrderBy, TInclude>,
  options: CursorBasedOptions<TWhereInput, TOrderBy, TInclude>
): Promise<CursorBasedResult<TModel>>

// Streaming
export function runSearch<
  TModel extends { id: string },
  TWhereInput,
  TOrderBy,
  TInclude,
>(
  dbDelegate: DbDelegate<TModel, TWhereInput, TOrderBy, TInclude>,
  options: StreamOptions<TWhereInput, TOrderBy, TInclude>
): Promise<StreamResult<TModel>>

// No pagination
export function runSearch<
  TModel extends { id: string },
  TWhereInput,
  TOrderBy,
  TInclude,
>(
  dbDelegate: DbDelegate<TModel, TWhereInput, TOrderBy, TInclude>,
  options: NoPaginationOptions<TWhereInput, TOrderBy, TInclude>
): Promise<AllResults<TModel>>

// --- Implementation ---
export async function runSearch<
  TModel extends { id: string },
  TWhereInput,
  TOrderBy,
  TInclude,
>(
  dbDelegate: DbDelegate<TModel, TWhereInput, TOrderBy, TInclude>,
  options: RunSearchOptions<TWhereInput, TOrderBy, TInclude>
): Promise<
  | PageBasedResult<TModel>
  | CursorBasedResult<TModel>
  | AllResults<TModel>
  | StreamResult<TModel>
> {
  const { where, orderBy, include } = options

  // Streaming mode
  if ('stream' in options && options.stream) {
    const { batchSize = 100 } = options
    async function* generator(): StreamResult<TModel> {
      let lastId: string | undefined
      while (true) {
        const batch = await dbDelegate.findMany({
          where,
          take: batchSize + 1,
          ...(lastId ? { skip: 1, cursor: { id: lastId } } : {}),
          orderBy,
          include,
        })

        if (batch.length === 0) break

        // If we fetched more items than the batch size, there's a next page
        if (batch.length > batchSize) {
          const nextItem = batch.pop() // Remove the extra item
          lastId = nextItem!.id // Use its ID as the cursor for the next iteration
        } else {
          lastId = undefined // This was the last batch
        }

        yield { data: batch }

        if (!lastId) break
      }
    }
    return generator()
  }

  // Cursor-based
  if ('cursor' in options) {
    const { cursor, limit } = options
    const data = await dbDelegate.findMany({
      where,
      take: limit + 1, // Fetch one extra item to check for a next page
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy,
      include,
    })
    let nextCursor: string | undefined
    if (data.length > limit) {
      const nextItem = data.pop() // Remove the extra item
      nextCursor = nextItem!.id
    }
    return { data, nextCursor }
  }

  // Page-based
  if ('page' in options && options.page) {
    const { page, pageSize } = options
    const [total, data] = await Promise.all([
      dbDelegate.count({ where }),
      dbDelegate.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy,
        include,
      }),
    ])
    return { data, total, page, pageSize }
  }

  // No pagination (fallback case)
  const { maxNoPaginationLimit = 1000 } = options
  const totalCount = await dbDelegate.count({ where })
  if (totalCount > maxNoPaginationLimit) {
    throw new Error(
      `Query too large (${totalCount} results). Max is ${maxNoPaginationLimit}. Please use pagination or streaming.`
    )
  }
  const data = await dbDelegate.findMany({
    where,
    orderBy,
    include,
  })
  return {
    data,
    warning:
      totalCount > maxNoPaginationLimit / 2
        ? `Warning: returning ${totalCount} records without pagination may impact performance.`
        : undefined,
  }
}
```

### Summary of Changes:

1.  **`RunSearchOptions` is now a Union Type**:
    - I removed the multiple `interface` declarations for `RunSearchOptions`.
    - I replaced them with a single `type` alias that unions (`|`) the four specific option types: `PageBasedOptions`, `CursorBasedOptions`, `StreamOptions`, and `NoPaginationOptions`. This is the main fix.

2.  **Added Generic Constraint**:
    - I added a generic constraint `TModel extends { id: string }` because the cursor-based and streaming logic relies on an `id` property to function correctly. This makes the function more type-safe.

3.  **Improved Type Guards**:
    - The `if` statements in the implementation now act as powerful type guards. Inside `if ('cursor' in options)`, TypeScript knows that `options` is of type `CursorBasedOptions` and allows you to safely access `options.limit` and `options.cursor`.

With these changes, your function overloads will work correctly, providing excellent type-safety and auto-completion for anyone using your `runSearch` utility.

### User

can you fix this code so that the searchFactory will return the return type that runSearch returns

```ts
import {
  runSearch,
  type PageBasedResult,
  type CursorBasedResult,
  type AllResults,
  type StreamResult,
} from './queryHelpers'
import { Prisma } from '@/prisma/client'

// Base options without pagination mode
type BaseOpts<TParams, TOrderBy> = TParams & {
  orderBy?: TOrderBy
  maxNoPaginationLimit?: number
}

// Overload signatures for SearchFunction
export interface SearchFunctionOverloads<TModel, TParams, TOrderBy> {
  // Page-based
  (
    options: BaseOpts<TParams, TOrderBy> & {
      page: number
      pageSize: number
    }
  ): Promise<PageBasedResult<TModel>> // Cursor-based
  (
    options: BaseOpts<TParams, TOrderBy> & {
      cursor: string
      limit: number
    }
  ): Promise<CursorBasedResult<TModel>> // Streaming
  (
    options: BaseOpts<TParams, TOrderBy> & {
      batchSize?: number
      stream: true
    }
  ): Promise<StreamResult<TModel>> // No pagination
  (options?: BaseOpts<TParams, TOrderBy> & {}): Promise<AllResults<TModel>>
}

/**
 * Creates a type‑safe search function for a given Prisma delegate.
 * Infers TModel automatically from the delegate and defaultInclude.
 */
export function searchFactory<
  TDelegate extends {
    findMany: (args: any) => Promise<any[]>
    count: (args: any) => Promise<number>
  },
  TWhereInput,
  TOrderBy,
  TInclude,
  TParams,
>(
  dbDelegate: TDelegate,
  buildFilters: (params: TParams) => TWhereInput,
  defaultInclude: TInclude,
  defaultOrderBy: (params: TParams) => TOrderBy
): SearchFunctionOverloads<
  Prisma.Result<
    Parameters<TDelegate['findMany']>[0] & { include: TInclude },
    { include: TInclude },
    'findMany'
  >[number],
  TParams,
  TOrderBy
> {
  type TModel = Prisma.Result<
    Parameters<TDelegate['findMany']>[0] & { include: TInclude },
    { include: TInclude },
    'findMany'
  >[number]

  const fn: any = (options: any = {}) => {
    const where = buildFilters(options)
    const orderBy = options.orderBy ?? defaultOrderBy(options)

    return runSearch<TModel, TWhereInput, TOrderBy, TInclude>(dbDelegate, {
      where,
      orderBy,
      include: defaultInclude,
      ...options,
    })
  }

  return fn
}
```

### Gemini

Of course. The problem is that the actual function implementation inside `searchFactory` is typed with `any`, which tells TypeScript to ignore any potential type mismatches. To fix this, you need to provide a single, comprehensive signature for the implementation that is compatible with all the overload signatures.

The solution is to create a **union type** of all possible `options` objects and use that for the implementation's parameter. Then, you can cast the implementation function to the overloaded interface type upon returning it.

Here's the corrected and improved code:

```typescript
import {
  runSearch,
  type PageBasedResult,
  type CursorBasedResult,
  type AllResults,
  type StreamResult,
  // Assuming RunSearchOptions is exported from here for the implementation
  // You can also redefine it if not exported from the helper
} from './queryHelpers'
import { Prisma } from '@/prisma/client'

// --- Reusable Option Types ---

// Base options without pagination mode
type BaseOpts<TParams, TOrderBy> = TParams & {
  orderBy?: TOrderBy
  maxNoPaginationLimit?: number
}

// Specific pagination option types
type PageOptions<TParams, TOrderBy> = BaseOpts<TParams, TOrderBy> & {
  page: number
  pageSize: number
}
type CursorOptions<TParams, TOrderBy> = BaseOpts<TParams, TOrderBy> & {
  cursor: string
  limit: number
}
type StreamOptions<TParams, TOrderBy> = BaseOpts<TParams, TOrderBy> & {
  stream: true
  batchSize?: number
}
type NoPaginationOptions<TParams, TOrderBy> = BaseOpts<TParams, TOrderBy>

// --- Union type for the implementation ---
type SearchOptions<TParams, TOrderBy> =
  | PageOptions<TParams, TOrderBy>
  | CursorOptions<TParams, TOrderBy>
  | StreamOptions<TParams, TOrderBy>
  | NoPaginationOptions<TParams, TOrderBy>

// Overload signatures for the returned search function
export interface SearchFunction<TModel, TParams, TOrderBy> {
  (options: PageOptions<TParams, TOrderBy>): Promise<PageBasedResult<TModel>>
  (
    options: CursorOptions<TParams, TOrderBy>
  ): Promise<CursorBasedResult<TModel>>
  (options: StreamOptions<TParams, TOrderBy>): Promise<StreamResult<TModel>>
  (
    options?: NoPaginationOptions<TParams, TOrderBy>
  ): Promise<AllResults<TModel>>
}

/**
 * Creates a type-safe search function for a given Prisma delegate.
 * Infers TModel automatically from the delegate and defaultInclude.
 */
export function searchFactory<
  // Using a more specific delegate type for better inference
  TDelegate extends {
    findMany: (args: any) => Promise<{ id: string }[]>
    count: (args: any) => Promise<number>
  },
  TWhereInput,
  TOrderBy,
  TInclude,
  TParams extends object,
>(
  dbDelegate: TDelegate,
  buildFilters: (params: TParams) => TWhereInput,
  defaultInclude: TInclude,
  defaultOrderBy: (params: TParams) => TOrderBy
): SearchFunction<
  // This is the inferred model type including the 'include' relations
  Prisma.Result<
    TDelegate,
    Parameters<TDelegate['findMany']>[0] & { include: TInclude },
    'findMany'
  >[number],
  TParams,
  TOrderBy
> {
  type TModel = Prisma.Result<
    TDelegate,
    Parameters<TDelegate['findMany']>[0] & { include: TInclude },
    'findMany'
  >[number]

  // The implementation uses the union type for its options
  const searchImplementation = (options?: SearchOptions<TParams, TOrderBy>) => {
    // The cast is needed because the union is wider than TParams
    const params = (options ?? {}) as TParams
    const where = buildFilters(params)
    const orderBy = options?.orderBy ?? defaultOrderBy(params)

    // The options passed to runSearch are now correctly typed
    return runSearch<TModel, TWhereInput, TOrderBy, TInclude>(dbDelegate, {
      where,
      orderBy,
      include: defaultInclude,
      // Spread the original options to pass pagination/streaming details
      ...(options ?? {}),
    })
  }

  // Cast the implementation to the overloaded type.
  // This tells TypeScript that our single implementation satisfies the multiple overload signatures.
  return searchImplementation as SearchFunction<TModel, TParams, TOrderBy>
}
```

---

## Breakdown of the Fixes 🧐

1.  **Refactored Option Types**: I broke out each options variant (`PageOptions`, `CursorOptions`, etc.) into its own `type` alias. This makes the code cleaner and easier to read.

2.  **Created a Union Type (`SearchOptions`)**: This is the key change. I created `SearchOptions` as a union of all possible option variants. This single type accurately describes all possible inputs for the _implementation_ of the search function.

3.  **Removed `any`**: I replaced `const fn: any = (options: any = {})` with a properly typed implementation (`searchImplementation`). Its `options` parameter now uses the `SearchOptions` union type.

4.  **Casting to the Overloaded Type**: The final step is `return searchImplementation as SearchFunction<...>`. This is a standard pattern in TypeScript when dealing with overloads. You write a single implementation with a broad (union) signature and then cast it to the more specific overloaded interface. This assures the compiler that your implementation correctly handles all the cases defined in the overloads.

Now, the returned function is fully type-safe, and when you use it, you'll get the correct return type based on the specific pagination options you provide. ✅

### User

typescript error

```ts
The inferred type of 'searchItems' cannot be named without a reference to '.pnpm/@prisma+client@6.10.1_prism_19e62450778ed551687d5daae39b8a21/node_modules/@prisma/client/runtime/library'. This is likely not portable. A type annotation is necessary.ts(2742)
⚠ Error (TS2742)  | 
The inferred type of searchItems cannot be named without a reference to .pnpm/@prisma+client@6.10.1_prism_19e62450778ed551687d5daae39b8a21/node_modules/@prisma/client/runtime/library . This is likely not portable. A type annotation is necessary.
const searchItems: SearchFunction<{ _count: { file: number; folder: number; image: number; video: number; audio: number; photo: number; collection: number; owner: number; workspace: number; drive: number; children: number; parent: number; ... 10 more ...; search: number; }; ... 22 more ...; workspace: { ...; } | null; } & { ...; }, { ...
```

### Gemini

Of course. This is a common error when working with libraries like Prisma that generate very complex, structural types.

This error means TypeScript has successfully figured out the exact, complex shape of your data (`searchItems`), but that shape is so complex it can't be written down without referencing **private, internal types** from the `@prisma/client` library. TypeScript flags this because relying on internal types is fragile and not portable.

Think of it like this: TypeScript figured out a secret, complicated recipe (`the inferred type`), but it's not allowed to write it on the public menu (`your code`) because the ingredients are proprietary (`internal Prisma types`). The error message, **"A type annotation is necessary,"** is TypeScript's way of asking you to give the dish a simple, public name.

---

### Why This Happens

Your `searchFactory` is designed to be very precise. It uses `Prisma.Result` to infer the exact type of the model that will be returned, including all the relations you specify in `defaultInclude`. This results in a massive, anonymous, structural type. When you try to assign the factory's output to a new variable (`const searchItems = ...`), TypeScript tries to infer and assign this huge anonymous type to `searchItems`, triggering the error.

---

### How to Fix It: Explicitly Define Your Model Type

The solution is to do exactly what the error suggests: provide an explicit type annotation. The best way to do this is to create a named, exported type for your Prisma model, including its relations. You can do this easily with Prisma's `Prisma.<Model>GetPayload` utility.

Here’s the step-by-step solution:

**1. Define a Named Type for Your Model and its Relations**

Instead of letting the factory infer the model type anonymously, define it yourself. This creates a clean, reusable, and portable type.

```typescript
// in your prisma types file, or alongside the factory call
import { Prisma } from '@/prisma/client'

// Define the 'include' object once so you can reuse it
const itemInclude = {
  // Add all the relations you need
  owner: true,
  workspace: true,
  // ... other relations
} satisfies Prisma.ItemInclude

// Create the final, named model type using the include object
export type ItemWithRelations = Prisma.ItemGetPayload<{
  include: typeof itemInclude
}>
```

**2. Annotate Your `searchItems` Variable**

Now, use your new `ItemWithRelations` type to explicitly annotate the `searchItems` constant when you create it.

```typescript
import { searchFactory, type SearchFunction } from './searchFactory'
import { prisma } from '@/prisma/client'
import type { ItemWithRelations } from './types' // 👈 Import your new type

// Assume you have these types defined for your search parameters
type ItemSearchParams = {
  query?: string
  workspaceId?: string
}
type ItemOrderBy = Prisma.ItemOrderByWithRelationInput

// --- The Fix ---
// Explicitly provide the types for the SearchFunction
const searchItems: SearchFunction<
  ItemWithRelations, // 👈 The model type
  ItemSearchParams, // 👈 The params type
  ItemOrderBy // 👈 The order-by type
> = searchFactory(
  prisma.item,
  (params: ItemSearchParams) => {
    // build your where clause from params
    const where: Prisma.ItemWhereInput = {
      workspaceId: params.workspaceId,
      name: { contains: params.query, mode: 'insensitive' },
    }
    return where
  },
  itemInclude, // The include object defined in step 1
  (params: ItemSearchParams) => {
    // build your default order-by
    return { name: 'asc' }
  }
)

// Now you can use it without any errors
async function testSearch() {
  const results = await searchItems({
    page: 1,
    pageSize: 10,
    workspaceId: '123',
  })
  console.log(results.data[0].workspace) // Fully typed!
}
```

By creating an explicit, named type (`ItemWithRelations`), you satisfy the compiler and make your code significantly more readable and maintainable. You're no longer relying on a massive, unreadable inferred type.
