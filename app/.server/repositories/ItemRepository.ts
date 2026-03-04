import { Prisma } from '@/prisma/client'
import { prisma } from '@/services/db'
import { getPrefixForModel, toObjectId } from '@/utils/converters'
import { searchFactory } from '../search/search'
import { buildItemFilters } from '../search/item.filters'

let defaultselect = {
  id: true,
  name: true,
  type: true,
  size: true,
  category: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  driveId: true,
  parentId: true,
  ownerId: true,
  workspaceId: true,
  folder: {
    select: {
      id: true,
      childCount: true,
      inclusiveChildCount: true,
      itemId: true
    },
  },
  file: {
    select: {
      id: true,
      etag: true,
      extension: true,
      mimeType: true,
      key: true,
    },
  },
  permissions: {
    select: {
      id: true,
      roles: true,
      linkId: true,
      invitationId: true,
      users: {
        select: {
          displayName: true,
          email: true,
          id: true,
          image: true,
          name: true,
        },
      },
    },
  },
} satisfies Prisma.ItemSelect

const defaultOrderBy = {
  id: 'asc',
} satisfies Prisma.ItemOrderByWithRelationInput

export const itemRepository = {
  search: searchFactory({
    dbDelegate: prisma.item,
    buildFilters: buildItemFilters,
    defaultOrderBy: () => defaultOrderBy,
  }),

  async findById(args: Prisma.ItemFindUniqueArgs) {
    // If the user provides a select, we use it, otherwise we use the default.
    return await prisma.item.findUniqueOrThrow({
      ...args,
      select: args.select || defaultselect,
    })
  },

  async create(args: Prisma.ItemCreateArgs) {
    return await prisma.item.create({
      ...args,
      select: args.select || defaultselect,
    })
  },

  async update(args: Prisma.ItemUpdateArgs) {
    return await prisma.item.update({
      ...args,
      select: args.select || defaultselect,
    })
  },

  async delete(id: string) {
    return await prisma.item.delete({
      where: { id },
    })
  },

  // --- Custom, Model-Specific Methods ---

  /**
   * Finds all items within a specific workspace, with pagination.
   * This is a good example of a complex, reusable query.
   * @param workspaceId The ID of the workspace.
   */
  async findWorkspaceItems(workspaceId: string) {
    // Now you can specify the include at the call site, and the
    // return type will be inferred correctly.
    return await prisma.item.findMany({
      where: { workspaceId },
      select: defaultselect,
      orderBy: { createdAt: 'desc' },
      take: 20,
    })
  },

  /**
   * Finds items belonging to a user that are marked as favorites.
   * @param userId The ID of the user.
   */
  async findFavoritesForUser(userId: string) {
    return await prisma.item.findMany({
      where: {
        ownerId: userId,
        favorites: {
          some: {
            favoritedById: userId,
          },
        },
      },
    })
  },

  /**
   * Finds a specific item belonging to a user that is marked as a favorite.
   * @param favoritedById The ID of the user who favorited the item.
   */
  async findFavoriteItem(itemId: string, favoritedById: string) {
    return await prisma.item.findFirst({
      where: {
        favorites: {
          some: {
            favoritedById,
            itemId,
          },
        },
      },
      select: defaultselect,
    })
  },

  /**
   * Marks an item as favorited by a specific user.
   * @param itemId The ID of the item to favorite.
   * @param favoritedById The ID of the user who is favoriting the item.
   */
  async favorite(
    itemId: string,
    favoritedById: string,
    client: Prisma.TransactionClient = prisma
  ) {
    return client.item.update({
      where: { id: itemId },
      data: {
        favorites: {
          create: {
            favoritedById,
            id: toObjectId(getPrefixForModel('Favorite')),
          },
        },
      },
    })
  },

  /**
   * Unmarks an item as favorited by a specific user.
   * @param itemId The ID of the item to unfavorite.
   * @param favoritedById The ID of the user who is unfavoriting the item.
   */
  async unfavorite(
    itemId: string,
    favoritedById: string,
    client: Prisma.TransactionClient = prisma
  ) {
    let item = await client.favorite.findFirst({
      where: { itemId, favoritedById },
    })
    if (!item) return
    return client.item.update({
      where: { id: itemId },
      data: {
        favorites: {
          delete: {
            id: item.id, 
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
