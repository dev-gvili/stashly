# Semantic search: the index

How an uploaded file becomes searchable text and vectors. The query side is in
[search.md](search.md); the working rules are in the `stashly-search` skill.

Documents are split into passages of about 300 tokens and each passage is
embedded on its own, so a match can point at the passage that matched, and a
long document isn't cut off at the model's 512-token limit.

## Tables

Both in `prisma/models/search.prisma`.

| Table | One row per | Holds |
|---|---|---|
| `Search` | item | `content`: the whole extracted text, with a GIN trigram index (`search_content_trgm_idx`) for the keyword ranker. `vector`: a document-level vector, not used by the ranking |
| `SearchChunk` | passage | `ord`, `content`, `pageNum` (null for formats without pages), `section` (the nearest heading before the passage), `charStart` / `charEnd`, and its `vector(768)`. `SearchChunk_vector_idx` is an HNSW cosine index created in migration `20260815000000_search_query_indexes` (Prisma can't express it, so the schema only keeps the name) |

The locators are written at index time so a result can be highlighted without
chunking again.

## Where the text comes from

All in `extractMediaMetadata` (`app/utils/media-metadata.ts`), run by the
indexing machine for each upload:

- PDF: the text layer (`pdfText` in the compute worker, `extractPdfText` in
  `app/utils/pdf.ts`, at most 50 pages and 200,000 characters).
- Markdown: the `mdMeta` worker operation.
- Other text formats (source, config, data, `.txt`): `File.text()`, when
  `isIndexableTextFile` (`app/utils/text-files.ts`) accepts the file, capped at
  `MAX_INDEXED_TEXT_CHARS` (512 KB). Lockfiles and minified bundles are left out.
- PDFs with no text layer: OCR, page by page (below).

A file none of these accept gets no `Search` row and is found by name only.

## Pipeline

Indexing runs in `app/machines/indexing/` (see its README) for every upload
once its row exists, whether or not its card is on screen. Three machines:

1. **Metadata** (`indexing-item.machine.ts`), two at a time, right after each
   row lands. Extracts the text and posts `save_media_metadata` to
   `/api/items`. The server (`saveMediaMetadata` in
   `app/.server/search-actions.ts`) writes the facets and `Search.content`,
   splits the text with `chunkText` and replaces the item's chunks with
   `upsertSearchChunks`, then answers with the chunks to embed.
2. **Vectors** (`embed.machine.ts`). Embeds the chunks in the browser and posts
   them back with `save_search_chunk_embeddings`; `setSearchChunkVectors`
   writes them with raw SQL (Prisma can't write a `vector` column).
3. **OCR** (`ocr.machine.ts`). When a PDF's text comes back empty.

Vectors and OCR wait in a deferred lane while any upload is moving bytes
(tech-debt item 53). The server owns chunk text: the client only sends vectors
back.

`save_ocr_page` and `save_search_chunk_embeddings` are in
`SEARCH_INDEX_INTENTS` (`app/utils/revalidation.ts`), so they don't re-run the
page's loaders. `save_media_metadata` also writes displayed facets and does
revalidate.

Every index write requires `write` access on the item, checked in
`saveMediaMetadata`, `appendSearchPage` and `setSearchChunkVectors`.

### Chunking

`chunkText(text, { chunkChars = 1500, overlapChars = 250 })`: windows of
about 1,500 characters with 250 characters of overlap, ends snapped to a
sentence or line break near the window's end. `assignChunkSections` fills
`section` from the headings.

### Embedding

`Xenova/all-mpnet-base-v2`, 768 dimensions, mean-pooled and normalized, on
WebGPU in its own worker (`app/workers/embedding.worker.ts`;
`embedding.ai.ts` is its client). Every job goes through
`app/workers/ai-queue.ts`, so only one model uses the GPU at a time. A worker
that errors or loses its GPU device is ended and the next batch starts a new
one.

### OCR

`ocr.machine.ts` runs `streamOcrPdf` (`app/utils/thumbnail-ocr.ts`) on up to
`OCR_MAX_PAGES` (15) pages. Each page is rendered in the compute worker
(`pdfPageAt`), read by PaddleOCR PP-OCRv6 in `app/workers/paddle-ocr.worker.ts`,
and read again by GLM-OCR (`app/workers/ocr.ai.ts`) when PaddleOCR's page
confidence is below `PADDLE_FALLBACK_BELOW` (0.89), which is the case for
Hebrew. Each page is saved with `save_ocr_page` (`appendSearchPage`), and its
chunks go on to the vector machine. The engines are described in
[ai-pipeline.md](ai-pipeline.md) and the `stashly-ai-inference` skill;
measurements are in tech-debt item 54.

### Recovery

A tab closed before the vectors were posted leaves chunks with a null
`vector`. `useEmbeddingBackfill` (mounted in the app layout) asks for the
user's own unembedded chunks (`GET /api/items?intent=pending_search_embeddings`)
and embeds them on a later visit, one tab at a time. Files of a type that only
became indexable after they were uploaded are found by
`intent=reindex_candidates` and re-indexed with `reindex_text`
(`reindexTextItems`).

## Tunable parameters

| Constant | File | Value |
|---|---|---|
| `CHUNK_CHARS` | `app/.server/search-actions.ts` | 1500 |
| `OVERLAP_CHARS` | `app/.server/search-actions.ts` | 250 |
| `CHUNK_SCAN_DEPTH` | `app/.server/search-actions.ts` | 400 |
| `NAME_SIMILARITY_FLOOR` | `app/.server/search-actions.ts` | 0.2 |
| `SEMANTIC_SIMILARITY_FLOOR` | `app/.server/search-actions.ts` | 0.15 |
| `RANK_DEPTH` | `app/utils/search-query.ts` | 100 |
| `RRF_K` | `app/utils/search-query.ts` | 60 |
| `SEMANTIC_MIN_LENGTH` | `app/utils/search-query.ts` | 4 |
| `DEBOUNCE_MS` | `app/hooks/useItemSearch.ts` | 250 |
| `SEMANTIC_TIMEOUT_MS` | `app/hooks/useItemSearch.ts` | 45,000 |
| `MAX_INDEXED_TEXT_CHARS` | `app/utils/text-files.ts` | 512 KB |
| `extractPdfText` `maxPages` / `maxChars` | `app/utils/pdf.ts` | 50 / 200,000 |
| `OCR_MAX_PAGES` | `app/utils/ocr-engine.ts` | 15 |
| `PADDLE_MAX_PIXELS` | `app/workers/paddle-ocr.ai.ts` | 2,000,000 |
| `PADDLE_FALLBACK_BELOW` | `app/workers/paddle-ocr.ai.ts` | 0.89 |
| `REC_BATCH_SIZE` | `app/utils/paddle-ocr.ts` | 8 |
| `OCR_MAX_PIXELS` | `app/workers/ocr.ai.ts` | 14·14·4·1280 |
| `MAX_NEW_TOKENS` (GLM-OCR) | `app/workers/ocr.ai.ts` | 768 |

The vector size (768) is tied to the model and to the `vector(768)` columns;
changing the model needs a migration.

## Known gaps

- Search only covers items the user owns; items shared with them are not
  searched.
- A rename, description edit or new version doesn't re-chunk the item.
- Chunks the owner never comes back to embed stay without vectors; there is no
  server-side pass.
