import { describe, expect, it, vi } from 'vitest'

// A resource route's `data()` is sent as JSON, which has no BigInt: a `size` or
// `storageLimit` column left as one made the whole response a 500 (tech-debt
// item 63). Each loader parses its payload through an output schema, as
// `/api/quota` does, so bytes reach the client as numbers.
vi.mock('@/services/auth', () => ({ auth: { api: { getSession: vi.fn() } } }))
vi.mock('@/services/item-actions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/item-actions')>()),
  paginateItems: vi.fn(async () => ({
    items: [
      {
        id: 'item_a',
        name: 'a.jpg',
        type: 'file',
        category: 'image',
        size: 10_000_000n,
        createdAt: new Date('2026-11-01T00:00:00Z'),
        thumbnails: [],
      },
    ],
    nextCursor: null,
    hasMore: false,
  })),
}))
// Stubbed whole: the real module loads the Stripe client, which throws without
// a key (CI has none).
vi.mock('@/services/subscription-actions', () => ({
  updateSubscriptionPlan: vi.fn(),
  cancelSubscription: vi.fn(),
  getActiveSubscription: vi.fn(async () => ({
    id: 'sub_a',
    status: 'active',
    metadata: null,
    createdAt: new Date('2026-11-01T00:00:00Z'),
    updatedAt: new Date('2026-11-01T00:00:00Z'),
    endedAt: null,
    storagePlanId: 'plan_free',
    stripeSubscriptionId: null,
    ownerId: 'usr_test',
    storagePlan: {
      id: 'plan_free',
      name: 'Free',
      tag: 'free',
      description: null,
      type: 'free',
      storageLimit: 15_000_000_000n,
      workspaceLimit: 5,
      memberLimit: 5,
      features: [],
      priceCents: null,
      currency: null,
      stripePriceId: null,
    },
  })),
}))

import { RouterContextProvider } from 'react-router'
import { sessionContext } from '@/services/middleware/context'
import { loader as collectionsLoader } from '../collections'
import { loader as subscriptionLoader } from '../subscription'

function args(path: string) {
  const context = new RouterContextProvider()
  context.set(sessionContext, { user: { id: 'usr_test' } } as never)
  return { request: new Request(`http://localhost${path}`), params: {}, context } as never
}

/** The body as the client receives it: `data()`'s payload through JSON. */
async function body(run: () => Promise<unknown>) {
  const result = (await run()) as { data: unknown }
  return JSON.parse(JSON.stringify(result.data))
}

describe('GET loaders send bytes as numbers, not BigInt', () => {
  it('/api/collections', async () => {
    const sent = await body(() => collectionsLoader(args('/api/collections')))
    expect(sent.items[0]).toMatchObject({ id: 'item_a', size: 10_000_000, thumbnailUrl: null })
  })

  it('/api/subscription', async () => {
    const sent = await body(() => subscriptionLoader(args('/api/subscription')))
    expect(sent.subscription.storagePlan.storageLimit).toBe(15_000_000_000)
  })
})
