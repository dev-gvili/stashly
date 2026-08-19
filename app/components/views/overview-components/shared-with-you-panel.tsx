import type { SharedWithYouEntry } from '@/types/stash.types'
import { toRelativeTime } from '@/utils/formaters'
import { cn } from '@/utils/styles'
import type { ReactNode } from 'react'
import { OverviewDetailCard } from './detail-card'
import { PanelCard } from './panel-card'
import { PersonAvatar } from './person-avatar'

/**
 * One inbound share. Uses the page's `OverviewDetailCard` so it is literally
 * the same card as Favorites and Recently opened; the sharer rides the
 * thumbnail as an avatar chip and the footer's right slot carries when it
 * arrived rather than the file's own modified date.
 */
function SharedInboxCard({ entry }: { entry: SharedWithYouEntry }) {
  const { item, by, sharedAt } = entry
  return (
    <OverviewDetailCard
      item={item}
      overlay={
        <span className="absolute bottom-2 left-2 z-10 flex items-center gap-1.5 rounded-full bg-black/55 py-1 pr-2 pl-1 backdrop-blur-sm">
          <PersonAvatar person={by} className="size-4" />
          {/* Fixed black scrim — literal white, not a theme token. */}
          <span className="font-stashly text-xs whitespace-nowrap text-white">
            {by.name}
          </span>
        </span>
      }
      footerRight={
        <span className="text-muted-foreground shrink-0 text-xs whitespace-nowrap">
          {toRelativeTime(sharedAt)}
        </span>
      }
    />
  )
}

/** Everything other people sent you, newest first. */
export function SharedWithYouPanel({
  entries,
  viewAllTo,
  icon,
  className,
}: {
  entries: SharedWithYouEntry[]
  viewAllTo: string
  icon?: ReactNode
  className?: string
}) {
  if (!entries.length) return null
  return (
    <PanelCard
      title="Shared with you"
      icon={icon}
      viewAll={{ to: viewAllTo, label: 'View all' }}
      bodyClassName="grid grid-cols-2 gap-2"
      className={cn(className)}
    >
      {entries.slice(0, 4).map((entry) => (
        <SharedInboxCard key={entry.item.id} entry={entry} />
      ))}
    </PanelCard>
  )
}
