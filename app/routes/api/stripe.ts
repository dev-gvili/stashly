import { data } from 'react-router'
import Stripe from 'stripe'
import type { Route } from './+types/stripe'
import { inspect } from 'util'
import { stripe } from '../../.server/stripe'

// This is a Remix action that acts as an API endpoint for Stripe webhooks.
export const action = async ({ request }: Route.ActionArgs) => {
  // Only allow POST requests
  if (request.method !== 'POST') {
    return data({ message: 'Method Not Allowed' }, { status: 405 })
  }

  const signature = request.headers.get('stripe-signature')
  const rawBody = await request.text()

  if (!signature) {
    return data({ message: 'No signature provided.' }, { status: 400 })
  }

  try {
    // Construct the event from the raw body and signature. This verifies the event's authenticity.
    const event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    )

    // Handle different event types related to subscriptions.
    switch (event.type) {
      case 'checkout.session.completed':
        const checkoutSession = event.data.object as Stripe.Checkout.Session
        console.log(
          `Checkout session completed for session ID: ${checkoutSession.id}`
        )

        // Extract necessary data, like the user ID from metadata
        const userId = checkoutSession.metadata?.userId
        const subscriptionId = checkoutSession.subscription as string

        // Make sure both a user and subscription are found
        if (userId && subscriptionId) {
          // TODO: This is where you would create the initial subscription record in your database.
          // Example with a Prisma ORM call:
          // await prisma.subscription.create({
          //   data: {
          //     userId,
          //     stripeSubscriptionId: subscriptionId,
          //     status: 'active',
          //     // Other subscription details
          //   },
          // });
          console.log(`New subscription started for user: ${userId}`)
        }
        break

      case 'customer.subscription.updated':
        const subscription = event.data.object as Stripe.Subscription
        console.log(
          `Subscription updated for subscription ID: ${subscription.id}`,
          inspect(subscription, { colors: true, depth: null })
        )
        // TODO: Update the subscription status in your database. This event handles renewals,
        // cancellations, and plan changes.
        // Example:
        // await prisma.subscription.update({
        //   where: { stripeSubscriptionId: subscription.id },
        //   data: {
        //     status: subscription.status,
        //     currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        //     // Update other fields as needed
        //   },
        // });
        break

      case 'customer.subscription.deleted':
        const deletedSubscription = event.data.object as Stripe.Subscription
        console.log(
          `Subscription deleted for subscription ID: ${deletedSubscription.id}`,
          inspect(deletedSubscription, { colors: true, depth: null })
        )
        // TODO: Mark the subscription as inactive or deleted in your database.
        // Example:
        // await prisma.subscription.update({
        //   where: { stripeSubscriptionId: deletedSubscription.id },
        //   data: { status: 'cancelled' },
        // });
        break

      case 'invoice.paid':
        const invoice = event.data.object as Stripe.Invoice
        console.log(`Invoice paid for customer: ${invoice.customer}`)
        // This is a good place to log a successful recurring payment.
        // The customer.subscription.updated event is more robust for status changes.
        break

      default:
        console.log(`Unhandled event type ${event.type}`)
    }

    // Return a 200 to Stripe to acknowledge receipt of the event
    return data({ received: true }, { status: 200 })
  } catch (err: any) {
    console.log(`Stripe webhook signature error: ${err.message}`)
    return data({ message: `Webhook Error: ${err.message}` }, { status: 400 })
  }
}
