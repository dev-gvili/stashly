import { z } from 'zod'
import { Prisma } from '@/prisma/client'
import { StoragePlanType } from '@/prisma/enums'
import { createFilter, buildFiltersFactory } from '@/utils/filters'

export const storagePlanFilterSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    tag: z.string(),
    type: z.nativeEnum(StoragePlanType),
    storageLimit: z.coerce.bigint(),
    workspaceLimit: z.coerce.number().int(),
    memberLimit: z.coerce.number().int(),
    stripePriceId: z.string(),

    // Pagination Params
    cursor: z.string().optional(),
    take: z.coerce.number().default(50),
    orderBy: z.custom<Prisma.StoragePlanOrderByWithRelationInput>(),
    include: z.custom<Prisma.StoragePlanInclude>(),
  })
  .partial()

const createStoragePlanFilter = createFilter<
  Prisma.StoragePlanWhereInput,
  z.infer<typeof storagePlanFilterSchema>
>()

export const storagePlanFilters = {
  id: createStoragePlanFilter(z.string().nonempty(), (id) => ({ id })),
  name: createStoragePlanFilter(z.string().nonempty(), (name) => ({ name })),
  tag: createStoragePlanFilter(z.string().nonempty(), (tag) => ({ tag })),
  type: createStoragePlanFilter(z.nativeEnum(StoragePlanType), (type) => ({ type })),
  storageLimit: createStoragePlanFilter(z.coerce.bigint(), (storageLimit) => ({ storageLimit })),
  workspaceLimit: createStoragePlanFilter(z.coerce.number().int(), (workspaceLimit) => ({ workspaceLimit })),
  memberLimit: createStoragePlanFilter(z.coerce.number().int(), (memberLimit) => ({ memberLimit })),
  stripePriceId: createStoragePlanFilter(z.string().nonempty(), (stripePriceId) => ({ stripePriceId })),
}

export const buildStoragePlanFilters = buildFiltersFactory({
  filters: storagePlanFilters,
  schema: storagePlanFilterSchema,
})

export type StoragePlanFilterParams = z.infer<typeof storagePlanFilterSchema>
