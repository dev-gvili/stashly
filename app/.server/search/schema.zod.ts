import { z } from 'zod'

export let date = z.object({
  before: z.date({ coerce: true }).or(z.string().date()),
  after: z.date({ coerce: true }).or(z.string().date()),
})
