import { href, useNavigate } from 'react-router'
import { DropOverlay } from '@/components/views/home-components/drop-overlay'
import { HomeFeed, type HomeFeedProps } from '@/components/views/home-components/home-feed'
import {
  HomeSearchHero,
  type HomeSearchHeroProps,
} from '@/components/views/home-components/home-search-hero'
import {
  NeedsYouPill,
  SearchablePill,
} from '@/components/views/home-components/home-status-pills'
import { useUpload } from '@/hooks/useUpload'
import { QUERY_KEY } from '@/utils/filter-data'
import type { NeedsYouEntry, SearchableStatus } from '@/types/home.types'

export interface HomeViewProps
  extends Pick<HomeSearchHeroProps, 'firstName' | 'suggestions'>,
    HomeFeedProps {
  searchable: SearchableStatus
  needsYou: NeedsYouEntry[]
  onActOnNeed: (entry: NeedsYouEntry) => void
  onDismissNeed: (entry: NeedsYouEntry) => void
}

/**
 * Search-first home: the AI search hero over a mixed feed of recent files and
 * collections. The whole page is a drop target, handled by the upload machine
 * (so folders and quota behave as they do everywhere else).
 */
export function HomeView({
  firstName,
  suggestions,
  searchable,
  needsYou,
  onActOnNeed,
  onDismissNeed,
  ...feed
}: HomeViewProps) {
  const { isDragging, dragHandlers } = useUpload()
  const navigate = useNavigate()

  const openSearch = (query?: string) =>
    navigate(
      query
        ? `${href('/:me/stash/search', { me: feed.me })}?${QUERY_KEY}=${encodeURIComponent(query)}`
        : href('/:me/stash/search', { me: feed.me })
    )

  return (
    <div
      {...dragHandlers}
      data-slot="home-view"
      className="relative flex min-h-[calc(100dvh-3.5rem)] flex-col items-center px-6 pt-8 pb-30 md:px-10"
    >
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-95 bg-dots mask-fade-b" />
      <div className="relative z-10 flex w-full max-w-7xl justify-end gap-2">
        <SearchablePill status={searchable} />
        <NeedsYouPill entries={needsYou} onAct={onActOnNeed} onDismiss={onDismissNeed} />
      </div>
      <div className="mt-10 flex w-full justify-center">
        <HomeSearchHero firstName={firstName} suggestions={suggestions} onOpenSearch={openSearch} />
      </div>
      <div className="mt-14 flex w-full justify-center">
        <HomeFeed {...feed} />
      </div>
      {isDragging && <DropOverlay />}
    </div>
  )
}
