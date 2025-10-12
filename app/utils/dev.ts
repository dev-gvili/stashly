import { inspect } from 'node:util'
import { parseSearchParams } from './parsers'
import { prisma } from '../.server/db'
import { parseArgs, type ParseArgsConfig } from 'node:util'
import { itemRepository } from '../.server/repositories/ItemRepository'
import type { Prisma } from '../.server/prisma/client'
import { subscriptionRepository } from '../.server/repositories/SubscriptionRepository'
import {
	buildItemFilters,
	itemFilterSchema,
} from '../.server/filters/item.filters'
import { toZodSearchSchema } from '../utils/converters'
import { z } from 'zod'
import {initEmbeddingModel, encodeText} from '../services/embeddings'


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
	await initEmbeddingModel()
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
		const searchSchema = toZodSearchSchema<
			typeof itemFilterSchema,
			Prisma.ItemOrderByWithRelationInput
		>(itemFilterSchema)

		// Infer the type from the Zod schema to ensure `params` is strongly typed.
		type SearchParams = z.infer<typeof searchSchema>

		let params = parseSearchParams({
			schema: searchSchema,
			searchParams: new URLSearchParams(`${urlSearchParams}`),
		})

		console.log('url search params: ', params)
		console.log('build item filters: ', buildItemFilters(params))

		if (params.strategy === 'stream') {
			// The `search` function is now correctly typed, so we can pass `params` directly.
			for await (const batch of await itemRepository.search({
				...params,
				strategy: 'stream',
			})) {
				console.log(
					'stream started: ',
					inspect(
						{
							data: batch.data.map((i) => ({
								id: i.id,
							})),
							metadata: batch.metadata,
						},
						{ colors: true, depth: null }
					)
				)
				if (batch.metadata.isComplete) {
					break
				}
			}
		}
		if (params.strategy === 'cursor') {
			let { cursor, ...rest } = params
			while (true) {
				// Pass the strongly-typed `params` object directly to the search function.
				// The correct overload will be resolved, and `res` will have the proper type.
				let res = await itemRepository.search({
					...rest,
					strategy: 'cursor',
				})

				if (res.metadata.nextCursor) {
					cursor = res.metadata.nextCursor
					console.log(
						inspect(
							{
								data: res.data.map((i) => ({
									id: i.id,
								})),
								metadata: res.metadata,
							},
							{ colors: true, depth: null }
						)
					)
				}
				if (res.metadata.isComplete || !res.data.length) {
					console.log(
						inspect(
							{
								data: res.data.map((i) => ({
									id: i.id,
								})),
								metadata: res.metadata,
							},
							{ colors: true, depth: null }
						)
					)
					console.log('Pagination Complete')
					break
				}
			}
		}
		if (params.strategy === 'offset') {
			let res = await itemRepository.search({
				...params,
			})
			console.log(res)
		}
	}
	if (action === 'stripeCustomerId') {
		item = await subscriptionRepository.findStripeCustomerId(`${ownerId}`)
	}
	if (action === 'prices') {
		item = await subscriptionRepository.listPrices()
	}
	if (action === 'embed') {
		let text = encodeText('Hello world!')
		console.log('encoded text: ', await text)
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
