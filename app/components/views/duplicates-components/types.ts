import type { StashItem } from '@/types/stash.types'

/** How confident the server is that these files really are the same thing. */
export type DuplicateRisk = 'exact' | 'near' | 'conflict'

/**
 * The item fields this screen renders.
 *
 * Deliberately a *structural subset* of `StashItem` rather than `StashItem`
 * itself: a real `StashItem` is assignable to it, but a duplicate row does not
 * have to load fifteen relations to be rendered. `thumbnails` follows the repo
 * convention (`thumbnails.find(t => t.url && !t.url.startsWith('#'))`) — there
 * is no `thumbnailUrl` field on `StashItem`. `extension` lives on `Item.file`,
 * so it is optional here and lifted by whoever builds the group.
 */
export interface DuplicateItem {
  id: string
  name: string
  /** `Item.size` is a `bigint` in Prisma; serialized routes pass a `number`. */
  size: number | bigint
  thumbnails?: { url: string | null }[]
  extension?: string | null
}

type Assert<T extends true> = T

/**
 * Compile-time proof that a real `StashItem` still satisfies `DuplicateItem`.
 * If `StashItem` ever drops `thumbnails` or re-types `size`, this line is the
 * error, not a runtime surprise in the copy card.
 */
export type DuplicateItemAcceptsStashItem = Assert<
  StashItem extends DuplicateItem ? true : false
>

/** One physical copy inside a duplicate group. */
export interface DuplicateCopy {
  /** The real item, so thumbnails and names come from the same source as the rest of the app. */
  item: DuplicateItem
  /** Display path of the folder holding this copy, e.g. `Photos/2026/August`. */
  folderPath: string
  /** ISO string — when this copy entered the stash (not when it was modified). */
  addedAt: string
  /** ISO string — last modification, used by the "keep newest" rule. */
  modifiedAt: string
  /** Content checksum (`File.hash`). Equal checksums across a group mean `risk: 'exact'`. */
  checksum?: string | null
}

export interface DuplicateGroup {
  id: string
  /** Display name for the group — normally the keeper candidate's filename. */
  name: string
  risk: DuplicateRisk
  copies: DuplicateCopy[]
  /** Bytes reclaimable if every copy but one is deleted. Server-computed. */
  reclaimableBytes: number
}

/** Seeds which copy is preselected in each group. */
export type ResolveRule = 'newest' | 'original' | 'filed'

export interface DuplicateTriageViewProps {
  groups: DuplicateGroup[]
  initialRule?: ResolveRule
  /** Fired when the user commits a group. `keptItemIds` is always non-empty. */
  onResolveGroup?: (input: {
    groupId: string
    keptItemIds: string[]
    deletedItemIds: string[]
  }) => void
  /** Fired once every group has been visited. */
  onFinish?: () => void
  className?: string
}
