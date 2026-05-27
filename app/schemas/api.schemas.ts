import { z } from 'zod'
import { toZodArraySchema } from '@/utils/converters'

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
  z.object({
    intent: z.literal('create_upload_item'),
    id: z.string(),
    name: z.string(),
    key: z.string(),
    size: z.coerce.bigint(),
    mimeType: z.string().optional(),
    etag: z.string().optional(),
    bucket: z.string(),
    driveId: z.string(),
    parentId: z.string(),
    ownerId: z.string(),
    category: z.string().optional(),
  }),
  z.object({
    intent: z.literal('create_folder'),
    name: z.string().nonempty(),
    parentId: z.string().nonempty(),
    driveId: z.string().nonempty(),
  }),
  z.object({
    intent: z.literal('save_media_metadata'),
    itemId: z.string().nonempty(),
    // image fields
    imageWidth: z.coerce.number().int().optional(),
    imageHeight: z.coerce.number().int().optional(),
    cameraMake: z.string().optional(),
    cameraModel: z.string().optional(),
    iso: z.coerce.number().int().optional(),
    fNumber: z.coerce.number().optional(),
    exposureTime: z.coerce.number().optional(),
    focalLength: z.coerce.number().optional(),
    takenDateTime: z.coerce.date().optional(),
    latitude: z.coerce.number().optional(),
    longitude: z.coerce.number().optional(),
    // video fields
    videoWidth: z.coerce.number().int().optional(),
    videoHeight: z.coerce.number().int().optional(),
    duration: z.coerce.number().optional(),
    frameRate: z.coerce.number().optional(),
    // document fields (currently PDF; extensible to other text formats)
    documentText: z.string().optional(),
    documentPageCount: z.coerce.number().int().optional(),
  }),
  z.object({
    intent: z.literal('save_search_chunk_embeddings'),
    // JSON-encoded `[{ chunkId, vector: number[] }]`. Vectors are 768-dim
    // (validated server-side in setSearchChunkVectors). Using a JSON-encoded
    // string field keeps the request shape consistent with the rest of the
    // form-data API; acceptable for typical batch sizes (<50 chunks).
    embeddings: z.string().min(2),
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

// Note: the loader for this route is currently unused, but will be needed to fetch collection details for the add to collection dialog on the client side. the input schema will include the collectionId param and any query params needed for pagination of collection items.

export const addItemsToCollectionInput = z.object({
  cursor: z.string().optional(),
  take: z.coerce.number().optional(),
  ownerId: z.string(),
})


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
    intent: z.literal('remove_item_from_collection'),
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

const recipientInputSchema = z.object({
  email: z.email(),
  role: z.string().nonempty(),
})

/** Schema for GET /api/invitations?type=sent|received */
export const invitationsLoaderInput = z.object({
  type: z.enum(['sent', 'received']).default('received'),
  itemId: z.string().optional(),
})

export const invitationsApiRouteInput = z.discriminatedUnion('intent', [
  // Invite multiple recipients to access an item
  z.object({
    intent: z.literal('send_item_invitation'),
    itemId: z.string().nonempty(),
    recipients: z.array(recipientInputSchema).min(1),
    expiresAt: z.coerce.date().optional(),
  }),
  // Invite multiple recipients to a workspace
  z.object({
    intent: z.literal('send_workspace_invitation'),
    workspaceId: z.string().nonempty(),
    recipients: z.array(recipientInputSchema).min(1),
    expiresAt: z.coerce.date().optional(),
  }),
  // Accept a pending invitation (per recipient)
  z.object({
    intent: z.literal('accept_invitation'),
    recipientId: z.string().nonempty(),
  }),
  // Reject a pending invitation (per recipient)
  z.object({
    intent: z.literal('reject_invitation'),
    recipientId: z.string().nonempty(),
  }),
  // Cancel an entire invitation (sender)
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

// ====================================================== //
// ================ Comments Api Route ================== //
// ====================================================== //

/** Schema for GET /api/items/:itemId/comments */
export const commentsLoaderInput = z.object({
  itemId: z.string().optional(),
})

export const commentsApiRouteInput = z.discriminatedUnion('intent', [
  z.object({
    intent: z.literal('create_comment'),
    content: z.string().nonempty(),
  }),
  z.object({
    intent: z.literal('update_comment'),
    commentId: z.string().nonempty(),
    content: z.string().nonempty(),
  }),
  z.object({
    intent: z.literal('delete_comment'),
    commentId: z.string().nonempty(),
  }),
])

// ====================================================== //
// ================ Versions Api Route ================== //
// ====================================================== //

/** Schema for GET /api/items/:itemId/versions */
export const versionsLoaderInput = z.object({
  itemId: z.string().optional(),
  versionId: z.string().optional(),
})

export const versionsApiRouteInput = z.discriminatedUnion('intent', [
  z.object({
    intent: z.literal('create_version'),
    label: z.string().optional(),
    version: z.string().optional(),
    size: z.coerce.bigint().optional(),
  }),
  z.object({
    intent: z.literal('restore_version'),
    versionId: z.string().nonempty(),
  }),
  z.object({
    intent: z.literal('delete_version'),
    versionId: z.string().nonempty(),
  }),
])

// ====================================================== //
// =================== Users Api Route ================== //
// ====================================================== //

/** Schema for GET /api/users */
export const usersLoaderInput = z.object({
  query: z.string().optional(),
  email: z.string().email().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
})

export const usersApiRouteInput = z.discriminatedUnion('intent', [
  z.object({
    intent: z.literal('update_user'),
    name: z.string().min(1).optional(),
    displayName: z.string().optional(),
    image: z.url().optional(),
  }),
  z.object({
    intent: z.literal('delete_user'),
    userId: z.string().optional(),
  }),
])

// ====================================================== //
// =============== Notifications Api Route ============== //
// ====================================================== //

/** Schema for GET /api/notifications */
export const notificationsLoaderInput = z.object({
  status: z.enum(['read', 'unread']).optional(),
  type: z.enum(['info', 'warning', 'error', 'success']).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
})

export const notificationsApiRouteInput = z.discriminatedUnion('intent', [
  z.object({
    intent: z.literal('mark_read'),
    notificationId: z.string().nonempty(),
  }),
  z.object({
    intent: z.literal('mark_all_read'),
  }),
  z.object({
    intent: z.literal('delete_notification'),
    notificationId: z.string().nonempty(),
  }),
  z.object({
    intent: z.literal('create_notification'),
    message: z.string().nonempty(),
    type: z.enum(['info', 'warning', 'error', 'success']),
  }),
])

// ====================================================== //
// ================= Settings Api Route ================= //
// ====================================================== //

export const settingsApiRouteInput = z.discriminatedUnion('intent', [
  z.object({
    intent: z.literal('update_settings'),
    name: z.string().min(1).optional(),
    displayName: z.string().optional(),
    image: z.url().optional(),
  }),
])

// ====================================================== //
// ================= Members Api Route ================== //
// ====================================================== //

/** Schema for GET /api/members?workspaceId=... */
export const membersLoaderInput = z.object({
  workspaceId: z.string().nonempty(),
})

const workspaceMemberRoleSchema = z.enum(['owner', 'admin', 'member', 'viewer'])

export const membersApiRouteInput = z.discriminatedUnion('intent', [
  z.object({
    intent: z.literal('add_member'),
    workspaceId: z.string().nonempty(),
    userId: z.string().nonempty(),
    role: workspaceMemberRoleSchema.default('member'),
  }),
  z.object({
    intent: z.literal('remove_member'),
    workspaceId: z.string().nonempty(),
    userId: z.string().nonempty(),
  }),
  z.object({
    intent: z.literal('change_role'),
    workspaceId: z.string().nonempty(),
    userId: z.string().nonempty(),
    role: workspaceMemberRoleSchema,
  }),
])

// ====================================================== //
// =============== Subscription Api Route =============== //
// ====================================================== //

export const subscriptionApiRouteInput = z.discriminatedUnion('intent', [
  z.object({
    intent: z.literal('update_plan'),
    storagePlanId: z.string().optional(),
    storagePlanType: z.string().optional(),
  }),
  z.object({
    intent: z.literal('cancel_subscription'),
  }),
])

// ====================================================== //
// ================ Workspaces Api Route ================ //
// ====================================================== //

export const workspacesLoaderInput = z.object({
  workspaceId: z.string().optional(),
  userId: z.string().optional(),
})

export const workspacesApiRouteInput = z.discriminatedUnion('intent', [
  z.object({
    intent: z.literal('create_workspace'),
    name: z.string().nonempty(),
    slug: z.string().nonempty(),
  }),
  z.object({
    intent: z.literal('update_workspace'),
    workspaceId: z.string().nonempty(),
    name: z.string().optional(),
    slug: z.string().optional(),
  }),
  z.object({
    intent: z.literal('delete_workspace'),
    workspaceId: z.string().nonempty(),
  }),
])

// ====================================================== //
// ================ Permissions Api Route =============== //
// ====================================================== //

export const permissionsLoaderInput = z.object({
  itemId: z.string().nonempty(),
})

const permissionRoleSchema = z.enum(['read', 'write', 'owner'])

export const permissionsApiRouteInput = z.discriminatedUnion('intent', [
  z.object({
    intent: z.literal('grant_permission'),
    itemId: z.string().nonempty(),
    userId: z.string().nonempty(),
    role: permissionRoleSchema,
  }),
  z.object({
    intent: z.literal('revoke_permission'),
    itemId: z.string().nonempty(),
    userId: z.string().nonempty(),
  }),
  z.object({
    intent: z.literal('expire_permission'),
    permissionId: z.string().nonempty(),
    expiresAt: z.coerce.date(),
  }),
])

// ====================================================== //
// ================ Thumbnails Api Route ================ //
// ====================================================== //

export const thumbnailCreateSchema = z.object({
  itemId: z.string().nonempty(),
  url: z.string().nonempty(), // hex color e.g. '#3b82f6'
  view: z.enum(['list', 'grid', 'river', 'waterfall']).default('grid'),
  size: z.enum(['small', 'medium', 'large', 'original', 'custom']).default('medium'),
})

// PATCH sends url-encoded or JSON — url is a data URL e.g. 'data:image/jpeg;base64,...'
export const thumbnailUpdateSchema = z.object({
  stage: z.coerce.number().int().min(1).max(4),
  url: z.string().min(1),
  width: z.coerce.number().int().optional(),
  height: z.coerce.number().int().optional(),
})

// ====================================================== //
// ==================== Pins Api Route ================== //
// ====================================================== //

const pinSchema = z.object({
  intent: z.literal('pin'),
  itemId: z.string().nonempty(),
})

const unpinSchema = z.object({
  intent: z.literal('unpin'),
  itemId: z.string().nonempty(),
})

const reorderSchema = z.object({
  intent: z.literal('reorder'),
  pinId: z.string().nonempty(),
  position: z.coerce.number().int(),
})

export const pinApiRouteInput = z.discriminatedUnion('intent', [
  pinSchema,
  unpinSchema,
  reorderSchema,
])

export const pinApiRouteQuery = z.object({
  intent: z.enum(['list', 'check']).default('list'),
  itemId: z.string().optional(),
  cursor: z.string().optional(),
})

// ====================================================== //
// ==================== Locks Api Route ================= //
// ====================================================== //

const lockSchema = z.object({
  intent: z.literal('lock'),
  itemId: z.string().nonempty(),
  expiresAt: z.string().datetime().optional(),
})

const unlockSchema = z.object({
  intent: z.literal('unlock'),
  itemId: z.string().nonempty(),
})

export const lockApiRouteInput = z.discriminatedUnion('intent', [
  lockSchema,
  unlockSchema,
])

export const lockApiRouteQuery = z.object({
  intent: z.enum(['list', 'check']).default('list'),
  itemId: z.string().optional(),
  cursor: z.string().optional(),
})
