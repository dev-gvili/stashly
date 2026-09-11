import { sessionContext } from '@/context'
import { redirect } from 'react-router'
import {
  getSearchIndexStats,
  searchItemsHybrid,
} from '@/services/search-actions'
import { SearchView } from '@/components/views/search-view'
import {
  buildItemFilters,
  itemFilterSchema,
} from '@/utils/filters/item.filters'
import { isSearchableQuery, clampTake } from '@/utils/search-query'
import type { SearchResponse } from '@/types/stash.types'
import type { Route } from './+types/search'
import { parseSearchParams } from '@/utils/parsers'

export { ErrorBoundary } from '@/components/error-boundary'

export function meta({ matches }: Route.MetaArgs) {
  const userName = matches[1].loaderData?.user.name
  return [
    { title: `Stashly - Search${userName ? ` ${userName}'s Stash` : ''}` },
    { description: 'Search your stash by name, tag, or meaning.' },
  ]
}

const EMPTY: SearchResponse = {
  items: [],
  total: 0,
  hasMore: false,
  semantic: false,
  keywordCount: 0,
  semanticCount: 0,
}

/**
 * Server-renders the keyword half so a shared `?q=…` link paints results
 * without waiting on client JS. The semantic upgrade can't happen here — the
 * embedding model runs in the browser — so `useItemSearch` layers it on after
 * hydration when the user is in semantic mode.
 */
export async function loader({ request, context }: Route.LoaderArgs) {
  const session = context.get(sessionContext)

  const searchParams = new URL(request.url).searchParams
  searchParams.set('owner', session.user.id)

  const parsedParams = parseSearchParams({
    searchParams,
    schema: itemFilterSchema
     
  })

  const filters = buildItemFilters(parsedParams)

  const indexStats = await getSearchIndexStats(session.user.id)

  if (!isSearchableQuery(parsedParams.query)) {
    return { me: session.user.id, results: EMPTY, indexStats }
  }

  const results = await searchItemsHybrid({
    ...parsedParams,
    ownerId: session.user.id,
    where: filters,
  })

  return { me: session.user.id, results, indexStats }
}

export default function Search({ loaderData }: Route.ComponentProps) {
  const { me, results, indexStats } = loaderData

  return (
    <SearchView
      me={me}
      initialResults={results as unknown as SearchResponse}
      indexStats={indexStats}
    />
  )
}
