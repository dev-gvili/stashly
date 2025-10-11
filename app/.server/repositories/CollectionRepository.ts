import { Prisma } from '@/prisma/client'
import { prisma } from '@/services/db'
import type { IRepository } from '@/services/repositories/IRepository'
import {
	buildCollectionFilters,
	collectionFilterSchema,
} from '@/services/filters/collection.filters'
import { searchFactory } from '@/utils/search'
import { z } from 'zod'

const defaultInclude = {
	item: true,
	items: true,
}

type CollectionWithRelations = Prisma.CollectionGetPayload<{
	include: typeof defaultInclude
}>

const defaultOrderBy = (
	params: z.infer<typeof collectionFilterSchema>
): Prisma.CollectionOrderByWithRelationInput => ({
	// updatedAt: 'desc',
})

export class CollectionRepository
	implements IRepository<CollectionWithRelations, 'Collection'>
{
	name = 'Collection' as const

	private db: typeof prisma

	private search

	constructor(dbClient: typeof prisma) {
		this.db = dbClient
		this.search = searchFactory({
			dbDelegate: this.db.collection,
			buildFilters: buildCollectionFilters,
			defaultOrderBy,
		})
	}

	// ------------------------------------------------------------------
	// Basic CRUD
	// ------------------------------------------------------------------

	async findById(id: string): Promise<CollectionWithRelations | null> {
		return this.db.collection.findUnique({
			where: { id },
			include: defaultInclude,
		})
	}

	async findAll(
		args: Prisma.CollectionFindManyArgs
	): Promise<CollectionWithRelations[]> {
		return this.db.collection.findMany({ ...args, include: defaultInclude })
	}

	async create(
		args: Prisma.CollectionCreateInput
	): Promise<CollectionWithRelations> {
		return this.db.collection.create({
			data: args,
			include: defaultInclude,
		})
	}

	async update(
		args: Prisma.CollectionUpdateArgs
	): Promise<CollectionWithRelations> {
		return this.db.collection.update({ ...args, include: defaultInclude })
	}

	async delete(
		args: Prisma.CollectionDeleteArgs
	): Promise<CollectionWithRelations> {
		return this.db.collection.delete({ ...args, include: defaultInclude })
	}
}
