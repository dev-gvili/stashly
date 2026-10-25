import type { z } from 'zod'
import {
  itemsApiRouteInput,
  quotaApiRouteInput,
  quotaApiRouteOutput,
} from '@/schemas/api.schemas'

export type QuotaApiRouteInput = z.infer<typeof quotaApiRouteInput>
export type QuotaApiRouteOutput = z.infer<typeof quotaApiRouteOutput>

export type ItemsApiRouteInput = z.infer<typeof itemsApiRouteInput>
/** The `save_media_metadata` payload, as `saveMediaMetadata` receives it. */
export type MediaMetadataInput = Omit<
  Extract<ItemsApiRouteInput, { intent: 'save_media_metadata' }>,
  'intent'
>
