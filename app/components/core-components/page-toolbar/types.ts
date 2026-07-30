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
}

export type ToolbarContext = 'files' | 'trash' | 'favorites' | 'shared'

export type ToolbarLayout = 'grid' | 'list'

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
