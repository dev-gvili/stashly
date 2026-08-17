# Semantic Search

Stashly is built toward **chunked, hybrid retrieval** — the same architecture every serious file-search product runs (Drive, OneDrive, M365 Copilot, Confluence). Documents are split into ~300-token passages and each is embedded independently; the eventual query path combines sparse keyword (`pg_trgm`) with dense vector (`pgvector`) signals at retrieval time.

**Status:** both sides ship. The index side writes chunks and vectors on upload; the query side fuses `pg_trgm` and `pgvector` ranks with Reciprocal Rank Fusion at `/api/search/:type`, surfaced at `/:me/stash/search`.

Single-vector-per-document was deliberately rejected. See [§ Why chunk?](#why-chunk) for the rationale.

---

## Architecture at a glance

```
┌─────────────── INDEX TIME (per upload) ───────────────┐
│                                                       │
│  Client: PDF (utils/pdf.ts) / .md (utils/markdown.ts)│
│          ──► documentText  (.txt not wired yet)      │
│        │                                              │
│        ▼                                              │
│  Server: chunkText (utils-grade pure fn)             │
│        │                                              │
│        ▼                                              │
│  upsertSearchChunks → SearchChunk rows (no vector)   │
│        │                                              │
│        ▼                                              │
│  Client: embedding.ai (WebGPU MPNet 768-dim)         │
│        │                                              │
│        ▼                                              │
│  setSearchChunkVectors (raw SQL, pgvector cast)      │
└───────────────────────────────────────────────────────┘

┌─────────────── QUERY TIME (per search) ───────────────┐
│                                                       │
│  Query string                                         │
│    │                                                  │
│    ├─► GET /api/search/items  (pass 1, no model)     │
│    │      └─► rankByKeyword (pg_trgm)                │
│    │                                                  │
│    └─► embedText (WebGPU, browser)                   │
│           └─► POST /api/search/items + vector        │
│                 ├─► rankByKeyword  (sparse)          │
│                 ├─► rankByVector   (pgvector cosine) │
│                 └─► RRF fusion ──► hydrate items     │
│                       + best chunk per item          │
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

### 0. Client: OCR fallback for PDFs with no text layer

A scanned PDF — or an export whose pages are images — extracts to **zero
characters**. It uploads fine, thumbnails fine, and is silently unfindable by
content, because `save_media_metadata` only indexes `if (documentText)`.

When `extractPdfText` returns empty, `extractMediaMetadata` renders the pages
and reads them with a vision model instead:

```
pdfText → '' ──► compute({ kind: 'pdfPages' })   // rasterize, in the worker
                   └─► ocrPages()                 // GLM-OCR, main thread + WebGPU
                         └─► documentText ──► normal chunk + embed path
```

**Model:** `onnx-community/GLM-OCR-ONNX` at q4f16 (~623MB: decoder 322MB,
vision encoder 251MB, embeddings 50MB). Purpose-built for document
transcription, 0.9B parameters, 94.62 on OmniDocBench v1.5.

It replaced `onnx-community/Qwen3-VL-2B-Instruct-ONNX`, and the reason is
worth recording. Qwen was picked for the one thing GLM-OCR doesn't document:
**Hebrew**. Qwen names it among 32 OCR languages; Z.ai publishes only "8
languages" without listing them. That choice was reversed on measurement —
Qwen3-VL ran at **~4 tok/s on integrated graphics** (Intel Gen12LP, WebGPU
confirmed active), about three minutes for a dense page. Generation is one
forward pass per token, so decoder size is the lever: 322MB against 949MB at
the same quantization.

**Hebrew quality is therefore an open, empirical question.** If RTL
transcription comes back wrong, `MODEL_ID` in `ocr.ai.ts` is a one-constant
revert — the surrounding plumbing is model-agnostic.

### Model comparison — measured, not argued

Three models were run over the same 15-page image-only PDF on the same
integrated GPU (Intel Gen12LP). Decoder size predicts speed almost exactly —
and speed turned out not to be the deciding factor.

| Model | Decoder | s/page | chars/page | Usable output? |
|---|---|---|---|---|
| Qwen3-VL-2B | 949 MB | ~200 | — | Correct, unusably slow |
| **GLM-OCR 0.9B** | **322 MB** | **31.8** | **453** | **Yes — clean prose, correct reading order** |
| Florence-2 base-ft | 61 MB | 9.1 | 476 | **No — see below** |

Florence-2 is 3.5× faster than GLM-OCR and extracts *the same volume* of text.
It is still the wrong choice, and only the raw output shows why:

```
GLM-OCR:    "...browser-side WebGPU AI inference, XState 5 orchestration,
             and real-time PostgreSQL reactivity."

Florence-2: "...Browser-side Side PU ATinference, Xstate 5 ororch"
```

Florence-2 produces no word separation (`Architecture ofCLIENT:BROWSER`),
interleaves diagram labels into body text because it has no reading-order
model, and garbles technical terms (`PINTURE`, `Fidge Functions`,
`REAL 1.6BOSE CAKING`). `WebGPU AI inference` becomes `PU ATinference` — a
phrase search that succeeds against GLM-OCR's text returns nothing against
Florence-2's.

It is a 0.23B general vision model with an `<OCR>` task token, built for scene
text; GLM-OCR is purpose-built for document transcription. **`chars/page` is a
worthless quality metric on its own** — the two models scored within 5% of each
other while producing text of completely different value. Always read the
sample.

The Florence-2 implementation is kept at `app/workers/ocr-florence.ai.ts` and
selectable via `ocr-engine.ts`, so this can be re-measured rather than
re-argued.

### Other measured findings that shaped the config:

- **Per-component dtype barely matters here.** Moving Qwen's vision encoder
  and embeddings from q4f16 to fp16 cost ~900MB of download and left
  throughput unchanged (4.6 tok/s before, 3.3–4.5 after). Decoding dominates.
- **Greedy decoding loops on sparse pages.** A diagram page with ~1,700
  characters of real text still burned the full 768-token budget. Hence
  `repetition_penalty` and `no_repeat_ngram_size`, so the model reaches EOS
  when it genuinely runs out of text.

No new dependency: `GlmOcrForConditionalGeneration` ships in
`@huggingface/transformers` 4.2.0 and `glm_ocr` is registered in
`MODEL_FOR_IMAGE_TEXT_TO_TEXT_MAPPING`. GLM-OCR is task-tuned rather than
instruction-tuned, so the prompt is the terse `Text Recognition:` label rather
than a conversational request.

Cost control, since this is the most expensive thing in the pipeline:

| Guard | Value | Why |
|---|---|---|
| Trigger | only on zero extracted chars | a PDF with a text layer never loads the model |
| Import | lazy `import('@/workers/ocr.ai')` | a session that meets no scanned PDF never downloads weights |
| `OCR_MAX_PAGES` | 6 | each page is a full autoregressive generation; 12 was 35+ min per upload on integrated graphics |
| `MAX_NEW_TOKENS` | 768 | decoding dominates page latency, ahead of image size |
| Render budget | `OCR_MAX_PIXELS` | the processor's `smart_resize` downscales to ~1.0M px regardless, so rendering above it is wasted rasterization |
| `do_sample` | false | sampling invents text that was never on the page — worse than a gap |
| Queue | `enqueue` **per page**, `'background'` | one job per document starved interactive search for minutes; per-page yields let a query jump the queue |

Rasterization runs in the compute worker (`pdfPages`, 180s budget vs. the 30s
used for thumbnail ops); inference runs on the main thread through
`ai-queue.ts`, like every other model in the app. Failures report to
`/api/metrics` under the `ocr` stage and leave the document indexed by name
and tags — exactly what it would have been anyway.

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

- `Xenova/all-mpnet-base-v2` via `@huggingface/transformers`, `device: 'webgpu'`, `dtype: 'q4'`
- 768-dim, mean-pooled and L2-normalized (`{ pooling: 'mean', normalize: true }` — the recommended config for MPNet; vectors compare cleanly with cosine similarity)
- Despite living under `app/workers/`, this is a plain module on the main thread (same pattern as `thumbnail.ai.ts`) — compute is offloaded to WebGPU rather than to a Worker
- Runs through `app/workers/ai-queue.ts` shared with image-AI work — only one WebGPU job at a time
- Batched: `embedTexts(texts: string[])` is meaningfully faster than per-call invocations due to model warm-up

### 4. Server: vector write — `setSearchChunkVectors([{ chunkId, vector }])`

- Raw SQL `UPDATE "SearchChunk" SET vector = $1::vector WHERE id = $2` — Prisma can't write `Unsupported(...)` columns directly
- All updates in one `prisma.$transaction` so partial writes don't leave the index half-populated
- Validates `vector.length === 768` before each update

### 5. Wire-up — `app/hooks/useThumbnailV2.ts` `runMetadataPipeline`

Kicked off (unawaited) from `useThumbnailV2().run` right after the stage-2 resize, for every file type regardless of whether a thumbnail was produced:

1. `extractMediaMetadata(file)` → `documentText` for PDF / Markdown
2. POST `save_media_metadata` to `/api/items`; the handler calls `upsertSearchContent` + `chunkText` + `upsertSearchChunks` and returns `chunks: [{id, ord, content}]`
3. Lazy-import `@/workers/embedding.ai`, call `embedTexts(chunks.map(c => c.content))`
4. POST `[{chunkId, vector}]` back to `/api/items` via the `save_search_chunk_embeddings` intent

Fire-and-forget — the file is usable in the gallery before the embedding completes.

**Failure mode:** the whole pipeline is wrapped in one `try/catch` that logs to `console.error` and reports a `metadata_pipeline` counter to `/api/metrics` (see `app/utils/report-degraded.ts`) — but it does not retry inline. A vector-count mismatch likewise logs and bails. Because embedding is client-side, closing the tab before step 4 leaves the chunk rows with `vector` NULL.

**Recovery:** those rows are healed on a later visit by `useEmbeddingBackfill` (mounted in the authenticated layout), which fetches the user's NULL-vector chunks via the `pending_search_embeddings` intent and re-runs them through the same model. It only fires when that owner returns — a document whose owner never comes back stays unembedded, which is what the remaining server-side pass in the [Roadmap](#roadmap) would cover.

---

## Query pipeline (today)

### 1. Two passes, not one

Query embedding runs in the browser on the same WebGPU model the index side
uses, so the first search of a session pays for model download and warm-up.
Blocking results on that would make search feel broken, so `useItemSearch`
issues two requests per query:

| Pass | Request | Needs the model? | Purpose |
|------|---------|------------------|---------|
| 1 | `GET /api/search/items?q=…` | No | Paints immediately. The permanent path in fuzzy mode and on browsers without WebGPU. |
| 2 | `POST /api/search/items` + `vector` | Yes | Replaces the list with the fused hybrid ranking. |

Pass 2 is a `POST` purely because a 768-float embedding is ~10KB as text and
will not fit in a URL — nothing is mutated.

### 2. Sparse ranker — `rankByKeyword`

`similarity()` is length-normalized across the whole string, so a one-word
query against a 20,000-char document body scores near zero. `word_similarity()`
compares the query against the best-matching *extent* instead, which is the
correct operator here. Matches on `Item.name` (trigram + `ILIKE`), `tags`, and
`Search.content`.

### 3. Dense ranker — `rankByVector`

Takes the `CHUNK_SCAN_DEPTH` nearest chunks by cosine distance, then rolls them
up to one best passage per item with `DISTINCT ON`. The roll-up is in the
*outer* query on purpose: the inner `ORDER BY vector <=> $1 LIMIT n` is the
shape an HNSW index can answer, and moving `DISTINCT ON` inside would force a
scan of every chunk the user owns.

### 4. Fusion — `reciprocalRankFusion`

The two rankers produce incomparable scores (trigram similarity vs. cosine
distance), so they are combined by *rank*: each list contributes
`1 / (k + rank)` per document, `k = 60`. Fusion happens in TypeScript rather
than SQL — it keeps each query readable and puts the ranking maths somewhere
unit tests can reach (`app/utils/__tests__/search-query.test.ts`).

### 5. Hydration

Fused ids are hydrated in one Prisma `findMany` using the same select shape as
`getFolderContent`, then re-sorted into fused order. Structured filters
(category, type, …) are applied during hydration, which means they narrow the
top `RANK_DEPTH` matches rather than searching the whole drive with the filter
pre-applied — see the note on `searchItems`.

### Scope and permissions

Every ranking query is scoped to `ownerId = session.user.id AND status =
'normal'` **inside the SQL**, not layered on afterwards. Items shared with the
user are not searchable yet.

### Fallbacks

Semantic ranking is best-effort. Each of these leaves pass 1's results on
screen and sets `degradedReason`, which the view renders as a one-line
explanation rather than silently ranking worse:

| Reason | Trigger |
|--------|---------|
| `query_too_short` | Under `SEMANTIC_MIN_LENGTH` (4 chars) — trigrams do better on fragments |
| `no_webgpu` | Browser can't run the model at all |
| `embedding_failed` | Model loaded but inference threw |
| `request_failed` | The `POST` itself failed |

A separate case is a drive with **nothing indexed**: semantic mode returns no
dense hits because there are no embedded chunks, not because nothing matched.
`getSearchIndexStats` feeds `SearchNotIndexedNotice` so the UI says so.

Query-time embedding failures report to `/api/metrics` under the
`search_query` stage, distinct from the index-time `embedding` stage.

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
| `RANK_DEPTH` | `search-query.ts` | 100 | Items per ranker before fusion. Also caps how deep filtered results can go |
| `RRF_K` | `search-query.ts` | 60 | RRF smoothing. Lower = top ranks dominate more |
| `CHUNK_SCAN_DEPTH` | `search-actions.ts` | 400 | Chunks pulled before roll-up. Raise if long docs crowd out other items |
| `SEMANTIC_MIN_LENGTH` | `search-query.ts` | 4 | Below this, skip embedding and stay keyword-only |
| `DEBOUNCE_MS` | `useItemSearch.ts` | 250 | Keystroke settle time before a request goes out |
| `EMBEDDING_DIM` | `embedding.ai.ts` | 768 | Tied to MPNet; changing model also requires schema migration |
| `extractPdfText.maxPages` | `pdf.ts` | 50 | Raised from 5 once chunked indexing shipped |
| `extractPdfText.maxChars` | `pdf.ts` | 200_000 | After per-page concat, total cap |
| `OCR_MAX_PAGES` | `ocr.ai.ts` | 6 | Pages sent to the vision model; each is a full generation pass |
| `OCR_MAX_PIXELS` | `ocr.ai.ts` | 14·14·4·1280 | Pixel budget for OCR renders; matches the processor’s `smart_resize` default |
| `MAX_NEW_TOKENS` | `ocr.ai.ts` | 768 | Generation ceiling per page — the dominant latency lever |

---

## Roadmap

### Shipped
- `SearchChunk` schema + raw SQL vector writes (migration `20260526182115_add_on_delete_cascade_on_search_item_field`)
- Chunking with sentence-snap and overlap
- Client-side WebGPU embedding module, shared AI queue
- Wire-up from PDF upload completion
- **Markdown indexing.** `.md` body text flows through the same `documentText` path as PDFs (`extractMediaMetadata` → `mdMeta`), so `.md` uploads are chunked and embedded too.
- **Query path.** Hybrid retrieval — `pg_trgm` (sparse) + `pgvector` cosine (dense) fused with RRF, rolled up to items with the best-matching passage highlighted. `rankByKeyword` / `rankByVector` / `rankSearchResults` / `searchItems` in `search-actions.ts`, served by `app/routes/api/search.ts` and surfaced by `app/components/views/search-view.tsx`.
- **Query embedding location.** Resolved: client-side, matching the index side. No server-side inference and no new dependency; browsers without WebGPU degrade to keyword-only rather than losing search.
- **Query-path indexes.** `search_content_trgm_idx` (GIN trigram on `Search.content`) and an HNSW replacement for the useless btree on `SearchChunk.vector` — migration `20260815000000_search_query_indexes`.
- **Lifted the `maxPages` cap** to 50 pages / 200,000 chars, now that chunked indexing makes extra pages into extra searchable passages rather than tokenizer-truncated waste.
- **OCR fallback** for PDFs with no text layer — `app/workers/ocr.ai.ts`, triggered from `extractMediaMetadata` only when extraction yields zero characters. See [§ OCR fallback](#0-client-ocr-fallback-for-pdfs-with-no-text-layer).

### Next slices
- **Per-page metadata for chunks.** Today `extractPdfText` joins pages with `\n\n` and discards page numbers. To populate `SearchChunk.pageNum`, extend `extractPdfText` to return `[{ pageNum, text }]` and pipe per-page chunking through.
- **Other text formats.** `.txt` and code files are trivial extensions of the same `documentText` flow (`.md` already ships). `.docx` via `mammoth`. Spreadsheets and presentations are larger feature work.
- **Backfill.** Existing items have no chunks, and any upload whose tab closed before the embedding POST has chunks with `vector` NULL. Nothing recovers either case today. One-shot script: select items where `Search.content IS NOT NULL`, chunk + embed.
- **Re-embedding.** Rename / description-edit / version replacement should invalidate chunks. Today they don't — chunks become stale.

### Future improvements
- **Cross-encoder reranker** — `Xenova/ms-marco-MiniLM-L-6-v2` runs in the browser, takes the top-50 from RRF and re-scores them. ~35-50% relevance improvement at moderate latency cost.
- **Anthropic-style contextual retrieval** — at index time, prepend each chunk with a 1-sentence summary of how it fits in the broader doc, generated by a small LLM. ~35% retrieval improvement per Anthropic's published numbers. Adds an LLM call per chunk at index time, so cost/perf trade-off worth its own design conversation.
- **Hybrid weight tuning.** Default RRF treats sparse and dense ranks equally. May want to bias toward sparse for short queries, dense for long natural-language ones.

---

## Migration

The `SearchChunk` table already exists — it landed in `prisma/migrations/20260526182115_add_on_delete_cascade_on_search_item_field/migration.sql` alongside its `itemId`, `vector`, and `(itemId, ord)` indexes.

The query path adds one migration, `20260815000000_search_query_indexes`:

```shell
pnpm prisma migrate dev
```

It is a **performance** change, not a correctness one — search returns the same
results before and after, just with sequential scans. Two statements:

- `search_content_trgm_idx` — GIN trigram on `Search.content`, so the sparse
  ranker's `word_similarity()` / `ILIKE` are indexed. `Item.name` already had
  the equivalent (`item_name_trgm_idx`).
- `SearchChunk_vector_idx` — dropped and recreated as **HNSW** with
  `vector_cosine_ops`. It was created as a plain btree, which cannot answer an
  `ORDER BY vector <=> $1` nearest-neighbour query, so the dense ranker was
  scanning every chunk the owner has. The name is kept so it still lines up
  with the `@@index([vector], map: "SearchChunk_vector_idx")` declaration in
  `prisma/models/search.prisma` — Prisma cannot express an HNSW index with an
  operator class, so the DDL lives in the migration while the schema keeps the
  name.

Both schema changes are additive — no risk to existing data. New uploads index
automatically. Items whose chunks were written but never embedded are picked up
by `useEmbeddingBackfill` the next time their owner opens the app; items that
were never chunked at all still need a re-index pass (TBD).
