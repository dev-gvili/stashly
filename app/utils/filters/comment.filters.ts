import { z } from 'zod'
import { Prisma } from '@/prisma/client'
import { createFilter, buildFiltersFactory } from '@/utils/filters'
import { date } from '@/schemas/filters.schemas'

export const commentFilterSchema = z
  .object({
    id: z.string(),
    content: z.string(),
    itemId: z.string(),
    ownerId: z.string(),
    date,

    // Pagination Params
    cursor: z.string().optional(),
    take: z.coerce.number().default(50),
    orderBy: z.custom<Prisma.CommentOrderByWithRelationInput>(),
    include: z.custom<Prisma.CommentInclude>(),
  })
  .partial()

const createCommentFilter = createFilter<
  Prisma.CommentWhereInput,
  z.infer<typeof commentFilterSchema>
>()

export const commentFilters = {
  id: createCommentFilter(z.string().nonempty(), (id) => ({ id })),
  content: createCommentFilter(z.string().nonempty(), (content) => ({
    content: { contains: content, mode: 'insensitive' },
  })),
  itemId: createCommentFilter(z.string().nonempty(), (itemId) => ({ itemId })),
  ownerId: createCommentFilter(z.string().nonempty(), (ownerId) => ({ ownerId })),
  date: createCommentFilter(
    date.refine(({ before, after }) => before || after, {
      message: 'At least one of before or after must be provided.',
    }),
    ({ before, after }) => ({ createdAt: { lte: before, gte: after } })
  ),
}

export const buildCommentFilters = buildFiltersFactory({
  filters: commentFilters,
  schema: commentFilterSchema,
})

export type CommentFilterParams = z.infer<typeof commentFilterSchema>
