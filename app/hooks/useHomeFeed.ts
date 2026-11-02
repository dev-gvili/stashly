import { useMemo, useState } from 'react'
import type { HomeCollection, HomeFeedEntry, HomeFeedTab, HomeFile } from '@/types/home.types'

/** Slots in the "All" tab that take a collection: file, col, file, file, col… */
const COLLECTION_SLOTS = [1, 4, 7, 10]
const ALL_LIMIT = 12

function interleave(files: HomeFile[], collections: HomeCollection[]) {
  const out: HomeFeedEntry[] = []
  let f = 0
  let c = 0
  for (let i = 0; out.length < ALL_LIMIT && (f < files.length || c < collections.length); i++) {
    if (COLLECTION_SLOTS.includes(i) && c < collections.length) out.push({ kind: 'collection', collection: collections[c++] })
    else if (f < files.length) out.push({ kind: 'file', file: files[f++] })
    else out.push({ kind: 'collection', collection: collections[c++] })
  }
  return out
}

/**
 * Home feed tabs from recent files and collections. "All" mixes the newest 8
 * files with up to 4 collections (12 max); the other tabs are plain filters.
 */
export function useHomeFeed({
  recent,
  collections,
  me,
  initialTab = 'all',
}: {
  recent: HomeFile[]
  collections: HomeCollection[]
  me: string
  initialTab?: HomeFeedTab
}) {
  const [tab, setTab] = useState<HomeFeedTab>(initialTab)

  const lists = useMemo(() => {
    const asFile = (file: HomeFile): HomeFeedEntry => ({ kind: 'file', file })
    return {
      all: interleave(recent.slice(0, 8), collections.slice(0, 4)),
      pinned: recent.filter((f) => f.pinned).map(asFile),
      collections: collections.map((collection): HomeFeedEntry => ({ kind: 'collection', collection })),
      shared: recent.filter((f) => f.ownerId !== me).map(asFile),
    } satisfies Record<HomeFeedTab, HomeFeedEntry[]>
  }, [recent, collections, me])

  return {
    tab,
    setTab: (v: string) => setTab(v as HomeFeedTab),
    entries: lists[tab],
    counts: {
      all: lists.all.length,
      pinned: lists.pinned.length,
      collections: lists.collections.length,
      shared: lists.shared.length,
    },
  }
}
