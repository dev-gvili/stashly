import type { z } from 'zod'
import { quotaApiRouteInput, quotaApiRouteOutput } from '@/schemas/api.schemas'

export type QuotaApiRouteInput = z.infer<typeof quotaApiRouteInput>
export type QuotaApiRouteOutput = z.infer<typeof quotaApiRouteOutput>
