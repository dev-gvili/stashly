import { sessionContext } from '@/.server/middleware/context'
import { redirect } from 'react-router'
import {
  getSearchIndexStats,
  getSearchScopeLabel,
  searchItemsHybrid,
} from '@/services/search-actions'
import { SearchView } from '@/components/views/search-view'
import {
  buildItemFilters,
  itemFilterSchema,
} from '@/utils/filters/item.filters'
import { isSearchableQuery, parseSearchScope, SEARCH_SCOPE_KEY } from '@/utils/search-query'
import type { SearchResponse } from '@/types/stash.types'
import type { Route } from './+types/search'
import { parseSearchParams } from '@/utils/parsers'
import { parseOrRespond } from '@/utils/api.errors'
import { toSearchSchema } from '@/utils'
import type { Prisma } from '@/prisma/client'

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
  // Context for the `favorited` filter, which scopes to the viewer, not the owner.
  searchParams.set('currentUserId', session.user.id)

  const parsedParams = parseOrRespond(() => parseSearchParams({
    searchParams,
    schema: toSearchSchema<
      typeof itemFilterSchema,
      Prisma.ItemOrderByWithRelationInput,
      Prisma.ItemInclude
    >({ schema: itemFilterSchema }),
  }), 'text')

  const filters = buildItemFilters(parsedParams)

  const query = parsedParams.query ?? ''
  // `?in=folder:<id>` / `?in=collection:<id>`: search one place, not the drive.
  // The label and the search both check access to it, in the actions.
  const scope = parseSearchScope(searchParams.get(SEARCH_SCOPE_KEY))

  const [indexStats, scopeLabel] = await Promise.all([
    getSearchIndexStats(session.user.id),
    scope ? getSearchScopeLabel(session.user.id, scope) : null,
  ])

  if (!isSearchableQuery(query)) {
    return { me: session.user.id, results: EMPTY, indexStats, scope: scopeLabel }
  }

  const results = await searchItemsHybrid({
    ...parsedParams,
    query,
    ownerId: session.user.id,
    where: filters,
    scope: scopeLabel ? scope : null,
  })

  return { me: session.user.id, results, indexStats, scope: scopeLabel }
}

export default function Search({ loaderData }: Route.ComponentProps) {
  const { me, results, indexStats, scope } = loaderData

  return (
    <SearchView
      me={me}
      initialResults={results as unknown as SearchResponse}
      indexStats={indexStats}
      scope={scope}
    />
  )
}
