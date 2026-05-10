# Semantic Search

Stashly uses **chunked, hybrid retrieval** — the same architecture every serious file-search product runs (Drive, OneDrive, M365 Copilot, Confluence). Documents are split into ~300-token passages, each embedded independently, and queries combine sparse keyword (`pg_trgm`) with dense vector (`pgvector`) signals at retrieval time.

Single-vector-per-document was deliberately rejected. See [§ Why chunk?](#why-chunk) for the rationale.

---

## Architecture at a glance

```
┌─────────────── INDEX TIME (per upload) ───────────────┐
│                                                       │
│  PDF / .txt / .md ──► extract text                   │
│                       (utils/pdf.ts)                  │
│        │                                              │
│        ▼                                              │
│  Server: chunkText (utils-grade pure fn)             │
│        │                                              │
│        ▼                                              │
│  upsertSearchChunks → SearchChunk rows (no vector)   │
│        │                                              │
│        ▼                                              │
│  Client: embedding.ai worker (WebGPU MPNet 768-dim)  │
│        │                                              │
│        ▼                                              │
│  setSearchChunkVectors (raw SQL, pgvector cast)      │
└───────────────────────────────────────────────────────┘

┌─────────────── QUERY TIME (per search) ───────────────┐
│  not yet wired — see § Roadmap below                  │
│                                                       │
│  Query string ──► sparse rank (pg_trgm)              │
│              ──► dense rank  (pgvector cosine)       │
│              ──► RRF fusion                           │
│              ──► top-k items + best chunk per item   │
└───────────────────────────────────────────────────────┘
```

---

## Schema

```prisma
model Search {
  id      String  @id          // 'srch_...'
  itemId  String  @unique
  content String? @db.Text     // document-level fallback (full extracted text)
  vector  Unsupported("vector(768)")?  // currently unused; reserved for doc-level dense search
  // ...
}

model SearchChunk {
  id        String  @id        // 'schk_...'
  itemId    String
  ord       Int                // 0-based position within the doc
  content   String  @db.Text   // ~1500-char passage
  pageNum   Int?               // null for non-paginated formats
  charStart Int                // offset into the cleaned full text
  charEnd   Int
  vector    Unsupported("vector(768)")?
  // ...
  @@unique([itemId, ord])
  @@index([vector], map: "SearchChunk_vector_idx")
}
```

`pageNum` / `charStart` / `charEnd` exist solely for **passage highlighting** in a future UI — capture them at index time so we never have to re-chunk.

---

## Index pipeline (today)

### 1. Server: chunking — `app/.server/search-actions.ts`

```typescript
chunkText(fullText, { chunkChars = 1500, overlapChars = 250 })
  → TextChunk[]   // { content, charStart, charEnd, pageNum }
```

- ~1500-char windows ≈ ~300 MPNet tokens (well under the 512-token limit)
- 250-char overlap (~50 tokens) preserves context across passage boundaries
- Snaps chunk ends to sentence/newline breaks within the trailing 200 chars
- Pure function (no Prisma dep) — works in browser or server

### 2. Server: persistence — `upsertSearchChunks(itemId, chunks)`

- Replaces (`deleteMany` + `createMany` in one transaction) rather than upserts; chunk boundaries shift when source text changes, so previous `ord` mappings aren't meaningful
- Returns `[{ id, ord, content }]` for the client to embed
- Server is authoritative for chunk text — client never sends content back, only vectors

### 3. Client: embedding — `app/workers/embedding.ai.ts`

- `Xenova/all-mpnet-base-v2`, 768-dim, mean-pooled and L2-normalized (recommended config for MPNet — vectors compare cleanly with cosine similarity)
- Runs through `app/workers/ai-queue.ts` shared with image-AI workers — only one WebGPU job at a time
- Batched: `embedTexts(texts: string[])` is meaningfully faster than per-call invocations due to model warm-up

### 4. Server: vector write — `setSearchChunkVectors([{ chunkId, vector }])`

- Raw SQL `UPDATE "SearchChunk" SET vector = $1::vector WHERE id = $2` — Prisma can't write `Unsupported(...)` columns directly
- All updates in one `prisma.$transaction` so partial writes don't leave the index half-populated
- Validates `vector.length === 768` before each update

### 5. Wire-up — `app/hooks/useThumbnail.ts` `saveMediaMetadata`

After the metadata POST returns, if the response contains `chunks: [{id, content}]`:
1. Lazy-import `@/workers/embedding.ai`
2. Call `embedTexts(chunks.map(c => c.content))`
3. POST `[{chunkId, vector}]` back via `save_search_chunk_embeddings` intent

Fire-and-forget — the file is usable in the gallery before the embedding completes.

---

## Why chunk?

Three forcing functions:

1. **Embedding model context limits.** MPNet has a max input of 512 tokens (~2,000 chars). A 50-page PDF would silently truncate to its first ~2 pages — the embedding represents only the intro, not the body. Industry-standard fix: chunk before embedding.

2. **What users search for.** *"Find that contract"* is document-level retrieval (filename + metadata + first page suffices). *"What does our termination clause say?"* is passage-level retrieval — only chunked indexing can find that. Stashly's "OSS Drive replacement" positioning has to handle both.

3. **What the leaders do.** Drive, OneDrive, M365 Copilot, Confluence, Notion, Slack — all chunk. The same pattern shows up in Anthropic's [Contextual Retrieval](https://www.anthropic.com/news/contextual-retrieval) (Sep 2024) and most public RAG references. Stashly is positioned as a reference implementation, so its search architecture should match the standard, not a simplified variant.

---

## Tunable parameters

| Constant | Location | Default | Notes |
|----------|----------|---------|-------|
| `CHUNK_CHARS` | `search-actions.ts` | 1500 | Higher = more context per chunk, but truncated by tokenizer past ~2000 |
| `OVERLAP_CHARS` | `search-actions.ts` | 250 | ~17% overlap. Raise if cross-passage queries underperform |
| `EMBEDDING_DIM` | `embedding.ai.ts` | 768 | Tied to MPNet; changing model also requires schema migration |
| `extractPdfText.maxPages` | `pdf.ts` | 5 | **Currently caps PDFs to first 5 pages** — see roadmap |
| `extractPdfText.maxChars` | `pdf.ts` | 20_000 | After per-page concat, total cap |

---

## Roadmap

### Shipped (2026-05-10)
- `SearchChunk` schema + raw SQL vector writes
- Chunking with sentence-snap and overlap
- Client-side WebGPU embedding worker, shared AI queue
- Wire-up from PDF upload completion

### Next slices
- **Query path.** Hybrid retrieval: `pg_trgm` (sparse) + `pgvector` cosine (dense), combined via Reciprocal Rank Fusion. Rolls chunk results up to items, returns top-N with the best-matching chunk highlighted. Probably ~120 lines of SQL + a route handler.
- **Server-side query embedding** decision. The client embedding worker can also embed query strings (round-trip cost) — vs. running an embedding service server-side. Trade-off: latency vs. server stateless-ness.
- **Per-page metadata for chunks.** Today `extractPdfText` joins pages with `\n\n` and discards page numbers. To populate `SearchChunk.pageNum`, extend `extractPdfText` to return `[{ pageNum, text }]` and pipe per-page chunking through.
- **Lift `maxPages` cap to ~50 pages / 200,000 chars** once chunked indexing is wired (the cap was sized for the prior single-vector approach).
- **Other text formats.** `.txt`, `.md` are trivial extensions of the same `documentText` flow. `.docx` via `mammoth`. Spreadsheets and presentations are larger feature work.
- **Backfill.** Existing items have no chunks. One-shot script: select items where `Search.content IS NOT NULL`, chunk + embed.
- **Re-embedding.** Rename / description-edit / version replacement should invalidate chunks. Today they don't — chunks become stale.

### Future improvements
- **Cross-encoder reranker** — `Xenova/ms-marco-MiniLM-L-6-v2` runs in the browser, takes the top-50 from RRF and re-scores them. ~35-50% relevance improvement at moderate latency cost.
- **Anthropic-style contextual retrieval** — at index time, prepend each chunk with a 1-sentence summary of how it fits in the broader doc, generated by a small LLM. ~35% retrieval improvement per Anthropic's published numbers. Adds an LLM call per chunk at index time, so cost/perf trade-off worth its own design conversation.
- **Hybrid weight tuning.** Default RRF treats sparse and dense ranks equally. May want to bias toward sparse for short queries, dense for long natural-language ones.

---

## Migration command

```bash
pnpm prisma migrate dev --name add_search_chunk
```

The schema change is additive — no risk to existing data. After the migration, new uploads index automatically; existing items will need the backfill script (TBD).
