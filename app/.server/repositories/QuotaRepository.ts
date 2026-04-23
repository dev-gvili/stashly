import type { Prisma } from '@/prisma/client'
import type { Quota as PrismaQuota } from '@/prisma/client'
import { prisma } from '@/services/db'
import {
  buildQuotaFilters,
  quotaFilterSchema,
  quotaFilters,
} from '@/utils/filters/quota.filters'
import { z } from 'zod'
import { calculateQuota, toQuota } from '@/services/quota.utils'
import { findStoragePlanById, findDefaultStoragePlan } from '../storagePlan-actions'
import { searchFactory } from '@/utils/search'
import { getPrefixForModel, toObjectId } from '@/utils/converters'
import { StashlyError, StashlyErrorCode } from '../api.errors'

export interface Quota extends PrismaQuota {
  remaining: bigint
}

/**
 * Input type for quota update operations after file actions.
 *
 * @property {string} userId - The ID of the user.
 * @property {bigint} dataSize - The size of the data affected by the action.
 */
export interface UpdateAfterInput {
  userId: string
  dataSize: bigint
  client?: Prisma.TransactionClient
}

const defaultOrderBy = (
  params: z.infer<typeof quotaFilterSchema>
): Prisma.QuotaOrderByWithRelationInput => ({
  updatedAt: 'desc',
})

/**
 * Repository for the `Quota` model.
 * Provides CRUD operations plus a handful of convenience helpers.
 */
