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
    driveId: z.string().optional(),
    workspaceId: z.string().optional(),
  }),
  z.object({
    intent: z.literal('rename_collection'),
    collectionId: z.string().nonempty(),
    newName: z.coerce.string().nonempty(),
  }),
  z.object({
    intent: z.literal('trash_collection'),
    collectionId: z.string().nonempty(),
  }),
  z.object({
    intent: z.literal('restore_collection'),
    collectionId: z.string().nonempty(),
  }),
  z.object({
    intent: z.literal('delete_collection'),
    collectionId: z.string().nonempty(),
  }),
  z.object({
    intent: z.literal('clear_collection'),
    collectionId: z.string().nonempty(),
  }),
  z.object({
    intent: z.literal('add_items_to_collection'),
    itemIds: toZodArraySchema(z.string()),
    collectionId: z.string().nonempty(),
  }),
  z.object({
    intent: z.literal('remove_item'),
    itemId: z.string().nonempty(),
    collectionId: z.string().nonempty(),
  }),
  z.object({
    intent: z.literal('remove_items_from_collection'),
    itemIds: toZodArraySchema(z.string()),
    collectionId: z.string().nonempty(),
  }),
])

// ====================================================== //
// =============== Invitations Api Route ================ //
// ====================================================== //

const permissionRoleSchema = z.enum(['read', 'write', 'owner'])
const workspaceMemberRoleSchema = z.enum(['viewer', 'member', 'admin', 'owner'])

/** Schema for GET /api/invitations?type=sent|received */
export const invitationsLoaderInput = z.object({
  type: z.enum(['sent', 'received']).default('received'),
  itemId: z.string().optional(),
})

export const invitationsApiRouteInput = z.discriminatedUnion('intent', [
  // Invite a specific user (by email) to access an item
  z.object({
    intent: z.literal('send_item_invitation'),
    itemId: z.string().nonempty(),
    email: z.string().email(),
    role: permissionRoleSchema,
    expiresAt: z.coerce.date().optional(),
  }),
  // Invite a user to a workspace
  z.object({
    intent: z.literal('send_workspace_invitation'),
    workspaceId: z.string().nonempty(),
    email: z.string().email(),
    role: workspaceMemberRoleSchema,
    expiresAt: z.coerce.date().optional(),
  }),
  // Accept a pending invitation (recipient)
  z.object({
    intent: z.literal('accept_invitation'),
    invitationId: z.string().nonempty(),
  }),
  // Reject a pending invitation (recipient)
  z.object({
    intent: z.literal('reject_invitation'),
    invitationId: z.string().nonempty(),
  }),
  // Cancel a pending invitation (sender)
  z.object({
    intent: z.literal('cancel_invitation'),
    invitationId: z.string().nonempty(),
  }),
])

// ====================================================== //
// ================== Shares Api Route ================== //
// ====================================================== //

const shareScopeSchema = z.enum(['anonymous', 'organization', 'users'])
const shareLinkTypeSchema = z.enum(['view', 'edit', 'embed', 'upload'])

/** Schema for GET /api/shares?itemId=xxx */
export const sharesLoaderInput = z.object({
  itemId: z.string().nonempty(),
})

export const sharesApiRouteInput = z.discriminatedUnion('intent', [
  // Create a view-only share link
  z.object({
    intent: z.literal('create_view_link'),
    itemId: z.string().nonempty(),
    scope: shareScopeSchema,
    downloadable: z.coerce.boolean().optional(),
    password: z.string().optional(),
    expiresAt: z.coerce.date().optional(),
  }),
  // Create an edit share link
  z.object({
    intent: z.literal('create_edit_link'),
    itemId: z.string().nonempty(),
    scope: shareScopeSchema,
    password: z.string().optional(),
    expiresAt: z.coerce.date().optional(),
  }),
  // Create an embed share link (always anonymous)
  z.object({
    intent: z.literal('create_embed_link'),
    itemId: z.string().nonempty(),
    password: z.string().optional(),
    expiresAt: z.coerce.date().optional(),
  }),
  // Create an upload share link (folder-only)
  z.object({
    intent: z.literal('create_upload_link'),
    itemId: z.string().nonempty(),
    scope: shareScopeSchema,
    password: z.string().optional(),
    expiresAt: z.coerce.date().optional(),
  }),
  // Change the scope of an existing link
  z.object({
    intent: z.literal('update_link_scope'),
    linkId: z.string().nonempty(),
    scope: shareScopeSchema,
  }),
  // Change the type of an existing link
  z.object({
    intent: z.literal('update_link_type'),
    linkId: z.string().nonempty(),
    type: shareLinkTypeSchema,
  }),
  // Set or update the expiry on a link
  z.object({
    intent: z.literal('expire_link'),
    linkId: z.string().nonempty(),
    expiresAt: z.coerce.date(),
  }),
  // Remove expiry from a link
  z.object({
    intent: z.literal('remove_link_expiry'),
    linkId: z.string().nonempty(),
  }),
  // Toggle downloadable flag on a link
  z.object({
    intent: z.literal('update_link_downloadable'),
    linkId: z.string().nonempty(),
    downloadable: z.coerce.boolean(),
  }),
  // Revoke (delete) a specific share link
  z.object({
    intent: z.literal('revoke_link'),
    linkId: z.string().nonempty(),
  }),
  // Revoke all share links for an item
  z.object({
    intent: z.literal('revoke_all_links'),
    itemId: z.string().nonempty(),
  }),
])
