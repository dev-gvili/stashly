import { Prisma } from '@/prisma/client'
import { prisma } from '@/services/db'
import {
	buildActivityFilters,
	activityFilterSchema,
} from '@/services/filters/activity.filters'
import { searchFactory } from '@/utils/search'
import type { IRepository } from './IRepository'
import { getPrefixForModel, toObjectId } from '@/utils/misc'
import type { z } from 'zod'

const defaultInclude = {
	time: true,
	item: true,
	action: true,
	access: true,
}

const defaultOrderBy = (
	params: z.infer<typeof activityFilterSchema>
): Prisma.ActivityOrderByWithRelationInput => ({
	// Modify as needed (e.g., use 'updatedAt' if available)
})
type ModelWithRelations = Prisma.ActivityGetPayload<{
	include: typeof defaultInclude
}>

export class ActivityRepository
	implements IRepository<ModelWithRelations, 'Activity'>
{
	name = 'Activity' as const
	private db: typeof prisma
	private search

	constructor(dbClient: typeof prisma) {
		this.db = dbClient
		this.search = searchFactory({
			dbDelegate: this.db.activity,
			buildFilters: buildActivityFilters,
			defaultInclude,
			defaultOrderBy,
		})
	}

	// --- Basic CRUD ---

	async findById(id: string): Promise<ModelWithRelations | null> {
		return this.db.activity.findUnique({
			where: { id },
			include: defaultInclude,
		})
	}

	async findAll(
		args?: Prisma.ActivityFindManyArgs
	): Promise<ModelWithRelations[]> {
		return this.db.activity.findMany({
			...args,
			include: defaultInclude,
		})
	}

	async create(
		data: Prisma.ActivityCreateInput
	): Promise<ModelWithRelations> {
		return this.db.activity.create({
			data: {
				...data,
				id: toObjectId(getPrefixForModel('Activity')),
			},
			include: defaultInclude,
		})
	}

	async update(args: Prisma.ActivityUpdateArgs): Promise<ModelWithRelations> {
		return this.db.activity.update({
			...args,
			include: defaultInclude,
		})
	}

	async delete(id: string): Promise<ModelWithRelations> {
		return this.db.activity.delete({
			where: { id },
			include: defaultInclude,
		})
	}

	// --- Custom Methods ---

	// Example:
	// async findByEmail(email: string): Promise<ModelWithRelations | null> {
	//   return this.db.activity.findUnique({ where: { email }, include: defaultInclude });
	// }
}

// Export a singleton instance
export const activityRepository = new ActivityRepository(prisma)
