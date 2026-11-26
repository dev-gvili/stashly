import { useCallback } from 'react'
import { useFetcher } from 'react-router'
import type { SearchPassage } from '@/types/stash.types'

type HitPassagesResponse = { total: number; passages: SearchPassage[] } | { error: string }

/**
 * The passage around every literal hit in one search result, loaded on
 * demand (the first time the card's hit stepper is used), never with the list.
 *
 * The fetcher is keyed by item and query, so a new query starts empty and a
 * second card for the same item and query shares the load.
 *
 * @param itemId - The result's item.
 * @param query - The query as searched; the server finds its terms again.
 *
 * @example
 * const hits = useHitPassages(result.id, query)
 * <button onClick={hits.load}>Next hit</button>
 * hits.passages?.[index] // → the passage to show, once loaded
 */
export function useHitPassages(itemId: string, query: string) {
  const fetcher = useFetcher<HitPassagesResponse>({ key: `hit-passages:${itemId}:${query}` })
  const loaded = fetcher.data && 'passages' in fetcher.data ? fetcher.data : null

  const load = useCallback(() => {
    if (fetcher.state !== 'idle' || fetcher.data) return
    const params = new URLSearchParams({ intent: 'hit_passages', itemId, query })
    fetcher.load(`/api/search/items?${params.toString()}`)
  }, [fetcher, itemId, query])

  return {
    passages: loaded?.passages ?? null,
    total: loaded?.total ?? null,
    loading: fetcher.state === 'loading',
    failed: !!fetcher.data && 'error' in fetcher.data,
    load,
  }
}
