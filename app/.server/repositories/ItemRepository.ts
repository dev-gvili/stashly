import { Prisma, type Item } from '@/prisma/client'
import { prisma } from '@/services/db' // Assuming your prisma client is exported from here
import type { IRepository } from './IRepository'

class ItemRepository implements IRepository<Item> {
	async findById(id: string): Promise<Item | null> {
		return prisma.item.findUnique({
			where: { id },
		})
	}

	async findAll(): Promise<Item[]> {
		return prisma.item.findMany()
	}

	async create(data: Prisma.ItemCreateInput): Promise<Item> {
		return prisma.item.create({ data })
	}

	async update(id: string, data: Prisma.ItemUpdateInput): Promise<Item> {
		return prisma.item.update({
			where: { id },
			data,
		})
	}

	async delete(id: string): Promise<Item> {
		return prisma.item.delete({
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
		return prisma.item.findMany({
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
	async findFavoritesByUser(userId: string): Promise<Item[]> {
		return prisma.item.findMany({
			where: {
				ownerId: userId,
				favoritedBy: {
					some: {
						favoritedById: userId,
					},
				},
			},
			orderBy: {
				updatedAt: 'desc',
			},
		})
	}
}

// Export a singleton instance for use in your services
export const itemRepository = new ItemRepository()
