import { Link } from 'react-router'
import { ChevronRightIcon, CollectionFillIcon, FolderFillIcon, PinFillIcon, ShareFillIcon } from '@/components/icons'
import { HomeCollectionCard } from '@/components/views/home-components/home-collection-card'
import { HomeFileCard } from '@/components/views/home-components/home-file-card'
import { useHomeFeed } from '@/hooks/useHomeFeed'
import type { HomeCollection, HomeFile, HomeFeedTab } from '@/types/home.types'
import { Tabs, TabsList, TabsTrigger } from '@/ui/tabs'

const TABS: { value: HomeFeedTab; label: string; more: string }[] = [
  { value: 'all', label: 'All', more: 'Open stash' },
  { value: 'pinned', label: 'Pinned', more: 'All pinned' },
  { value: 'collections', label: 'Collections', more: 'All collections' },
  { value: 'shared', label: 'Shared', more: 'All shared' },
]

const EMPTY: Record<HomeFeedTab, { icon: typeof FolderFillIcon; text: string }> = {
  all: { icon: FolderFillIcon, text: 'Your stash is empty — drop files here to start' },
  pinned: { icon: PinFillIcon, text: 'Pin files to keep them here' },
  collections: { icon: CollectionFillIcon, text: 'No collections yet' },
  shared: { icon: ShareFillIcon, text: 'Nothing has been shared with you yet' },
}

export interface HomeFeedProps {
  recent: HomeFile[]
  collections: HomeCollection[]
  me: string
  /** "See all" destination per tab. */
  moreHref: Record<HomeFeedTab, string>
  onTogglePin?: (file: HomeFile) => void
}

/** All / Pinned / Collections / Shared tabs over a fluid grid of file and collection tiles. */
export function HomeFeed({ recent, collections, me, moreHref, onTogglePin }: HomeFeedProps) {
  const feed = useHomeFeed({ recent, collections, me })
  const empty = EMPTY[feed.tab]
  const tab = TABS.find((t) => t.value === feed.tab)!

  return (
    <section className="relative flex w-full max-w-7xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={feed.tab} onValueChange={feed.setTab}>
          <TabsList className="h-auto flex-wrap border border-border/50">
            {TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value} className="h-7 gap-1.5 px-3">
                <span className="font-stashly text-xs font-medium">{t.label}</span>
                <span className="font-stashly text-2xs text-muted-foreground tabular-nums">{feed.counts[t.value]}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-3">
          <span className="hidden font-stashly text-xs text-muted-foreground sm:inline">Drop files anywhere to upload</span>
          <Link
            to={moreHref[feed.tab]}
            className="inline-flex items-center gap-1 text-muted-foreground no-underline hover:text-foreground"
          >
            <span className="font-stashly text-xs">{tab.more}</span>
            <ChevronRightIcon className="size-3.5" />
          </Link>
        </div>
      </div>

      {feed.entries.length > 0 ? (
        <div className="grid grid-cards-md gap-3">
          {feed.entries.map((e) =>
            e.kind === 'file' ? (
              <HomeFileCard key={e.file.id} file={e.file} onTogglePin={onTogglePin} />
            ) : (
              <HomeCollectionCard key={e.collection.id} collection={e.collection} />
            )
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border px-6 py-14 text-center text-muted-foreground">
          <empty.icon className="size-6 opacity-60" />
          <span className="font-stashly text-sm">{empty.text}</span>
        </div>
      )}
    </section>
  )
}
