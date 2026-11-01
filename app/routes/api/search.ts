/**
 * `/api/search/:type` — the query side of the search feature.
 *
 * Two halves, because the two rankers have very different request shapes:
 *
 *   • `GET`  — keyword-only. Cheap, cacheable, works everywhere, and answers
 *     while the client's embedding model is still warming up.
 *   • `POST` — hybrid. Carries the browser-computed 768-dim query embedding,
 *     which is ~10KB as text and so cannot travel in a URL. It reads rather
 *     than mutates; the POST is purely a payload-size decision.
 *
 * Both are scoped to the session user's own items inside the ranking SQL.
 *
 * @see docs/semantic-search.md
 */
import { auth } from '@/services/auth'
import { getSearchIndexStats, searchItemsHybrid } from '@/services/search-actions'
import {
  searchApiRouteInput,
  searchApiRouteOutput,
  searchApiRouteQuery,
  searchScope,
} from '@/schemas/api.schemas'
import { parseOrRespond, rethrowAsResponse, toErrorInfo } from '@/utils/api.errors'
import { buildItemFilters } from '@/utils/filters/item.filters'
import { parseFormData, parseSearchParams } from '@/utils/parsers'
import { isSearchableQuery, normalizeQuery } from '@/utils/search-query'
import { data, redirect } from 'react-router'
import type { Route } from './+types/search'

/** Empty result, shared by the too-short-query and unknown-scope paths. */
const EMPTY = {
  items: [],
  total: 0,
  hasMore: false,
  semantic: false,
  keywordCount: 0,
  semanticCount: 0,
}

/**
 * Validate `:type` against the declared scopes so an unknown segment 404s
 * loudly instead of silently answering with an empty list.
 */
function assertScope(type: string | undefined) {
  const parsed = searchScope.safeParse(type)
  if (!parsed.success) {
    throw data({ error: `Unknown search scope: ${type}` }, { status: 404 })
  }
  return parsed.data
}

/** The structured half of the request — shared by both handlers. */
function filtersFor(input: {
  category?: string[]
  type?: string[]
  extension?: string[]
  tags?: string[]
}) {
  return buildItemFilters({
    ...(input.category?.length && { category: input.category }),
    ...(input.type?.length && { type: input.type }),
    ...(input.extension?.length && { extension: input.extension }),
    ...(input.tags?.length && { tags: input.tags }),
  } as Parameters<typeof buildItemFilters>[0])
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) throw redirect('/auth/sign-in')

  assertScope(params.type)

  const url = new URL(request.url)

  // The index-coverage probe is a separate concern from running a query: the
  // view asks for it once on mount to explain a thin semantic half, with no
  // query typed yet.
  if (url.searchParams.get('intent') === 'index_stats') {
    return data(await getSearchIndexStats(session.user.id))
  }

  // An absent or one-character `query` is the normal state of a search page, not
  // an error — answer with an empty result rather than a validation throw.
  if (!isSearchableQuery(url.searchParams.get('query') ?? '')) {
    return data(EMPTY)
  }

  const input = parseOrRespond(() =>
    parseSearchParams({
      schema: searchApiRouteQuery,
      searchParams: url.searchParams,
    })
  )

  const results = await searchItemsHybrid({
    ownerId: session.user.id,
    query: input.query,
    where: filtersFor(input),
    take: input.take,
    skip: input.skip,
  })

  return data(searchApiRouteOutput.parse(results))
}

export async function action({ request, params }: Route.ActionArgs) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) throw redirect('/auth/sign-in')

  assertScope(params.type)

  const input = await parseFormData({ request, schema: searchApiRouteInput }).catch(
    rethrowAsResponse
  )

  if (!isSearchableQuery(input.query)) return data(EMPTY)

  // The vector is user input — it round-trips through the browser — so a
  // malformed one has to become a 400 here rather than a Postgres cast error
  // inside the ranking query. `toVectorLiteral` (called by `searchItemsHybrid`)
  // enforces length and finiteness; JSON.parse enforces that it is even an
  // array.
  let vector: unknown
  try {
    vector = JSON.parse(input.vector)
  } catch {
    return data({ error: 'Malformed query embedding' }, { status: 400 })
  }

  try {
    const results = await searchItemsHybrid({
      ownerId: session.user.id,
      query: normalizeQuery(input.query),
      vector: vector as number[],
      where: filtersFor(input),
      take: input.take,
      skip: input.skip,
    })
    return data(searchApiRouteOutput.parse(results))
  } catch (e) {
    const err = toErrorInfo(e)
    // A bad vector is the client's fault (400); anything else is ours (500).
    const isVectorError = /vector|dim/i.test(err.message ?? '')
    return data(
      { error: err.message ?? 'Search failed' },
      { status: err.status ?? (isVectorError ? 400 : 500) },
    )
  }
}
