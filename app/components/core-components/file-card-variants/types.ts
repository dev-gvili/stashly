import type { ReactNode } from 'react'
import type { StashItem } from '@/types/stash.types'

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
