import { ItemCategory, ItemType } from '@/prisma/client'
import {
	buildAlgoliaFiltersFactory,
	createAlgoliaFilter,
} from '@/utils/algolia-filters'
import { toZodArraySchema } from '@/utils/converters'
import { z } from 'zod'

export const itemAlgoliaFilterSchema = z
	.object({
		category: toZodArraySchema(z.nativeEnum(ItemCategory)),
		type: toZodArraySchema(z.nativeEnum(ItemType)),
		tags: toZodArraySchema(z.string().trim().min(1)),
		query: z.string().trim().min(1),
		collection: z.string().nonempty(),
		owner: z.string().nonempty(),
		workspace: z.string().nonempty(),
		favorited: z.boolean(),
		trashed: z.boolean(),
		status: z.nativeEnum(ItemType),
		locked: z.boolean(),
		id: z.string().nonempty(),
		hasChildren: z.boolean(),
		extension: toZodArraySchema(z.string().nonempty()),
	})
	.partial()

const createItemAlgoliaFilter =
	createAlgoliaFilter<z.infer<typeof itemAlgoliaFilterSchema>>()

export const itemAlgoliaFilters = {
	category: createItemAlgoliaFilter(
		z.array(z.nativeEnum(ItemCategory)),
		(categories) => {
			return categories.map((c) => `category:${c}`).join(' OR ')
		}
	),
	type: createItemAlgoliaFilter(z.array(z.nativeEnum(ItemType)), (types) => {
		return types.map((t) => `type:${t}`).join(' OR ')
	}),
	tags: createItemAlgoliaFilter(z.array(z.string()), (tags) => {
		return `(${tags.map((t) => `tags:"${t}"`).join(' OR ')})`
	}),
}

export const buildItemAlgoliaFilters = buildAlgoliaFiltersFactory({
	filters: itemAlgoliaFilters,
	schema: itemAlgoliaFilterSchema,
})
