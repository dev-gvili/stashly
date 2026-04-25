import { z } from 'zod'
import { Prisma } from '@/prisma/client'
import { createFilter, buildFiltersFactory } from '@/utils/filters'
import { date } from '@/schemas/filters.schemas'

export const invitationFilterSchema = z
  .object({
    id: z.string(),
    senderId: z.string(),
    itemId: z.string(),
    workspaceId: z.string(),
    date,

    // Pagination Params
    cursor: z.string().optional(),
    take: z.coerce.number().default(50),
    orderBy: z.custom<Prisma.InvitationOrderByWithRelationInput>(),
    include: z.custom<Prisma.InvitationInclude>(),
  })
  .partial()

const createInvitationFilter = createFilter<
  Prisma.InvitationWhereInput,
  z.infer<typeof invitationFilterSchema>
>()

export const invitationFilters = {
  id: createInvitationFilter(z.string().nonempty(), (id) => ({ id })),
  senderId: createInvitationFilter(z.string().nonempty(), (senderId) => ({ senderId })),
  itemId: createInvitationFilter(z.string().nonempty(), (itemId) => ({ itemId })),
  workspaceId: createInvitationFilter(z.string().nonempty(), (workspaceId) => ({ workspaceId })),
  date: createInvitationFilter(
    date.refine(({ before, after }) => before || after, {
      message: 'At least one of before or after must be provided.',
    }),
    ({ before, after }) => ({ createdAt: { lte: before, gte: after } })
  ),
}

export const buildInvitationFilters = buildFiltersFactory({
  filters: invitationFilters,
  schema: invitationFilterSchema,
})

export type InvitationFilterParams = z.infer<typeof invitationFilterSchema>
