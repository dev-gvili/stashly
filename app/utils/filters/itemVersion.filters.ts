import { z } from 'zod'
import { Prisma } from '@/prisma/client'
import { createFilter, buildFiltersFactory } from '@/utils/filters'

export const itemVersionFilterSchema = z
  .object({
    id: z.string(),
    label: z.string(),
    version: z.string(),
    itemId: z.string(),
  })
  .partial()

const createItemVersionFilter = createFilter<
  Prisma.ItemVersionWhereInput,
  z.infer<typeof itemVersionFilterSchema>
>()

export const itemVersionFilters = {
  id: createItemVersionFilter(z.string().nonempty(), (id) => ({ id })),
  label: createItemVersionFilter(z.string().nonempty(), (label) => ({ label })),
  version: createItemVersionFilter(z.string().nonempty(), (version) => ({ version })),
  itemId: createItemVersionFilter(z.string().nonempty(), (itemId) => ({ itemId })),
}

export const buildItemVersionFilters = buildFiltersFactory({
  filters: itemVersionFilters,
  schema: itemVersionFilterSchema,
})

export type ItemVersionFilterParams = z.infer<typeof itemVersionFilterSchema>
