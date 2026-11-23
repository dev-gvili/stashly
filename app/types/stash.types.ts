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
  ShareLinkType,
  ShareScope,
  WorkspaceMemberRole,
} from '@/prisma/enums'
import type { ActivityWithRelations } from '@/utils/activity'
import type { MarkdownHeading } from '@/utils/markdown'
import type { SearchMode } from './filter.types'

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
    'id' | 'url' | 'width' | 'height' | 'size' | 'view' | 'stage'
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
  /** Signed thumbnail URLs of the newest image-bearing members (0–4). */
  covers: string[]
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
  /** The file facet, when the caller has it: the thumbnail check reads its `mimeType`. */
  file?: StashItem['file']
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

export type StashItemText = {
  id: string
  name: string
  file: { mimeType: string | null } | null
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

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

/**
 * The passage a result quotes as its evidence.
 *
 * Two sources, one shape. When the query appears literally in the document the
 * server cuts the window around that occurrence, because the vector-nearest
 * chunk is routinely a *different* passage — quoting it under a "2 hits" label
 * shows text containing none of the words the user typed. Only when there is no
 * literal hit does the dense chunk stand in, and then `similarity` is set and
 * `chunkId` names the row it came from.
 *
 * `pageNum` / `charStart` / `charEnd` are captured at index time (see
 * `docs/semantic-search.md`) so a result can be linked straight to its
 * location in the source document without re-chunking.
 */
export type SearchPassage = {
  /** Null when the window was cut from the document body rather than a chunk. */
  chunkId: string | null
  content: string
  /** Null for formats without pages (`.md`, `.txt`). */
  pageNum: number | null
  /**
   * 1-based line in the document body. Null for anything indexed before line
   * breaks were preserved, until that item is re-indexed.
   */
  lineNum: number | null
  /**
   * Nearest preceding heading — how a document with structure but no pages
   * says where a passage came from. Null for formats without headings, and for
   * anything indexed before sections were recorded.
   */
  section: string | null
  charStart: number
  charEnd: number
  /** Cosine similarity in `[0, 1]`. Null when the passage was located literally. */
  similarity: number | null
}

/**
 * Why a result is in the list, strongest evidence first.
 *
 * The search page groups by this rather than showing one flat ranking, because
 * a filename hit and a distant semantic neighbour are different kinds of
 * answer: the first is what the user asked for, the second is a suggestion.
 * Sorting them together leaves a 9% result sitting next to a 96% one with
 * nothing to explain why it is there.
 *
 * `fuzzy` and `semantic` are the two no-literal-evidence kinds, kept apart
 * because they are reached by different rankers: `fuzzy` is an approximate
 * name from the trigram half (no model involved), `semantic` is a vector
 * neighbour. Collapsing them labelled every typo match "closest by meaning".
 */
export type MatchKind = 'name' | 'content' | 'fuzzy' | 'semantic'

/** One search hit: a normal item card plus what matched inside it. */
export type SearchResult = StashItem & {
  /** Null for a keyword-only hit — nothing inside the document matched. */
  passage: SearchPassage | null
  /**
   * Relevance in `[0, 100]`, on a scale that depends on `matchKind`.
   *
   * For `semantic` results it is the true cosine similarity — absolute, and
   * comparable across searches, so a low number means a genuinely distant
   * match. For `name` and `content` it is fused rank normalized against this
   * result set's best hit, so the leader always reads 100 and the number is
   * only meaningful within one search.
   *
   * The page groups by `matchKind`, so the two scales are never shown side by
   * side. Don't sort across groups on this field.
   */
  score: number
  /** The grouping key. Server-derived; see `MatchKind`. */
  matchKind: MatchKind
  /** Literal query-term occurrences in the document body; 0 for pure neighbours. */
  hitCount: number
}

/**
 * Serialized payload of both `/api/search/:type` halves.
 *
 * `semantic` reports what actually ran, not what was requested: a request
 * that carried a vector still comes back `semantic: false` when the drive has
 * no embedded chunks to match against, which is what lets the view explain an
 * empty dense half instead of showing a bare "no results".
 */
export type SearchResponse = {
  items: SearchResult[]
  total: number
  hasMore: boolean
  semantic: boolean
  keywordCount: number
  semanticCount: number
}

// ---------------------------------------------------------------------------
// Gallery
// ---------------------------------------------------------------------------

/**
 * One image as the gallery layouts consume it.
 *
 * Named `GalleryImage` rather than `ImageData` (its name back in
 * `views/buildRows.ts`) because this module is re-exported through
 * `app/types/index.ts` — `ImageData` there would shadow the DOM lib global for
 * every `@/types` consumer.
 */
export type GalleryImage = {
  id: string
  src: string | null
  alt: string
  width: number
  height: number
  sizes: string
  srcSet: string
  parentId: string | null
}

/**
 * A row of the Images page (`routes/stash/gallery.tsx`): a `GalleryImage` plus
 * what the page's tiles, grouping and selection bar read.
 */
export type GalleryPageImage = GalleryImage & {
  name: string
  /** File size in bytes, already a number (the column is a BigInt). Named
   * `bytes` because the loader's `size` is the thumbnail stage. */
  bytes: number
  /** ISO timestamp; drives the date groups. */
  createdAt: string
  /** Pinned by the viewer. */
  pinned: boolean
  folderName: string | null
}

// ---------------------------------------------------------------------------
// Search results presentation
// ---------------------------------------------------------------------------

/** The matching text as a card renders it, already windowed for reading. */
export interface EvidenceSnippet {
  /** The excerpt, trimmed to a readable window around the match. */
  text: string
  /** Where it sits in the document — `page 5`. Absent when the source has no pagination. */
  locator?: string
  /** Ellipsis hints for text dropped either side of the window. */
  truncatedStart?: boolean
  truncatedEnd?: boolean
}

/** What the results header needs to describe the search that produced them. */
export interface SearchQueryState {
  query: string
  mode: SearchMode
  /**
   * Terms the vector index added by meaning. No server field feeds this yet —
   * while it is absent the dotted highlight tier and its legend never render,
   * which is the correct degradation rather than a gap.
   */
  expandedTerms?: string[]
}

// ---------------------------------------------------------------------------
// Item page — loader payload contracts
// ---------------------------------------------------------------------------

/** Markdown body streamed from `routes/stash/file.tsx` into `MarkdownStage`. */
export type MarkdownDoc = { text: string; headings: MarkdownHeading[] }

/** Plain-text body streamed from `routes/stash/file.tsx` into `TextStage`. */
export type TextDoc = { text: string }

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

export interface OverviewPerson {
  id: string
  name: string
  /** Short role or team label, e.g. `design`. */
  role?: string
  avatarUrl?: string | null
  /** How many items you have exchanged with this person. */
  exchangedCount?: number
  lastExchangeAt?: Date | string | null
}

/** One item somebody shared with you. */
export interface SharedWithYouEntry {
  item: StashItem
  by: OverviewPerson
  sharedAt: Date | string
}

/** One outbound share link you own. */
export interface SharedLink {
  item: StashItem
  /** Absolute link the Copy action puts on the clipboard. */
  url?: string | null
  /** Human summary of the audience, e.g. `Anyone with link` or `2 people`. */
  audience: string
  permission: 'View' | 'Edit'
  expiresAt?: Date | string | null
  /** True once `expiresAt` has passed; kept explicit so the server can decide. */
  expired?: boolean
  viewCount: number
}

/** Lifecycle of a `SharedLink`, derived by `toLinkState` in `@/utils/converters`. */
export type LinkState = 'live' | 'expiring' | 'expired'

export interface StorageSegment {
  /** Display label, e.g. `Images`. */
  label: string
  bytes: number
  /** Which literal tint class the meter should use for this segment. */
  tone: 'images' | 'video' | 'audio' | 'documents' | 'code' | 'other'
}

export interface StorageUsage {
  usedBytes: number
  totalBytes: number
  segments: StorageSegment[]
  planName?: string
  renewsAt?: Date | string | null
}

/** A day-grouped photo cluster: "On this day". */
export interface MemoryCluster {
  /** Date the cluster is anchored to. */
  date: Date | string
  items: StashItem[]
  totalCount: number
}

/**
 * Restorable items sitting in the trash. `retentionDays` is optional because
 * this app has no purge policy yet — without one the line must not claim a
 * window it cannot honour, so it degrades to the bare count.
 */
export interface TrashRescueSummary {
  count: number
  retentionDays?: number
}

// ---------------------------------------------------------------------------
// Workspace overview — `routes/workspaces/workspace.tsx` loader payload
// ---------------------------------------------------------------------------

export interface WorkspaceOverviewMember {
  id: string
  name: string
  email: string
  image: string | null
  role: WorkspaceMemberRole
  storageBytes: bigint
  status: 'online' | 'idle' | 'offline'
}

export interface WorkspaceOverviewItem {
  id: string
  name: string
  category: string
  size: bigint
  updatedAt: Date | null
  ownerName: string
}

export interface WorkspaceOverviewPinnedItem {
  id: string
  name: string
  type: 'collection' | 'folder'
  itemCount: number
}

export interface WorkspaceOverviewInvite {
  id: string
  email: string
  role: string
  sentAt: Date
  senderName: string
}

// ---------------------------------------------------------------------------
// Invitations
// ---------------------------------------------------------------------------

/**
 * Optional presentation fields the detail panel *can* surface when the loader
 * provides them. Everything here is optional — the UI degrades gracefully when
 * a field is absent, so no schema change is required to ship the panel.
 *
 * To light up the richer sections (personal message, file peek, mutual
 * connection), extend the loader / `StashInvitation` with:
 *   - message?: string
 *   - mutualConnection?: string
 *   - sender.title
 *   - item.mimeType / item.fileCount
 *   - workspace.size / workspace.fileCount / workspace.memberCount
 *   - previews?: StashPickerItem[]
 */
export type InvitationExtras = StashInvitation & {
  message?: string | null
  mutualConnection?: string | null
  sender: StashInvitation['sender'] & {
    title?: string | null
  }
  item:
    | (NonNullable<StashInvitation['item']> & {
        mimeType?: string | null
        fileCount?: number | null
      })
    | null
  workspace:
    | (NonNullable<StashInvitation['workspace']> & {
        size?: string | null
        fileCount?: number | null
        memberCount?: number | null
      })
    | null
}

/** One editable row in the invite forms (NewInvitation / AddRecipients). */
export type InviteRow = { id: string; email: string; role: string }

// ---------------------------------------------------------------------------
// Sharing
// ---------------------------------------------------------------------------

export interface ShareLinkWithPermissions {
  id: string
  type: ShareLinkType
  scope: ShareScope
  url: string | null
  downloadable: boolean | null
  password: string | null
  expiresAt: Date | string | null
  createdAt: Date | string
  permission: {
    id: string
    roles: string
    users: { id: string; name: string | null; image: string | null }[]
  }[]
}

// ---------------------------------------------------------------------------
// Toolbar
// ---------------------------------------------------------------------------

export interface LibraryStats {
  folders: number
  files: number
  favorites: number
  trashed: number
  /** formatted used size, e.g. "18.4 GB" — build with `formatSize('byte', 'unit', bytes)` */
  size: string
  /** formatted quota, e.g. "40 GB" */
  quota: string
  /** 0–100 */
  usedPercent: number
  /** the used bytes behind `size`, for adding an upload's rows in the browser */
  sizeBytes?: number
  /** the quota bytes behind `quota` */
  quotaBytes?: number
}

export type ToolbarContext = 'files' | 'trash' | 'favorites' | 'shared'

/** Bulk-selection callbacks every page-toolbar variant spreads into its props. */
export interface BulkActions {
  onMove?: () => void
  onFavorite?: () => void
  onDownload?: () => void
  onShare?: () => void
  onTrash?: () => void
  onDeleteForever?: () => void
  onRestore?: () => void
  onCopyTo?: () => void
  onCopyLink?: () => void
}

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

/** Shape of an individual workspace entry displayed in the sidebar. */
export interface WorkspacesSidebarItem {
  id: string
  name: string
  slug: string
  icon?: React.ReactNode
  action?: React.ReactNode
}
