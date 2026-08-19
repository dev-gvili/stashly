---
name: stashly-search
description: Stashly search — the hybrid sparse/dense ranking in search-actions.ts, the SearchChunk passage store, the two-phase keyword-then-semantic client flow, query expansion, evidence cards, and the reindex/backfill intents. Load when working on search ranking, the search view, search API routes, chunking, or the search index in the Stashly repo.
---

# Stashly Search

Hybrid retrieval: a sparse (trigram/substring) ranker and a dense (pgvector) ranker are fused with **Reciprocal Rank Fusion**. Server logic is `app/.server/search-actions.ts` (~1300 lines, the single owner); routes are `app/routes/api/search.ts` (query) and `app/routes/api/items.ts` (index writes); the view is `app/routes/stash/search.tsx` → `app/components/views/search-view.tsx`.

Long-form background lives in `docs/search.md` and `docs/semantic-search.md` — read those before changing ranking behaviour.

## The two-phase client flow

Embedding happens **in the browser** on WebGPU, and the first query of a session pays for MPNet's download and warm-up. So `app/hooks/useItemSearch.ts` runs every query twice:

| Pass | Request | Needs a model? |
|------|---------|----------------|
| 1 — keyword | `GET /api/search/:type` | No. Paints immediately. |
| 2 — semantic | embed query → `POST` the vector to the same route | Yes. Replaces the list with the fused ranking. |

Pass 2 is **best-effort**: no WebGPU, a model that won't load, a failed request, or a 45s timeout all leave pass 1's results on screen and set `degradedReason` so the view can say *why* it stayed keyword-only. Never make a semantic failure blank the results. Debounce is 250 ms.

The query vector is user input (it round-trips through the browser), so `POST` must reject a malformed one as a 400 — `toVectorLiteral` enforces length and finiteness before it reaches Postgres.

## Data model

Two tables, both in `prisma/models/search.prisma`:

- **`Search`** — one row per item. `content` is the whole document body; carries a document-level vector plus a `gin_trgm_ops` index (`search_content_trgm_idx`) that answers the sparse half's `word_similarity()` / `ILIKE`.
- **`SearchChunk`** — one row per ~300-token passage. Carries `pageNum`, `section` (nearest preceding heading), `charStart`/`charEnd`, and its own vector. **Write the locators at index time** — the point is never having to re-chunk to highlight a passage.

`section` is what gives non-paginated formats (`.md`, `.txt`) a locator at all: "§ Why chunk?" where a PDF says "page 5".

## Ranking rules

- **Never fabricate a locator.** `lineNum` is `null` when the stored body has no line structure — `cleanText` collapses whitespace runs, so only the OCR path (which joins pages with `\n\n`) keeps newlines. Returning `1` for everything else is a fabricated value and is explicitly forbidden (see CLAUDE.md → Data Honesty).
- **Scores are real cosine values**, normalized so the leader is 100. RRF's raw sum has no absolute meaning, so the normalization is the only honest thing it can express: *how this result compares with the best one found*.
- `SEMANTIC_SIMILARITY_FLOOR = 0.15` is deliberately low — a ~1,500-char chunk against a three-word query scores well below 1.0 even when it quotes the query verbatim. Don't raise it by intuition; raise it with the displayed scores as evidence.
- `CHUNK_SCAN_DEPTH = 400` is deeper than `RANK_DEPTH = 100` because one long document can occupy many nearest chunks; `DISTINCT ON` collapses them back to items before fusing.
- `splitQueryTerms` is shared by the sparse ranker and the match-detail query **on purpose**. If they disagree, an item ranks on a word the hit counter never looks for and comes back `hitCount: 0` while sitting in the `content` group.

**`MatchKind`** (`'name' | 'content' | 'fuzzy' | 'semantic'`) is derived **server-side**, ordered by how much the user can trust it. Only the server sees `Search.content`; the client has a single passage and would mislabel any document whose literal hits fall outside it.

`fuzzy` and `semantic` are the two *no literal evidence* kinds and are told apart by **which ranker produced the id**: `rankByVector` builds `ids` and `passages` from the same array, so an id with no detail row and no entry in `ranking.passages` can only have come from the trigram half (`similarity(name, query) > NAME_SIMILARITY_FLOOR`) — a typo match, with no embedding involved. Merging the two labelled every typo "closest by meaning", which in fuzzy mode is a claim about a model that never ran. Neither kind renders a score or a snippet: `name` and `fuzzy` have nothing to quote, and a fused-rank number on a trigram match is not a similarity.

The vector-nearest chunk and the chunk containing the typed words are routinely different passages — that is semantic retrieval working. Don't quote the dense passage under a "2 hits" label.

## Query expansion

`app/utils/search-expansion.ts` — client-side, embedding-based. `collectCandidateTerms` gathers up to `EXPANSION_MAX_CANDIDATES` (24), `pickExpandedTerms` keeps at most `EXPANSION_MAX_TERMS` (6) above `EXPANSION_MIN_SIMILARITY` (0.35). Tuning constants live at the top of the file with their rationale; keep them there rather than inlining numbers.

## View

`app/components/views/search-components/` — barrel-exported. `EvidenceCard` is the unit: a result is a claim plus the evidence for it (`MatchBadge`, `ScoreBadge`/`ScoreMeter`, `SnippetBlock`, `HighlightedText`). `MatchGroup` groups by `MatchKind`, `ResultsSummary` heads the list. Pure helpers (`tokenizeQuery`, `highlightSegments`, `toEvidenceSnippet`, `passageLocator`, `scoreBand`) live in `search-helpers.ts` and are unit-tested — put new display logic there, not in a component.

## Index writes

All through `POST /api/items` intents:

| Intent | Writes |
|--------|--------|
| `save_ocr_page` | one OCR'd page into `Search.content` (`appendSearchPage`) |
| `save_search_chunk_embeddings` | vectors onto existing `SearchChunk` rows |
| `reindex_text` | re-chunks text items (`reindexTextItems`) |
| `reindex_candidates` (GET) | items whose index is thin or missing |

**These two must not trigger revalidation** — see `app/utils/revalidation.ts` and the `isSearchIndexSubmission` predicate. A 15-page OCR submits ~30 times; before the guard each submission re-ran the route loader *and* the thumbnail presign loader. Any new background index-write intent belongs in `SEARCH_INDEX_INTENTS`. An intent that also writes displayable facets (like `save_media_metadata`) does **not** — it must still revalidate.

## Tests

`app/utils/__tests__/`: `search-query.test.ts`, `search-expansion.test.ts`, `search-evidence.test.ts`, `search-api-output.test.ts`, `markdown-sections.test.ts`. E2E: `tests/e2e/search.spec.ts`. Ranking SQL is `$queryRaw` and invisible to `tsc` — verify it against the dev DB with `npx tsx --env-file=.env <script.ts>`.
