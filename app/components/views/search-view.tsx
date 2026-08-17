/**
 * Route-level view for `/:me/stash/search`.
 *
 * Deliberately renders no search input of its own — `AppHeader` already mounts
 * `<HeaderFilters />`, whose `SearchInput` (and its fuzzy/semantic toggle) is
 * wired to `useFilters`. That state lives entirely in the URL, so this view
 * reads the same `?q=` / `?searchMode=` params the header writes.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router'
import { Button } from '@/ui/button'
import { ListLayout } from '@/components/views/list-view'
import { SelectionProvider } from '@/components/stash/selection'
import { LoaderIcon } from '@/components/icons'
import {
  EvidenceCard,
  EvidenceCardSkeleton,
  MatchGroup,
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
import { useItemSearch } from '@/hooks/useItemSearch'
import { isSearchableQuery } from '@/utils/search-query'
import type { SearchDegradedReason } from '@/utils/search-query'
import { cn } from '@/utils/styles'
import type { SearchResponse, StashItem } from '@/types/stash.types'

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
}

export function SearchView({ me, initialResults, indexStats }: SearchViewProps) {
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
    status,
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
  })

  const searchable = isSearchableQuery(query)

  // Semantic was asked for, the query was long enough to embed, and the drive
  // still returned no dense hits — an index gap, not a miss.
  const notIndexed =
    searchMode === 'semantic' && searchable && !semantic && !degradedReason

  // Re-read coverage live rather than trusting the page-load snapshot: the
  // whole point of the status panel is watching the numbers move. Polls while
  // there is a backlog to watch, or while the runner is mid-flight.
  const backfill = useEmbeddingBackfillState()
  const liveStats = useIndexStats(
    indexStats.pendingChunks > 0 || backfill.phase !== 'idle',
    indexStats,
    backfill.updatedAt
  )
  const hasBacklog = liveStats.pendingChunks > 0

  // Terms are what every highlight in the tree marks against, so they are
  // derived once here rather than per card.
  const terms = useMemo(() => tokenizeQuery(query), [query])

  // Grouped by *why* each result matched. Within a group the server's fused
  // order already holds, so this only partitions — it never re-sorts.
  const groups = useMemo(
    () =>
      MATCH_KIND_ORDER.map((kind) => ({
        kind,
        items: items.filter((item) => item.matchKind === kind),
      })).filter((group) => group.items.length > 0),
    [items],
  )

  return (
    <div className="flex h-full flex-col gap-3 py-3">
      {searchable &&
        (isLoading ? (
          <div className="flex items-center gap-2 font-stashly text-sm text-muted-foreground">
            <LoaderIcon className="size-4 animate-spin" />
            <span>
              {status === 'upgrading' ? 'Ranking by meaning…' : 'Searching…'}
            </span>
          </div>
        ) : (
          <ResultsSummary
            state={{ query, mode: searchMode, expandedTerms }}
            totalCount={total}
            terms={terms}
            semanticRan={semantic}
          />
        ))}

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
          {/* `ListLayout` still self-gates on `?layout=list`. The grid half
              can't reuse `GridLayout` — each group owns its own grid, and
              nesting sections inside a CSS grid would lay them out as cells. */}
          <SelectionProvider items={items.map((item) => item.id)}>
            <ListLayout items={items as StashItem[]} />
            <GroupedResults>
              {isLoading && items.length === 0
                ? // Same geometry as `MatchGroup`'s grid, so the placeholders
                  // sit exactly where the cards will land.
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-[repeat(auto-fill,minmax(16rem,1fr))]">
                    {Array.from({ length: 8 }).map((_, index) => (
                      <EvidenceCardSkeleton key={index} />
                    ))}
                  </div>
                : groups.map((group) => (
                    <MatchGroup
                      key={group.kind}
                      kind={group.kind}
                      count={group.items.length}
                    >
                      {group.items.map((item) => (
                        <EvidenceCard
                          key={item.id}
                          result={item}
                          query={query}
                          terms={terms}
                          expandedTerms={expandedTerms}
                        />
                      ))}
                    </MatchGroup>
                  ))}
            </GroupedResults>
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
    </div>
  )
}

/**
 * The grid half of the layout, gated on `?layout=grid` exactly as `GridLayout`
 * is — search groups its results, so it stacks sections instead of cells, but
 * the two halves must still agree on which one the URL is asking for.
 */
function GroupedResults({ children }: { children: ReactNode }) {
  const [searchParams] = useSearchParams()
  if (!searchParams.has('layout', 'grid')) return null
  return <div className="flex flex-col gap-8">{children}</div>
}

/**
 * Index coverage, re-read from the server while `enabled`.
 *
 * The page loader's snapshot goes stale the moment the client-side backfill
 * embeds anything, which is exactly when the "not indexed" notice should stop
 * showing. Polling only while the notice is on screen keeps this to zero extra
 * requests in the normal case.
 */
function useIndexStats(
  enabled: boolean,
  initial: { indexedChunks: number; pendingChunks: number },
  /** Bump to re-read immediately — passed the runner's `updatedAt`. */
  revalidateKey?: number,
) {
  const [stats, setStats] = useState(initial)

  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()

    const read = () =>
      fetch('/api/search/items?intent=index_stats', {
        signal: controller.signal,
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((body) => body && setStats(body))
        .catch(() => null)

    void read()
    // Belt and braces: `revalidateKey` catches every phase change, and the
    // interval covers a batch that finishes between them.
    const timer = setInterval(read, 5_000)
    return () => {
      clearInterval(timer)
      controller.abort()
    }
  }, [enabled, revalidateKey])

  return stats
}
