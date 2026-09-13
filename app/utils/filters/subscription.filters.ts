import { z } from 'zod'
import { Prisma } from '@/prisma/client'
import { SubscriptionStatus } from '@/prisma/enums'
import { createFilter, buildFiltersFactory } from '@/utils/filters'
import { date } from '@/schemas/filters.schemas'

export const subscriptionFilterSchema = z
  .object({
    id: z.string(),
    status: z.nativeEnum(SubscriptionStatus),
    ownerId: z.string(),
    storagePlanId: z.string(),
    stripeSubscriptionId: z.string(),
    date,
  })
  .partial()

const createSubscriptionFilter = createFilter<
  Prisma.SubscriptionWhereInput,
  z.infer<typeof subscriptionFilterSchema>
>()

export const subscriptionFilters = {
  id: createSubscriptionFilter(z.string().nonempty(), (id) => ({ id })),
  status: createSubscriptionFilter(z.nativeEnum(SubscriptionStatus), (status) => ({ status })),
  ownerId: createSubscriptionFilter(z.string().nonempty(), (ownerId) => ({ ownerId })),
  storagePlanId: createSubscriptionFilter(z.string().nonempty(), (storagePlanId) => ({ storagePlanId })),
  stripeSubscriptionId: createSubscriptionFilter(
    z.string().nonempty(),
    (stripeSubscriptionId) => ({ stripeSubscriptionId })
  ),
  date: createSubscriptionFilter(
    date.refine(({ before, after }) => before || after, {
      message: 'At least one of before or after must be provided.',
    }),
    ({ before, after }) => ({ createdAt: { lte: before, gte: after } })
  ),
}

export const buildSubscriptionFilters = buildFiltersFactory({
  filters: subscriptionFilters,
  schema: subscriptionFilterSchema,
})

export type SubscriptionFilterParams = z.infer<typeof subscriptionFilterSchema>
