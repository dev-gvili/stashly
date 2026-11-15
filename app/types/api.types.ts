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

/** A video or audio file with no media facet, and where to read its bytes. */
export interface MetadataBackfillCandidate {
  id: string
  name: string
  size: number
  mimeType: string
  kind: 'video' | 'audio'
  /** Short-lived signed GET; it accepts `Range`. */
  url: string
}
