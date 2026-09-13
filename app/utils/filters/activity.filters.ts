import { z } from 'zod'
import { Prisma } from '@/prisma/client'
import { createFilter, buildFiltersFactory } from '@/utils/filters'

export const activityFilterSchema = z
  .object({
    id: z.object({ equals: z.string().optional() }).optional(),
    timeId: z.object({ equals: z.string().optional() }).optional(),
    itemId: z.object({ equals: z.string().optional() }).optional(),
    ownerId: z.object({ equals: z.string().optional() }).optional(),
  })
  .partial()

const createActivityFilter = createFilter<
  Prisma.ActivityWhereInput,
  z.infer<typeof activityFilterSchema>
>()

export const activityFilters = {
  id: createActivityFilter(
    z.object({ equals: z.any().optional() }).optional(),
    (id) => ({ id })
  ),
  timeId: createActivityFilter(
    z.object({ equals: z.any().optional() }).optional(),
    (timeId) => ({ timeId })
  ),
  itemId: createActivityFilter(
    z.object({ equals: z.any().optional() }).optional(),
    (itemId) => ({ itemId })
  ),
  ownerId: createActivityFilter(
    z.object({ equals: z.any().optional() }).optional(),
    (ownerId) => ({
      item: {
        ownerId,
      },
    })
  ),
}

export const buildActivityFilters = buildFiltersFactory({
  filters: activityFilters,
  schema: activityFilterSchema,
})

export type ActivityFilterParams = z.infer<typeof activityFilterSchema>

/**
 * Filter Documentation (Markdown)
 *
 * | Field       | Type     | Operators                               |
 * |-------------|----------|-----------------------------------------|
| id | String | equals |
| timeId | String | equals |
| itemId | String | equals |
 */
