import Stripe from 'stripe'
import { SubscriptionEventHandler } from '@/services/subscription.events.server'

// This should be a required environment variable
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET!

export async function action({ request }: ActionFunctionArgs) {
	const payload = await request.text()
	const signature = request.headers.get('stripe-signature')

	if (!signature) {
		return new Response('No signature provided', { status: 400 })
	}

	let event: Stripe.Event
	try {
		const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
		event = stripe.webhooks.constructEvent(
			payload,
			signature,
			STRIPE_WEBHOOK_SECRET
		)
	} catch (err: any) {
		console.error(`Webhook signature verification failed: ${err.message}`)
		return new Response(`Webhook Error: ${err.message}`, { status: 400 })
	}

	const handler = new SubscriptionEventHandler()
	await handler.handleEvent(event)

	return new Response(null, { status: 200 })
}