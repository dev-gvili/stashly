import { fromPromise } from 'xstate'
import type { Subscription } from '@/prisma/client'

const FetchInit: RequestInit = {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
}

/**
 * Fetches the user's current subscription from the API.
 * This actor is a promise-based wrapper around a fetch call.
 */
export const fetchSubscriptionActor = fromPromise<
  Subscription,
  { userId: string }
>(async ({ input }) => {
  const res = await fetch('/api/subscriptions', {
    ...FetchInit,
    body: JSON.stringify({
      userId: input.userId,
      action: 'fetch',
    }),
  })
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.message || 'Failed to fetch subscription')
  }
  const result = await res.json()
  return result.subscription
})

/**
 * Updates an existing subscription via the API.
 */
export const updateSubscriptionActor = fromPromise<
  Subscription,
  { subscriptionId: string; data: Partial<Subscription> }
>(async ({ input }) => {
  const res = await fetch('/api/subscriptions', {
    ...FetchInit,
    body: JSON.stringify({
      subscriptionId: input.subscriptionId,
      data: input.data,
      action: 'update',
    }),
  })
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.message || 'Failed to update subscription')
  }
  const result = await res.json()
  return result.subscription
})

/**
 * Cancels a subscription via the API.
 */
export const cancelSubscriptionActor = fromPromise<
  Subscription,
  { subscriptionId: string }
>(async ({ input }) => {
  const res = await fetch('/api/subscriptions', {
    ...FetchInit,
    body: JSON.stringify({
      subscriptionId: input.subscriptionId,
      action: 'cancel',
    }),
  })
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.message || 'Failed to cancel subscription')
  }
  const result = await res.json()
  return result.subscription
})

/**
 * Logs a subscription event to the history via the API.
 */
export const logEventActor = fromPromise<
  SubscriptionHistory,
  {
    userId: string
    eventType: string
    description: string
    details?: Record<string, unknown>
  }
>(async ({ input }) => {
  const res = await fetch('/api/subscriptions', {
    ...FetchInit,
    body: JSON.stringify({
      ...input,
      action: 'logEvent',
    }),
  })
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.message || 'Failed to log subscription event')
  }
  const result = await res.json()
  return result.historyEntry
})
