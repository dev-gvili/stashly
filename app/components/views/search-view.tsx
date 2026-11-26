/**
 * Route-level view for `/:me/stash/search`.
 *
 * Deliberately renders no search input of its own — `AppHeader` already mounts
 * `<HeaderFilters />`, whose `SearchInput` (and its fuzzy/semantic toggle) is
 * wired to `useFilters`. That state lives entirely in the URL, so this view
 * reads the same `?q=` / `?searchMode=` params the header writes.
 */
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { Button } from '@/ui/button'
import { SelectionProvider } from '@/components/stash/selection'
import {
  CollectionFillIcon,
  FolderFillIcon,
  LoaderIcon,
  RemoveIcon,
} from '@/components/icons'
import {
  EvidenceCard,
  EvidenceCardSkeleton,
  EvidenceInspector,
  EvidenceRow,
  MatchGroup,
  SearchFilterBar,
  type MatchTier,
  type ResultSort,
  ResultsSummary,
  MATCH_KIND_ORDER,
  tokenizeQuery,
} from '@/components/views/search-components'
import {
  SearchIdleState,
  SearchNoResultsState,
  SearchNotIndexedNotice,
} from '@/components/states/search-empty-state'
import { EmbeddingBackfillStatus } from '@/components/core-components/embedding-backfill-status'
import { ReindexStatus } from '@/components/core-components/reindex-status'
import { useEmbeddingBackfillState } from '@/hooks/useEmbeddingBackfill'
import { useFilters } from '@/hooks/useFilters'
import { useIndexStats } from '@/hooks/useIndexStats'
import { useItemSearch } from '@/hooks/useItemSearch'
import { isBackfillActive } from '@/utils/embedding-backfill'
import { formatSearchScope, isSearchableQuery, SEARCH_SCOPE_KEY } from '@/utils/search-query'
import type { SearchDegradedReason } from '@/utils/search-query'
import { cn } from '@/utils/styles'
import type { SearchResponse } from '@/types/stash.types'

/** Human-readable explanation for each way semantic ranking can be skipped. */
const DEGRADED_COPY: Record<SearchDegradedReason, string> = {
  query_too_short:
    'Query too short to search by meaning — showing keyword matches.',
  no_webgpu:
    'This browser can’t run the embedding model (WebGPU unavailable) — showing keyword matches.',
  embedding_failed:
    'Couldn’t build a query embedding — showing keyword matches.',
  request_failed: 'Semantic search request failed — showing keyword matches.',
}

export interface SearchViewProps {
  /** Owner segment for links out of the empty state. */
  me: string
  /** Server-rendered first page for the incoming `?q=` URL. */
  initialResults: SearchResponse
  /** Index coverage at page load, refreshed live once a search runs. */
  indexStats: { indexedChunks: number; pendingChunks: number }
  /** The folder or collection the search is limited to (`?in=`), if any. */
  scope?: { kind: 'folder' | 'collection'; id: string; name: string } | null
}

