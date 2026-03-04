import { Prisma } from '@/prisma/client'
import { prisma } from '@/services/db'
import {
  buildUserFilters,
  userFilterSchema,
} from '@/utils/filters/user.filters'
import { searchFactory } from '@/utils/search'
import type { z } from 'zod'

const defaultInclude = {
  notifications: true,
  permissions: true,
  accounts: true,
  sessions: true,
  workspaces: true,
  subscriptions: {
    include: {
      storagePlan: true,
    },
  },
  comments: true,
  invitations: true,
  items: true,
  lockedItems: true,
  drive: true,
  favorites: true,
} satisfies Prisma.UserInclude

const defaultOrderBy = (
  params: z.infer<typeof userFilterSchema>
): Prisma.UserOrderByWithRelationInput => ({
  updatedAt: 'desc',
})

export const userRepository = {
  search: searchFactory({
    dbDelegate: prisma.user,
    buildFilters: buildUserFilters,
    defaultOrderBy,
  }),

  // ------------------------------------------------------------------
  // Basic CRUD
  // ------------------------------------------------------------------

  async findById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      include: defaultInclude,
    })
  },

  async findAll(args?: Prisma.UserFindManyArgs) {
    return prisma.user.findMany({
      ...args,
      include: defaultInclude,
    })
  },

  async create(data: Prisma.UserCreateInput) {
    return prisma.user.create({
      data,
      include: defaultInclude,
    })
  },

  async update(
    args: Prisma.UserUpdateArgs,
    client: Prisma.TransactionClient = prisma
  ) {
    return client.user.update({
      ...args,
      include: defaultInclude,
    })
  },

  async delete(id: string) {
    return prisma.user.delete({
      where: { id },
      include: defaultInclude,
    })
  },

  // ------------------------------------------------------------------
  // Custom Methods
  // ------------------------------------------------------------------

  /**
   * Finds a user by their email address.
   * @param email The email address of the user.
   * @returns The user with relations or null if not found.
   */
  async findByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
      include: defaultInclude,
    })
  },
}
