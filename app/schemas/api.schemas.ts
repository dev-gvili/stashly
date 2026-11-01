import { z } from 'zod'
import { toUserText, toZodArraySchema } from '@/utils/converters'
import { ItemCategory, ItemType } from '@/prisma/browser'

// ====================================================== //
// ============= Client Degradation Reports ============= //
// ====================================================== //

/**
 * Optional pipeline steps that can be skipped without failing the upload:
 * the browser-side thumbnail stages and the metadata/embedding chain. Each
 * one sits behind a `catch` that used to return silently.
 */
export const DEGRADED_STAGES = [
  'thumbnail_stage1',
  'thumbnail_stage2',
  'thumbnail_stage3',
  'metadata_pipeline',
  'embedding',
  // Query-time embedding, as opposed to `embedding` at index time. A client
  // that can't embed a *query* still searches by keyword, so this degrades
  // the ranking rather than the result set — worth its own series.
  'search_query',
  // Vision-model fallback for PDFs with no text layer. Failing here means a
  // scanned document stays unsearchable by content — the one stage whose
  // failure produces no partial result at all.
  'ocr',
] as const

/** Why the step was skipped. Coarse on purpose — see the note below. */
export const DEGRADED_REASONS = [
  'webgpu_unavailable',
  'model_load_failed',
  'render_failed',
  'unsupported_input',
  'unknown',
] as const

export type DegradedStage = (typeof DEGRADED_STAGES)[number]
export type DegradedReason = (typeof DEGRADED_REASONS)[number]

/**
 * Body of `POST /api/metrics`, sent by the browser when an optional stage
 * degrades. Both fields are closed enums rather than free strings: they become
 * Prometheus label values, so an open vocabulary would let a caller explode
 * series cardinality and inject characters into the exposition format. It also
 * keeps the report free of anything identifying — no item ids, no filenames,
 * no stack traces.
 */
export const clientDegradedReport = z.object({
  stage: z.enum(DEGRADED_STAGES),
  reason: z.enum(DEGRADED_REASONS),
})

export type ClientDegradedReport = z.infer<typeof clientDegradedReport>

// ====================================================== //
// =================== Quota Api Route ================== //
// ====================================================== //

/**
 * A byte count the client asks about. Never negative, and capped at the
 * largest size a browser `File` can report.
 */
const clientByteCount = z.coerce
  .bigint()
  .nonnegative()
  .max(BigInt(Number.MAX_SAFE_INTEGER))

/**
 * Input of `/api/quota`, one shape per `action`. Read-only: every action reads
 * the quota, none writes it.
 *
 * Quota changes only on the server, in the same code that changes the rows it
 * accounts for: upload in `createUploadedItem`, trash, restore, delete and copy
 * elsewhere in `item-actions.ts`, and the plan limit (`updateTotalQuota`) in
 * billing. None of them may be driven by a request body.
 */
export const quotaApiRouteInput = z.discriminatedUnion('action', [
  z.object({ action: z.literal('find-quota') }),
  z.object({
    action: z.literal('verify-free-quota'),
    dataSize: clientByteCount,
  }),
  z.object({
    action: z.literal('check-free-quota'),
    dataSize: clientByteCount,
    itemId: z.string(),
  }),
])

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
  currentParentId: z.string().default(''),
})
/**
 * This schema is for validating and parsing the input from the client for item-related actions.
 * It uses a discriminated union based on the 'intent' field to handle single item or multiple items actions.
 */
/**
 * Exactly the argument `createUploadedItem` takes.
 *
 * Exported so the client that builds the payload and the route that parses it
 * read from one schema — a field added on one side and forgotten on the other
 * used to surface as a runtime parse failure at the end of an upload, after
 * the bytes were already in S3.
 */
export const createUploadItemFields = z.object({
  id: z.string(),
  name: z.string(),
  // The object's own key, `<root>/<id>/<name>` (`toObjectKey`), within S3's
  // key limit.
  key: z.string().max(1024),
  // `<root>/<folders>/<name>`. Its middle segments become folders, so an
  // unbounded path was unbounded work for `createUploadedItem`.
  uploadPath: z.string().max(1024),
  // The client's claim, only compared: the charge and `Item.size` are the
  // stored object's (`headUploadedObject`). A negative claim is still refused.
  size: z.coerce.bigint().nonnegative(),
  mimeType: z.string().optional(),
  etag: z.string().optional(),
  // Client-computed content hash; empty string when the browser could not
  // hash the file, so it is normalised away rather than stored as ''.
  hash: z.string().optional(),
  bucket: z.string(),
  driveId: z.string(),
  parentId: z.string(),
  ownerId: z.string(),
  category: z.string().optional(),
  uploadId: z.string(),
})

