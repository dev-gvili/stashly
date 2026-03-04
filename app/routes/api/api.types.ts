import type { z } from 'zod'
import { quotaApiRouteInput, quotaApiRouteOutput } from './schema.zod'

export type QuotaApiRouteInput = z.infer<typeof quotaApiRouteInput>
export type QuotaApiRouteOutput = z.infer<typeof quotaApiRouteOutput>
