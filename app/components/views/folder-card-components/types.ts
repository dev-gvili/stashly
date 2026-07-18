// View-model consumed by all folder cards.
// Map your Stashly Item (folder) to this shape.
export interface FolderCardData {
  id: string
  name: string
  /** dominant category of children: text | audio | presentation | image | video | pdf */
  category: string
  /** human label for the category, e.g. "Docs", "Photos" */
  kind: string
  childCount: number
  /** formatted inclusive size, e.g. "482 MB" */
  inclusiveSize: string
  /** relative, e.g. "2d ago" */
  updatedAt: string
  /** formatted date, e.g. "Jan 8, 2026" */
  createdAt: string
  /** cover image url (optional) */
  cover?: string
  /** css background fallback while/if cover fails */
  fallback?: string
}

export interface FolderCardProps {
  folder: FolderCardData
  onOpen?: (folder: FolderCardData) => void
}
