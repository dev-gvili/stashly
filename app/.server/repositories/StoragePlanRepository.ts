import type { StoragePlan, StoragePlanType } from '@/prisma/client'
import { prisma } from '@/services/db'

export const storagePlanRepository = {

	async findById(id: string): Promise<StoragePlan> {
		return prisma.storagePlan.findUniqueOrThrow({
			where: { id },
		})
	},

	async findAll(args: unknown): Promise<StoragePlan[]> {
		return prisma.storagePlan.findMany(args as any)
	},

	async create(args: unknown): Promise<StoragePlan> {
		return prisma.storagePlan.create(args as any)
	},

	async update(args: unknown): Promise<StoragePlan> {
		return prisma.storagePlan.update(args as any)
	},

	async delete(args: unknown): Promise<StoragePlan> {
		return prisma.storagePlan.delete(args as any)
	},

	async findByType(type: StoragePlanType): Promise<StoragePlan | null> {
		return prisma.storagePlan.findFirst({ where: { type } })
	},
	
	// Find a plan by its name
	async findByName(name: string): Promise<StoragePlan | null> {
		return prisma.storagePlan.findFirst({ where: { name } })
	},

	// Find all plans with pagination support
	async findAllWithPagination(
		page: number,
		pageSize: number
	): Promise<StoragePlan[]> {
		const skip = (page - 1) * pageSize
		return prisma.storagePlan.findMany({ skip, take: pageSize })
	},

	// Find multiple plans by an array of IDs
	async findByIds(ids: string[]): Promise<StoragePlan[]> {
		return prisma.storagePlan.findMany({ where: { id: { in: ids } } })
	},

	// Find a plan by its Stripe price ID
	async findByPriceId(priceId: string): Promise<StoragePlan | null> {
		return prisma.storagePlan.findFirst({
			where: { stripePriceId: priceId },
		})
	},

	// Find a plan by type and price ID
	async findByTypeAndPrice(
		type: StoragePlanType,
		priceId: string
	): Promise<StoragePlan | null> {
		return prisma.storagePlan.findFirst({
			where: { type, stripePriceId: priceId },
		})
	},

	// Find a plan by type and storage limit
	async findByTypeAndLimit(
		type: StoragePlanType,
		limit: bigint
	): Promise<StoragePlan | null> {
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
	async findLimitsByType(type: StoragePlanType): Promise<{
		storageLimit: bigint
		workspaceLimit: number
		memberLimit: number
	}> {
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
	async findDefault(): Promise<StoragePlan> {
		return prisma.storagePlan.findFirstOrThrow({
			where: { type: 'free' },
		})
	},
}
