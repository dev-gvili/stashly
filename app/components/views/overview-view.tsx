import type { JSX } from 'react'
import { href, Link } from 'react-router'
import type { StashItem } from '@/types/stash.types'
import type {
  OverviewActivity,
  OverviewActivityKind,
} from '@/services/activity-actions'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/ui/card'
import { ItemCard } from '@/components/stash/item-card'
import { toIcon, toItemUrl } from '@/utils/converters'
import { formatSize } from '@/utils/formaters'
import { cn } from '@/utils/styles'
import { FilesEmptyState } from '@/components/states/files-empty-state'
import {
  FavoriteIcon,
  FolderIcon,
  PinIcon,
  RecentIcon,
} from '@/components/icons'

export interface OverviewViewProps {
  user: { id: string; name: string }
  pinned: StashItem[]
  favorites: StashItem[]
  suggestedFolders: StashItem[]
  suggestedFiles: StashItem[]
  activity: OverviewActivity[]
  className?: string
}

const ACTIVITY_VERB: Record<OverviewActivityKind, string> = {
  viewed: 'viewed',
  created: 'uploaded',
  edited: 'edited',
  renamed: 'renamed',
  moved: 'moved',
  copied: 'copied',
  shared: 'shared',
  restored: 'restored',
  deleted: 'deleted',
  commented: 'commented on',
  updated: 'updated',
  pinned: 'pinned',
  unpinned: 'unpinned',
  reordered: 'reordered',
}

