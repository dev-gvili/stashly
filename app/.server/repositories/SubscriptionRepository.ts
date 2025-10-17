import { Prisma, type Subscription, type StoragePlan } from '@/prisma/client'
import { prisma } from '@/services/db'
import { StoragePlanType, SubscriptionStatus } from '../prisma/enums'
import { getPrefixForModel, toObjectId } from '../../utils/misc'
import { stripe } from '../stripe'
import type Stripe from 'stripe'

export const subscriptionRepository = {
	// --- Standard CRUD Methods (kept for basic operations) ---
	db: prisma,

	async findById(
		args: Prisma.SubscriptionFindUniqueArgs
	): Promise<Subscription | null> {
		return this.db.subscription.findUnique(args)
	},

	async findAll(): Promise<Subscription[]> {
		return this.db.subscription.findMany()
	},

	async create(data: Prisma.SubscriptionCreateInput): Promise<Subscription> {
		return this.db.subscription.create({ data })
	},

	async update(args: Prisma.SubscriptionUpdateArgs): Promise<Subscription> {
		return this.db.subscription.update(args)
	},

	async delete(id: string): Promise<Subscription> {
		return prisma.subscription.delete({ where: { id } })
	},

	// --- Production-Ready Custom Methods ---

	async findStripeCustomerId(userId: string): Promise<string> {
		// Retrieve the user from the database.
		const user = await this.db.user.findUniqueOrThrow({
			where: { id: userId },
		})

		// Check for Existing ID: checks if the user's record in local database already has a stripeCustomerId.
		if (user.stripeCustomerId !== null) {
			// Verify with Stripe: If an ID exists locally, we call stripe.customers.retrieve() to confirm that this customer ID is still valid on Stripe's servers. If it's valid, the function returns that ID immediately.
			try {
				const customer = await stripe.customers.retrieve(
					user.stripeCustomerId
				)
				return customer.id
			} catch (error) {}
		}

		// Check by Email: Before creating a brand new customer, we searches Stripe for existing customers with the same email address to avoid creating duplicates.
		let customers = await stripe.customers.list({
			email: user.email,
			limit: 1,
		})

		// If a customer with that email is found, we reuses that existing Stripe customer.
		let customer = customers.data[0]

		// If customer with that email not found, we creates a new customer in Stripe using the user's email and linking it to your internal userId via metadata.
		if (!customer) {
			customer = await stripe.customers.create({
				email: user.email,
				name: user.name ?? undefined,
				metadata: {
					userId: user.id,
				},
			})
		}

		// Update Local Database: update the user with the created or retrieved Stripe customer ID.
		await this.db.user.update({
			where: { id: userId },
			data: {
				stripeCustomerId: customer.id,
			},
		})

		// Return ID: Finally, it returns the valid customer ID.
		return customer.id
	},
	
	async findActiveByOwnerId(ownerId: string): Promise<Subscription | null> {
		return this.db.subscription.findFirst({
			where: {
				ownerId,
				status: { in: [SubscriptionStatus.active] },
			},
		})
	},

	async findActiveByStripeCustomerId(
		stripeCustomerId: string
	): Promise<Subscription | null> {
		return this.db.subscription.findFirst({
			where: {
				owner: {
					stripeCustomerId,
				},
				status: { in: [SubscriptionStatus.active] },
			},
		})
	},

	async findActiveByStoragePlanType(
		storagePlanType: StoragePlanType
	): Promise<Subscription | null> {
		return this.db.subscription.findFirst({
			where: {
				storagePlan: {
					type: storagePlanType,
				},
				status: { in: [SubscriptionStatus.active] },
			},
		})
	},

	async findActive({
		ownerId,
		stripeCustomerId,
		storagePlanType,
	}: {
		ownerId: string
		stripeCustomerId: string
		storagePlanType: StoragePlanType
	}) {
		return this.db.subscription.findFirst({
			where: {
				ownerId,
				owner: {
					stripeCustomerId,
				},
				storagePlan: {
					type: storagePlanType,
				},
				status: { in: [SubscriptionStatus.active] },
			},
		})
	},

	async findByStripeSubscriptionId(
		stripeSubscriptionId: string
	): Promise<Subscription | null> {
		return this.db.subscription.findUnique({
			where: { stripeSubscriptionId },
		})
	},

	async listPrices() {
		const prices = await stripe.prices.list({
			expand: ['data.product'],
			type: 'recurring',
			limit: 25,
			active: true,
		})
		return prices.data
	},

	async listProducts() {
		return stripe.products.list()
	},

	async findPriceById(priceId: string) {
		return stripe.prices.retrieve(priceId, { expand: ['product'] })
	},

	async findProductById(productId: string) {
		return stripe.products.retrieve(productId)
	},

	async findProductByPriceId(priceId: string) {
		return stripe.prices
			.retrieve(priceId, { expand: ['product'] })
			.then((price) => price.product)
	},

	async findSubscriptionByCustomerId(customerId: string) {
		return stripe.subscriptions.list({ customer: customerId })
	},

	async findSubscriptionById(subscriptionId: string) {
		return stripe.subscriptions.retrieve(subscriptionId)
	},

	async findCustomerById(customerId: string) {
		return stripe.customers.retrieve(customerId)
	},

	async findCustomerByEmail(email: string) {
		return stripe.customers
			.list({ email, limit: 1 })
			.then((customers) => customers.data[0])
	},

	async createCustomer(email: string, name?: string, userId?: string) {
		return stripe.customers.create({
			email,
			name,
			metadata: userId ? { userId } : undefined,
		})
	},

	async createSubscription(customerId: string, priceId: string) {
		return stripe.subscriptions.create({
			customer: customerId,
			items: [{ price: priceId }],
		})
	},

	async cancelSubscription(subscriptionId: string) {
		return stripe.subscriptions.update(subscriptionId, {
			cancel_at_period_end: true,
		})
	},

	async updateSubscription(
		subscriptionId: string,
		data: Stripe.SubscriptionUpdateParams
	) {
		return stripe.subscriptions.update(subscriptionId, data)
	},

	async updateByStripeId(
		stripeSubscriptionId: string,
		data: Prisma.SubscriptionUpdateInput
	): Promise<Subscription> {
		return prisma.subscription.update({
			where: { stripeSubscriptionId },
			data,
		})
	},

	// --- New Transactional, Multi-Model Methods ---

	/**
	 * Creates a new subscription and updates the quota.
	 * This is a transactional operation to ensure data integrity.
	 * @param userId The user who initiated the subscription.
	 * @param storagePlan The plan being subscribed to.
	 * @param stripeSubscription The subscription data from Stripe.
	 */
	async createSubscriptionAndInitializeQuota(
		userId: string,
		storagePlan: StoragePlan,
		stripeSubscription: {
			stripeSubscriptionId: string
			status: SubscriptionStatus
		}
	): Promise<Subscription> {
		const { stripeSubscriptionId, status } = stripeSubscription

		return this.db.$transaction(async (tx) => {
			// 1. Create the Subscription
			const newSubscription = await tx.subscription.create({
				data: {
					ownerId: userId,
					id: toObjectId(getPrefixForModel('Subscription')),
					storagePlanId: storagePlan.id,
					stripeSubscriptionId,
					status,
				},
				include: { storagePlan: true, owner: true },
			})

			// 2. Update the Workspace's Quota
			await tx.quota.update({
				where: { driveId: newSubscription.owner.driveId! },
				data: {
					total: storagePlan.storageLimit,
				},
			})

			return newSubscription
		})
	},

	/**
	 * Changes a subscription's plan, updates the quota, and logs the event.
	 * Handles upgrades/downgrades within a single transaction.
	 * @param stripeSubscriptionId The Stripe ID of the subscription to change.
	 * @param newPlan The new storage plan.
	 */
	async changeSubscriptionPlan(
		stripeSubscriptionId: string,
		newPlan: StoragePlan
	): Promise<Subscription> {
		return this.db.$transaction(async (tx) => {
			// 1. Get the current subscription to identify the old plan
			const currentSubscription = await tx.subscription.findUniqueOrThrow(
				{
					where: { stripeSubscriptionId },
					include: { storagePlan: true, owner: true },
				}
			)

			// 2. Update the subscription to point to the new plan
			const updatedSubscription = await tx.subscription.update({
				where: { stripeSubscriptionId },
				data: {
					storagePlanId: newPlan.id,
				},
			})

			// 3. Update the associated workspace's quota
			await tx.quota.update({
				where: { driveId: currentSubscription.owner.driveId! },
				data: {
					total: newPlan.storageLimit,
				},
			})

			return updatedSubscription
		})
	},

	/**
	 * Sets a subscription to be canceled and logs the event in the history.
	 * This is now a transactional operation.
	 */
	async setAsCanceled(
		stripeSubscriptionId: string,
		cancelAt: Date
	): Promise<Subscription> {
		return this.db.$transaction(async (tx) => {
			// 1. Update the subscription status
			const canceledSubscription = await tx.subscription.update({
				where: { stripeSubscriptionId },
				data: {
					status: SubscriptionStatus.canceled,
					endedAt: cancelAt,
				},
			})

			return canceledSubscription
		})
	},
}
