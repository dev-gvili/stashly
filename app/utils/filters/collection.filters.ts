import { z } from 'zod'
import { Prisma } from '@/prisma/client'
import { createFilter, buildFiltersFactory } from '@/utils/filters'
import { date } from './schema.zod'
export const collectionFilterSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    size: z.bigint(),
    date,
    sizeMin: z.number(),
    sizeMax: z.number(),
  })
  .partial()

export const createCollectionFilter = createFilter<
  Prisma.CollectionWhereInput,
  z.infer<typeof collectionFilterSchema>
>()

export const collectionFilters = {
  id: createCollectionFilter(z.string().nonempty(), (id) => ({ id })),
  name: createCollectionFilter(z.string().nonempty(), (name) => ({ name })),
  size: createCollectionFilter(z.bigint(), (size) => ({ size })),
  date: createCollectionFilter(
    date.refine(({ before, after }) => before || after, {
      message: 'At least one of before or after must be provided.',
    }),
    ({ before, after }) => ({
      item: {
        createdAt: {
          lte: before,
          gte: after,
        },
      },
    })
  ),
  sizeMin: createCollectionFilter(z.number(), (sizeMin) => ({
    size: { gte: sizeMin },
  })),
  sizeMax: createCollectionFilter(z.number(), (sizeMax) => ({
    size: { lte: sizeMax },
  })),
}

export const buildCollectionFilters = buildFiltersFactory({
  filters: collectionFilters,
  schema: collectionFilterSchema,
})