export const  itemsApiRouteInput = z.discriminatedUnion('intent', [
  itemSchema,
  itemsSchema,
  moveItemSchema,
  z.object({
    intent: z.literal('rename_item'),
    itemId: z.string(),
    newName: toUserText(z.string().nonempty())
  }),
  z.object({
    intent: z.literal('move_items'),
    selectedItems: toZodArraySchema(z.string()),
    targetFolderId: z.string(),
    currentParentId: z.string().default(''),
  }),
  createUploadItemFields.extend({
    intent: z.literal('create_upload_item'),
  }),
  z.object({
    intent: z.literal('resolve_upload_folders'),
    rootId: z.string().nonempty(),
    // One JSON field, not a repeated one: a folder named "2024" or "a,b" must
    // arrive as written, and a one-folder batch must still be a list.
    dirs: z
      .string()
      .transform((text, ctx) => {
        try {
          return JSON.parse(text) as unknown
        } catch {
          ctx.addIssue({ code: 'custom', message: 'dirs must be a JSON array' })
          return z.NEVER
        }
      })
      // Each path is part of an S3 key, so S3's 1,024-character key limit
      // bounds it too; `resolveFolderTree` caps the folders they add up to.
      .pipe(z.array(z.string().nonempty().max(1024)).max(20_000)),
  }),
  z.object({
    intent: z.literal('create_folder'),
    name: toUserText(z.string().nonempty()),
    parentId: z.string().nonempty(),
  }),
  z.object({
    intent: z.literal('create_folder_inline'),
    name: toUserText(z.string().nonempty()),
    parentId: z.string().nonempty(),
    driveId: z.string().nonempty(),
  }),
  z.object({
    intent: z.literal('save_media_metadata'),
    itemId: z.string().nonempty(),
    // image fields
    imageWidth: z.coerce.number().int().optional(),
    imageHeight: z.coerce.number().int().optional(),
    horizontalResolution: z.coerce.number().int().optional(),
    verticalResolution: z.coerce.number().int().optional(),
    bitDepth: z.coerce.number().int().optional(),
    // free-text fields use z.coerce.string(): parseFormData's urlencoded
    // decoder turns numeric-looking values (camera model '5100', album '2112')
    // into numbers before Zod sees them — see the pdf* fields below.
    cameraMake: z.coerce.string().optional(),
    cameraModel: z.coerce.string().optional(),
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
    // pdf document-info fields (Pdf facet). parseFormData's urlencoded decoder
    // pre-coerces values: 'true'/'false' arrive as booleans and numeric-looking
    // strings (e.g. pdfVersion '1.7', a title like '2026') arrive as numbers —
    // so booleans accept both shapes and text fields coerce back to string.
    pdfTitle: z.coerce.string().optional(),
    pdfAuthor: z.coerce.string().optional(),
    pdfSubject: z.coerce.string().optional(),
    pdfKeywords: z.coerce.string().optional(),
    pdfCreator: z.coerce.string().optional(),
    pdfProducer: z.coerce.string().optional(),
    pdfVersion: z.coerce.string().optional(),
    pdfLanguage: z.coerce.string().optional(),
    pdfIsEncrypted: z.union([z.boolean(), z.stringbool()]).optional(),
    pdfHasFormFields: z.union([z.boolean(), z.stringbool()]).optional(),
    pdfHasAnnotations: z.union([z.boolean(), z.stringbool()]).optional(),
    pdfHasSignatures: z.union([z.boolean(), z.stringbool()]).optional(),
    pdfPageWidth: z.coerce.number().optional(),
    pdfPageHeight: z.coerce.number().optional(),
    pdfDocCreatedAt: z.coerce.date().optional(),
    pdfDocModifiedAt: z.coerce.date().optional(),
    // markdown document-info fields (Markdown facet). Same coercion caveat as
    // the pdf* fields above — text fields coerce back to string, booleans
    // accept both shapes.
    mdTitle: z.coerce.string().optional(),
    mdAuthor: z.coerce.string().optional(),
    mdDescription: z.coerce.string().optional(),
    mdTags: z.coerce.string().optional(),
    mdWordCount: z.coerce.number().int().optional(),
    mdReadingTime: z.coerce.number().int().optional(),
    mdHeadingCount: z.coerce.number().int().optional(),
    mdLinkCount: z.coerce.number().int().optional(),
    mdImageCount: z.coerce.number().int().optional(),
    mdCodeBlockCount: z.coerce.number().int().optional(),
    mdTaskCount: z.coerce.number().int().optional(),
    mdHasFrontmatter: z.union([z.boolean(), z.stringbool()]).optional(),
    mdDocCreatedAt: z.coerce.date().optional(),
    mdDocModifiedAt: z.coerce.date().optional(),
    // audio fields
    audioDuration: z.coerce.number().int().optional(),
    audioBitrate: z.coerce.number().int().optional(),
    audioTitle: z.coerce.string().optional(),
    audioArtist: z.coerce.string().optional(),
    audioAlbum: z.coerce.string().optional(),
    audioAlbumArtist: z.coerce.string().optional(),
    audioComposer: z.coerce.string().optional(),
    audioGenre: z.coerce.string().optional(),
    audioCopyright: z.coerce.string().optional(),
    audioYear: z.coerce.number().int().optional(),
    audioTrack: z.coerce.number().int().optional(),
    audioTrackCount: z.coerce.number().int().optional(),
    audioDisc: z.coerce.number().int().optional(),
    audioDiscCount: z.coerce.number().int().optional(),
  }),
  z.object({
    // One OCR'd page, saved as it is transcribed rather than after the whole
    // document. Appends: `ord` continues from the item's existing chunks and
    // `pageNum` is recorded, unlike `save_media_metadata` which replaces the
    // entire index for the item.
    intent: z.literal('save_ocr_page'),
    itemId: z.string().nonempty(),
    pageNum: z.coerce.number().int().positive(),
    text: toUserText(z.string().min(1)),
  }),
  z.object({
    intent: z.literal('save_search_chunk_embeddings'),
    // JSON-encoded `[{ chunkId, vector: number[] }]`. Vectors are 768-dim
    // (validated server-side in setSearchChunkVectors). Using a JSON-encoded
    // string field keeps the request shape consistent with the rest of the
    // form-data API; acceptable for typical batch sizes (<50 chunks).
    embeddings: z.string().min(2),
  }),
  z.object({
    // Rebuild the search index for text documents whose extraction never ran
    // or was truncated by an older parser. Batched rather than all-at-once:
    // each item is an S3 read plus a re-chunk, so a large backlog would
    // otherwise hold one request open for minutes.
    intent: z.literal('reindex_text'),
    limit: z.coerce.number().int().positive().max(50).default(10),
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
    content: toUserText(z.string().nonempty()),
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
    content: toUserText(z.string().nonempty()),
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


/**
 * Output of the `/api/collections` loader (the add-to-collection picker's
 * pages), parsed before it is sent: a resource route's payload is JSON, which
 * has no BigInt, so `size` goes out as a number, as `/api/quota` does.
 */
export const collectionsLoaderOutput = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      type: z.string(),
      category: z.string(),
      size: z.coerce.number(),
      createdAt: z.date(),
      thumbnailUrl: z.string().nullable(),
    })
  ),
  nextCursor: z.string().nullable(),
  hasMore: z.boolean(),
})