export const quotaRepository = {
  // Search functionality
  search: searchFactory({
    dbDelegate: prisma.quota,
    buildFilters: buildQuotaFilters,
    defaultOrderBy,
  }),

  // ------------------------------------------------------------------
  // Basic CRUD
  // ------------------------------------------------------------------
  async findById(id: string, client: Prisma.TransactionClient = prisma) {
    const quota = await client.quota.findUniqueOrThrow({ where: { id } })
    return toQuota(quota)
  },

  async findAll(args: Prisma.QuotaFindManyArgs) {
    const quotas = await prisma.quota.findMany(args)
    return quotas.map(toQuota)
  },

  /**
   * Creates a new quota record.
   *
   * If a `storagePlanId` is supplied, the quota's `total` will be set to the
   * storage limit of that plan.  When no plan is provided, the default
   * storage plan's limit is used.
   *
   * @param {Prisma.QuotaUncheckedCreateInput & { storagePlanId?: string }} params
   *   The data used to create the quota.  The `storagePlanId` field is optional
   *   and is only used to determine the `total` value.
   * @returns} The created quota instance.
   * @throws {Error} If the specified storage plan cannot be found.
   */
  async create({
    storagePlanId,
    ...args
  }: Prisma.QuotaUncheckedCreateInput & {
    storagePlanId?: string
  }) {
    // Determine the total storage limit based on the provided storage plan
    // If no storage plan ID is provided, use the default plan's storage limit
    if (!storagePlanId) {
      const defaultPlan = await findDefaultStoragePlan()
      args.total = defaultPlan.storageLimit
    }

    // If a storage plan ID is provided, fetch the plan and set the total accordingly
    if (storagePlanId) {
      const storagePlan = await findStoragePlanById(storagePlanId)
      if (!storagePlan)
        throw new Error(`Storage plan ${storagePlanId} not found`)
      args.total = storagePlan.storageLimit // Set total based on storage plan
    }
    const quota = await prisma.quota.create({ data: args })
    return toQuota(quota)
  },

  /**
   * Updates an existing quota record.
   *
   * The method first retrieves the current quota, calculates the new
   * `used`, `deleted`, `total`, `remaining`, and `status` values using
   * {@link calculateQuota}, merges those values into the update payload,
   * and then performs the Prisma update operation.
   *
   * @param {Prisma.QuotaUpdateArgs} args - The Prisma update arguments.
   * @returns} The updated quota instance.
   * @throws {Error} If the quota does not exist or the update fails.
   */
  async update({
    userId,
    driveId,
    id,
    client = prisma,
    ...data
  }: Pick<Prisma.QuotaUncheckedUpdateInput, 'used' | 'deleted' | 'total'> & {
    userId?: string
    driveId?: string
    id?: string
    client: Prisma.TransactionClient
  }) {
    let current: Omit<PrismaQuota, 'createdAt' | 'updatedAt'> | null = null
    // Check if we got quota ID, if true find by that ID
    if (id) current = await this.findById(id, client)
    // If we don't have quota ID, Check if we got a drive ID, if true Find quota by drive ID
    if (driveId) current = await this.findByDriveId(driveId, client)
    // If we still don't have a quota, try finding by user ID
    if (userId) current = await this.findByUserId(userId, client)
    // If still not found, throw error
    if (!current) throw new StashlyError(StashlyErrorCode.QUOTA_NOT_FOUND)
    // Calculate new quota values based on current and incoming data
    const { remaining, ...quota } = calculateQuota(current, data as PrismaQuota)
    // Update the quota in the database
    const updated = await client.quota.update({
      where: { id: current.id },
      data: { ...data, ...quota },
    })
    // Return the updated quota
    return toQuota(updated)
  },

  async delete(args: Prisma.QuotaDeleteArgs) {
    const quota = await prisma.quota.delete(args)
    return toQuota(quota)
  },

  // ------------------------------------------------------------------
  // Convenience lookups
  // ------------------------------------------------------------------
  /** Find a quota by the owning user ID */
  async findByUserId(
    userId: string,
    client: Prisma.TransactionClient = prisma
  ) {
    const quota = await client.quota.findFirst({
      where: { drive: { ownerId: userId } },
    })
    return quota ? toQuota(quota) : null
  },

  /** Find a quota by the drive ID */
  async findByDriveId(
    driveId: string,
    client: Prisma.TransactionClient = prisma
  ) {
    const quota = await client.quota.findFirst({ where: { driveId } })
    return quota ? toQuota(quota) : null
  },

  /** Find a quota by both user and drive */
  async findByUserAndDrive(
    userId: string,
    driveId: string
  ): Promise<Omit<Quota, 'createdAt' | 'updatedAt'> | null> {
    const quota = await prisma.quota.findFirst({
      where: { drive: { ownerId: userId }, driveId },
      omit: { createdAt: true, updatedAt: true },
    })
    return quota ? toQuota(quota) : null
  },

  // ------------------------------------------------------------------
  // Validation helpers
  // ------------------------------------------------------------------

  /** Throw if a quota with the given ID does not exist */
  async assertExists(id: string, client: Prisma.TransactionClient = prisma) {
    const quota = await client.quota.findUnique({ where: { id } })
    if (!quota) throw new StashlyError(StashlyErrorCode.QUOTA_NOT_FOUND)
    return toQuota(quota)
  },

  /** Ensure a user has a quota record */
  async ensureUserQuota(
    userId: string,
    client: Prisma.TransactionClient = prisma
  ) {
    const quota = await this.findByUserId(userId, client)
    if (!quota)
      throw new StashlyError(StashlyErrorCode.QUOTA_NOT_DEFINED_FOR_USER)
    return quota
  },

  /** Validate that the quota has enough free space for a given size */
  validateFreeSpace(quota: Omit<Quota, 'createdAt' | 'updatedAt'>, size: bigint): void {
    const remaining = quota.total - quota.used
    if (remaining < size)
      throw new StashlyError(StashlyErrorCode.INSUFFICIENT_QUOTA)
  },

  // ====================================================== //
  // ==================== After Action ==================== //
  // ====================================================== //

  /**
   * Handles the quota update after a successful file upload.
   *
   * @param userId - The ID of the user.
   * @param dataSize - The sum of the sizes of the uploaded items.
   */
  async updateAfterItemsUploaded({ userId, dataSize, client }: UpdateAfterInput) {
    client = client || prisma
    return await this.update({ userId, used: dataSize, client })
  },

  /**
   * Updates the quota after items are copied.
   *
   * @param {UpdateAfterInput} input - The input object containing userId and dataSize.
   */
  async updateAfterItemsCopied({ userId, dataSize, client}: UpdateAfterInput) {
    client = client || prisma
    return await this.update({ userId, used: dataSize, client })
  },

  /**
   * Updates the quota after items are moved to trash.
   *
   * @param {UpdateAfterInput} input - The input object containing userId and dataSize.
   */
  async updateAfterItemsTrashed({ userId, dataSize, client }: UpdateAfterInput) {
    client = client || prisma
    return await this.update({ userId, used: -dataSize, deleted: dataSize, client })
  },

  /**
   * Updates the quota after items are restored from trash.
   *
   * @param {UpdateAfterInput} input - The input object containing userId and dataSize.
   */
  async updateAfterItemsRestored({ userId, dataSize, client }: UpdateAfterInput) {
    client = client || prisma
    return await this.update({ userId, used: dataSize, deleted: -dataSize, client })
  },

  /**
   * Updates the quota after items are permanently deleted from trash.
   *
   * @param {UpdateAfterInput} input - The input object containing userId and dataSize.
   */
  async updateAfterItemsDeleted({ userId, dataSize, client }: UpdateAfterInput) {
    client = client || prisma
    return await this.update({ userId, deleted: -dataSize, client })
  },

  /**
   * Updates the total quota for a user.
   *
   * @param {UpdateAfterInput} input - The input object containing userId and dataSize.
   */
  async updateTotalQuota({ userId, dataSize, client }: UpdateAfterInput) {
    client = client || prisma
    return await this.update({ userId, total: dataSize, client })
  },

  // ------------------------------------------------------------------
  // Pagination / counting
  // ------------------------------------------------------------------
  async count(args: Prisma.QuotaCountArgs): Promise<number> {
    return prisma.quota.count(args as any)
  },

  async findAllWithPagination(page: number, pageSize: number) {
    const skip = (page - 1) * pageSize
    return (await prisma.quota.findMany({ skip, take: pageSize })).map(toQuota)
  },

  async countWithFilters(
    filters: z.infer<typeof quotaFilterSchema>
  ): Promise<number> {
    const where = buildQuotaFilters(filters)
    return prisma.quota.count({ where })
  },
}

export type QuotaRepo = typeof quotaRepository

export { quotaFilterSchema, quotaFilters }
