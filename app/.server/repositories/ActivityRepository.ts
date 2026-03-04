import { Prisma } from '@/prisma/client'
import { prisma } from '@/services/db'
import {
  buildActivityFilters,
  activityFilterSchema,
} from '@/utils/filters/activity.filters'
import { searchFactory } from '@/utils/search'
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

export const activityRepository = {
  name: 'Activity' as const,
  db: prisma,
  search: searchFactory({
    dbDelegate: prisma.activity,
    buildFilters: buildActivityFilters,
    defaultOrderBy,
  }),

  // --- Basic CRUD ---

  async findById(id: string): Promise<ModelWithRelations | null> {
    return prisma.activity.findUnique({
      where: { id },
      include: defaultInclude,
    })
  },

  async findAll(
    args?: Prisma.ActivityFindManyArgs
  ): Promise<ModelWithRelations[]> {
    return prisma.activity.findMany({
      ...args,
      include: defaultInclude,
    })
  },

  async create(data: Prisma.ActivityCreateInput): Promise<ModelWithRelations> {
    return prisma.activity.create({
      data: {
        ...data,
        id: toObjectId(getPrefixForModel('Activity')),
      },
      include: defaultInclude,
    })
  },

  async update(args: Prisma.ActivityUpdateArgs): Promise<ModelWithRelations> {
    return prisma.activity.update({
      ...args,
      include: defaultInclude,
    })
  },

  async delete(id: string): Promise<ModelWithRelations> {
    return prisma.activity.delete({
      where: { id },
      include: defaultInclude,
    })
  },

  async findMany(
    args: Prisma.ActivityFindManyArgs
  ): Promise<ModelWithRelations[]> {
    return prisma.activity.findMany({ ...args, include: defaultInclude })
  },

  async findFirst(
    args: Prisma.ActivityFindFirstArgs
  ): Promise<ModelWithRelations | null> {
    return prisma.activity.findFirst({ ...args, include: defaultInclude })
  },

  async count(args: Prisma.ActivityCountArgs): Promise<number> {
    return prisma.activity.count(args)
  },

  // --- Custom Methods ---

  // Example:
  // async findByEmail(email: string): Promise<ModelWithRelations | null> {
  //   return this.db.activity.findUnique({ where: { email }, include: defaultInclude });
  // }
}
