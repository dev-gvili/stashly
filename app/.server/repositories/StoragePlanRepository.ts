import type { Prisma } from '@/prisma/browser'
import type { StoragePlanType } from '@/prisma/client'
import { prisma } from '@/services/db'

export const storagePlanRepository = {
  async findById(id: string) {
    return prisma.storagePlan.findUniqueOrThrow({
      where: { id },
    })
  },

  async findAll(args: Prisma.StoragePlanFindManyArgs) {
    return prisma.storagePlan.findMany(args)
  },

  async create(args: Prisma.StoragePlanCreateArgs) {
    return prisma.storagePlan.create(args)
  },

  async update(args: Prisma.StoragePlanUpdateArgs) {
    return prisma.storagePlan.update(args)
  },

  async delete(args: Prisma.StoragePlanDeleteArgs) {
    return prisma.storagePlan.delete(args)
  },

  async findByType(type: StoragePlanType) {
    return prisma.storagePlan.findFirst({ where: { type } })
  },

  // Find a plan by its name
  async findByName(name: string) {
    return prisma.storagePlan.findFirst({ where: { name } })
  },

  // Find all plans with pagination support
  async findAllWithPagination(page: number, pageSize: number) {
    const skip = (page - 1) * pageSize
    return prisma.storagePlan.findMany({ skip, take: pageSize })
  },

  // Find multiple plans by an array of IDs
  async findByIds(ids: string[]) {
    return prisma.storagePlan.findMany({ where: { id: { in: ids } } })
  },

  // Find a plan by its Stripe price ID
  async findByPriceId(priceId: string) {
    return prisma.storagePlan.findFirst({
      where: { stripePriceId: priceId },
    })
  },

  // Find a plan by type and price ID
  async findByTypeAndPrice(type: StoragePlanType, priceId: string) {
    return prisma.storagePlan.findFirst({
      where: { type, stripePriceId: priceId },
    })
  },

  // Find a plan by type and storage limit
  async findByTypeAndLimit(type: StoragePlanType, limit: bigint) {
    return prisma.storagePlan.findFirst({
      where: { type, storageLimit: limit },
    })
  },

  /**
   * The function `findLimitsByType` asynchronously retrieves storage, workspace, and member limits for
   * a given storage plan type.
   *
   * @param type
   *
   * @return The `findLimitsByType` function returns a Promise that resolves to an object containing the
   * storageLimit (as a bigint), workspaceLimit (as a number), and memberLimit (as a number) for the
   * storage plan of the specified type.
   */
  async findLimitsByType(type: StoragePlanType) {
    const plan = await this.findByType(type)
    if (!plan) throw new Error(`Storage plan ${type} not found`)

    return {
      storageLimit: plan.storageLimit,
      workspaceLimit: plan.workspaceLimit,
      memberLimit: plan.memberLimit,
    }
  },

  /**
   * Retrive the default storage plan - free
   */
  async findDefault(client: Prisma.TransactionClient = prisma) {
    return client.storagePlan.findFirstOrThrow({
      where: { type: 'free' },
    })
  },
}