function greetingPart(hour: number) {
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

function formatRelative(value: Date | string | null | undefined) {
  if (!value) return null
  const date = typeof value === 'string' ? new Date(value) : value
  const diff = Date.now() - date.getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  return date.toLocaleDateString('en', { month: 'short', day: 'numeric' })
}

function Greeting({ name }: { name: string }) {
  const first = name.split(/\s+/)[0]
  const part = greetingPart(new Date().getHours())
  return (
    <header className="flex items-end justify-between pb-4 border-b border-dashed border-input">
      <div>
        <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1 font-stashly">
          {part}
        </div>
        <h1 className="font-stashly text-2xl leading-none">
          {first}&rsquo;s Stash
        </h1>
      </div>
    </header>
  )
}

function SectionLabel({
  title,
  subtitle,
}: {
  title: string
  subtitle?: string
}) {
  return (
    <div className="flex items-baseline gap-3 mb-3">
      <h3 className="text-sm uppercase font-stashly">{title}</h3>
      {subtitle && (
        <span className="text-sm text-muted-foreground">— {subtitle}</span>
      )}
    </div>
  )
}

function PanelCard({
  title,
  count,
  icon,
  viewAll,
  children,
}: {
  title: string
  count: number
  icon: JSX.Element
  viewAll: { to: string; label: string }
  children: JSX.Element
}) {
  return (
    <Card className="border border-input rounded-md surface-glass bg-card p-0 overflow-hidden gap-0 py-0 shadow-none">
      <CardHeader className="flex! items-baseline px-4 py-4">
        <CardTitle className="text-sm uppercase font-stashly flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
        <CardDescription className="text-sm text-muted-foreground ml-2">
          {count}
        </CardDescription>
        <Link
          to={viewAll.to}
          className="ml-auto text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
        >
          {viewAll.label} →
        </Link>
      </CardHeader>
      <CardContent className="p-4 pt-0">{children}</CardContent>
    </Card>
  )
}

function ItemListRow({ item }: { item: StashItem }) {
  const Icon = item.type === 'folder' ? FolderIcon : toIcon(item.category)
  const url = toItemUrl({
    type: item.type,
    id: item.id,
    parentId: item.parentId ?? '',
    ownerId: item.ownerId,
  })
  const meta =
    item.type === 'folder'
      ? `${item.folder?.inclusiveChildCount ?? 0} items`
      : formatSize('byte', 'unit', item.size)

  return (
    <Link
      to={url}
      className="group flex items-center gap-3 p-2 rounded-md border border-dashed border-input hover:border-ring hover:bg-muted/30 transition-colors min-w-0"
    >
      <Icon className="size-5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-stashly truncate">{item.name}</div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground truncate">
          {meta}
        </div>
      </div>
    </Link>
  )
}

function OverviewCard({ item }: { item: StashItem }) {
  return (
    <ItemCard {...item}>
      <ItemCard.Header>
        <ItemCard.Checkbox name="selectedItems" value={item.id} />
        <ItemCard.Actions className="place-self-end" />
      </ItemCard.Header>
      <ItemCard.Content>
        <ItemCard.Thumbnail />
        <ItemCard.Name />
      </ItemCard.Content>
      <ItemCard.Footer>
        <ItemCard.Size />
        <ItemCard.Count />
      </ItemCard.Footer>
    </ItemCard>
  )
}

function ActivityRow({ activity }: { activity: OverviewActivity }) {
  if (!activity.item) return null
  const Icon =
    activity.item.type === 'folder'
      ? FolderIcon
      : toIcon(activity.item.category)
  const url = toItemUrl({
    type: activity.item.type,
    id: activity.item.id,
    parentId: activity.item.parentId ?? '',
    ownerId: activity.item.ownerId,
  })
  return (
    <li>
      <Link
        to={url}
        className="grid grid-cols-[auto_1fr_auto] items-center gap-3 py-1.5 px-2 -mx-2 rounded-md hover:bg-muted/30 transition-colors text-sm"
      >
        <Icon className="size-5 text-muted-foreground" />
        <span className="truncate font-stashly">
          <span className="text-muted-foreground">
            You {ACTIVITY_VERB[activity.kind]}{' '}
          </span>
          <span>{activity.item.name}</span>
        </span>
        <span className="text-xs uppercase tracking-wider text-muted-foreground tabular-nums shrink-0">
          {formatRelative(activity.observedAt)}
        </span>
      </Link>
    </li>
  )
}

export function OverviewView({
  user,
  pinned,
  favorites,
  suggestedFolders,
  suggestedFiles,
  activity,
  className,
}: OverviewViewProps) {
  const hasAny =
    pinned.length > 0 ||
    favorites.length > 0 ||
    suggestedFolders.length > 0 ||
    suggestedFiles.length > 0 ||
    activity.length > 0

  if (!hasAny) return <FilesEmptyState />

  console.log('OverviewView',{user, pinned, favorites, suggestedFolders, suggestedFiles, activity  })
  return (
    <div className={cn('flex flex-col gap-6 w-full', className)}>
      <Greeting name={user.name} />
      {(pinned.length > 0 || favorites.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {pinned.length > 0 && (
            <PanelCard
              title="Pinned"
              count={pinned.length}
              icon={<PinIcon className="size-5 text-accent-foreground" />}
              viewAll={{
                to: href('/:me/stash/pinned', { me: user.id }),
                label: 'View all',
              }}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {pinned.slice(0, 6).map((item) => (
                  <ItemListRow key={item.id} item={item} />
                ))}
              </div>
            </PanelCard>
          )}
          {favorites.length > 0 && (
            <PanelCard
              title="Favorites"
              count={favorites.length}
              icon={<FavoriteIcon className="size-5 text-accent-foreground" />}
              viewAll={{
                to: href('/:me/stash/favorites', { me: user.id }),
                label: 'View all',
              }}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {favorites.slice(0, 6).map((item) => (
                  <ItemListRow key={item.id} item={item} />
                ))}
              </div>
            </PanelCard>
          )}
        </div>
      )}
      {suggestedFolders.length > 0 && (
        <section>
          <SectionLabel title="Jump back in" subtitle="based on last touch" />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 auto-rows-min">
            {suggestedFolders.slice(0, 6).map((folder) => (
              <OverviewCard key={folder.id} item={folder} />
            ))}
          </div>
        </section>
      )}
      {suggestedFiles.length > 0 && (
        <section>
          <SectionLabel title="Recent files" subtitle="recently opened" />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 auto-rows-min">
            {suggestedFiles.slice(0, 10).map((file) => (
              <OverviewCard key={file.id} item={file} />
            ))}
          </div>
        </section>
      )}
      {activity.length > 0 && (
        <Card className="border border-input rounded-md surface-glass bg-card p-0 overflow-hidden gap-0 py-0 shadow-none">
          <CardHeader className="flex! items-baseline px-4 py-4">
            <CardTitle className="text-sm uppercase font-stashly flex items-center gap-2">
              <RecentIcon className="size-5 text-muted-foreground" />
              Activity
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground ml-2">
              your recent actions
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <ul className="space-y-0.5">
              {activity.map((a) => (
                <ActivityRow key={a.id} activity={a} />
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
