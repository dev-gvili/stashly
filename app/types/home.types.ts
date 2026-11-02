export type FileKind = 'document' | 'image' | 'audio' | 'video' | 'code'

/** What the home feed needs from a stash item — map from StashItem in the loader. */
export interface HomeFile {
  id: string
  name: string
  kind: FileKind
  /** Shown as the corner badge, e.g. "PDF". */
  extension?: string
  size: number
  updatedAt: Date | string
  href: string
  ownerId: string
  thumbnailUrl?: string
  pinned?: boolean
  /** Indexed / transcribed / captioned — findable by what's inside. */
  searchable?: boolean
  /** Audio / video length, e.g. "6:41". */
  duration?: string
}

export interface HomeCollectionTile {
  kind: FileKind
  thumbnailUrl?: string
}

export interface HomeCollection {
  id: string
  name: string
  itemCount: number
  href: string
  /** First three items; fewer are repeated to fill the mosaic. */
  tiles: HomeCollectionTile[]
}

export type HomeFeedTab = 'all' | 'pinned' | 'collections' | 'shared'

export type HomeFeedEntry =
  | { kind: 'file'; file: HomeFile }
  | { kind: 'collection'; collection: HomeCollection }

export interface NeedsYouEntry {
  id: string
  kind: 'comment' | 'invite' | 'share'
  actorName: string
  /** Sentence after the actor's name, e.g. "commented on Q3 Board Deck.pdf". */
  text: string
  quote?: string
  cta: string
  at: Date | string
  /** The invitation recipient row that accept / dismiss act on. */
  recipientId: string
}

export interface SearchableQueueEntry {
  id: string
  name: string
  kind: FileKind
  /** e.g. "Video · 6 min 41 s" */
  meta: string
}

export interface SearchableStatus {
  done: number
  total: number
  queue: SearchableQueueEntry[]
}
