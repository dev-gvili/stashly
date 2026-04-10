import { z } from 'zod'
import { Prisma } from '@/prisma/client'
import { createFilter, buildFiltersFactory } from '@/utils/filters'
import { date } from '@/schemas/filters.schemas'

// Collections are Items with type='collection', so filters target ItemWhereInput.
export const collectionFilterSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    size: z.bigint(),
    date,
    sizeMin: z.number(),
    sizeMax: z.number(),

    // Pagination Params
    cursor: z.string().optional(),
    take: z.coerce.number().default(50),
    orderBy: z.custom<Prisma.ItemOrderByWithRelationInput>(),
    include: z.custom<Prisma.ItemInclude>(),
  })
  .partial()

export const createCollectionFilter = createFilter<
  Prisma.ItemWhereInput,
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
      createdAt: {
        lte: before,
        gte: after,
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