export function SearchView({ me, initialResults, indexStats, scope }: SearchViewProps) {
  const filters = useFilters()
  const [searchParams, setSearchParams] = useSearchParams()
  const { query, searchMode } = filters.state

  // Every layout view self-gates on `searchParams.has('layout', …)` and renders
  // nothing when the param is absent, so a bare `/stash/search` link would show
  // an empty page. Seed the app-wide default, the same way
  // `breadcrumb-navigation` does when it navigates.
  const layout = searchParams.get('layout')
  useEffect(() => {
    if (layout) return
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.set('layout', 'grid')
        return next
      },
      { replace: true, preventScrollReset: true },
    )
  }, [layout, setSearchParams])

  const {
    items,
    total,
    hasMore,
    semantic,
    degradedReason,
    isLoading,
    loadMore,
    isLoadingMore,
    expandedTerms,
  } = useItemSearch({
    query,
    mode: searchMode,
    filters: {
      category: filters.state.category,
      type: filters.state.type,
    },
    // Only seed from the loader when the URL's query is what produced it.
    initialData: isSearchableQuery(query) ? initialResults : undefined,
    scope: scope ? formatSearchScope(scope) : null,
  })

  // Widen to the whole stash: drop `?in=` and keep everything else.
  const clearScope = () =>
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete(SEARCH_SCOPE_KEY)
        return next
      },
      { replace: true, preventScrollReset: true },
    )

  const searchable = isSearchableQuery(query)

  // Semantic was asked for, the query was long enough to embed, and the drive
  // still returned no dense hits — an index gap, not a miss.
  const notIndexed =
    searchMode === 'semantic' && searchable && !semantic && !degradedReason

  // Re-read coverage live rather than trusting the page-load snapshot: the
  // whole point of the status panel is watching the numbers move.
  //
  // Gated on the runner *working*, and nothing else. A backlog that no runner
  // is processing cannot change, so reading it repeatedly only asks the same
  // question again — and the previous condition also OR'd in the loader's
  // `pendingChunks`, a value frozen at page load that stayed true for the life
  // of the tab. With the runner idle this now issues zero requests.
  //
  // `isBackfillActive`, not `phase !== 'idle'`: the latter is also true for
  // `done`/`failed`/`skipped`, so a finished run left this reading every five
  // seconds until the tab closed.
  //
  // The key is `batches:active`, not `updatedAt`. `updatedAt` bumps on every
  // progress report, which meant one request every few seconds for the whole
  // run; this changes only when a batch lands or the runner starts or stops.
  // `backfill.embedded` fills the gap between those with the runner's own
  // confirmed count, so the bar moves per save without asking the server.
  const backfill = useEmbeddingBackfillState()
  const backfillActive = isBackfillActive(backfill.phase)
  const liveStats = useIndexStats(
    backfillActive,
    indexStats,
    `${backfill.batches}:${backfillActive}`,
    backfill.embedded
  )
  const hasBacklog = liveStats.pendingChunks > 0

  // Terms are what every highlight in the tree marks against, so they are
  // derived once here rather than per card.
  const terms = useMemo(() => tokenizeQuery(query), [query])

  // Grouped by *why* each result matched. Within a group the server's fused
  // order already holds, so this only partitions — it never re-sorts.
  // Sorting reorders within a group only: a group's order is part of what
  // it says (why these matched), and scores on different groups are on
  // different scales. It applies to the loaded results; Load more re-sorts.
  const [sort, setSort] = useState<ResultSort>('score')
  const groups = useMemo(
    () =>
      MATCH_KIND_ORDER.map((kind) => {
        const inGroup = items.filter((item) => item.matchKind === kind)
        return {
          kind,
          // `sort` is stable, so equal hit counts keep the server's order;
          // `inGroup` is a fresh array from `filter`, so sorting it in place is safe.
          items: sort === 'hits' ? inGroup.sort((a, b) => b.hitCount - a.hitCount) : inGroup,
        }
      }).filter((group) => group.items.length > 0),
    [items, sort],
  )

  // The tier narrows the loaded results to one match group. A tier whose
  // group a new search no longer has falls back to all, rather than showing
  // an empty page for a filter the bar no longer offers.
  const [tier, setTier] = useState<MatchTier>('all')
  const effectiveTier = groups.some((g) => g.kind === tier) ? tier : 'all'
  const visibleGroups =
    effectiveTier === 'all' ? groups : groups.filter((g) => g.kind === effectiveTier)
  const resetRefinements = () => {
    setTier('all')
    filters.clear('category')
  }

  // The result open in the inspector, by id, so it survives the list
  // re-rendering (Load more, the semantic upgrade) and closes when it leaves.
  const [inspectId, setInspectId] = useState<string | null>(null)
  const inspected = inspectId ? (items.find((item) => item.id === inspectId) ?? null) : null
  const listLayout = layout === 'list'

  return (
    <div className="flex h-full flex-col gap-3 py-3">
      {scope && (
        <div className="flex items-center gap-2 font-stashly text-sm text-muted-foreground">
          <span>Searching in</span>
          <span className="inline-flex h-7 min-w-0 items-center gap-1.5 rounded-[4px] bg-muted pl-2 pr-1 text-foreground">
            {scope.kind === 'folder' ? (
              <FolderFillIcon className="size-4 shrink-0" />
            ) : (
              <CollectionFillIcon className="size-4 shrink-0" />
            )}
            <span className="truncate">{scope.name}</span>
            <button
              type="button"
              onClick={clearScope}
              aria-label="Search your whole stash instead"
              className="flex size-5 shrink-0 items-center justify-center rounded-[4px] text-muted-foreground transition-colors duration-200 hover:bg-accent hover:text-foreground cursor-pointer"
            >
              <RemoveIcon className="size-3.5" />
            </button>
          </span>
        </div>
      )}
      {/* While loading, the skeleton cards below are the only signal: what
          the search is doing under the hood is no concern of the reader's
          (owner, 26 Nov). */}
      {searchable &&
        !isLoading && (
          <ResultsSummary
            state={{ query, mode: searchMode, expandedTerms }}
            totalCount={total}
            semanticRan={semantic}
            scoped={!!scope}
            indexedPassages={liveStats.indexedChunks}
          />
        )}

      {searchable && (groups.length > 0 || filters.state.category.length > 0) && (
        <SearchFilterBar
          tier={effectiveTier}
          onTierChange={setTier}
          tierCounts={groups.map((g) => ({ kind: g.kind, count: g.items.length }))}
          categories={filters.state.category}
          onToggleCategory={(id) => filters.toggleMulti('category', id)}
          onReset={resetRefinements}
          sort={sort}
          onSortChange={setSort}
        />
      )}

      {degradedReason && (
        <div
          className={cn(
            'rounded-md border border-input bg-card p-3',
            'font-stashly text-sm text-muted-foreground',
          )}
        >
          {DEGRADED_COPY[degradedReason]}
        </div>
      )}

      {/* Sits above the embedding panel because it is the earlier failure: a
          document with no extracted text has no passages to embed, so the
          embedding backfill would report a clean "nothing pending" while the
          file stays unsearchable. Hides itself when there is nothing stale. */}
      <ReindexStatus />

      {/* A backlog is worth showing whenever it exists — not only on a
          semantic miss — because it is the answer to "why is nothing
          indexing". Once it drains, the panel disappears on its own. */}
      {hasBacklog ? (
        <EmbeddingBackfillStatus
          pendingChunks={liveStats.pendingChunks}
          indexedChunks={liveStats.indexedChunks}
        />
      ) : (
        notIndexed &&
        liveStats.indexedChunks === 0 && (
          <SearchNotIndexedNotice pendingChunks={0} />
        )
      )}

      {!searchable ? (
        <SearchIdleState me={me} />
      ) : items.length === 0 && !isLoading ? (
        <SearchNoResultsState query={query} />
      ) : (
        <>
          <SelectionProvider items={items.map((item) => item.id)}>
            <div className="flex flex-col gap-8">
              {isLoading && items.length === 0
                ? // Same geometry as `MatchGroup`'s grid, so the placeholders
                  // sit exactly where the cards will land.
                  <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(min(100%,max(15rem,calc((100%_-_4rem)/5))),1fr))]">
                    {Array.from({ length: 8 }).map((_, index) => (
                      <EvidenceCardSkeleton key={index} />
                    ))}
                  </div>
                : visibleGroups.map((group) => (
                    <MatchGroup
                      key={group.kind}
                      kind={group.kind}
                      count={group.items.length}
                      layout={listLayout ? 'list' : 'grid'}
                    >
                      {group.items.map((item) =>
                        listLayout ? (
                          <EvidenceRow
                            key={item.id}
                            result={item}
                            query={query}
                            terms={terms}
                            expandedTerms={expandedTerms}
                            inspected={item.id === inspectId}
                            onPeek={() => setInspectId(item.id)}
                          />
                        ) : (
                          <EvidenceCard
                            key={item.id}
                            result={item}
                            query={query}
                            terms={terms}
                            expandedTerms={expandedTerms}
                            inspected={item.id === inspectId}
                            onPeek={
                              item.type === 'folder' ? undefined : () => setInspectId(item.id)
                            }
                          />
                        )
                      )}
                    </MatchGroup>
                  ))}
            </div>
          </SelectionProvider>
          {hasMore && (
            <div className="col-span-full flex justify-center py-4">
              <Button
                variant="outline"
                className="font-stashly"
                onClick={loadMore}
                disabled={isLoadingMore}
              >
                {isLoadingMore ? (
                  <>
                    <LoaderIcon className="size-4 animate-spin" />
                    Loading…
                  </>
                ) : (
                  'Load more'
                )}
              </Button>
            </div>
          )}
        </>
      )}

      <EvidenceInspector
        result={inspected}
        me={me}
        query={query}
        terms={terms}
        expandedTerms={expandedTerms}
        onClose={() => setInspectId(null)}
      />
    </div>
  )
}
