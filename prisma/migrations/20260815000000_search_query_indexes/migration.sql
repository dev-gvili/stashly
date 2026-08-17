-- Indexes for the search query path (hybrid retrieval).
--
-- Both halves of `rankSearchResults` work without these — Postgres falls back
-- to sequential scans — so this migration is a performance change, not a
-- correctness one. Search functions before it is applied.

-- ─── Sparse half ──────────────────────────────────────────────────────────
-- `rankByKeyword` runs `word_similarity($query, s."content")` and
-- `s."content" ILIKE '%…%'`. A trigram GIN index answers both. `Item.name`
-- already has the equivalent from `20251127001530_update_item_indexes`
-- (`item_name_trgm_idx`); this is the missing half on document bodies.
CREATE INDEX IF NOT EXISTS "search_content_trgm_idx"
  ON "Search" USING GIN ("content" gin_trgm_ops);

-- ─── Dense half ───────────────────────────────────────────────────────────
-- `SearchChunk_vector_idx` was created as a plain btree by
-- `20260526182115_add_on_delete_cascade_on_search_item_field`. Btree cannot
-- answer an `ORDER BY vector <=> $1` nearest-neighbour query, so the dense
-- ranker was scanning every chunk the user owns. Replace it with HNSW using
-- the cosine opclass, which is what `<=>` needs.
--
-- Kept under the same index name so it still lines up with the
-- `@@index([vector], map: "SearchChunk_vector_idx")` declaration in
-- `prisma/models/search.prisma` — Prisma cannot express an HNSW index with an
-- operator class, so the DDL lives here while the schema keeps the name.
--
-- m=16 / ef_construction=64 are pgvector's defaults: good recall at a build
-- cost that stays reasonable as the table grows.
DROP INDEX IF EXISTS "SearchChunk_vector_idx";

CREATE INDEX "SearchChunk_vector_idx"
  ON "SearchChunk" USING hnsw ("vector" vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
