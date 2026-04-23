import type { Prisma, StoragePlanType } from '@/prisma/client'
import { prisma } from '@/services/db'

/**
 * Find a storage plan by ID. Throws if not found.
 *
 * @param id - The storage plan ID.
 * @returns The storage plan.
 * @throws {PrismaClientKnownRequestError} If no plan with the given ID exists.
 *
 * @example
 * const plan = await findStoragePlanById('sp_abc123')
 * console.log(plan.storageLimit)
 */
export async function findStoragePlanById(id: string) {
  return prisma.storagePlan.findUniqueOrThrow({ where: { id } })
}

/**
 * Find all storage plans matching the given Prisma args.
 *
 * @param args - Prisma `findMany` args (where, orderBy, take, skip, etc.).
 * @returns Array of matching storage plans.
 *
 * @example
 * const plans = await findAllStoragePlans({ orderBy: { priceCents: 'asc' } })
 */
export async function findAllStoragePlans(args: Prisma.StoragePlanFindManyArgs) {
  return prisma.storagePlan.findMany(args)
}

/**
 * Create a new storage plan.
 *
 * @param args - Prisma `StoragePlanCreateArgs`.
 * @returns The created storage plan.
 *
 * @example
 * const plan = await createStoragePlan({
 *   data: {
 *     id: 'sp_new',
 *     name: 'Enterprise',
 *     tag: 'enterprise',
 *     type: 'custom',
 *     storageLimit: 10_000_000_000_000n,
 *     workspaceLimit: 100,
 *     memberLimit: 500,
 *     features: ['unlimited-upload', 'priority-support'],
 *   },
 * })
 */
export async function createStoragePlan(args: Prisma.StoragePlanCreateArgs) {
  return prisma.storagePlan.create(args)
}

/**
 * Update a storage plan.
 *
 * @param args - Prisma `StoragePlanUpdateArgs` (where + data).
 * @returns The updated storage plan.
 *
 * @example
 * const plan = await updateStoragePlan({
 *   where: { id: 'sp_abc123' },
 *   data: { priceCents: 999 },
 * })
 */
export async function updateStoragePlan(args: Prisma.StoragePlanUpdateArgs) {
  return prisma.storagePlan.update(args)
}

/**
 * Delete a storage plan.
 *
 * @param args - Prisma `StoragePlanDeleteArgs` (where).
 * @returns The deleted storage plan.
 *
 * @example
 * const deleted = await deleteStoragePlan({ where: { id: 'sp_abc123' } })
 */
export async function deleteStoragePlan(args: Prisma.StoragePlanDeleteArgs) {
  return prisma.storagePlan.delete(args)
}

/**
 * Find the first storage plan matching a given type.
 *
 * @param type - The plan type (e.g. `'free'`, `'basic'`, `'premium'`).
 * @returns The matching plan, or `null` if none exists.
 *
 * @example
 * const free = await findStoragePlanByType('free')
 * const premium = await findStoragePlanByType('premium')
 */
export async function findStoragePlanByType(type: StoragePlanType) {
  return prisma.storagePlan.findFirst({ where: { type } })
}

/**
 * Find a storage plan by its display name.
 *
 * @param name - The plan name (e.g. `'Free'`, `'Basic'`).
 * @returns The matching plan, or `null` if none exists.
 *
 * @example
 * const plan = await findStoragePlanByName('Standard')
 */
export async function findStoragePlanByName(name: string) {
  return prisma.storagePlan.findFirst({ where: { name } })
}

/**
 * Find multiple storage plans by their IDs.
 *
 * @param ids - Array of storage plan IDs.
 * @returns Array of matching storage plans.
 *
 * @example
 * const plans = await findStoragePlansByIds(['sp_abc', 'sp_def'])
 */
export async function findStoragePlansByIds(ids: string[]) {
  return prisma.storagePlan.findMany({ where: { id: { in: ids } } })
}

/**
 * Find a storage plan by its Stripe price ID.
 *
 * @param priceId - The Stripe price ID.
 * @returns The matching plan, or `null` if none exists.
 *
 * @example
 * const plan = await findStoragePlanByPriceId('price_1abc')
 */
export async function findStoragePlanByPriceId(priceId: string) {
  return prisma.storagePlan.findFirst({ where: { stripePriceId: priceId } })
}

/**
 * Find a storage plan matching both a type and a Stripe price ID.
 * Useful when disambiguating plans that share a type but have different prices.
 *
 * @param type - The plan type.
 * @param priceId - The Stripe price ID.
 * @returns The matching plan, or `null` if none exists.
 *
 * @example
 * const plan = await findStoragePlanByTypeAndPrice('basic', 'price_1abc')
 */
export async function findStoragePlanByTypeAndPrice(type: StoragePlanType, priceId: string) {
  return prisma.storagePlan.findFirst({ where: { type, stripePriceId: priceId } })
}

/**
 * Find a storage plan matching both a type and a storage limit.
 *
 * @param type - The plan type.
 * @param limit - The storage limit in bytes.
 * @returns The matching plan, or `null` if none exists.
 *
 * @example
 * const plan = await findStoragePlanByTypeAndLimit('basic', 107_374_182_400n) // 100 GB
 */
export async function findStoragePlanByTypeAndLimit(type: StoragePlanType, limit: bigint) {
  return prisma.storagePlan.findFirst({ where: { type, storageLimit: limit } })
}

/**
 * Get the storage, workspace, and member limits for a plan type.
 * Throws if the plan type does not exist.
 *
 * @param type - The plan type.
 * @returns An object with `storageLimit`, `workspaceLimit`, and `memberLimit`.
 * @throws {Error} If no plan of the given type is found.
 *
 * @example
 * const { storageLimit, workspaceLimit } = await findStoragePlanLimitsByType('premium')
 */
export async function findStoragePlanLimitsByType(type: StoragePlanType) {
  const plan = await findStoragePlanByType(type)
  if (!plan) throw new Error(`Storage plan ${type} not found`)
  return {
    storageLimit: plan.storageLimit,
    workspaceLimit: plan.workspaceLimit,
    memberLimit: plan.memberLimit,
  }
}

/**
 * Get the default (free) storage plan. Throws if it does not exist.
 *
 * @param client - Optional Prisma transaction client.
 * @returns The free storage plan.
 * @throws {PrismaClientKnownRequestError} If no free plan exists in the database.
 *
 * @example
 * const plan = await findDefaultStoragePlan()
 *
 * // Inside a transaction:
 * await prisma.$transaction(async (tx) => {
 *   const plan = await findDefaultStoragePlan(tx)
 * })
 */
export async function findDefaultStoragePlan(client: Prisma.TransactionClient = prisma) {
  return client.storagePlan.findFirstOrThrow({ where: { type: 'free' } })
}
