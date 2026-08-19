/**
 * Drives the search page: debounce, keyword-first retrieval, and the optional
 * upgrade to semantic ranking.
 *
 * The shape of this hook follows from where embedding happens. Vectors are
 * produced in the browser on WebGPU (`app/workers/embedding.ai.ts`), and the
 * first call has to download and warm up MPNet — seconds, not milliseconds.
 * Waiting for that before showing anything would make every search feel
 * broken, so each query runs in two passes:
 *
 *   1. **Keyword** — a `GET` that needs no model. Results paint immediately.
 *   2. **Semantic** — embed the query, `POST` the vector, replace the list
 *      with the fused ranking. Only when the user asked for semantic mode and
 *      the query is long enough to be worth embedding.
 *
 * Pass 2 is best-effort by design: no WebGPU, a model that won't load, or a
 * failed request all leave pass 1's results on screen and set
 * `degradedReason`, so the view can say *why* it stayed keyword-only instead
 * of silently ranking worse.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { SearchMode } from '@/types/filter.types'
import type { SearchResponse } from '@/types/stash.types'
import {
  SEARCH_PAGE_SIZE,
  isSearchableQuery,
  normalizeQuery,
  shouldEmbedQuery,
  type SearchDegradedReason,
  type SearchStatus,
} from '@/utils/search-query'
import { classifyDegradation, reportDegraded } from '@/utils/report-degraded'
import {
  collectCandidateTerms,
  pickExpandedTerms,
  queryWords,
} from '@/utils/search-expansion'

/** Keystroke settle time before a request goes out. */
const DEBOUNCE_MS = 250

/**
 * Longest a semantic upgrade may run before the view gives up and keeps the
 * keyword results. Generous, because the first query of a session pays for
 * the embedding model's download and warm-up — but bounded, because the
 * alternative is an indefinite spinner.
 */
const SEMANTIC_TIMEOUT_MS = 45_000

/** Reject after `ms`, leaving the underlying promise to settle unobserved. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Semantic search timed out after ${ms}ms`)),
      ms
    )
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (err) => {
        clearTimeout(timer)
        reject(err)
      }
    )
  })
}

const EMPTY: SearchResponse = {
  items: [],
  total: 0,
  hasMore: false,
  semantic: false,
  keywordCount: 0,
  semanticCount: 0,
}

export interface UseItemSearchParams {
  query: string
  mode: SearchMode
  /** Structured filters, forwarded verbatim as repeated query params. */
  filters?: {
    category?: string[]
    type?: string[]
    extension?: string[]
    tags?: string[]
  }
  take?: number
  /** Server-rendered first page, so a shared `?q=` URL paints without a fetch. */
  initialData?: SearchResponse
}

export interface UseItemSearch extends SearchResponse {
  status: SearchStatus
  /** Set when semantic was requested but keyword-only ran. */
  degradedReason: SearchDegradedReason | null
  /** Whether a request of any kind is in flight. */
  isLoading: boolean
  loadMore: () => void
  isLoadingMore: boolean
  /**
   * Words the query vector matched that the user never typed, for the snippet's
   * dotted highlight tier. Arrives after the results, and only in semantic
   * mode — the other modes have no expansion to show.
   */
  expandedTerms: string[]
}

/** Serialize filters into the repeated-param form both handlers parse. */
function appendFilters(
  target: URLSearchParams | FormData,
  filters: UseItemSearchParams['filters'],
) {
  if (!filters) return
  for (const [key, values] of Object.entries(filters)) {
    if (!values?.length) continue
    // `toZodArraySchema` accepts the comma-joined form used everywhere else
    // in the app's URLs (see `useFilters`).
    target.append(key, values.join(','))
  }
}

/**
 * Search the signed-in user's items.
 *
 * @example
 * const { state } = useFilters()
 * const { items, status, degradedReason } = useItemSearch({
 *   query: state.query,
 *   mode: state.searchMode,
 * })
 */
