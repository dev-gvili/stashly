# Search — Semantic Search, Pagination Integration & Service Implementation

This document covers the full search system: semantic vector search with pgvector, integration with the existing pagination system, S3 content extraction for embeddings, and the `searchItems` service implementation.

---

## Table of Contents

1. [Semantic Search Overview](#1-semantic-search-overview)
2. [Setup: Model, Dependencies, Embedding](#2-setup-model-dependencies-embedding)
3. [PostgreSQL + Prisma Configuration](#3-postgresql--prisma-configuration)
4. [S3 Content Extraction](#4-s3-content-extraction)
5. [Upsert File + Embedding](#5-upsert-file--embedding)
6. [Semantic Search Function](#6-semantic-search-function)
7. [Integrating Semantic Search with Existing Pagination](#7-integrating-semantic-search-with-existing-pagination)
8. [searchItems Service (Postgres)](#8-searchitems-service-postgres)
9. [Item Filters](#9-item-filters)
10. [S3 Extraction & Embedding — Operational Notes](#10-s3-extraction--embedding--operational-notes)

---

## 1. Semantic Search Overview

**Stack:** Free-for-commercial-use, self-hosted solution.

| Component | Choice | Notes |
|-----------|--------|-------|
| Embedding model | `sentence-transformers/all-MiniLM-L6-v2` | 384-dim, Apache-2.0, ~33M params, <1GB RAM, fast on CPU |
| Vector store | `pgvector` PostgreSQL extension | `<=>` cosine distance operator |
| ORM | Prisma | `$queryRaw` for vector queries |
| Alternative (higher accuracy) | `intfloat/e5-large-v2` | 1024-dim, Apache-2.0, more RAM |

---

## 2. Setup: Model, Dependencies, Embedding

### Install Dependencies

```bash
npm i @xenova/transformers pg prisma @prisma/client pgvector pdf-parse textract \
      @aws-sdk/client-s3 pdfjs-dist
npx prisma init
```

### Embedding Model (`src/embeddings.ts`)

```typescript
import { pipeline } from '@xenova/transformers'

let embedder: ReturnType<typeof pipeline> | null = null

export async function initEmbeddingModel() {
  embedder = await pipeline(
    'feature-extraction',
    'sentence-transformers/all-MiniLM-L6-v2'
    // { quantize: 'q8' }  // optional: reduce RAM usage
  )
  console.log('Embedding model loaded')
}

export async function encodeText(text: string | string[]): Promise<number[]> {
  if (!embedder) throw new Error('Embedding model not initialised — call initEmbeddingModel() first')

  const out = await embedder(text, { pooling: 'mean' })
  const flat = out.data as Float32Array
  const norm = Math.sqrt(flat.reduce((s, v) => s + v * v, 0))
  return Array.from(flat, (v) => v / norm)
}
```

> First run downloads ~150MB of model files into `~/.cache/huggingface/hub`.
> Use the `cache_dir` option to specify a custom directory.

---

## 3. PostgreSQL + Prisma Configuration

### Enable pgvector (once, as superuser)

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### Prisma Schema

```prisma
model Item {
  embedding   Unsupported("vector")?  @db.Vector(384)
  @@index([embedding], type: Gist)   // GIST index for cosine similarity
}
```

The `@db.Vector(384)` tells Prisma the column is a `vector(384)` in Postgres. The GIST index enables fast `<=>` (cosine distance) queries.

### Run Migration

```shell
pnpm exec prisma migrate dev --name init
```

---

## 4. S3 Content Extraction

### Dispatcher Pattern

```typescript
import s3Extractors from 'app/.server/s3-extractors'

const content = await s3Extractors.extractTextFromS3Auto({
  bucket: 'my-bucket',
  key: 'uploads/report.pdf',
  options: { maxPages: 10 }
})
```

`extractTextFromS3Auto` chooses the best extractor by file extension. For images it returns captions (BLIP-based); for audio/video it returns transcripts (local Whisper).

### Multi-format Extraction (`src/extractFromS3.ts`)

```typescript
export async function extractTextFromS3Object(args: {
  bucket: string
  key: string
  s3Client?: S3Client
  maxSizeBytes?: number  // safety guard, e.g. 500 * 1024 * 1024
}): Promise<string>
```

Internally:
1. `GetObjectCommand` — stream the S3 object
2. `streamToBuffer(stream, { maxSizeBytes })` — accumulate with optional size guard
3. Dispatch to `pdf-parse` (for PDFs) or `textract.fromBufferWithName` (for everything else)

### PDF Range Streaming (`src/s3PdfExtractor.ts`)

For memory-efficient PDF extraction, uses `pdfjs` range transport:

```typescript
export async function extractPdfTextFromS3(params: {
  bucket: string
  key: string
  client?: S3Client
}): Promise<string>
```

**How it works:**
1. `HeadObject` — get total byte length (no data transferred)
2. `S3DataRangeTransport` — subclass of `PDFDataRangeTransport`; issues S3 Range GETs (`bytes=begin-end-1`) on demand
3. `pdfjsLib.getDocument({ length, range: transport })` — pdf.js requests only what it needs
4. Iterate pages, `getTextContent()`, concatenate

**Memory usage:** Only the current range chunk (~64KB default) is in RAM at any time, even for gigabyte PDFs.

---

## 5. Upsert File + Embedding

```typescript
export async function upsertFile(params: {
  id?: string
  name: string
  description?: string
  tags?: string[]
  filePath?: string                          // local upload
  s3Location?: { bucket: string; key: string } // S3 file
}) {
  // 1. Extract text
  let content: string | null = null
  if (s3Location) {
    content = await extractTextFromS3Object({
      bucket: s3Location.bucket,
      key: s3Location.key,
      maxSizeBytes: 300 * 1024 * 1024,
    })
  }

  // 2. Build embedding input string
  const textToEmbed = [name, description ?? '', tags.join(' '), content ?? ''].join(' ')
  const embedding = await encodeText(textToEmbed)

  // 3. Persist
  const data = { name, description, tags, content, embedding }
  if (id) await prisma.file.update({ where: { id }, data })
  else await prisma.file.create({ data })
}
```

For batch uploads, use `encodeText([txt1, txt2, ...])` and `prisma.file.createMany`.

---

## 6. Semantic Search Function

**Location:** `app/.server/searchService.ts`

```typescript
export async function semanticSearch(query: string, topK = 10): Promise<SearchResult[]> {
  const queryEmbedding = await encodeText(query)  // → 384-dim array

  const rows = await prisma.$queryRaw<SearchResult[]>`
    SELECT
      id,
      name,
      description,
      tags,
      1 - (embedding <=> ${queryEmbedding}::vector) AS similarity
    FROM "File"
    ORDER BY similarity DESC
    LIMIT ${topK};
  `

  return rows
}
```

- `<=>` = cosine distance (pgvector operator)
- `1 - distance` converts to intuitive similarity score (0–1, higher = more similar)

---

## 7. Integrating Semantic Search with Existing Pagination

The `searchFactory` in `ss.ts` (combined from `search.ts` and `pagination.ts`) integrates semantic search by pre-filtering item IDs before applying standard pagination.

### Approach

When a `semanticQuery` parameter is provided:
1. `SearchService.search(semanticQuery)` generates a vector embedding and queries the `Search` table via `SearchRepository`
2. Returns a list of matching item IDs sorted by similarity
3. These IDs are injected into the main query's `WHERE id IN (...)` clause
4. Standard pagination (cursor, offset, or streaming) runs on the filtered result set

### SearchRepository

Executes the raw SQL vector similarity query against the `Search` table:

```typescript
// app/.server/search/search.repository.ts
export const searchRepository = {
  async upsertSearchEmbedding(itemId: string, vector: number[], searchText: string) {
    // Raw SQL upsert into Search.vector (pgvector column)
  },
  async findSimilarItemIds(vector: number[], topK: number): Promise<string[]> {
    // Raw SQL: SELECT itemId FROM Search ORDER BY vector <=> $1 LIMIT $k
  }
}
```

### SearchService

```typescript
// app/.server/search/search.service.ts
import { encodeText } from './embeddings'
import { searchRepository } from './search.repository'

export async function findSimilarItems(query: string, topK = 50): Promise<string[]> {
  const vector = await encodeText(query)
  return searchRepository.findSimilarItemIds(vector, topK)
}
```

### Updated Filter Schema

```typescript
export const itemFilterSchema = z.object({
  // ... existing filters ...
  semanticQuery: z.string().min(1).optional(),
}).partial()
```

### Updated Search Factory

```typescript
// When semanticQuery is provided:
const fn = async (options: any = {}) => {
  let where = buildFilters(options)

  if (options.semanticQuery) {
    const similarIds = await searchService.findSimilarItems(options.semanticQuery)
    where = { AND: [where, { id: { in: similarIds } }] }
  }

  return runSearch(dbDelegate, { where, orderBy, include, ...options })
}
```

---

## 8. searchItems Service (Postgres)

`app/.server/search/searchItems.ts` is the unified search function. It builds a `where` clause from filters and delegates to the `paginate` utility with support for cursor, offset, and stream strategies.

---

## 9. Item Filters

**Location:** `.server/filters/item.filters.ts`

The filter system uses a typed factory pattern for composable, type-safe Prisma `WhereInput` construction.

### Available Filters

| Filter | Type | Description |
|--------|------|-------------|
| `id` | `string` | Filter by item ID |
| `query` | `string` | Full-text search on name (+ workspace fields if no workspace scoping) |
| `category` | `ItemCategory[]` | Filter by category enum |
| `type` | `ItemType[]` | Filter by type enum |
| `extension` | `string[]` | Filter by file extension |
| `status` | `ItemStatus` | Filter by status |
| `parent` | `string` | Filter by parentId |
| `workspace` | `string` | Filter by workspaceId |
| `tags` | `string[]` | `hasSome` tags match |
| `favorited` | `boolean` | Has favorites (`some: {}`) or none (`none: {}`) |
| `locked` | `boolean` | Has/lacks a LockedItem relation |
| `trashed` | `boolean` | Has/lacks a TrashItem relation |
| `owner` | `string` | Filter by ownerId |
| `permission` | `string \| string[]` | Filter by permission user IDs |
| `roles` | `PermissionRole[] \| WorkspaceMemberRole[]` | Filter by roles (scoped to workspace if provided) |
| `date` | `{ before?: Date, after?: Date }` | Filter by createdAt range |
| `hasChildren` | `boolean` | Folder has children (`childCount > 0`) |
| `collection` | `string` | Filter by collection ID |

### Usage

```typescript
import { buildItemFilters } from '.server/filters/item.filters'

const where = buildItemFilters({
  workspace: 'ws_123',
  type: ['file'],
  tags: ['important'],
  date: { after: new Date('2024-01-01') },
})

const items = await prisma.item.findMany({ where })
```

### Filter Factory Architecture

```typescript
// createFilter — typed factory for a single filter
export const createFilter = <TWhereInput, TParams>() => {
  return <T>(
    schema: z.ZodType<T>,
    filterFn: (value: T, params: TParams) => TWhereInput
  ) => ({ schema, apply: (value, params) => filterFn(schema.parse(value), params) })
}

// FilterBuilder — collects conditions and builds { AND: [...] }
export class FilterBuilder<TWhereInput, TFilters, TParams> {
  addFilter(key, value): this { ... }
  build(): TWhereInput { return { AND: conditions } }
}

// buildFiltersFactory — creates a ready-to-use filter builder function
export const buildFiltersFactory = ({ filters, schema }) => (params) => {
  const builder = new FilterBuilder(filters, params)
  for (const key of Object.keys(params)) {
    if (key in filters) builder.addFilter(key, params[key])
  }
  return builder.build()
}
```

---

## 10. S3 Extraction & Embedding — Operational Notes

**Key files:**
- `app/.server/s3-extractors.ts` — streaming extractors and local-model wrappers
- `app/.server/search/embeddings.ts` — `buildSearchTextFromItem`, `embedItemForSearch`, `embedItemForSearchString`
- `app/.server/search/search.repository.ts` — `upsertSearchEmbedding(...)` raw-SQL helper

### Typical Flow (extract → embed → upsert)

```typescript
const content = await s3Extractors.extractTextFromS3Auto({ bucket, key, options: { maxPages: 10 } })

const forSearch = {
  name: 'report.pdf',
  description: 'Quarterly report',
  tags: ['finance'],
  category: 'documents',
  type: 'file',
  file: { extension: '.pdf', mimeType: 'application/pdf' },
  extraText: content,
}

const vector = await embedItemForSearch(forSearch)
await searchRepository.upsertSearchEmbedding(itemId, vector, buildSearchTextFromItem(forSearch))
```

### Reindexing All Items

```typescript
// scripts/reindex-search.ts (skeleton)
import pLimit from 'p-limit'
const limit = pLimit(4)
const BATCH = 200

async function reindexAll() {
  let cursor: string | undefined
  while (true) {
    const items = await prisma.item.findMany({
      take: BATCH, ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      orderBy: { id: 'asc' }, include: { file: true, owner: true }
    })
    if (!items.length) break

    await Promise.all(items.map(it => limit(async () => {
      const content = it.file?.bucket
        ? await s3Extractors.extractTextFromS3Auto({ bucket: it.file.bucket, key: it.file.key })
        : ''
      const forSearch = { name: it.name, ... extraText: content }
      const vec = await embedItemForSearch(forSearch)
      await searchRepository.upsertSearchEmbedding(it.id, vec, buildSearchTextFromItem(forSearch))
    })))

    cursor = items[items.length - 1].id
  }
}
```

Run: `pnpm exec tsx ./scripts/reindex-search.ts`

### Performance & Operational Tips

- **Concurrency:** 1–4 concurrent inferences per CPU core; use `p-limit`
- **Batch sizes:** Fetch item metadata in batches of 100–500
- **Model memory:** Use quantization (`quantize: 'q8'`) to reduce RAM usage
- **Temp files:** Office/audio/video extraction writes temp files — ensure sufficient disk and cleanup
- **Vector dim:** Confirm `Search.vector` dimension equals the embedding model output (384 vs 768 mismatch causes runtime errors)

### Troubleshooting

- `expected 768 dimensions, not 384` — mismatch between model and DB vector dimension; fix by aligning model in `app/.server/search/embeddings.ts` or changing DB
- Out of memory — reduce concurrency and/or switch to quantized model

### Security & Privacy

- All extractors use local model inference — no external paid services or cloud ML APIs
- Enforce least-privileged S3 credentials for the reindexing service
- Ensure access controls to S3 objects are enforced upstream

---

## 11. Type-Safe Filter Definitions

> ⚠️ **Note:** This content was captured from an earlier AI conversation and may not reflect the current codebase. Review and verify against actual code before using.

Refactoring `workspaceMember.filters.ts` and `item.filters.ts` to use the type-safe `buildFiltersFactory` so every filter's `apply` gets strongly typed `params` from its schema.

### workspaceMember.filters.ts

```ts
import { z } from 'zod'
import { Prisma, WorkspaceMemberRole } from '@/prisma/client'
import { createFilterFactory, buildFiltersFactory } from '@/utils/filters'

export const workspaceMemberFilterSchema = z.object({
  workspaceId: z.string().uuid().optional(),
  memberId: z.string().uuid().optional(),
  roles: z.array(z.nativeEnum(WorkspaceMemberRole)).optional(),
  search: z.string().optional()
})

const createWorkspaceMemberFilter = createFilterFactory<
  Prisma.WorkspaceMemberWhereInput,
  z.infer<typeof workspaceMemberFilterSchema>
>()

export const workspaceMemberFilters = {
  workspaceId: createWorkspaceMemberFilter(
    z.string().uuid(),
    (workspaceId) => ({ workspaceId })
  ),
  memberId: createWorkspaceMemberFilter(
    z.string().uuid(),
    (memberId) => ({ memberId })
  ),
  roles: createWorkspaceMemberFilter(
    z.array(z.nativeEnum(WorkspaceMemberRole)),
    (roles) => ({ role: { in: roles } })
  ),
  search: createWorkspaceMemberFilter(
    z.string().min(1),
    (search, params) => {
      if (params.workspaceId) {
        return {
          member: {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } }
            ]
          }
        }
      }
      return {
        OR: [
          {
            workspace: {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } }
              ]
            }
          },
          {
            member: {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } }
              ]
            }
          }
        ]
      }
    }
  )
}

export const buildWorkspaceMemberFilters = buildFiltersFactory({
  filters: workspaceMemberFilters,
  schema: workspaceMemberFilterSchema
})
```

### item.filters.ts

```ts
import { z } from 'zod'
import { Prisma, ItemCategory, ItemType, ItemStatus } from '@/prisma/client'
import { createFilterFactory, buildFiltersFactory } from '@/utils/filters'

export const itemFilterSchema = z.object({
  workspaceId: z.string().uuid().optional(),
  ownerId: z.string().uuid().optional(),
  categories: z.array(z.nativeEnum(ItemCategory)).optional(),
  types: z.array(z.nativeEnum(ItemType)).optional(),
  statuses: z.array(z.nativeEnum(ItemStatus)).optional(),
  search: z.string().optional()
})

const createItemFilter = createFilterFactory<
  Prisma.ItemWhereInput,
  z.infer<typeof itemFilterSchema>
>()

export const itemFilters = {
  workspaceId: createItemFilter(z.string().uuid(), (workspaceId) => ({ workspaceId })),
  ownerId: createItemFilter(z.string().uuid(), (ownerId) => ({ ownerId })),
  categories: createItemFilter(
    z.array(z.nativeEnum(ItemCategory)),
    (categories) => ({ category: { in: categories } })
  ),
  types: createItemFilter(
    z.array(z.nativeEnum(ItemType)),
    (types) => ({ type: { in: types } })
  ),
  statuses: createItemFilter(
    z.array(z.nativeEnum(ItemStatus)),
    (statuses) => ({ status: { in: statuses } })
  ),
  search: createItemFilter(
    z.string().min(1),
    (search, params) => {
      if (params.workspaceId) {
        return {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } }
          ]
        }
      }
      return {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { workspace: { name: { contains: search, mode: 'insensitive' } } },
          { workspace: { description: { contains: search, mode: 'insensitive' } } }
        ]
      }
    }
  )
}

export const buildItemFilters = buildFiltersFactory({
  filters: itemFilters,
  schema: itemFilterSchema
})
```

### Benefits

- **Full IntelliSense**: Inside every `apply`, `params` is strongly typed from the schema.
- **No overrides**: Conditional logic like `if (params.workspaceId)` is clean and safe.
- **Consistency**: Both repositories use the same pattern.
- **Easy extension**: Adding a new filter is one line in the filters object.

---

## 12. Repository Search Methods with Filter Builders

> ⚠️ **Note:** This content was captured from an earlier AI conversation and may not reflect the current codebase. Review and verify against actual code before using.

Refactoring `searchMembers` and `searchItems` to call the type-safe filter builders directly.

### workspaceMemberRepository.searchMembers

```ts
import { buildWorkspaceMemberFilters, workspaceMemberFilterSchema } from './workspaceMember.filters'
import { z } from 'zod'

async searchMembers(
  options: z.infer<typeof workspaceMemberFilterSchema> & {
    page?: number
    pageSize?: number
    cursor?: string
    limit?: number
    batchSize?: number
    orderBy?: Prisma.WorkspaceMemberOrderByWithRelationInput
    maxNoPaginationLimit?: number
    stream?: boolean
  }
) {
  const where = buildWorkspaceMemberFilters(options)
  // ... pagination logic using where
}
```

### itemRepository.searchItems

```ts
import { buildItemFilters, itemFilterSchema } from './item.filters'
import { z } from 'zod'

async searchItems(
  options: z.infer<typeof itemFilterSchema> & {
    page?: number
    pageSize?: number
    cursor?: string
    limit?: number
    batchSize?: number
    orderBy?: Prisma.ItemOrderByWithRelationInput
    maxNoPaginationLimit?: number
    stream?: boolean
  }
) {
  const where = buildItemFilters(options)
  // ... pagination logic using where
}
```

---

## 13. Generic Pagination Helper (`runSearch`)

> ⚠️ **Note:** This content was captured from an earlier AI conversation and may not reflect the current codebase. Review and verify against actual code before using.

A generic, reusable `runSearch` helper that handles page-based, cursor-based, streaming, and no-pagination modes — with full TypeScript overloads so the return type is inferred automatically.

### utils/queryHelpers.ts

```ts
import { Prisma } from '@/prisma/client'

export type PageBasedResult<TModel> = { data: TModel[]; total: number; page: number; pageSize: number }
export type CursorBasedResult<TModel> = { data: TModel[]; nextCursor?: string }
export type AllResults<TModel> = { data: TModel[]; warning?: string }
export type StreamResult<TModel> = AsyncGenerator<TModel[], void, unknown>

export interface BasePaginationOptions<TWhereInput, TOrderBy, TInclude> {
  where: TWhereInput
  orderBy: TOrderBy
  include?: TInclude
  maxNoPaginationLimit?: number
}

// Overloads
export function runSearch<TModel, TWhereInput, TOrderBy, TInclude>(
  dbDelegate: { findMany: Function; count: Function },
  options: BasePaginationOptions<TWhereInput, TOrderBy, TInclude> & { page: number; pageSize: number; stream?: false }
): Promise<PageBasedResult<TModel>>

export function runSearch<TModel, TWhereInput, TOrderBy, TInclude>(
  dbDelegate: { findMany: Function; count: Function },
  options: BasePaginationOptions<TWhereInput, TOrderBy, TInclude> & { cursor: string; limit: number; stream?: false }
): Promise<CursorBasedResult<TModel>>

export function runSearch<TModel, TWhereInput, TOrderBy, TInclude>(
  dbDelegate: { findMany: Function; count: Function },
  options: BasePaginationOptions<TWhereInput, TOrderBy, TInclude> & { batchSize?: number; stream: true }
): Promise<StreamResult<TModel>>

export function runSearch<TModel, TWhereInput, TOrderBy, TInclude>(
  dbDelegate: { findMany: Function; count: Function },
  options: BasePaginationOptions<TWhereInput, TOrderBy, TInclude> & { stream?: false }
): Promise<AllResults<TModel>>

// Implementation
export async function runSearch<TModel, TWhereInput, TOrderBy, TInclude>(
  dbDelegate: {
    findMany: (args: {
      where: TWhereInput; orderBy: TOrderBy; include?: TInclude
      skip?: number; take?: number; cursor?: { id: string }
    }) => Promise<TModel[]>
    count: (args: { where: TWhereInput }) => Promise<number>
  },
  { where, orderBy, include, page, pageSize, cursor, limit, batchSize = 100, maxNoPaginationLimit = 1000, stream = false }: any
): Promise<any> {
  if (stream) {
    async function* generator(): StreamResult<TModel> {
      let lastId: string | undefined
      while (true) {
        const batch = await dbDelegate.findMany({
          where, take: batchSize + 1,
          ...(lastId ? { skip: 1, cursor: { id: lastId } } : {}),
          orderBy, include
        })
        if (batch.length === 0) break
        if (batch.length > batchSize) { lastId = (batch.pop() as any)?.id } else { lastId = undefined }
        yield batch
        if (!lastId) break
      }
    }
    return generator()
  }

  if (cursor && limit) {
    const data = await dbDelegate.findMany({ where, take: limit + 1, skip: 1, cursor: { id: cursor }, orderBy, include })
    let nextCursor: string | undefined
    if (data.length > limit) { nextCursor = (data.pop() as any)?.id }
    return { data, nextCursor }
  }

  if (page && pageSize) {
    const [total, data] = await Promise.all([
      dbDelegate.count({ where }),
      dbDelegate.findMany({ where, skip: (page - 1) * pageSize, take: pageSize, orderBy, include })
    ])
    return { data, total, page, pageSize }
  }

  const totalCount = await dbDelegate.count({ where })
  if (totalCount > maxNoPaginationLimit) {
    throw new Error(`Too many results (${totalCount}). Please use pagination, streaming, or refine your filters.`)
  }
  const data = await dbDelegate.findMany({ where, orderBy, include })
  return {
    data,
    warning: totalCount > maxNoPaginationLimit / 2
      ? `Warning: returning ${totalCount} records without pagination may impact performance.`
      : undefined
  }
}
```

### Usage with full type inference

```ts
// workspaceMemberRepository
return runSearch<
  Prisma.WorkspaceMemberGetPayload<{ include: { member: true; workspace: true } }>,
  Prisma.WorkspaceMemberWhereInput,
  Prisma.WorkspaceMemberOrderByWithRelationInput,
  { member: true; workspace: true }
>(this.db.workspaceMember, { where, orderBy, include: { member: true, workspace: true }, ...options })

// itemRepository
return runSearch<
  Prisma.ItemGetPayload<{ include: { workspace: true; owner: true } }>,
  Prisma.ItemWhereInput,
  Prisma.ItemOrderByWithRelationInput,
  { workspace: true; owner: true }
>(this.db.item, { where, orderBy, include: { workspace: true, owner: true }, ...options })
```
