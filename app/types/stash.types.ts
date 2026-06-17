import type { File, Folder, ItemCategory, ItemStatus, ItemType, Thumbnail } from '@/prisma/browser'
import type { InvitationStatus, PermissionRole, WorkspaceMemberRole } from '@/prisma/enums'

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
  parent: StashItem | null
  ownerId: string
  workspaceId: string | null
  driveId: string
  tags: string[]
  thumbnails: Pick<Thumbnail, 'id' | 'url' | 'width' | 'height' | 'size' | 'view'>[]
  favorites: StashFavorite[]
  pins?: StashPin[]
  locked: StashLock | null
  file: File | null
  folder: Folder | null
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

export interface StashInvitation {
  id: string
  createdAt: Date | string
  expiresAt: Date | string | null
  senderId: string
  sender: {
    id: string
    name: string
    email: string
    image: string | null
  }
  recipients: StashInvitationRecipient[]
  item: { id: string; name: string } | null
  workspace: { id: string; name: string } | null
  workspaceId: string | null
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
