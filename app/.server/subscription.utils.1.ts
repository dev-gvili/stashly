import {
	StoragePlanType,
	SubscriptionStatus,
} from '@/prisma/enums'
import {
	Prisma,
	type StoragePlan,
} from '@/prisma/client'
import { prisma } from './db'
import { ApiError, ApiErrorCode } from './api.errors'

// ====================================================== //
// ==================== INTERFACES ====================== //
// ====================================================== //

export type Action = 'find' | 'create' | 'update' | 'cancel'

/**
 * Defines the unified input for all subscription-related functions.
 * All actions (find, create, update) will use this single input type.
 */
export interface SubscriptionInput {
	userId: string
	storagePlanType?: StoragePlanType
	subscriptionType?: SubscriptionType
	status?: SubscriptionStatus
}

/**
 * Defines the unified output for all subscription-related functions.
 * All functions will return an object with a consistent structure.
 */

// Define common output type for consistency
type SubscriptionOutput = Prisma.SubscriptionGetPayload<{
	include: { storagePlan: true }
}> & { subscriptionEvent?: Prisma.SubscriptionHistoryGetPayload<{}> }


// export interface SubscriptionOutput extends Subscription {
// 	storagePlan?: StoragePlan | null
// 	subscriptionEvent?: SubscriptionHistory
// }

// ====================================================== //
// ==================== UTILITY FUNCTIONS ==================== //
// These private functions are called by `handleSubscriptionAction`
// ====================================================== //

/**
 * Determines the event type by comparing the storage limits of the previous and current plans.
 */
function toSubscriptionEventType(
	previous: StoragePlan,
	current: StoragePlan
): SubscriptionEventType {
	if (current.storageLimit > previous.storageLimit) {
		return SubscriptionEventType.upgrade
	}
	if (current.storageLimit < previous.storageLimit) {
		return SubscriptionEventType.downgrade
	}

	// If storage limits are identical, we can assume it's a renewal.
	return SubscriptionEventType.renewal
}

// ====================================================== //
// ==================== HANDLER FUNCTIONS ==================== //
// These private functions are called by `handleSubscriptionAction`
// ====================================================== //

/**
 * Finds the current subscription for a user.
 * @param userId The ID of the user.
 * @returns The subscription and any associated data.
 */
async function findSubscription({
	userId,
}: SubscriptionInput): Promise<SubscriptionOutput> {
	const subscription = await prisma.subscription.findFirst({
		where: { userId },
		include: { storagePlan: true },
	})
	if (!subscription) {
		throw new ApiError(
			ApiErrorCode.SUBSCRIPTION_NOT_FOUND,
			`No active subscription found for user ${userId}.`
		)
	}
	return subscription
}

/**
 * Creates a new subscription for a user.
 * @param input The input containing all necessary data for creation.
 * @returns The newly created subscription and a history record.
 */
export async function createSubscription({
	userId,
	storagePlanType,
	subscriptionType,
}: SubscriptionInput): Promise<SubscriptionOutput> {
	if (!storagePlanType) {
		throw new ApiError(
			ApiErrorCode.INVALID_INPUT,
			`storagePlanType is required to create a new subscription.`
		)
	}

	return await prisma.$transaction(async (tx) => {
		const storagePlan = await tx.storagePlan.findFirstOrThrow({
			where: { type: storagePlanType },
		})

		const newSubscription = await tx.subscription.create({
			data: {
				storagePlanType: storagePlan.type,
				storagePlanId: storagePlan.id,
				status: subscriptionStatus.parse('active'),
				type: subscriptionType,
				userId,
			},
			include: { storagePlan: true },
		})

		const subscriptionEvent = await logSubscriptionEvent({
			subscriptionId: newSubscription.id,
			changeType: SubscriptionEventType.creation,
			previousPlan: null,
			newPlan: newSubscription.storagePlanType,
			metadata: { type: newSubscription.type },
		})

		return { ...newSubscription, subscriptionEvent }
	})
}

