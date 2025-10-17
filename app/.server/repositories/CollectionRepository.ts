import { Prisma } from '@/prisma/client'
import { prisma } from '@/services/db'
import {
	buildCollectionFilters,
	collectionFilterSchema,
} from '@/services/filters/collection.filters'
import { searchFactory } from '@/utils/search'
import { getPrefixForModel, toObjectId } from '@/utils/misc'
import { z } from 'zod'

const defaultInclude = {
	item: true,
	items: true,
}

type CollectionWithRelations = Prisma.CollectionGetPayload<{
	include: typeof defaultInclude
}>

const defaultOrderBy: (
	params: z.infer<typeof collectionFilterSchema>
) => Prisma.CollectionOrderByWithRelationInput = (params) => ({})

export const collectionRepository = {
	db: prisma,
	search: searchFactory({
		dbDelegate: prisma.collection,
		buildFilters: buildCollectionFilters,
		defaultOrderBy,
	}),

	// ------------------------------------------------------------------
	// Basic CRUD
	// ------------------------------------------------------------------

	async findById(id: string): Promise<CollectionWithRelations | null> {
		return prisma.collection.findUnique({
			where: { id },
			include: defaultInclude,
		})
	},

	async findAll(
		args: Prisma.CollectionFindManyArgs
	): Promise<CollectionWithRelations[]> {
		return prisma.collection.findMany({ ...args, include: defaultInclude })
	},

	async create(
		data: Prisma.CollectionUncheckedCreateInput
	): Promise<CollectionWithRelations> {
		return await this.db.collection.create({
			data: {
				...data,
				id: toObjectId(getPrefixForModel('Collection')),
			},
			include: defaultInclude,
		})
	},

	async update(
		args: Prisma.CollectionUpdateArgs
	): Promise<CollectionWithRelations> {
		return prisma.collection.update({ ...args, include: defaultInclude })
	},

	async delete(
		args: Prisma.CollectionDeleteArgs
	): Promise<CollectionWithRelations> {
		return prisma.collection.delete({ ...args, include: defaultInclude })
	},

	async findMany(
		args: Prisma.CollectionFindManyArgs
	): Promise<CollectionWithRelations[]> {
		return prisma.collection.findMany({ ...args, include: defaultInclude })
	},

	async findFirst(
		args: Prisma.CollectionFindFirstArgs
	): Promise<CollectionWithRelations | null> {
		return prisma.collection.findFirst({ ...args, include: defaultInclude })
	},

	async count(args: Prisma.CollectionCountArgs): Promise<number> {
		return prisma.collection.count(args)
	},
}
