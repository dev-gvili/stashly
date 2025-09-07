import {
	StoragePlanType,
	SubscriptionChangeType,
	SubscriptionStatus,
	SubscriptionType,
} from '@/prisma/enums'
import {
	Prisma,
	type StoragePlan,
	type Subscription,
	type SubscriptionHistory,
} from '@/prisma/client'
import { prisma } from './db'
import { ApiError, ApiErrorCode } from './api.errors'
import { z } from 'zod'

interface FindSubscriptionInput {
	userId: string
}

interface SubscriptionInput {
	userId: string
	storagePlanType: StoragePlanType
	type?: SubscriptionType
	status?: SubscriptionStatus
}

let subscriptionChangeType = z.nativeEnum(SubscriptionChangeType)
let storagePlanType = z.nativeEnum(StoragePlanType).default('free')
let subscriptionStatus = z.nativeEnum(SubscriptionStatus).default('active')
let subscriptionType = z.nativeEnum(SubscriptionType).default('free')

let baseStoragePlan = z.object({
	id: z.string().uuid(),
	type: storagePlanType,
	storageLimit: z.coerce.bigint(),
	priceMonthly: z.instanceof(Prisma.Decimal),
	priceAnnual: z.instanceof(Prisma.Decimal).optional(),
})

let baseSubscriptionHistory = z.object({
	id: z.string().uuid(),
	subscriptionId: z.string().uuid(),
	changeType: subscriptionChangeType,
	newPlan: storagePlanType.nullable(),
	previousPlan: storagePlanType.nullable(),
	createdAt: z.date(),
})

// Define the full Subscription type including relations
let baseSubscription = z.object({
	id: z.string().uuid(),
	userId: z.string().uuid(),
	storagePlanId: z.string().uuid().optional(),
	stripeCustomerId: z.string().uuid().optional(),
	type: subscriptionType,
	status: subscriptionStatus,
	storagePlanType: storagePlanType,
	isCurrent: z.boolean().default(true),
	startDate: z.date(),
	createdAt: z.date(),
	updatedAt: z.date(),
	endDate: z.date().optional(),
	metadata: z.string().optional(),
})

let storagePlan = baseStoragePlan.extend({
	subscriptions: z.array(baseSubscription).optional(),
})

let subscription = baseSubscription.extend({
	storagePlan: storagePlan,
	history: z.array(baseSubscriptionHistory).optional(),
})

type SubscriptionOutput = z.infer<typeof subscription>

/**
 * Finds a user's active subscription by their user ID.
 * @param userId - The ID of the user.
 * @returns The user's subscription or null if not found.
 */
export async function findSubscription({ userId }: FindSubscriptionInput) {
	let userSubscription = await prisma.subscription.findFirst({
		where: { userId },
		include: { storagePlan: true },
	})

	if (!userSubscription) {
		throw new ApiError(ApiErrorCode.SUBSCRIPTION_NOT_FOUND)
	}

	return subscription.parse(userSubscription)
}

/**
 * Creates a new subscription for a user.
 * @param data - The data for the new subscription.
 * @returns The newly created subscription.
 */
export async function createSubscription(
	data: Prisma.SubscriptionUncheckedCreateInput
): Promise<SubscriptionOutput> {
	let userSubscription = await prisma.subscription.create({
		data,
		include: { storagePlan: true },
	})

	if (!userSubscription) {
		throw new ApiError(ApiErrorCode.CREATE_SUBSCRIPTION_FAILED)
	}

	return subscription.parse(userSubscription)
}

/**
 * Updates an existing subscription.
 * @param subscriptionId - The ID of the subscription to update.
 * @param data - The data to update.
 * @returns The updated subscription.
 */
export async function updateSubscription(
	userId: string,
	data: Prisma.SubscriptionUpdateInput
): Promise<SubscriptionOutput> {
	let userSubscription = await prisma.subscription.update({
		where: { userId },
		data,
		include: { storagePlan: true },
	})

	if (!userSubscription) {
		throw new ApiError(ApiErrorCode.UPDATE_SUBSCRIPTION_FAILED)
	}

	return subscription.parse(userSubscription)
}