export const collectionsApiRouteInput = z.discriminatedUnion('intent', [
  z.object({
    intent: z.literal('create_collection'),
    name: toUserText(z.string().nonempty()),
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
    message: toUserText(z.string().optional()),
  }),
  // Invite multiple recipients to a workspace
  z.object({
    intent: z.literal('send_workspace_invitation'),
    workspaceId: z.string().nonempty(),
    recipients: z.array(recipientInputSchema).min(1),
    expiresAt: z.coerce.date().optional(),
    message: toUserText(z.string().optional()),
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
  // Undo an accepted/rejected response, back to pending (per recipient)
  z.object({
    intent: z.literal('undo_invitation_response'),
    recipientId: z.string().nonempty(),
  }),
  // Cancel a single pending recipient (sender)
  z.object({
    intent: z.literal('cancel_recipient'),
    recipientId: z.string().nonempty(),
  }),
  // Cancel an entire invitation (sender)
  z.object({
    intent: z.literal('cancel_invitation'),
    invitationId: z.string().nonempty(),
  }),
])

/**
 * A single thumbnail-backed entry in an invitation's `previews` array (the
 * children of a shared folder/workspace). Part of the enriched invitation
 * response the detail panel renders. Matches the `StashPickerItem` shape so
 * entries render through the standard `ItemCard`.
 */
export const invitationPreviewSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  category: z.string(),
  size: z.coerce.bigint(),
  createdAt: z.coerce.date(),
  thumbnailUrl: z.string().nullish(),
})
export type InvitationPreviewPayload = z.infer<typeof invitationPreviewSchema>

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
  // Set, update, or remove password on a link
  z.object({
    intent: z.literal('update_link_password'),
    linkId: z.string().nonempty(),
    password: z.coerce.string().optional(),
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
    content: toUserText(z.string().nonempty()),
  }),
  z.object({
    intent: z.literal('update_comment'),
    commentId: z.string().nonempty(),
    content: toUserText(z.string().nonempty()),
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
    label: toUserText(z.string().optional()),
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
  query: toUserText(z.string().optional()),
  email: z.string().email().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
})

