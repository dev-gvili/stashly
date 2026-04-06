import { z } from 'zod'
import { Prisma } from '@/prisma/client'
import { createFilter, buildFiltersFactory } from '@/utils/filters'
import { QuotaStatus } from '@/prisma/enums'

export const quotaFilterSchema = z
  .object({
    id: z.string(),
    status: z.nativeEnum(QuotaStatus),
    createdAt: z.date(),
    updatedAt: z.date(),
    driveId: z.string(),
    used: z.coerce.bigint(),
    total: z.coerce.bigint(),
    deleted: z.coerce.boolean(),

    // Pagination Params
    cursor: z.string().optional(),
    take: z.coerce.number().default(50),
    orderBy: z.custom<Prisma.QuotaOrderByWithRelationInput>(),
    include: z.custom<Prisma.QuotaInclude>(),
  })
  .partial()

const createQuotaFilter = createFilter<
  Prisma.QuotaWhereInput,
  z.infer<typeof quotaFilterSchema>
>()

export const quotaFilters = {
  id: createQuotaFilter(z.string().nonempty(), (id) => ({ id })),
  status: createQuotaFilter(z.nativeEnum(QuotaStatus), (status) => ({
    status,
  })),
  createdAt: createQuotaFilter(z.date(), (createdAt) => ({ createdAt })),
  updatedAt: createQuotaFilter(z.date(), (updatedAt) => ({ updatedAt })),
  driveId: createQuotaFilter(z.string().nonempty(), (driveId) => ({ driveId })),
  used: createQuotaFilter(z.coerce.bigint(), (used) => ({ used })),
  total: createQuotaFilter(z.coerce.bigint(), (total) => ({ total })),
  deleted: createQuotaFilter(z.coerce.bigint(), (deleted) => ({ deleted })),
}

export const buildQuotaFilters = buildFiltersFactory({
  filters: quotaFilters,
  schema: quotaFilterSchema,
})
