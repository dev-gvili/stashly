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
8. [searchItems Service (Postgres + Algolia)](#8-searchitems-service-postgres--algolia)
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

## 8. searchItems Service (Postgres + Algolia)

`src/services/searchService.ts` supports two search modes: `'postgres'` and `'algolia'`.

```typescript
type SearchMode = 'postgres' | 'algolia'

export async function searchItems<TParams>(opts: SearchOptions<TParams>) {
  const { mode, limit = 20, page } = opts

  if (mode === 'postgres') {
    const where = buildFilters(rest as TParams)

    if (page !== undefined) {
      // Offset pagination with _relevance ordering
      return prisma.item.findMany({
        where,
        orderBy: { _relevance: { fields: ['name'], search: opts.query!, sort: 'desc' } },
        skip: (page - 1) * limit,
        take: limit,
        include,
      })
    }

    // Cursor pagination
    let items = await prisma.item.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursorId ? { cursor: { id: cursorId } } : {}),
      include,
    })
    const hasMore = items.length > limit
    const data = hasMore ? items.slice(0, limit) : items
    const nextCursor = hasMore ? items[limit]?.id : undefined
    return { data, metadata: { take: limit, count: data.length, previousCursor: cursorId, nextCursor, isComplete: !nextCursor } }
  }

  if (mode === 'algolia') {
    // Build Algolia filter string from category/type/tags
    const { results } = await client.searchForHits({
      requests: [{ indexName: ALGOLIA_INDEX, query, filters, hitsPerPage: limit, page }],
    })
    return results[0].hits
  }
}
```

### Algolia Client Setup

```typescript
const client = algoliasearch(
  process.env.ALGOLIA_APP_ID!,
  process.env.VITE_ALGOLIA_SEARCH_KEY!
)
```

**Note:** Use `algoliasearch` as a **default import**, not named import:

```typescript
import algoliasearch from 'algoliasearch'  // correct
// import { algoliasearch } from 'algoliasearch'  // wrong — no initIndex method
```

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