export async function cancelSubscription({
	userId,
}: SubscriptionInput): Promise<SubscriptionOutput> {
	return await prisma.$transaction(async (tx) => {
		const userSubscription = await tx.subscription.update({
			where: { userId },
			data: {
				status: 'cancelled',
				// TODO: You might also set the `endDate` to the end of the current billing period.
			},
			include: { storagePlan: true },
		})

		if (!userSubscription) {
			throw new ApiError(ApiErrorCode.CANCEL_SUBSCRIPTION_FAILED)
		}

		await logSubscriptionEvent({
			subscriptionId: userSubscription.id,
			changeType: 'cancellation',
			previousPlan: userSubscription.storagePlan?.type,
		})

		return subscription.parse(userSubscription)
	})
}

/**
 * Logs a subscription-related event to the subscription history table.
 * @param data - The data for the history entry.
 * @returns The newly created history entry.
 */
export async function logSubscriptionEvent(
	data: Prisma.SubscriptionHistoryUncheckedCreateInput
): Promise<SubscriptionHistory> {
	return prisma.subscriptionHistory.create({ data })
}

/**
 * Retrieves the full subscription history for a user, ordered by creation date.
 * @param userId - The ID of the user.
 * @returns An array of subscription history entries.
 */
export async function listSubscriptionHistory(
	userId: string
): Promise<SubscriptionHistory[]> {
	return prisma.subscriptionHistory.findMany({
		where: {
			subscription: { userId },
		},
	})
}

/**
 * Determines the change type by comparing the storage limits of the previous and current plans.
 */
function toSubscriptionChangeType(
	previous: StoragePlan,
	current: StoragePlan
): SubscriptionChangeType {
	if (current.storageLimit > previous.storageLimit) {
		return SubscriptionChangeType.upgrade
	}
	if (current.storageLimit < previous.storageLimit) {
		return SubscriptionChangeType.downgrade
	}

	// If storage limits are identical, we can assume it's a renewal.
	return SubscriptionChangeType.renewal
}
/**
 * Changes a user's subscription plan, handling upgrades, downgrades, and logging the event.
 * @param userId - The ID of the user.
 * @param newPlan - The new storage plan type.
 * @param type - The type of subscription (e.g., 'free', 'paid').
 * @returns The updated subscription.
 */
export async function changeSubscriptionPlan(
	userId: string,
	storagePlanType: StoragePlanType,
	subscriptionType: SubscriptionType = 'free'
): Promise<Subscription> {
	return prisma.$transaction(async (tx) => {
		// Fetch the current subscription and plan details
		const existingSubscription = await tx.subscription.findFirst({
			where: { userId },
			// Include the storage plan to compare storage limits
			include: { storagePlan: true },
		})

		if (!existingSubscription) {
			throw new ApiError(ApiErrorCode.SUBSCRIPTION_NOT_FOUND)
		}

		if (existingSubscription.storagePlanType === storagePlanType) {
			throw new ApiError(
				ApiErrorCode.UPDATE_SUBSCRIPTION_FAILED,
				`User already has plan: ${storagePlanType}`
			)
		}

		// This should ideally not happen if data is consistent, but it's a good safeguard.
		if (!existingSubscription.storagePlan) {
			throw new ApiError(
				ApiErrorCode.STORAGE_NOT_FOUND,
				`Could not find details for the existing storage plan.`
			)
		}

		const storagePlan = await tx.storagePlan.findFirstOrThrow({
			where: { type: storagePlanType },
		})

		// Create a new subscription record and mark it as current
		const newSubscription = await tx.subscription.create({
			data: {
				storagePlanType: storagePlan.type,
				storagePlanId: storagePlan.id,
				status: 'active',
				type: subscriptionType,
				userId: userId,
			},
		})

		// Dynamically determine if the change is an upgrade or downgrade
		const changeType =
			storagePlan.storageLimit >
			existingSubscription.storagePlan.storageLimit
				? 'upgrade'
				: 'downgrade'

		// Log the change in subscription history
		await tx.subscriptionHistory.create({
			data: {
				subscriptionId: newSubscription.id,
				changeType: changeType,
				previousPlan: existingSubscription.storagePlanType,
				newPlan: newSubscription.storagePlanType,
				metadata: {
					type: newSubscription.type,
				},
			},
		})

		return newSubscription
	})
}