/**
 * Updates an existing subscription for a user.
 * @param input The input containing the user ID and new subscription data.
 * @returns The updated subscription and a history record.
 */
async function updateSubscription({
	userId,
	storagePlanType,
	status,
	subscriptionType,
}: SubscriptionInput): Promise<SubscriptionOutput> {
	if (!storagePlanType && !status && !subscriptionType) {
		throw new ApiError(
			ApiErrorCode.INVALID_INPUT,
			`At least one of storagePlanType, status, or subscriptionType is required to update a subscription.`
		)
	}

	return await prisma.$transaction(async (tx) => {
		const existingSubscription = await findSubscription({
			userId,
		})

		if (!existingSubscription) {
			throw new ApiError(
				ApiErrorCode.SUBSCRIPTION_NOT_FOUND,
				`No active subscription found for user ${userId}.`
			)
		}

		// if no storagePlan
		if (!existingSubscription.storagePlan) {
			throw new ApiError(
				ApiErrorCode.STORAGE_PLAN_NOT_FOUND,
				`No active storage plan found for subscription ${existingSubscription.id}.`
			)
		}

		// Determine the new plan type, defaulting to the existing one if not provided

		const previousPlanType = existingSubscription.storagePlanType
		const newPlanType = storagePlanType || previousPlanType

		// Determine the event type before updating
		const eventType = toSubscriptionEventType(
			existingSubscription.storagePlan,
			{
				...existingSubscription.storagePlan,
				type: newPlanType,
			}
		)

		const updatedSubscription = await tx.subscription.update({
			where: { id: existingSubscription.id },
			data: {
				storagePlanType: newPlanType,
				status: status,
				type: subscriptionType,
			},
			include: { storagePlan: true },
		})

		const subscriptionEvent = await logSubscriptionEvent({
			subscriptionId: updatedSubscription.id,
			changeType: eventType,
			previousPlan: previousPlanType,
			newPlan: updatedSubscription.storagePlanType,
			metadata: {
				type: updatedSubscription.type,
				oldStatus: existingSubscription.status,
				newStatus: updatedSubscription.status,
			},
		})

		return { ...updatedSubscription, subscriptionEvent }
	})
}
/**
 * Cancels an existing subscription for a user.
 * @param input The input containing the user ID.
 * @returns The cancelled subscription and a history record.
 */
export async function cancelSubscription({
	userId,
}: SubscriptionInput): Promise<SubscriptionOutput> {
	return await updateSubscription({ userId, status: 'cancelled' })
	// return await prisma.$transaction(async (tx) => {
	// 	const existingSubscription = await findSubscription({ userId })

	// 	if (!existingSubscription) {
	// 		throw new ApiError(
	// 			ApiErrorCode.SUBSCRIPTION_NOT_FOUND,
	// 			`No active subscription found for user ${userId}.`
	// 		)
	// 	}

	// 	const cancelledSubscription = await tx.subscription.update({
	// 		where: { id: existingSubscription.id },
	// 		data: {
	// 			status: subscriptionStatus.parse('cancelled'),
	// 			endDate: new Date(),
	// 		},
	// 		include: { storagePlan: true },
	// 	})

	// 	const historyRecord = await tx.subscriptionHistory.create({
	// 		data: {
	// 			subscriptionId: cancelledSubscription.id,
	// 			changeType: subscriptionChangeType.parse('cancellation'),
	// 			previousPlan: existingSubscription.storagePlanType,
	// 			newPlan: null,
	// 			metadata: { type: existingSubscription.type },
	// 		},
	// 	})

	// 	return { ...cancelledSubscription, historyRecord }
	// })
}

/**
 * Changes a subscription's billing cycle (e.g., from monthly to annual).
 * @param userId The ID of the user.
 * @param newCycle The new subscription type ('monthly' or 'annual').
 * @returns The updated subscription and the corresponding history record.
 */
