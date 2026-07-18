import type {
  File,
  Folder,
  Video,
  Audio,
  Image,
  Pdf,
  Markdown,
  ItemCategory,
  ItemStatus,
  ItemType,
  Thumbnail,
} from '@/prisma/browser'
import type {
  InvitationStatus,
  PermissionRole,
  WorkspaceMemberRole,
} from '@/prisma/enums'
import type { ActivityWithRelations } from '@/utils/activity'

// ---------------------------------------------------------------------------
// Sub-types
// ---------------------------------------------------------------------------

export type StashFavorite = {
  id: string
  favoritedBy: {
    id: string
    name: string
    displayName: string | null
    image: string | null
  }
}

export type StashPin = {
  id: string
  pinnedById: string
  pinnedBy: {
    id: string
    name: string
    displayName: string | null
    image: string | null
  }
}

export type StashLock = {
  id: string
  lockedById: string
  lockedAt: Date | string
}

// ---------------------------------------------------------------------------
// Base item shape — the single source of truth for item data across the app.
// Used by ItemCard, ListLayout, SuggestionsView, and anywhere an item is displayed.
// ---------------------------------------------------------------------------

export interface StashItem {
  id: string
  name: string
  type: ItemType
  category: ItemCategory
  status: ItemStatus
  size: bigint
  inclusiveSize: bigint
  createdAt: Date | string | null
  updatedAt: Date | string | null
  parentId: string | null
  parent: StashAncestor | null
  ownerId: string
  workspaceId: string | null
  driveId: string
  tags: string[]
  thumbnails: Pick<
    Thumbnail,
    'id' | 'url' | 'width' | 'height' | 'size' | 'view'
  >[]
  favorites: StashFavorite[]
  pins?: StashPin[]
  locked: StashLock | null
  file: File | null
  folder: Folder | null
}

// A parent/ancestor item. Same fields as `StashItem`, but the ancestor chain is
// only loaded one level deep with its own parent fetched shallowly (scalars,
// no relations) — so `parent` here is intentionally loose to break the
// otherwise-infinite `StashItem.parent` recursion.
export interface StashAncestor extends Omit<StashItem, 'parent'> {
  parent?: { id: string; name: string } | null
}

// ---------------------------------------------------------------------------
// Collection card shape — slim representation used by CollectionCard and
// CollectionsView. Only the fields actually rendered in the UI.
// ---------------------------------------------------------------------------

export interface StashCollection {
  id: string
  name: string
  size: bigint
  itemCount: number
}

// ---------------------------------------------------------------------------
// Invitation — the shape returned from /api/invitations and used in the
// InviteDialog, invitations view, and item card actions.
// ---------------------------------------------------------------------------

export interface StashInvitationRecipient {
  id: string
  email: string
  status: InvitationStatus
  role: string
  permission: {
    id: string
    roles: PermissionRole
    item: { id: string; name: string } | null
  } | null
}

/**
 * A single thumbnail-backed entry in an invitation's `previews` array — the
 * children of a shared folder/workspace (or the shared item itself). Uses the
 * slim `StashPickerItem` shape so the UI can render each entry through the
 * standard `ItemCard` (via the picker → `StashItem` adapter).
 */
export type StashInvitationPreview = StashPickerItem

export interface StashInvitation {
  id: string
  createdAt: Date | string
  expiresAt: Date | string | null
  senderId: string
  /** Optional personal note from the sender. */
  message?: string | null
  sender: {
    id: string
    name: string
    email: string
    image: string | null
    /** Optional role/title line shown under the sender's name. */
    title?: string | null
  }
  recipients: StashInvitationRecipient[]
  item: {
    id: string
    name: string
    type: ItemType
    size: bigint
    category: ItemCategory
    file: File | null
    folder: Folder | null
    image: Image | null
    audio: StashItemAudio | null
    video: StashItemVideo | null
    pdf: StashItemPdf | null
    markdown: StashItemMarkdown | null
    /** MIME type of the shared file, when it is a single file. */
    mimeType?: string | null
    /** Number of children, when the shared item is a folder. */
    fileCount?: number | null
    /** Real thumbnail for the shared item, used for the hero preview. */
    thumbnailUrl?: string | null
  } | null
  workspace: {
    id: string
    name: string
    members: StashWorkspaceMember[]
    /** Formatted total storage size of the workspace (e.g. "512 MB"). */
    size?: string | null
    /** Total number of items in the workspace. */
    fileCount?: number | null
    /** Total number of workspace members. */
    memberCount?: number | null
  } | null
  workspaceId: string | null
  /** Thumbnail-backed peek at the shared contents. */
  previews?: StashInvitationPreview[] | null
}

