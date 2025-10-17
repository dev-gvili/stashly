import { inspect } from 'node:util'
import { parseSearchParams } from './parsers'
import { prisma } from '../.server/db'
import { parseArgs, type ParseArgsConfig } from 'node:util'
import { itemRepository } from '../.server/repositories/ItemRepository'
import type { ItemCategory, ItemType, Prisma } from '../.server/prisma/client'
import { subscriptionRepository } from '../.server/repositories/SubscriptionRepository'
import {
	buildItemFilters,
	itemFilterSchema,
} from '../.server/filters/item.filters'
import { toSearchSchema } from '../utils/converters'
import { z } from 'zod'
import { searchItems } from '../.server/services/search.service'
import {
	buildItemAlgoliaFilters,
	itemAlgoliaFilterSchema,
} from '../.server/filters/item.algolia.filters'

const options: ParseArgsConfig = {
	options: {
		json: { type: 'boolean' },
		itemId: { type: 'string' },
		ownerId: { type: 'string' },
		action: { type: 'string' },
		urlSearchParams: { type: 'string' },
	},
	allowPositionals: true,
	tokens: true,
} as const

async function main() {
	const {
		values: { itemId, ownerId, action, json, urlSearchParams },
		positionals,
		tokens,
	} = parseArgs(options)

	let item: any | null = null
	if (action === 'favorite') {
		item = await itemRepository.favorite(`${itemId!}`, `${ownerId}`)
	}
	if (action === 'unfavorite') {
		item = await itemRepository.unfavorite(`${itemId!}`, `${ownerId}`)
	}

	if (action === 'search') {
		// const searchParams = new URLSearchParams(`${urlSearchParams}`)

		// let params = parseSearchParams({
		// 	schema: itemAlgoliaFilterSchema.extend({ take: z.coerce.number() }),
		// 	searchParams,
		// })

		// console.log('Params: ', params)

		// const indexes = await searchItems({
		// 	...params,
		// 	mode: 'algolia',
		// 	buildFilters: buildItemAlgoliaFilters,
		// })
		// console.log(inspect({ indexes }, { colors: true, depth: null }))

		const searchParams = new URLSearchParams(`${urlSearchParams}`)

		let params = parseSearchParams({
			schema: itemFilterSchema,
			searchParams,
		})

		let algparams = parseSearchParams({
			schema: itemAlgoliaFilterSchema,
			searchParams,
		})

		let cursorId: string | undefined = undefined
		// For Postgres Search:
		// Paginate through all results
		console.log('Searching...')
		// while (true) {
			console.log('Postgres Search with params:', { ...params, cursorId })
			const items = await searchItems({
				...params,
				mode: 'postgres',
				include: { owner: true, workspace: true },
				buildFilters: buildItemFilters,
			})

			// For Algolia Search:
			console.log('Algolia Search with params:', { ...algparams })
			const hits = await searchItems({
				...algparams,
				mode: 'algolia',
				buildFilters: buildItemAlgoliaFilters,
			})

			console.log(inspect({ items }, { colors: true, depth: null }))
			console.log('inspect', { items: items.data?.length, hits: hits?.length })
			// console.log(inspect(items, { colors: true, depth: null }))
			// if (items.metadata.nextCursor) {
			// 	console.log(
			// 		inspect(
			// 			items.data.map((i) => ({ name: i.name })),
			// 			{ colors: true, depth: null }
			// 		)
			// 	)
			// 	console.log('Search From Cursor', items.metadata.previousCursor)
			// 	cursorId = items.metadata.nextCursor
			// }
			// console.log('Search Until Cursor', items.metadata.nextCursor)
			// if (items.metadata.isComplete) {
			// 	console.log(
			// 		inspect(
			// 			items.data.map((i) => ({ name: i.name })),
			// 			{ colors: true, depth: null }
			// 		)
			// 	)
			// 	console.log('Search Completed')
			// 	break
			// }
		// }
	}
	// if (action === 'search') {
	// 	const searchParams = new URLSearchParams(`${urlSearchParams}`)
	// 	const searchSchema = toZodSearchSchema<
	// 		typeof itemFilterSchema,
	// 		Prisma.ItemOrderByWithRelationInput
	// 	>(itemFilterSchema)

	// 	let params = parseSearchParams({
	// 		schema: searchSchema,
	// 		searchParams,
	// 	})

	// 	if (params.strategy === 'stream') {
	// 		for await (const batch of await itemRepository.search({
	// 			...params,
	// 			strategy: 'stream',
	// 		})) {
	// 			console.log(batch.data.map(i => ({name: i.name})))
	// 			if (batch.metadata.isComplete) break
	// 		}
	// 	}
	// 	if (params.strategy === 'cursor') {
	// 		while (true) {
	// 			let res = await itemRepository.search({
	// 				...params,
	// 				strategy: 'cursor',
	// 			})
	// 			if (res.metadata.nextCursor) {
	// 				params.cursor = res.metadata.nextCursor
	// 			}
	// 			if (res.metadata.isComplete) {
	// 				console.log('Pagination Complete')
	// 				break
	// 			}
	// 		}
	// 	}
	// 	if (params.strategy === 'offset') {
	// 		let res = await itemRepository.search({
	// 			...params,
	// 			page: 1,
	// 			take: 10,
	// 			strategy: 'offset',
	// 		})
	// 		console.log(res)
	// 	}
	// }
	if (action === 'stripeCustomerId') {
		item = await subscriptionRepository.findStripeCustomerId(`${ownerId}`)
	}
	if (action === 'prices') {
		item = await subscriptionRepository.listPrices()
	}
	if (json) {
		console.log(JSON.stringify(item, null, 2))
	} else {
		console.log(inspect(item, { colors: true, depth: null }))
	}
}

main()
	.then()
	.catch(console.error)
	.finally(() => prisma.$disconnect())
