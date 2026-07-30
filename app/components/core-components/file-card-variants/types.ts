import type { ReactNode } from 'react'
import type { StashItem } from '@/types/stash.types'
import { formatSize } from '@/utils/formaters'

/**
 * Shared prop shape for every FileCard variant. Mirrors the default
 * `FileCard` in `../file-card.tsx` so variants stay drop-in swappable at a
 * call site.
 */
export interface FileCardVariantProps {
  /** The item to render. Folders should use `FolderCardTab` instead. */
  item: StashItem
  className?: string
  /** When false, the action menu is hidden (e.g. read-only shared items). */
  showActions?: boolean
  /** Custom action-menu contents; falls back to the default menu when omitted. */
  actions?: ReactNode
}

/**
 * Splits a formatted byte count into its numeric part and its unit, so a card
 * can set them at different type sizes.
 *
 * @param size Raw byte count — `StashItem.size` is a `bigint`.
 * @returns `[value, unit]`, e.g. `['4.2', 'MB']`. The unit is `''` when
 *   `formatSize` returns no suffix.
 *
 * @example
 * const [value, unit] = splitSize(item.size)
 * <p>{value}<span className="text-xs">{unit}</span></p>
 */
export function splitSize(size: bigint | number): [string, string] {
  const [value, ...unitParts] = formatSize('byte', 'unit', size).split(' ')
  return [value, unitParts.join(' ')]
}
