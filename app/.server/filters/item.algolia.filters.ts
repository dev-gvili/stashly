import { ItemCategory, ItemStatus, ItemType } from '@/prisma/client'
import {
	buildAlgoliaFiltersFactory,
	createAlgoliaFilter,
} from '@/utils/algolia-filters'
import { toZodArraySchema } from '@/utils/converters'
import { z } from 'zod'

export const itemAlgoliaFilterSchema = z
	.object({
		id: z.string().nonempty(),
		query: z.string().trim().min(1),
		type: toZodArraySchema(z.enum(ItemType)),
		category: toZodArraySchema(z.enum(ItemCategory)),
		status: z.enum(ItemStatus),
		tags: toZodArraySchema(z.string().trim().min(1)),
		collection: z.string().nonempty(),
		owner: z.string().nonempty(),
		workspace: z.string().nonempty(),
		favorited: z.boolean(),
		trashed: z.boolean(),
		locked: z.boolean(),
		hasChildren: z.boolean(),
		extension: toZodArraySchema(z.string().nonempty()),
	})
	.partial()

const createItemAlgoliaFilter =
	createAlgoliaFilter<z.infer<typeof itemAlgoliaFilterSchema>>()

export const itemAlgoliaFilters = {
	id: createItemAlgoliaFilter(z.string(), (id) => `id:${id}`),
	// query: createItemAlgoliaFilter(z.string(), (query) => `*${query}*`),
	type: createItemAlgoliaFilter(z.array(z.enum(ItemType)), (types) => {
		return `(${types.map((t) => `type:${t}`).join(' OR ')})`
	}),
	category: createItemAlgoliaFilter(
		z.array(z.enum(ItemCategory)),
		(categories) =>
			`(${categories.map((c) => `category:${c}`).join(' OR ')})`
	),
	status: createItemAlgoliaFilter(
		z.enum(ItemStatus),
		(status) => `status:${status}`
	),
	tags: createItemAlgoliaFilter(z.array(z.string()), (tags) => {
		return `(${tags.map((t) => `tags:"${t}"`).join(' OR ')})`
	}),
	collection: createItemAlgoliaFilter(
		z.string(),
		(collectionId) => `collectionIds:${collectionId}`
	),
	owner: createItemAlgoliaFilter(
		z.string(),
		(ownerId) => `ownerId:${ownerId}`
	),
	workspace: createItemAlgoliaFilter(
		z.string(),
		(workspaceId) => `workspaceId:${workspaceId}`
	),
	favorited: createItemAlgoliaFilter(
		z.boolean(),
		(isFavorited) => `favorited:${isFavorited}`
	),
	trashed: createItemAlgoliaFilter(
		z.boolean(),
		(isTrashed) => `trashed:${isTrashed}`
	),
	locked: createItemAlgoliaFilter(
		z.boolean(),
		(isLocked) => `locked:${isLocked}`
	),
	hasChildren: createItemAlgoliaFilter(
		z.boolean(),
		(hasChildren) => `itemCount ${hasChildren ? '>' : '='} 0`
	),
	extension: createItemAlgoliaFilter(z.array(z.string()), (extensions) => {
		return `(${extensions.map((ext) => `extension:${ext}`).join(' OR ')})`
	}),
}

export const buildItemAlgoliaFilters = buildAlgoliaFiltersFactory({
	filters: itemAlgoliaFilters,
	schema: itemAlgoliaFilterSchema,
})
