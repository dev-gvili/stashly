import { Prisma, type Item } from '@/prisma/client'
import { prisma } from '@/services/db' // Assuming your prisma client is exported from here
import type { IRepository } from './IRepository'
import { getPrefixForModel, toObjectId } from '../../utils/misc'

class ItemRepository implements IRepository<Item, "Item"> {

	name = "Item" as const
	
	private db: typeof prisma

	constructor(dbClient: typeof prisma) {
		this.db = dbClient
	 }


	async findById(args: Prisma.ItemFindUniqueArgs) {
		return this.db.item.findUnique({
			...args,
		})
	}

	async findAll(args: Prisma.ItemFindManyArgs): Promise<Item[]> {
		return this.db.item.findMany(args)
	}

	async create(data: Prisma.ItemCreateInput): Promise<Item> {
		return this.db.item.create({ data })
	}

	async update(args: Prisma.ItemUpdateArgs): Promise<Item> {
		return this.db.item.update({
			...args,
		})
	}

	async delete(id: string): Promise<Item> {
		return this.db.item.delete({
			where: { id },
		})
	}

	// --- Custom, Model-Specific Methods ---

	/**
	 * Finds all items within a specific workspace, with pagination.
	 * This is a good example of a complex, reusable query.
	 * @param workspaceId The ID of the workspace.
	 * @param page The page number for pagination (1-based).
	 * @param pageSize The number of items per page.
	 */
	async findByWorkspace(
		workspaceId: string,
		page: number = 1,
		pageSize: number = 20
	): Promise<Item[]> {
		return this.db.item.findMany({
			where: {
				workspaceId: workspaceId,
			},
			orderBy: {
				createdAt: 'desc',
			},
			skip: (page - 1) * pageSize,
			take: pageSize,
		})
	}

	/**
	 * Finds items belonging to a user that are marked as favorites.
	 * @param userId The ID of the user.
	 */
	async findFavoritesByOwner(userId: string): Promise<Item[]> {
		return this.db.item.findMany({
			where: {
				ownerId: userId,
				favoritedBy: {
					some: {
						favoritedById: userId,
					},
				},
			},
		})
	}

	/**
	 * Marks an item as favorited by a specific user.
	 * @param itemId The ID of the item to favorite.
	 * @param userId The ID of the user who is favoriting the item.
	 */
	async favorite(itemId: string, userId: string): Promise<Item> {
		return this.db.item.update({
			where: { id: itemId },
			data: {
				favoritedBy: {
					create: {
						// Changed from `ownerId` to `userId`
						favoritedById: userId,
						id: toObjectId(getPrefixForModel('Favorite')),
					},
				},
			},
		})
	}

	/**
	 * Unmarks an item as favorited by a specific user.
	 * @param itemId The ID of the item to unfavorite.
	 * @param userId The ID of the user who is unfavoriting the item.
	 */
	async unfavorite(itemId: string, userId: string): Promise<Item> {
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
		})
	}
}

// Export a singleton instance for use in your services
export const itemRepository = new ItemRepository(prisma)
