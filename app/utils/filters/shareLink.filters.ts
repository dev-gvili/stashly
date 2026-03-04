import { z } from 'zod'
import { Prisma } from '@/prisma/client'
import { createFilter, buildFiltersFactory } from '@/utils/filters'

export const shareLinkFilterSchema = z
  .object({
    id: z.string(),
    url: z.string(),
    downloadable: z.coerce.boolean(),
    password: z.string(),
    expiresAt: z.date(),
    createdAt: z.date(),
    updatedAt: z.date(),
  })
  .partial()

/**
 * Factory for creating shareLink-specific filters.
 */
const createShareLinkFilter = createFilter<
  Prisma.ShareLinkWhereInput,
  z.infer<typeof shareLinkFilterSchema>
>()

/**
 * All available shareLink filters.
 */
export const shareLinkFilters = {
  id: createShareLinkFilter(z.string(), (value) => ({ id: value })),
  url: createShareLinkFilter(z.string(), (value) => ({ url: value })),
  downloadable: createShareLinkFilter(z.coerce.boolean(), (value) => ({
    downloadable: value,
  })),
  password: createShareLinkFilter(z.string(), (value) => ({ password: value })),
  expiresAt: createShareLinkFilter(z.date(), (value) => ({ expiresAt: value })),
  createdAt: createShareLinkFilter(z.date(), (value) => ({ createdAt: value })),
  updatedAt: createShareLinkFilter(z.date(), (value) => ({ updatedAt: value })),
}

/**
 * Build shareLink filters from provided params.
 */
export const buildShareLinkFilters = buildFiltersFactory({
  filters: shareLinkFilters,
  schema: shareLinkFilterSchema,
})
