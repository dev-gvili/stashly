# Search: queries and list filters

Two different things are called "search" in the code:

- **Search** the feature: a query typed at `/:me/stash/search`, ranked by
  keyword and meaning. Entry point `searchItemsHybrid` in
  `app/.server/search-actions.ts`.
- **List queries**: the paginated, filtered listing every action file uses
  (folders, collections, activity, shares…), built with `searchFactory` from
  `app/utils/search.ts`. No ranking, just a `where` clause.

How text and vectors get into the index is in
[semantic-search.md](semantic-search.md). Working rules are in the
`stashly-search` skill.

## The search feature

### Request flow

`app/routes/stash/search.tsx` renders `app/components/views/search-view.tsx`,
driven by `useItemSearch` (`app/hooks/useItemSearch.ts`). Each query, after a
250 ms debounce, goes out twice:

| Pass | Request | Needs the model |
|---|---|---|
| 1, keyword | `GET /api/search/items?q=…` | No. Paints at once |
| 2, semantic | embed the query in the browser, then `POST /api/search/items` with the vector | Yes. Replaces the list with the fused ranking |

Pass 2 is a `POST` only because a 768-number vector doesn't fit in a URL.
`items` is the only scope (`searchScope` in `app/schemas/api.schemas.ts`); any
other `:type` answers 404. The vector comes from the browser, so
`toVectorLiteral` (`app/utils/search-query.ts`) checks its length and that
every value is finite, and a bad one answers 400.

Pass 2 is best-effort. When it can't run, pass 1's results stay and
`degradedReason` says why: `query_too_short` (under `SEMANTIC_MIN_LENGTH`, 4
characters), `no_webgpu`, `embedding_failed`, `request_failed` (including the
45 s timeout). A semantic failure never empties the results. Query-time
failures are reported to `/api/metrics` under the `search_query` stage.

`app/utils/search-expansion.ts` explains semantic results, which contain none
of the typed words: after results paint, it picks up to 6 words from the
passages that are close to the query vector and marks them in a second,
dotted highlight. It does not change the ranking.

### Ranking

In `app/.server/search-actions.ts`, called through `rankSearchResults`:

- **`rankByKeyword`**: trigram `word_similarity()` and `ILIKE` over
  `Item.name`, tags and `Search.content`. `word_similarity()` scores the best
  matching part of a long text, where `similarity()` would score a one-word
  query against a whole document near zero.
- **`rankByVector`**: the `CHUNK_SCAN_DEPTH` (400) nearest chunks by cosine
  distance, then one best passage per item (`DISTINCT ON` in the outer query,
  so the inner `ORDER BY vector <=> … LIMIT` can use the HNSW index). Chunks
  under `SEMANTIC_SIMILARITY_FLOOR` (0.15) are dropped.
- **Fusion**: `reciprocalRankFusion` (`app/utils/search-query.ts`) combines the
  two lists by rank, `1 / (RRF_K + rank)` with `RRF_K = 60`, in TypeScript so
  it is unit-tested. Each ranker contributes up to `RANK_DEPTH` (100) items.
- **Hydration**: the fused ids are loaded in one query and put back in fused
  order. Filters (category, type…) apply here, so they narrow the top matches
  rather than search the whole drive.

Every ranking query is limited to `ownerId = <session user>` and live items
inside the SQL. Items shared with the user are not searched.

Each result carries a `MatchKind`, decided on the server because only the
server sees `Search.content`:

| Kind | Meaning |
|---|---|
| `name` | the query is in the name |
| `content` | the query is in the text; `splitQueryTerms` is shared with the hit counter so the two agree |
| `fuzzy` | a trigram match on the name (a typo); no score or snippet is shown |
| `semantic` | close by meaning only |

Scores shown are real cosine similarities, scaled so the top result is 100. A
line number is shown only when the stored text has lines (OCR text does;
`cleanText` flattens the rest), never invented.

### View

`app/components/views/search-components/`: `EvidenceCard` (one result and its
evidence), `MatchBadge`, `ScoreBadge`, `SnippetBlock`, `HighlightedText`,
`MatchGroup` (results grouped by kind), `ResultsSummary`. The display logic is
in `app/utils/search-evidence.ts` (`tokenizeQuery`, `highlightSegments`,
`toEvidenceSnippet`, `scoreBand`) and unit-tested. When nothing is indexed yet,
`getSearchIndexStats` lets the view say so instead of showing an empty
semantic result.

### Tests

`app/utils/__tests__/`: `search-query`, `search-expansion`,
`search-evidence`, `search-api-output`, `markdown-sections`. E2E:
`tests/e2e/search.spec.ts`. The ranking SQL is `$queryRaw`, which `tsc`
doesn't check; run it against the dev database (CLAUDE.md → Verification).

## List queries

### `searchFactory`

```typescript
const itemSearch = searchFactory({
  dbDelegate: prisma.item,
  buildFilters: buildItemFilters,
  defaultOrderBy: () => ({ createdAt: 'desc' }),
})
await itemSearch({ strategy: 'cursor', take: 20, ownerId, include: { … } })
```

`strategy` is `offset`, `cursor` or `stream`. `buildFilters` turns the
high-level params into a Prisma `where`. Pass `include` / `select` explicitly;
there is no default.

### Filters

One file per model in `app/utils/filters/` (`item.filters.ts`,
`activity.filters.ts`, …), built from `createFilter` and `buildFiltersFactory`
in `app/utils/filters.ts`, with the Zod shape next to it
(`itemFilterSchema`).

- A filter turns validated params into a `where`. It checks shape, never
  authority: the action that runs the query checks access.
- `buildFiltersFactory` applies a param only when its key is in the filter
  map. A schema key with no filter adds **no constraint**, silently, and the
  query returns more rows than intended.
  `app/utils/__tests__/item-filters-coverage.test.ts` fails when the item
  schema and filter keys differ.
