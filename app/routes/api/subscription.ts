import type { Route } from '../+types'
import { auth } from '@/services/auth'
import {
	getUserSubscription,
	updateUserSubscription,
} from '@/.server/subscription'


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
}
