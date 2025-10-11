import { Prisma, type Item } from '@/prisma/client'
import { prisma } from '@/services/db'
import { getPrefixForModel, toObjectId } from '@/utils/misc'
import { searchFactory } from '@/utils/search'
import { z } from 'zod'
import { buildItemFilters, itemFilterSchema } from '../filters/item.filters'
import type { IRepository } from './IRepository'

const defaultInclude = {
	owner: true,
	workspace: true,
}

type ModelWithRelations = Prisma.ItemGetPayload<{
	include: typeof defaultInclude
}>

const defaultOrderBy = (
	params?: z.infer<typeof itemFilterSchema>
): Prisma.ItemOrderByWithRelationInput => {
	return { createdAt: 'desc' }
}

class ItemRepository implements IRepository<Item, 'Item'> {
	name = 'Item' as const
	private db: typeof prisma
	public search
	constructor(dbClient: typeof prisma) {
		this.db = dbClient
		this.search = searchFactory({
			dbDelegate: prisma.item,
			buildFilters: buildItemFilters,
			defaultOrderBy,
		})
	}

	async findById(
		args: Prisma.ItemFindUniqueArgs
	): Promise<ModelWithRelations> {
		return this.db.item.findUniqueOrThrow({
			...args,
			include: defaultInclude,
		})
	}

	async create(data: Prisma.ItemCreateInput): Promise<ModelWithRelations> {
		return this.db.item.create({
			data: {
				...data,
				id: toObjectId(getPrefixForModel('Item')),
			},
			include: defaultInclude,
		})
	}

	async update(args: Prisma.ItemUpdateArgs): Promise<ModelWithRelations> {
		return this.db.item.update({
			...args,
			include: defaultInclude,
		})
	}

	async delete(id: string): Promise<ModelWithRelations> {
		return this.db.item.delete({
			where: { id },
			include: defaultInclude,
		})
	}

	// --- Custom, Model-Specific Methods ---

	/**
	 * Finds all items within a specific workspace, with pagination.
	 * This is a good example of a complex, reusable query.
	 * @param workspaceId The ID of the workspace.
	 */
	async findByWorkspace(workspaceId: string) {
		// Now you can specify the include at the call site, and the
		// return type will be inferred correctly.
		return await this.search({
			workspace: workspaceId,
			strategy: 'cursor',
			include: {
				owner: true,
				workspace: true,
			},
			take: 10,
		})
	}

	/**
	 * Finds items belonging to a user that are marked as favorites.
	 * @param userId The ID of the user.
	 */
	async findFavoritesByUserId(userId: string): Promise<ModelWithRelations[]> {
		return await this.db.item.findMany({
			where: {
				ownerId: userId,
				favoritedBy: {
					some: {
						favoritedById: userId,
					},
				},
			},
			include: defaultInclude,
		})
	}

	/**
	 * Marks an item as favorited by a specific user.
	 * @param itemId The ID of the item to favorite.
	 * @param userId The ID of the user who is favoriting the item.
	 */
	async favorite(
		itemId: string,
		userId: string
	): Promise<ModelWithRelations> {
		return this.db.item.update({
			where: { id: itemId },
			data: {
				favoritedBy: {
					create: {
						favoritedById: userId,
						id: toObjectId(getPrefixForModel('Favorite')),
					},
				},
			},
			include: defaultInclude,
		})
	}

	/**
	 * Unmarks an item as favorited by a specific user.
	 * @param itemId The ID of the item to unfavorite.
	 * @param userId The ID of the user who is unfavoriting the item.
	 */
	async unfavorite(
		itemId: string,
		userId: string
	): Promise<ModelWithRelations> {
		return this.db.item.update({
			where: { id: itemId },
			data: {
				favoritedBy: {
					delete: {
						favoritedById_itemId: {
							favoritedById: userId,
							itemId: itemId,
						},
					},
				},
			},
			include: defaultInclude,
		})
	}
}

// Export a singleton instance for use in your services
export const itemRepository = new ItemRepository(prisma)