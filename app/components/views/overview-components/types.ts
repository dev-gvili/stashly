import type { OverviewActivity } from '@/services/activity-actions'
import type { StashItem } from '@/types/stash.types'

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

export interface StorageSegment {
  /** Display label, e.g. `Images`. */
  label: string
  bytes: number
  /** Which literal tint class the meter should use for this segment. */
  tone: 'images' | 'video' | 'documents' | 'code' | 'other'
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
 * window it can't honour, so it degrades to the bare count.
 */
export interface TrashRescueSummary {
  count: number
  retentionDays?: number
}

export interface OverviewViewProps {
  user: { id: string; name: string }
  pinned: StashItem[]
  favorites: StashItem[]
  suggestedFolders: StashItem[]
  suggestedFiles: StashItem[]
  activity: OverviewActivity[]
  /** Line under the page title, e.g. `12 folders · 269 files`. */
  subline?: string
  storage?: StorageUsage
  sharedWithYou?: SharedWithYouEntry[]
  sharedLinks?: SharedLink[]
  people?: OverviewPerson[]
  memories?: MemoryCluster
  trash?: TrashRescueSummary
  /** Why each suggested item is surfaced, keyed by item id. */
  suggestionReasons?: Record<string, string>
  className?: string
}
