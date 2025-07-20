import type { Route } from '../+types'
import { auth } from '@/services/auth.server'
import {
	getUserSubscription,
	updateUserSubscription,
} from '@/services/subscription.server'
import { parseFormData } from '../../utils/parsers'
import { z } from 'zod'
import { StoragePlanType, SubscriptionType } from '../../services/prisma/enums'

const schema = z.object({
	storagePlanType: z.nativeEnum(StoragePlanType),
	subscriptionType: z.nativeEnum(SubscriptionType),
})

// GET: Get current user's subscription
export async function loader({ request }: Route.LoaderArgs) {
	const session = await auth.api.getSession(request)
	const subscription = await getUserSubscription(session?.user.id || '')
	if (!subscription) {
		return new Response('No subscription found', { status: 404 })
	}

	return { subscription } // Return subscription data
}

// POST: Update subscription (e.g., change plan)
export async function action({ request }: Route.ActionArgs) {
	const session = await auth.api.getSession(request)
	const userId = session?.user.id || '' // Replace with actual user extraction
	const { storagePlanType, subscriptionType } = await parseFormData({
		request,
		schema,
	})
	const updated = await updateUserSubscription(
		userId,
		storagePlanType,
		subscriptionType
	)
	return updated
}
