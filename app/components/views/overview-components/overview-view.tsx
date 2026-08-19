import {
  InboxReciveFillIcon,
  PinFillIcon,
  ShareFillIcon,
} from '@/components/icons'
import { FolderCardTab } from '@/components/views/folder-card-components/folder-card-tab'
import { toGreeting } from '@/utils/formaters'
import { cn } from '@/utils/styles'
import { href, Link, useLocation } from 'react-router'
import type { OverviewViewProps } from './types'
import { ActivityTimeline } from './activity-timeline'
import { OverviewDetailCard } from './detail-card'
import { OverviewFirstRun } from './first-run'
import { MemoriesRow } from './memories-row'
import { PanelCard } from './panel-card'
import { PeopleStrip } from './people-strip'
import { PinnedTile } from './pinned-tile'
import { SectionLabel } from './section-label'
import { SharedLinksPanel } from './shared-links-panel'
import { SharedWithYouPanel } from './shared-with-you-panel'
import { StorageStrip } from './storage-strip'
import { SuggestionReason } from './suggestion-reason'
import { TrashRescue } from './trash-rescue'

function Greeting({ name, subline }: { name: string; subline?: string }) {
  const first = name.split(/\s+/)[0]
  return (
    <header>
      <div className="text-muted-foreground font-stashly text-xs tracking-widest uppercase">
        {toGreeting()}
      </div>
      <h1 className="font-stashly mt-2 text-2xl leading-none">
        {first}&rsquo;s Stash
      </h1>
      {subline && (
        <p className="text-muted-foreground mt-2.5 text-sm">{subline}</p>
      )}
    </header>
  )
}

/**
 * The overview page. Reading order: who you are and what you have, what you
 * reach for, what you were doing, what came back to you, then who and what
 * changed. Every module sits on the same card surface as the item cards —
 * filled, borderless, rounded-3xl, children concentric at rounded-2xl.
 *
 * Sections self-hide when their data is empty; the page never renders an empty
 * panel or a padded-out list.
 */
export function OverviewView({
  user,
  pinned,
  favorites,
  suggestedFolders,
  suggestedFiles,
  activity,
  subline,
  storage,
  sharedWithYou = [],
  sharedLinks = [],
  people = [],
  memories,
  trash,
  suggestionReasons,
  className,
}: OverviewViewProps) {
  const location = useLocation()
  const hasAny =
    pinned.length > 0 ||
    favorites.length > 0 ||
    suggestedFolders.length > 0 ||
    suggestedFiles.length > 0 ||
    activity.length > 0

  if (!hasAny) return <OverviewFirstRun />

  const to = (path: string) => `${path}${location.search}`
  const me = { me: user.id }

  return (
    <div className={cn('flex w-full flex-col gap-7', className)}>
      <div className="border-input border-b border-dashed pb-6">
        <Greeting name={user.name} subline={subline} />
        {storage && (
          <StorageStrip
            storage={storage}
            manageTo={to(href('/:me/settings/billing', me))}
            className="mt-4"
          />
        )}
      </div>

      {pinned.length > 0 && (
        <section>
          <SectionLabel
            title="Quick access"
            subtitle="your pinned & favorite items"
          />
          <PanelCard
            title="Pinned"
            icon={<PinFillIcon className="size-5" />}
            viewAll={{
              to: to(href('/:me/stash/pinned', me)),
              label: 'View all',
            }}
            bodyClassName="grid grid-cols-2 gap-2 lg:grid-cols-4"
          >
            {pinned.slice(0, 4).map((item) => (
              <PinnedTile key={item.id} {...item} />
            ))}
          </PanelCard>
        </section>
      )}

      {/* Folders and favorites share one stretched row so both blocks end
          flush: the square folder cards set the height, the favorites `fill`
          it. Two columns only from lg — below that they stack. */}
      <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-[53fr_71fr]">
        {suggestedFolders.length > 0 && (
          <section className="flex flex-col">
            <SectionLabel
              title="Suggested folders"
              subtitle="based on your usage"
            />
            <div className="grid flex-1 grid-cols-2 gap-2 lg:grid-cols-3 lg:grid-rows-2">
              {suggestedFolders.slice(0, 6).map((folder) => (
                <FolderCardTab key={folder.id} {...folder} />
              ))}
            </div>
          </section>
        )}
        {favorites.length > 0 && (
          <section className="flex flex-col">
            <SectionLabel
              title="Favorites"
              subtitle="your most favorite items"
            />
            <div className="grid flex-1 grid-cols-3 gap-2 lg:grid-cols-4 lg:grid-rows-2">
              {favorites.slice(0, 8).map((item) => (
                <OverviewDetailCard key={item.id} item={item} fill />
              ))}
            </div>
          </section>
        )}
      </div>

      {suggestedFiles.length > 0 && (
        <section>
          <SectionLabel
            title="Recently opened"
            subtitle="your most recently opened items"
            action={
              <Link
                to={to(href('/:me/stash/recent', me))}
                className="text-muted-foreground hover:text-foreground text-xs tracking-wider uppercase transition-colors"
              >
                All files →
              </Link>
            }
          />
          {/* Seven columns, not four: the folder (3 of 53fr) and favorites
              (4 of 71fr) grids above both land on a ~1/7 module, so this row
              only matches their card size at seven. */}
          <div className="grid auto-rows-fr grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-7">
            {suggestedFiles.slice(0, 11).map((item, index) => {
              const reason = suggestionReasons?.[item.id]
              // The first cell is the last opened item — the span carries that
              // meaning, it is not decoration. It stands two rows tall, so the
              // five columns beside it stack two cards each and the block ends
              // flush at 1 + 10.
              const isLastOpened = index === 0
              return (
                <OverviewDetailCard
                  key={item.id}
                  item={item}
                  fill={isLastOpened}
                  className={
                    isLastOpened
                      ? 'md:col-span-2 md:row-span-2 lg:col-span-2 lg:row-span-2'
                      : undefined
                  }
                  overlay={
                    reason ? <SuggestionReason reason={reason} /> : undefined
                  }
                />
              )
            })}
          </div>
        </section>
      )}

      {memories && (
        <MemoriesRow
          memories={memories}
          openTo={to(href('/:me/stash/images', me))}
        />
      )}

      {(sharedWithYou.length > 0 || sharedLinks.length > 0) && (
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
          <SharedWithYouPanel
            entries={sharedWithYou}
            viewAllTo={to(href('/:me/stash/invitations', me))}
            icon={<InboxReciveFillIcon className="size-5" />}
          />
          <SharedLinksPanel
            links={sharedLinks}
            manageTo={to(href('/:me/stash/shares', me))}
            icon={<ShareFillIcon className="size-5" />}
          />
        </div>
      )}

      {people.length > 0 && (
        <PeopleStrip
          people={people}
          inviteTo={to(href('/:me/stash/invitations', me))}
        />
      )}

      {activity.length > 0 && (
        <section>
          <SectionLabel title="Activity" subtitle="your recent actions" />
          <ActivityTimeline activity={activity} />
        </section>
      )}

      {trash && (
        <TrashRescue
          count={trash.count}
          retentionDays={trash.retentionDays}
          trashTo={to(href('/:me/stash/trash', me))}
        />
      )}
    </div>
  )
}