export function useItemSearch({
  query,
  mode,
  filters,
  take = SEARCH_PAGE_SIZE,
  initialData,
}: UseItemSearchParams): UseItemSearch {
  const [response, setResponse] = useState<SearchResponse>(initialData ?? EMPTY)
  const [status, setStatus] = useState<SearchStatus>(
    initialData?.items.length ? 'ready' : 'idle',
  )
  const [degradedReason, setDegradedReason] =
    useState<SearchDegradedReason | null>(null)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [expandedTerms, setExpandedTerms] = useState<string[]>([])

  // One controller per query generation. A new keystroke aborts the previous
  // generation's *both* passes — without this, a slow semantic response for
  // "rep" could land after the keyword response for "report" and overwrite it.
  const controllerRef = useRef<AbortController | null>(null)
  const skipRef = useRef(0)

  // The filter object is rebuilt every render by callers; comparing its
  // serialized form keeps the effect from re-firing on identical filters.
  const filterKey = JSON.stringify(filters ?? {})

  const buildParams = useCallback(
    (q: string, skip: number) => {
      const params = new URLSearchParams()
      params.set('query', q)
      params.set('take', String(take))
      params.set('skip', String(skip))
      appendFilters(params, filters)
      return params
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [take, filterKey],
  )

  /** Pass 1. Always runs — it is also the permanent path in fuzzy mode. */
  const fetchKeyword = useCallback(
    async (q: string, skip: number, signal: AbortSignal) => {
      const res = await fetch(
        `/api/search/items?${buildParams(q, skip).toString()}`,
        { signal },
      )
      if (!res.ok) throw new Error(`Search failed: ${res.status}`)
      return (await res.json()) as SearchResponse
    },
    [buildParams],
  )

  /**
   * Pass 2. Imported lazily so a session that never searches semantically
   * doesn't pull in the model wrapper — or trigger its weight download.
   */
  const fetchSemantic = useCallback(
    async (q: string, skip: number, signal: AbortSignal) => {
      const { embedText } = await import('@/workers/embedding.ai')
      const vector = await embedText(q)
      if (signal.aborted) return null

      const fd = new FormData()
      fd.append('intent', 'semantic_search')
      fd.append('query', q)
      fd.append('take', String(take))
      fd.append('skip', String(skip))
      fd.append('vector', JSON.stringify(vector))
      appendFilters(fd, filters)

      const res = await fetch('/api/search/items', {
        method: 'POST',
        body: fd,
        signal,
      })
      if (!res.ok) throw new Error(`Semantic search failed: ${res.status}`)
      // The vector rides back out with the results: pass 3 needs it to score
      // candidate expansions, and re-embedding the same query to get it again
      // would cost a second model round trip for a value already in hand.
      return { response: (await res.json()) as SearchResponse, vector }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [take, filterKey],
  )

  /**
   * Pass 3. Which words in the results the query vector actually matched.
   *
   * Runs after the list is on screen and never blocks it — nothing here
   * changes what was found, only how the snippets are marked. Queued at
   * `'background'` so a follow-up query embeds ahead of it.
   */
  const fetchExpansions = useCallback(
    async (
      q: string,
      items: SearchResponse['items'],
      queryVector: number[],
      signal: AbortSignal,
    ): Promise<string[]> => {
      const passages = items
        .map((item) => item.passage?.content)
        .filter((content): content is string => !!content)
      if (passages.length === 0) return []

      const candidates = collectCandidateTerms(passages, queryWords(q))
      if (candidates.length === 0) return []

      const { embedTexts } = await import('@/workers/embedding.ai')
      const vectors = await embedTexts(candidates, undefined, 'background')
      if (signal.aborted) return []

      return pickExpandedTerms(candidates, vectors, queryVector)
    },
    [],
  )

  useEffect(() => {
    const q = normalizeQuery(query)
    controllerRef.current?.abort()
    skipRef.current = 0

    // Expansions belong to the query that produced them. Clearing here rather
    // than when the new ones arrive stops the previous search's dotted marks
    // sitting over the next search's snippets.
    setExpandedTerms([])

    if (!isSearchableQuery(q)) {
      setResponse(EMPTY)
      setStatus('idle')
      setDegradedReason(null)
      return
    }

    const controller = new AbortController()
    controllerRef.current = controller
    const { signal } = controller

    const timer = setTimeout(async () => {
      const wantsSemantic = mode === 'semantic'
      setStatus(wantsSemantic ? 'upgrading' : 'keyword')
      setDegradedReason(null)

      try {
        const keyword = await fetchKeyword(q, 0, signal)
        if (signal.aborted) return
        setResponse(keyword)
        setStatus(wantsSemantic ? 'upgrading' : 'ready')
      } catch (e) {
        if (signal.aborted) return
        console.error('[search] keyword pass failed', e)
        setStatus('error')
        return
      }

      if (!wantsSemantic) return

      if (!shouldEmbedQuery(q)) {
        // Long enough to search, too short to embed usefully.
        setDegradedReason('query_too_short')
        setStatus('ready')
        return
      }

      try {
        // Hard ceiling on the upgrade. The embedding runs on a queue shared
        // with background AI work, and the first call of a session also
        // downloads model weights — so "slow" is normal and "never" is
        // possible. Without this the view sits on "Ranking by meaning…"
        // forever with keyword results already on screen behind it.
        const semantic = await withTimeout(
          fetchSemantic(q, 0, signal),
          SEMANTIC_TIMEOUT_MS
        )
        if (signal.aborted || !semantic) return
        setResponse(semantic.response)
        setStatus('ready')

        // Pass 3, fire and forget. The list is already on screen and correct;
        // this only decides which words in it get the dotted tier, so a
        // failure here must leave the search entirely intact.
        void fetchExpansions(q, semantic.response.items, semantic.vector, signal)
          .then((terms) => {
            if (!signal.aborted) setExpandedTerms(terms)
          })
          .catch((e) => {
            if (signal.aborted) return
            console.warn('[search] expansion pass failed', e)
          })
      } catch (e) {
        if (signal.aborted) return
        // Keyword results are already on screen — this downgrades the
        // ranking, it doesn't fail the search.
        const timedOut = e instanceof Error && /timed out/.test(e.message)
        if (timedOut) {
          console.warn('[search] semantic upgrade timed out', e)
          setDegradedReason('request_failed')
        } else {
          const reason = classifyDegradation(e)
          reportDegraded('search_query', reason)
          setDegradedReason(
            reason === 'webgpu_unavailable' ? 'no_webgpu' : 'embedding_failed',
          )
        }
        setStatus('ready')
      }
    }, DEBOUNCE_MS)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, mode, filterKey, fetchKeyword, fetchSemantic, fetchExpansions])

  /**
   * Append the next page.
   *
   * Offset-based rather than cursor-based: results are ordered by a fused
   * relevance score that exists only for the duration of the request, so
   * there is no row to anchor a cursor to. Deliberately keyword-only — paging
   * would otherwise re-embed the same query per page for a ranking the server
   * already truncated at `RANK_DEPTH`.
   */
  const loadMore = useCallback(() => {
    const q = normalizeQuery(query)
    if (!isSearchableQuery(q) || isLoadingMore || !response.hasMore) return

    setIsLoadingMore(true)
    const nextSkip = skipRef.current + take
    const controller = new AbortController()

    fetchKeyword(q, nextSkip, controller.signal)
      .then((page) => {
        skipRef.current = nextSkip
        setResponse((current) => ({
          ...page,
          items: [...current.items, ...page.items],
          // The freshly-fetched page is authoritative about what follows it.
          hasMore: page.hasMore,
        }))
      })
      .catch((e) => {
        if (controller.signal.aborted) return
        console.error('[search] load more failed', e)
      })
      .finally(() => setIsLoadingMore(false))
  }, [query, take, isLoadingMore, response.hasMore, fetchKeyword])

  return {
    ...response,
    status,
    degradedReason,
    isLoading: status === 'keyword' || status === 'upgrading',
    loadMore,
    isLoadingMore,
    expandedTerms,
  }
}
