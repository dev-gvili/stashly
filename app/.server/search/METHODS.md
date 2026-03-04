# Search Repository - Updated Methods

## Overview

Updated `search.repository.ts` with comprehensive methods for semantic and content-based searching with embeddings.

## New Methods Added

### Core Search Operations

#### `upsertSearchEmbedding(itemId, embedding, content?)`

- Creates or updates a search embedding for an item
- Uses raw SQL for vector field (which is Unsupported in Prisma)
- Returns the created/updated Search record

#### `deleteSearchEmbedding(itemId)`

- Deletes search embedding for a single item

#### `deleteSearchEmbeddingBatch(itemIds)`

- Deletes search embeddings for multiple items
- Returns count of deleted records

### Semantic Search

#### `semanticSearch(queryVector, topK)`

- Performs vector similarity search
- Returns top K most similar items ranked by cosine similarity

#### `semanticSearchWithFilters(queryVector, topK, filters?)`

- Semantic search with optional filtering
- Supported filters:
  - `workspaceId` - filter by workspace
  - `itemType` - filter by item type (file, folder, collection)
  - `excludeIds` - exclude specific items
- Uses safe parameterized queries

### Content-Based Search

#### `searchByContent(query, topK)`

- Case-insensitive content search
- Returns Search records matching the query
- Limited to top K results

### Record Management

#### `getSearchByItemId(itemId)`

- Get search record for a specific item

#### `getSearchByItemIds(itemIds)`

- Get search records for multiple items

#### `getAllSearchRecords(limit?, offset?)`

- Get all search records with pagination
- Default: 100 limit, offset 0

#### `countSearchRecords()`

- Total count of search records

#### `existsSearchEmbedding(itemId)`

- Check if embedding exists for an item

### Batch Operations

#### `upsertSearchEmbeddingBatch(items)`

- Batch upsert multiple embeddings
- Items format: `{ itemId, embedding, content? }[]`

### Maintenance

#### `updateSearchContent(itemId, content)`

- Update only the content field for a search record

#### `clearAllSearchEmbeddings()`

- Delete all search embeddings (use with caution)
- Returns count deleted

## Type Definitions

### SemanticSearchResult

```typescript
{
  id: string // Item ID
  similarity: number // Similarity score (0-1)
}
```

### SearchResult

```typescript
{
  id: string;
  itemId: string;
  content: string | null;
  similarity?: number;
  createdAt: Date;
  updatedAt: Date;
}
```

## Implementation Notes

1. **Vector Field**: The `vector` field is Unsupported in Prisma, so embeddings are managed via raw SQL
2. **SQL Safety**: Parameterized queries prevent SQL injection
3. **Transactions**: All batch operations use Promise.all() for parallel processing
4. **Error Handling**: Methods throw on missing records; use findUnique for safe queries

## Usage Examples

```typescript
import { searchRepository } from '@/search/search.repository'

// Upsert embedding
const embedding = [0.1, 0.2, 0.3, ...] // 768-dim vector
await searchRepository.upsertSearchEmbedding(itemId, embedding, "searchable content")

// Semantic search
const results = await searchRepository.semanticSearch(queryVector, 10)

// Filtered search
const filtered = await searchRepository.semanticSearchWithFilters(
  queryVector,
  10,
  {
    workspaceId: 'ws_123',
    itemType: 'file',
    excludeIds: ['item_1', 'item_2']
  }
)

// Content search
const contentResults = await searchRepository.searchByContent("query", 5)

// Batch upsert
await searchRepository.upsertSearchEmbeddingBatch([
  { itemId: 'item_1', embedding: vec1, content: 'content1' },
  { itemId: 'item_2', embedding: vec2, content: 'content2' },
])

// Exists check
const hasEmbedding = await searchRepository.existsSearchEmbedding(itemId)
```

## Security Considerations

✅ **Parameterized Queries** - All dynamic values use parameters  
✅ **Input Validation** - Prisma validation on all operations  
✅ **Read-only Operations** - Search queries don't modify data  
⚠️ **Batch Size** - Consider limiting batch sizes for very large operations
