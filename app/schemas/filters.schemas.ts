import type { Prisma } from '@/prisma/browser'
import { z } from 'zod'

export let date = z.object({
  before: z.coerce.date().or(z.string().date()),
  after: z.coerce.date().or(z.string().date()),
})

export let paginationOptions = z.object({
  cursor: z.string().optional(),
  take: z.coerce.number().default(25),
  // orderBy: z.custom<Prisma.ItemOrderByWithRelationInput>().optional(),
  // include: z.custom<Prisma.ItemInclude>().optional(),
})