export interface StashWorkspaceMember {
  id: string
  role: WorkspaceMemberRole
  member: { id: string; name: string; image: string | null }
}

// ---------------------------------------------------------------------------
// Lightweight picker shape — used by AddToCollectionDialog and anywhere a
// slim item representation is needed (no thumbnails[], favorites[], file, folder).
// ---------------------------------------------------------------------------

export type StashPickerItem = Pick<
  StashItem,
  'id' | 'name' | 'type' | 'category' | 'size' | 'createdAt'
> & {
  thumbnailUrl?: string | null
}

// ---------------------------------------------------------------------------
// Item-page stage shapes — the per-stage subsets of the item data that each
// file-detail view (audio/video/pdf/markdown stage + item panel) renders.
// ---------------------------------------------------------------------------

export type StashItemAudio = {
  id: string
  name: string
  thumbnails: Array<{ url: string | null; size: string; view: string }>
  audio: {
    title: string | null
    artist: string | null
    album: string | null
    albumArtist: string | null
    duration: number | null
    track: number | null
    trackCount: number | null
    bitrate: number | null
  } | null
}

export type StashItemVideo = {
  id: string
  name: string
  thumbnails: Array<{ url: string | null; size: string; view: string }>
  video: {
    width: number | null
    height: number | null
    duration: number | null
  } | null
}

export type StashItemImage = {
  id: string
  name: string
  image: {
    width: number | null
    height: number | null
  } | null
}

export type StashItemPdf = {
  id: string
  name: string
  pdf: {
    title: string | null
    pageCount: number | null
  } | null
}

export type StashItemMarkdown = {
  id: string
  name: string
  markdown: {
    title: string | null
    headingCount: number | null
  } | null
}

// Subset of what getFileItem returns — only what the item panel renders.
export type StashItemPanel = {
  id: string
  name: string
  size: bigint
  category: ItemCategory
  tags: string[]
  type: ItemType
  createdAt: Date | string | null
  updatedAt: Date | string | null
  openedAt?: Date | string | null
  status: ItemStatus
  owner: {
    id: string
    name: string
    email: string
    image: string | null
    bucket: string
  }
  url: string
  file: { mimeType: string | null; extension: string | null } | null
  audio: {
    title: string | null
    artist: string | null
    album: string | null
    albumArtist: string | null
    track: number | null
    trackCount: number | null
    duration: number | null
    bitrate: number | null
    bitDepth?: number | null
    sampleRate?: number | null
    channels?: number | null
  } | null
  pdf?: {
    pageCount: number | null
    title: string | null
    author: string | null
    subject: string | null
    creator: string | null
    producer: string | null
    pdfVersion: string | null
    language: string | null
    hasFormFields: boolean | null
    hasSignatures: boolean | null
    pageWidth: number | null
    pageHeight: number | null
    docCreatedAt: Date | string | null
    docModifiedAt: Date | string | null
  } | null
  markdown?: {
    title: string | null
    author: string | null
    description: string | null
    tags: string | null
    wordCount: number | null
    readingTime: number | null
    headingCount: number | null
    linkCount: number | null
    imageCount: number | null
    codeBlockCount: number | null
    taskCount: number | null
    hasFrontmatter: boolean | null
    docCreatedAt: Date | string | null
    docModifiedAt: Date | string | null
  } | null
  video?: {
    width: number | null
    height: number | null
    duration: number | null
    bitrate: number | null
    codec: string | null
    container: string | null
    frameRate: number | null
  } | null
  image?: {
    width: number | null
    height: number | null
    horizontalResolution: number | null
    verticalResolution: number | null
    bitDepth: number | null
    cameraMake: string | null
    cameraModel: string | null
    iso: number | null
    fNumber: number | null
    exposureTime: number | null
    focalLength: number | null
    takenDateTime: Date | string | null
    latitude: number | null
    longitude: number | null
  } | null
  favorites: Array<{
    favoritedBy: { id: string; name: string; image: string | null }
  }>
  permissions: Array<{
    roles: string
    users: Array<{ id: string; name: string; image: string | null }>
  }>
  collections: Array<{ id: string; name: string }>
  activities: Array<ActivityWithRelations>
}
