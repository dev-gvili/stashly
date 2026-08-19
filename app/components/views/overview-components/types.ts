import type { OverviewActivity } from '@/services/activity-actions'
import type {
  MemoryCluster,
  OverviewPerson,
  SharedLink,
  SharedWithYouEntry,
  StashItem,
  StorageUsage,
  TrashRescueSummary,
} from '@/types/stash.types'

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
