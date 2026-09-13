import { z } from 'zod'
import { Prisma } from '@/prisma/client'
import { PermissionRole } from '@/prisma/enums'
import { createFilter, buildFiltersFactory } from '@/utils/filters'

export const permissionFilterSchema = z
  .object({
    id: z.string(),
    roles: z.enum(PermissionRole),
    itemId: z.string(),
    linkId: z.string(),
    recipientId: z.string(),
  })
  .partial()

const createPermissionFilter = createFilter<
  Prisma.PermissionWhereInput,
  z.infer<typeof permissionFilterSchema>
>()

export const permissionFilters = {
  id: createPermissionFilter(z.string().nonempty(), (id) => ({ id })),
  roles: createPermissionFilter(z.enum(PermissionRole), (roles) => ({ roles })),
  itemId: createPermissionFilter(z.string().nonempty(), (itemId) => ({ itemId })),
  linkId: createPermissionFilter(z.string().nonempty(), (linkId) => ({ linkId })),
  recipientId: createPermissionFilter(z.string().nonempty(), (recipientId) => ({ recipientId })),
}

export const buildPermissionFilters = buildFiltersFactory({
  filters: permissionFilters,
  schema: permissionFilterSchema,
})

export type PermissionFilterParams = z.infer<typeof permissionFilterSchema>
