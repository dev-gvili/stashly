import type { LibraryStats } from '@/types/stash.types'
import { formatSize } from '@/utils/formaters'

/** The counts and byte totals `retrieveUserUsageMetrics` returns. */
export interface UsageMetrics {
  folders: number
  files: number
  favorites: number
  trashed: number
  usedBytes: bigint
  quotaBytes: bigint
}

/**
 * Usage metrics as the strings and numbers a loader can serialize. `usedBytes`
 * and `quotaBytes` are BigInts, which JSON has no form for, so they leave as
 * formatted text and a percentage.
 *
 * @example
 * toLibraryStats({ folders: 3, files: 12, favorites: 1, trashed: 0, usedBytes: 5_000_000n, quotaBytes: 10_000_000n })
 * // → { folders: 3, files: 12, favorites: 1, trashed: 0, size: '5MB', quota: '10MB', usedPercent: 50 }
 *
 * @example
 * // No quota yet reads as 0%, not a division by zero
 * toLibraryStats({ ...metrics, usedBytes: 10n, quotaBytes: 0n }).usedPercent // → 0
 */
export function toLibraryStats(stats: UsageMetrics): LibraryStats {
  return {
    folders: stats.folders,
    files: stats.files,
    favorites: stats.favorites,
    trashed: stats.trashed,
    size: formatSize('byte', 'unit', Number(stats.usedBytes)),
    quota: formatSize('byte', 'unit', Number(stats.quotaBytes)),
    usedPercent:
      stats.quotaBytes > 0n
        ? Math.round(Number((stats.usedBytes * 100n) / stats.quotaBytes))
        : 0,
  }
}
