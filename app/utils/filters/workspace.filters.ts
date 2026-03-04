import { z } from 'zod'
import { Prisma } from '@/prisma/client'
import { createFilter, buildFiltersFactory } from '@/utils/filters'
import { date } from './schema.zod'

export const workspaceFilterSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
    description: z.string(),
    default: z.coerce.boolean(),
    date,
    storagePlanId: z.string(),
  })
  .partial()

const createWorkspaceFilter = createFilter<
  Prisma.WorkspaceWhereInput,
  z.infer<typeof workspaceFilterSchema>
>()

export const workspaceFilters: Record<
  keyof z.infer<typeof workspaceFilterSchema>,
  ReturnType<typeof createWorkspaceFilter>
> = {
  id: createWorkspaceFilter(z.string().nonempty(), (id) => ({ id })),
  name: createWorkspaceFilter(z.string().nonempty(), (name) => ({ name })),
  slug: createWorkspaceFilter(z.string().nonempty(), (slug) => ({ slug })),
  description: createWorkspaceFilter(z.string().nonempty(), (description) => ({
    description,
  })),
  default: createWorkspaceFilter(z.coerce.boolean(), (defaultValue) => ({
    default: defaultValue,
  })),
  date: createWorkspaceFilter(
    date.refine(({ before, after }) => before || after, {
      message: 'At least one of before or after must be provided.',
    }),
    ({ before, after }) => ({
      createdAt: { lte: before, gte: after },
    })
  ),
  storagePlanId: createWorkspaceFilter(
    z.string().nonempty(),
    (storagePlanId) => ({ storagePlanId })
  ),
}

export const buildWorkspaceFilters = buildFiltersFactory({
  filters: workspaceFilters,
  schema: workspaceFilterSchema,
})
