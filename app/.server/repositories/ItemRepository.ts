import { Prisma, type Item } from '@/prisma/client'
import { prisma } from '@/services/db'
import { getPrefixForModel, toObjectId } from '@/utils/misc'
import { searchFactory } from '@/utils/search'
import { z } from 'zod'
import { buildItemFilters, itemFilterSchema } from '../filters/item.filters'

const defaultInclude = {
	owner: true,
	workspace: true,
}

const defaultOrderBy = (
	params?: z.infer<typeof itemFilterSchema>
): Prisma.ItemOrderByWithRelationInput => {
	return { createdAt: 'desc' }
}

export const itemRepository = {
	db: prisma,
	search: searchFactory({
		dbDelegate: prisma.item,
		buildFilters: buildItemFilters,
		defaultOrderBy,
	}),

	async findById(args: Prisma.ItemFindUniqueArgs) {
		return await this.db.item.findUniqueOrThrow({
			where: args.where,
			include: args.include || defaultInclude,
		})
	},

	async create(data: Prisma.ItemCreateInput) {
		data.id = toObjectId(getPrefixForModel('Item'))
		return await this.db.item.create({ data })
	},

	async update(args: Prisma.ItemUpdateArgs) {
		return await this.db.item.update(args)
	},

	async delete(id: string) {
		return await this.db.item.delete({
			where: { id },
		})
	},

	// --- Custom, Model-Specific Methods ---

	/**
	 * Finds all items within a specific workspace, with pagination.
	 * This is a good example of a complex, reusable query.
	 * @param workspaceId The ID of the workspace.
	 */
	async findByWorkspace(workspaceId: string) {
		// Now you can specify the include at the call site, and the
		// return type will be inferred correctly.
		return await prisma.item.findMany({
			where: { workspaceId },
			include: defaultInclude,
			orderBy: { createdAt: 'desc' },
			take: 20,
		})
	},

	/**
	 * Finds items belonging to a user that are marked as favorites.
	 * @param userId The ID of the user.
	 */
	async findFavoritesByUserId(userId: string) {
		return await prisma.item.findMany({
			where: {
				ownerId: userId,
				favoritedBy: {
					some: {
						favoritedById: userId,
					},
				},
			},
		})
	},

	/**
	 * Marks an item as favorited by a specific user.
	 * @param itemId The ID of the item to favorite.
	 * @param userId The ID of the user who is favoriting the item.
	 */
	async favorite(itemId: string, userId: string) {
		return prisma.item.update({
			where: { id: itemId },
			data: {
				favoritedBy: {
					create: {
						favoritedById: userId,
						id: toObjectId(getPrefixForModel('Favorite')),
					},
				},
			},
		})
	},

	/**
	 * Unmarks an item as favorited by a specific user.
	 * @param itemId The ID of the item to unfavorite.
	 * @param userId The ID of the user who is unfavoriting the item.
	 */
	async unfavorite(itemId: string, userId: string) {
		return prisma.item.update({
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
	},

	async findAll(args: Prisma.ItemFindManyArgs) {
		return prisma.item.findMany(args)
	},

	async findFirst(args: Prisma.ItemFindFirstArgs) {
		return prisma.item.findFirst(args)
	},

	async count(args: Prisma.ItemCountArgs): Promise<number> {
		return prisma.item.count(args)
	},
}
