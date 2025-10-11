import { z } from 'zod'
import { Prisma } from '@/prisma/client'

export const collectionFilterSchema = z.object({
	id: z.string(),
	name: z.string(),
	size: z.bigint(),
	// Range filters for dates/numbers

	sizeMin: z.number().optional(),
	sizeMax: z.number().optional(),
})

export function buildCollectionFilters(
	params: z.infer<typeof collectionFilterSchema>
): Prisma.CollectionWhereInput {
	const where: Prisma.CollectionWhereInput = {}

	if (params.id) {
		where.id = { contains: params.id, mode: 'insensitive' }
	}

	if (params.name) {
		where.name = { contains: params.name, mode: 'insensitive' }
	}

	if (params.size !== undefined) {
		where.size = params.size
	}
	if (params.sizeMin || params.sizeMax) {
		where.size = {
			...(params.sizeMin ? { gte: params.sizeMin } : {}),
			...(params.sizeMax ? { lte: params.sizeMax } : {}),
		}
	}

	return where
}
