// services/searchService.ts
import { Prisma, type Item } from '@/prisma/client'
import { prisma } from '@/services/db'
import { algoliasearch } from 'algoliasearch'
import type {
	ItemHit,
	SearchOptions,
	SearchReturn,
	SearchMode,
} from './search.types'

import { config } from '@dotenvx/dotenvx'
import { buildItemAlgoliaFilters } from '../filters/item.algolia.filters'

config()

const ALGOLIA_APP_ID = process.env.ALGOLIA_APP_ID!
const ALGOLIA_ADMIN_KEY = process.env.ALGOLIA_ADMIN_KEY!
const ALGOLIA_INDEX = process.env.ALGOLIA_INDEX || 'items_index'

let algoliaClient: ReturnType<typeof algoliasearch> | null = null
function getAlgoliaClient() {
	if (!algoliaClient) {
		algoliaClient = algoliasearch(ALGOLIA_APP_ID, ALGOLIA_ADMIN_KEY)
	}
	return algoliaClient
}

export async function searchItems<
	TParams,
	TMode extends SearchMode = 'postgres',
	TInclude extends Prisma.ItemInclude | undefined = undefined
>(opts: SearchOptions<TParams, TMode> & { include?: TInclude }) {
	const { take = 10, query, include, ...rest } = opts

	if (rest.mode === 'postgres') {
		const { buildFilters, cursorId, orderBy } = rest
		const where = buildFilters(rest as TParams)
		const items = await prisma.item.findMany({
			where,
			orderBy,
			include,
			...(cursorId ? { cursor: { id: cursorId } } : {}),
			take: take + 1,
		})

		const hasMore = items.length > take
		const data = hasMore ? items.slice(0, take) : items
		const nextCursor = hasMore ? items[take]?.id : undefined

		return {
			data,
			metadata: {
				take: take,
				count: data.length,
				previousCursor: cursorId,
				nextCursor,
				isComplete: !nextCursor,
			},
		}
	}

	if (rest.mode === 'algolia') {
		const { page, buildFilters } = rest
		const filters = buildFilters(rest as TParams)

		console.log('Filters:', filters)

		const { results } = await getAlgoliaClient().searchForHits<ItemHit>({
			requests: [
				{
					indexName: ALGOLIA_INDEX,
					query,
					attributesToRetrieve: ['*'],
					filters: filters,
					hitsPerPage: take,
					page: page ? page - 1 : 0,
				},
			],
		})

		return results[0].hits as SearchReturn<TInclude, TMode>
	}

	throw new Error(`Unsupported search mode: ${opts.mode}`)
}
