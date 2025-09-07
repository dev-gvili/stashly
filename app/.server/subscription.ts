import { prisma } from '@/.server/db'
import { StoragePlanType, type SubscriptionType } from '@/prisma/enums'
// import { toQuota } from './subscription.utils'
import { formatSize } from '@/utils/formaters'

// Get a user's current subscription
export async function getUserSubscription(userId: string) {
	return prisma.subscription.findFirstOrThrow({
		where: { userId, isCurrent: true },
	})
}

// Update a user's subscription plan and quota
export async function updateUserSubscription(
	userId: string,
	newPlan: StoragePlanType,
	type: SubscriptionType = 'free'
) {
	// Validate new plan
	const validPlans = Object.values(StoragePlanType)
	if (!validPlans.includes(newPlan)) {
		throw new Error(`Invalid storage plan: ${newPlan}`)
	}

	// Wrap all database operations in a transaction for atomicity
	return prisma.$transaction(async (tx) => {
		// Fetch the current subscription and plan details
		const existingSubscription = await tx.subscription.findFirst({
			where: { userId, isCurrent: true },
			// Include the storage plan to compare storage limits
			include: { storagePlan: true },
		})

		if (!existingSubscription) {
			throw new Error(`No active subscription found for user: ${userId}`)
		}

		if (existingSubscription.storagePlanType === newPlan) {
			throw new Error(`User already has plan: ${newPlan}`)
		}

		// This should ideally not happen if data is consistent, but it's a good safeguard.
		if (!existingSubscription.storagePlan) {
			throw new Error(
				`Could not find details for the existing storage plan.`
			)
		}

		const storagePlan = await tx.storagePlan.findFirstOrThrow({
			where: { type: newPlan },
		})

		// Create a new subscription record and mark it as current
		const newSubscription = await tx.subscription.create({
			data: {
				storagePlanType: storagePlan.type,
				storagePlanId: storagePlan.id,
				status: 'active',
				type: type,
				userId: userId,
				isCurrent: true,
			},
		})

		// Dynamically determine if the change is an upgrade or downgrade
		const changeType =
			storagePlan.storageLimitGB >
			existingSubscription.storagePlan.storageLimitGB
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

		// Deactivate the old subscription
		await tx.subscription.update({
			where: { id: existingSubscription.id },
			data: { isCurrent: false },
		})

		// Update the user's drive quota
		const drive = await tx.drive.findFirstOrThrow({
			where: { ownerId: userId },
			include: { quota: true },
		})

		if (!drive.quota) {
			throw new Error(`No quota found for drive: ${drive.id}`)
		}

		const newTotal = toQuota(newPlan)
		const newQuotaValues = toQuota(drive.quota, { newTotal })

		console.log(
			`Updating quota for user ${userId} from ${formatSize("byte","unit",drive.quota.total)} to ${formatSize("byte","unit",newTotal)} used: ${formatSize("byte","unit", newQuotaValues.used)} remaining: ${formatSize("byte","unit",newQuotaValues.remaining)} deleted: ${formatSize("byte","unit",newQuotaValues.deleted)} state: ${newQuotaValues.state}`
		)
		await tx.quota.update({
			where: { id: drive.quota.id },
			data: newQuotaValues,
		})

		// Update the user record to point to the new subscription
		await tx.user.update({
			where: { id: userId },
			data: {
				subscriptionId: newSubscription.id,
				storagePlanId: storagePlan.id,
			},
		})

		return newSubscription
	})
}

// Helper: map Stripe customer ID to user ID
async function getUserIdByStripeCustomerId(stripeCustomerId: string) {
	try {
		const user = await prisma.user.findUniqueOrThrow({
			where: { stripeCustomerId },
			select: { id: true },
		})
		return user.id
	} catch (error) {
		console.error('Error fetching user by Stripe customer ID:', error)
		return null
	}
}
