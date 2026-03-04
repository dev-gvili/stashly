import { z } from 'zod'

export let date = z.object({
  before: z.coerce.date().or(z.string().date()),
  after: z.coerce.date().or(z.string().date()),
})