export const usersApiRouteInput = z.discriminatedUnion('intent', [
  z.object({
    intent: z.literal('update_user'),
    name: toUserText(z.string().min(1).optional()),
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
    intent: z.literal('mark_unread'),
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
    message: toUserText(z.string().nonempty()),
    type: z.enum(['info', 'warning', 'error', 'success']),
    kind: z
      .enum([
        'system',
        'share',
        'upload',
        'file',
        'storage',
        'invitation',
        'member',
        'workspace',
        'collection',
        'favorite',
        'pin',
        'comment',
        'lock',
      ])
      .optional(),
  }),
])

// ====================================================== //
// ================= Settings Api Route ================= //
// ====================================================== //

export const settingsApiRouteInput = z.discriminatedUnion('intent', [
  z.object({
    intent: z.literal('update_settings'),
    name: toUserText(z.string().min(1).optional()),
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

/**
 * Output of the `/api/subscription` loader: the active subscription and its
 * plan, or `null`. Parsed before it is sent, so the plan's `storageLimit`
 * (a BigInt column) goes out as a number, as `/api/quota` does.
 */
export const subscriptionLoaderOutput = z.object({
  subscription: z
    .object({
      id: z.string(),
      status: z.string(),
      metadata: z.unknown(),
      createdAt: z.date(),
      updatedAt: z.date(),
      endedAt: z.date().nullable(),
      storagePlanId: z.string(),
      stripeSubscriptionId: z.string().nullable(),
      ownerId: z.string(),
      storagePlan: z.object({
        id: z.string(),
        name: z.string(),
        tag: z.string(),
        description: z.string().nullable(),
        type: z.string(),
        storageLimit: z.coerce.number(),
        workspaceLimit: z.number(),
        memberLimit: z.number(),
        features: z.array(z.string()),
        priceCents: z.number().nullable(),
        currency: z.string().nullable(),
        stripePriceId: z.string().nullable(),
      }),
    })
    .nullable(),
})

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
    name: toUserText(z.string().nonempty()),
    slug: z.string().nonempty(),
  }),
  z.object({
    intent: z.literal('update_workspace'),
    workspaceId: z.string().nonempty(),
    name: toUserText(z.string().optional()),
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

/**
 * GET discriminator for `/api/thumbnails/:itemId`.
 *
 * `presign` mints a short-lived PUT for the thumbnail key; `source` hands back
 * a GET on the original file so the client can regenerate a missing thumbnail.
 * Both are reads keyed on the same item, so they share one loader.
 */
export const thumbnailApiRouteQuery = z.object({
  intent: z.enum(['presign', 'source']),
})

export const thumbnailCreateSchema = z.object({
  itemId: z.string().nonempty(),
  url: z.string().nonempty(), 
  view: z.enum(['list', 'grid', 'river', 'waterfall']).default('grid'),
  size: z.enum(['small', 'medium', 'large', 'original', 'custom']).default('medium'),
})

// PATCH records a persisted stage. Only stages 2 and 3 reach the server —
// stage 1 is a local object URL that never leaves the browser.
//
// `url` is the client's optimistic src, kept so the fetcher-signal consumer can
// read it from `formData` on submit. The server IGNORES it and derives the
// stored locator itself: it signs whatever is stored, with credentials that
// reach every bucket, so a client-supplied value would be a read primitive.
export const thumbnailUpdateSchema = z.object({
  stage: z.coerce
    .number()
    .int()
    .pipe(z.union([z.literal(2), z.literal(3)])),
  url: z.string().min(1).optional(),
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

// ====================================================== //
// =================== Search Api Route ================= //
// ====================================================== //

/**
 * Scopes addressable at `/api/search/:type`. Only `items` is implemented;
 * declaring the enum here means an unknown scope fails validation at the
 * route boundary instead of silently returning an empty result set.
 */
export const searchScope = z.enum(['items'])

/** Shared filter/pagination fields for both halves of the search API. */
const searchCommonFields = {
  query: toUserText(z.string().min(1).max(512)),
  take: z.coerce.number().int().positive().max(100).default(25),
  skip: z.coerce.number().int().min(0).default(0),
  category: toZodArraySchema(z.enum(ItemCategory)).optional(),
  type: toZodArraySchema(z.enum(ItemType)).optional(),
  extension: toZodArraySchema(z.string().nonempty()).optional(),
  tags: toUserText(toZodArraySchema(z.string().trim().min(1)).optional()),
}

/**
 * `GET /api/search/:type` — keyword-only retrieval.
 *
 * The fast path: it needs no embedding, so it answers while the client's
 * model is still warming up, and it is the permanent path for browsers
 * without WebGPU.
 */
export const searchApiRouteQuery = z.object(searchCommonFields)

/**
 * `POST /api/search/:type` — hybrid retrieval.
 *
 * A POST for a read because the query embedding is 768 floats (~10KB as text)
 * and will not fit in a URL. Nothing is mutated.
 */
export const searchApiRouteInput = z.discriminatedUnion('intent', [
  z.object({
    intent: z.literal('semantic_search'),
    ...searchCommonFields,
    // JSON-encoded `number[]`, 768-dim — validated by `toVectorLiteral`
    // before it reaches the `::vector` cast. Matches the JSON-in-a-form-field
    // convention already used by `save_search_chunk_embeddings`.
    vector: z.string().min(2),
  }),
])

export type SearchApiRouteQuery = z.infer<typeof searchApiRouteQuery>
export type SearchApiRouteInput = z.infer<typeof searchApiRouteInput>

/** `Item.size` / `Item.inclusiveSize` are `BigInt` in Prisma. */
const serializableSizes = {
  size: z.coerce.number(),
  inclusiveSize: z.coerce.number(),
}

/**
 * This schema is for transforming the output before it's sent to the client.
 * It uses z.coerce.number() to safely convert bigint to number.
 *
 * `/api/search/:type` is a **resource route**, so its response goes out through
 * `Response.json()` rather than the turbo-stream encoder page loaders use —
 * and `JSON.stringify` throws on the first `BigInt` it meets. Sizes are
 * declared at every level they appear (`item`, `item.parent`,
 * `item.parent.parent`), since the card select carries the ancestor chain.
 *
 * `.loose()` throughout: only the fields needing coercion are declared, and
 * everything else on the payload — `passage`, thumbnails, dates, facets —
 * passes through untouched.
 *
 * `score` / `matchKind` / `hitCount` are the exception: they need no coercion
 * but are declared anyway, because they are what the results page groups by.
 * Dropping one silently collapses every result into the `semantic` group with
 * no error anywhere, so the boundary is the right place to catch it.
 */
export const searchApiRouteOutput = z
  .object({
    items: z.array(
      z
        .object({
          ...serializableSizes,
          score: z.number(),
          matchKind: z.enum(['name', 'content', 'fuzzy', 'semantic']),
          hitCount: z.number(),
          parent: z
            .object({
              ...serializableSizes,
              parent: z.object(serializableSizes).loose().nullish(),
            })
            .loose()
            .nullish(),
        })
        .loose()
    ),
    total: z.number(),
    hasMore: z.boolean(),
    semantic: z.boolean(),
    keywordCount: z.number(),
    semanticCount: z.number(),
  })
  .loose()

// ====================================================== //
// ============ Source Types (cross-file) Route ========= //
// ====================================================== //

// Cross-file type resolution for the code viewer: fetch a project's alias
// config, then the source of specific alias-mapped files.

const projectConfigSchema = z.object({
  intent: z.literal('project-config'),
  fileId: z.string().nonempty(),
})

const sourceFilesSchema = z.object({
  intent: z.literal('source-files'),
  rootId: z.string().nonempty(),
  // Project-root-relative logical paths (client has already alias-mapped them).
  logicalPaths: z.array(z.string().nonempty()).max(60),
})

export const sourceTypesApiRouteInput = z.discriminatedUnion('intent', [
  projectConfigSchema,
  sourceFilesSchema,
])


// ====================================================== //
// ============= Resolve Duplicates Route =============== //
// ====================================================== //

// The triage screen commits one group at a time. `itemIds` is the *drop* list —
// every copy the user did not keep — and it is always non-empty, because a
// group where nothing was dropped never submits at all.
export const resolveDuplicatesApiRouteInput = z.discriminatedUnion('intent', [
  z.object({
    intent: z.literal('resolve_group'),
    itemIds: z.array(z.string().nonempty()).min(1).max(200),
  }),
])
