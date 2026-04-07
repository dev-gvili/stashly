import { z } from 'zod'
import { toZodArraySchema } from '../utils/converters'

// ====================================================== //
// =================== Quota Api Route ================== //
// ====================================================== //

/**
 * This schema is for validating and parsing the input from the client.
 * It uses z.coerce.bigint() to safely convert various input types to bigint.
 * The action field is a discriminated union to handle different quota-related actions.
 */
export const quotaApiRouteInput = z.object({
  dataSize: z.coerce.bigint(),
  action: z
    .literal('find-quota')
    .or(z.literal('verify-free-quota'))
    .or(z.literal('check-free-quota'))
    .or(z.literal('update-total-quota'))
    .or(z.literal('items-uploaded'))
    .or(z.literal('items-trashed'))
    .or(z.literal('items-copied'))
    .or(z.literal('items-restored'))
    .or(z.literal('items-deleted')),

  itemId: z.string().optional(),
})

/**
 * This schema is for transforming the output before it's sent to the client.
 * It uses z.coerce.number() to safely convert bigint to number.
 */
export const quotaApiRouteOutput = z.object({
  id: z.string(),
  driveId: z.string(),
  deleted: z.coerce.number(),
  total: z.coerce.number(),
  used: z.coerce.number(),
  remaining: z.coerce.number(),
  status: z.enum(['normal', 'warning', 'critical', 'exceeded']),
})

// ====================================================== //
// =================== Items Api Route ================== //
// ====================================================== //

/**
 * Schema for actions involving a single item.
 */
let itemSchema = z.object({
  intent: z
    .literal('trash_item')
    .or(z.literal('restore_item'))
    .or(z.literal('delete_item')),
  selectedItem: z.string().nonempty(),
})
/**
 * Schema for actions involving multiple items.
 */
let itemsSchema = z.object({
  intent: z
    .literal('trash_items')
    .or(z.literal('restore_items'))
    .or(z.literal('delete_items')),
  selectedItems: toZodArraySchema(z.string()),
})

let moveItemSchema = z.object({
  intent: z.literal('move_item'),
  selectedItem: z.string(),
  targetFolderId: z.string(),
})
/**
 * This schema is for validating and parsing the input from the client for item-related actions.
 * It uses a discriminated union based on the 'intent' field to handle single item or multiple items actions.
 */
export const itemsApiRouteInput = z.discriminatedUnion('intent', [
  itemSchema,
  itemsSchema,
  moveItemSchema,
  z.object({
    intent: z.literal('move_items'),
    selectedItems: toZodArraySchema(z.string()),
    targetFolderId: z.string(),
  }),
])

// ====================================================== //
// ==================== AI Api Route ==================== //
// ====================================================== //

/**
 * Schema for AI-related API route input.
 * This is a discriminated union based on the 'intent' field to handle various AI functionalities.
 */
export const aiApiRouteInput = z.discriminatedUnion('intent', [
  z.object({
    intent: z.literal('caption-image'),
    // The s3 presigned GET URL to the image file.
    // Must be publicly accessible, usally will be created automatically by the upload state machine after successful upload.
    url: z.url(),
  }),
  z.object({
    intent: z.literal('transcribe-audio'),
    // The s3 presigned GET URL to the audio / video file.
    // Must be publicly accessible, usally will be created automatically by the upload state machine after successful upload.
    url: z.url(),
  }),
  /**
   * Schema for ai embedding request.
   * Extracts features from the provided content, content will be
   */
  z.object({
    intent: z.literal('extract-features'),
    content: z.string().nonempty(),
  }),
  z.object({
    intent: z.literal('translate-text'),
    key: z.string().nonempty(),
  }),
  z.object({
    intent: z.literal('suggest-items'),
    key: z.string().nonempty(),
  }),
  z.object({
    intent: z.literal('summarize-text'),
    content: z.string().nonempty(),
  }),
  z.object({
    intent: z.literal('chat'),
    prompt: z.string().nonempty(),
  }),
])

// ====================================================== //
// ================ Collections Api Route =============== //
// ====================================================== //

export const collectionsApiRouteInput = z.discriminatedUnion('intent', [
  z.object({
    intent: z.literal('create_collection'),
    name: z.string().nonempty(),
    driveId: z.string().nonempty(),
    workspaceId: z.string().optional(),
  }),
  z.object({
    intent: z.literal('rename_collection'),
    collectionId: z.string().nonempty(),
    newName: z.coerce.string().nonempty(),
  }),
  z.object({
    intent: z
      .literal('trash_collection')
      .or(z.literal('restore_collection'))
      .or(z.literal('delete_collection'))
      .or(z.literal('clear_collection')),
    collectionId: z.string().nonempty(),
  }),
  z.object({
    intent: z.literal('add_items_to_collection'),
    itemIds: toZodArraySchema(z.string()),
    collectionId: z.string().nonempty(),
  }),
  z.object({
    intent: z.literal('remove_items_from_collection'),
    itemIds: toZodArraySchema(z.string()),
    collectionId: z.string().nonempty(),
  })
])