export async function updateSubscriptionBillingType(
	userId: string,
	subscriptionType: SubscriptionType
): Promise<SubscriptionOutput> {
	return await prisma.$transaction(async (tx) => {
		const subscription = await findSubscription({ userId })

		if (!subscription || !subscription.storagePlan) {
			throw new ApiError(
				ApiErrorCode.SUBSCRIPTION_NOT_FOUND,
				`No subscription found for user ${userId}.`
			)
		}

		if (subscription.type === subscriptionType) {
			throw new ApiError(
				ApiErrorCode.INVALID_INPUT,
				`Subscription is already set to '${subscriptionType}'.`
			)
		}

		const updatedSubscription = await tx.subscription.update({
			where: { id: subscription.id, userId: userId },
			data: { type: subscriptionType },
			include: { storagePlan: true },
		})

		// Suggestion: Add 'BILLING_CYCLE_CHANGED' to your SubscriptionEventType enum
		// For now, we can log it with metadata.
		const subscriptionEvent = await logSubscriptionEvent({
			subscriptionId: updatedSubscription.id,
			changeType: SubscriptionEventType.billing_cycle_change, // Or a new, more specific type
			newPlan: updatedSubscription.storagePlan.type,
			previousPlan: subscription.storagePlanType,
			metadata: {
				message: `Billing cycle changed from ${subscription.type} to ${subscriptionType}.`,
			},
		})

		return { ...updatedSubscription, subscriptionEvent }
	})
}

/**
 * Changes a user's subscription to a new storage plan, handling upgrades/downgrades.
 * This function is responsible for updating the plan and provisioning the correct storage quota.
 * @param userId The ID of the user.
 * @param newPlanId The ID of the new StoragePlan.
 * @returns The updated subscription and a history record.
 */
async function changeSubscriptionPlan(
	userId: string,
	newPlanId: string
): Promise<SubscriptionOutput> {
	return await prisma.$transaction(async (tx) => {
		// 1. Get all necessary current data in one go
		const user = await tx.user.findUnique({
			where: { id: userId },
			include: {
				subscription: { include: { storagePlan: true } },
				drive: true, // We need the drive to find the quota
			},
		})

		// 2. Validate the data
		const oldSubscription = user?.subscription
		const oldPlan = user?.subscription?.storagePlan
		const drive = user?.drive

		if (!oldSubscription || !oldPlan || !drive) {
			throw new ApiError(
				ApiErrorCode.NOT_FOUND,
				`Could not find a complete subscription, plan, or drive for user ${userId}.`
			)
		}

		const newPlan = await tx.storagePlan.findUnique({
			where: { id: newPlanId },
		})

		if (!newPlan) {
			throw new ApiError(
				ApiErrorCode.STORAGE_PLAN_NOT_FOUND,
				`The plan with ID ${newPlanId} does not exist.`
			)
		}

		// 3. Determine the event type (using a data-driven approach)
		const eventType = getChangeType(oldPlan, newPlan) // Assumes getChangeType uses storageLimit or price

		// 4. Update the subscription to point to the new plan
		const updatedSubscription = await tx.subscription.update({
			where: { id: oldSubscription.id },
			data: {
				storagePlanId: newPlan.id, // Update the foreign key to the new plan
			},
			include: { storagePlan: true },
		})

		// 5. --- THIS IS THE CRITICAL FIX ---
		// Update the user's quota to match the new plan's limit
		await tx.quota.update({
			where: { driveId: drive.id },
			data: {
				total: newPlan.storageLimit,
			},
		})

		// 6. Log the event
		const historyRecord = await logSubscriptionEvent({
			subscriptionId: updatedSubscription.id,
			changeType: eventType,
			previousPlan: oldPlan.type,
			newPlan: newPlan.type,
		})

		return { ...updatedSubscription, historyRecord }
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
