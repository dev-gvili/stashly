import { Prisma } from '@/prisma/client'
import { prisma } from '@/services/db'
import {
  buildActivityFilters,
  activityFilterSchema,
} from '@/utils/filters/activity.filters'
import { searchFactory } from '@/utils/search'
import { getPrefixForModel, toObjectId } from '@/utils/converters'
import type { z } from 'zod'

const defaultInclude = {
  time: true,
  item: true,
  action: true,
  access: true,
} satisfies Prisma.ActivityInclude

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
    args?: z.infer<typeof activityFilterSchema>
  ) {
    return await this.search({
      ...args,
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
    const { filters, orderBy, pagination } = this.search.buildFilters(args)
    return prisma.activity.findMany({
      where: filters,
      orderBy,
      skip: pagination.skip,
      take: pagination.take,
      include: defaultInclude,
    })
  },

  async findFirst(
    args: Prisma.ActivityFindFirstArgs
  ): Promise<ModelWithRelations | null> {
    const { filters, orderBy, pagination } = this.search.buildFilters(args)
    return prisma.activity.findFirst({
      where: filters,
      orderBy,
      skip: pagination.skip,
      take: pagination.take,
      include: defaultInclude,
    })
  },

  async count(args: Prisma.ActivityCountArgs): Promise<number> {
    return prisma.activity.count(args)
  },
  async countAll(args?: Prisma.ActivityCountArgs): Promise<number> {
    const { filters } = this.search.buildFilters(args)
    return prisma.activity.count({
      where: filters,
      ...args,
    })
  },

  // --- Custom Methods ---

  // Example:
  // async findByEmail(email: string): Promise<ModelWithRelations | null> {
  //   return this.db.activity.findUnique({ where: { email }, include: defaultInclude });
  // }
}
