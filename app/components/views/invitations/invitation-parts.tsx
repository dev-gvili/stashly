import { InvitationStatusPill } from '@/components/core-components/invitation-status'
import {
  CheckIcon,
  ChevronRightIcon,
  LockIcon,
  MessageFillIcon,
  OpenWithIcon,
  PreviewIcon,
  SuccessIcon,
} from '@/components/icons'
import type { InvitationStatus } from '@/prisma/enums'
import type {
  StashItem,
  StashPickerItem,
  StashWorkspaceMember,
} from '@/types/stash.types'
import { ItemCard } from '@/components/stash/item-card'
import { Avatar, AvatarFallback, AvatarImage } from '@/ui/avatar'
import { toIcon, toUserInitial } from '@/utils/converters'
import { cn } from '@/utils/styles'
import {
  getContextIcon,
  getContextLabel,
  type AccessPermission,
  type ContextKind,
} from '@/utils/invitations'
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardTitle,
  Item,
} from '@/components/ui'
import { GridLayout } from '../grid-view'

// ---------------------------------------------------------------------------
// Striped placeholder background for preview thumbnails. Tailwind conversion
// of the kit's `.stashly-stripes` rule — uses theme tokens so it works in
// light + dark automatically.
// ---------------------------------------------------------------------------

export const stripesClass =
  'bg-muted bg-[repeating-linear-gradient(-45deg,color-mix(in_oklab,var(--color-muted-foreground)_9%,transparent)_0_1px,transparent_1px_9px)]'

// ---------------------------------------------------------------------------
// Sender block — avatar (with verified check) + name + role + status
// ---------------------------------------------------------------------------

export function SenderBlock({
  name,
  subtitle,
  image,
  status,
  size = 'md',
}: {
  name: string
  subtitle?: string | null
  image?: string | null
  status?: InvitationStatus
  size?: 'md' | 'lg'
}) {
  const avatarSize = size === 'lg' ? 'size-14' : 'size-12'
  return (
    <div className="flex items-start gap-3">
      <div className="relative shrink-0">
        <Avatar className={avatarSize}>
          <AvatarImage src={image ?? undefined} />
          <AvatarFallback className="font-stashly">
            {toUserInitial(name)}
          </AvatarFallback>
        </Avatar>
        <SuccessIcon className="absolute -bottom-0.5 -right-0.5 size-4 text-primary" />
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="text-xs text-muted-foreground">Invitation from</p>
        <h2 className="truncate font-stashly text-base font-semibold leading-tight">
          {name}
        </h2>
        {subtitle && (
          <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {status && <InvitationStatusPill status={status} />}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Context thumbnail — big striped hero with the type icon + a kind pill
// ---------------------------------------------------------------------------

export function ContextThumbnail({
  kind,
  previewUrl,
  className,
  children,
}: {
  kind: ContextKind
  /** Real generated thumbnail; shown instead of the type icon when present. */
  previewUrl?: string | null
  className?: string
  children?: React.ReactNode
}) {
  const Icon = toIcon(kind)
  return (
    <div className="overflow-hidden relative flex flex-col h-full w-full items-center justify-center gap-2 p-4">
      {previewUrl ? (
        <div className="overflow-hidden relative flex flex-col h-full w-full items-center justify-center gap-2 bg-sidebar p-4 rounded-md surface-elevate">
          <img
            src={previewUrl}
            alt=""
            className="max-h-full max-w-full w-sm h-auto select-none rounded-xl border border-input object-fill  transition-transform duration-150"
          />
        </div>
      ) : (
        <div
          className={cn(
            'container  place-items-center rounded-xl border border-input bg-card text-primary shadow-2xl shadow-stashly transition-transform duration-150',
            stripesClass,
            className
          )}
        >
          <Icon className="size-12" />
        </div>
      )}
      {children}
    </div>
  )
}

/** Footer row for a single-item thumbnail: name + meta + open link. */
export function ContextThumbnailFooter({
  name,
  meta,
  onOpen,
}: {
  name: string
  meta?: string | null
  onOpen?: () => void
}) {
  return (
    <div className="flex items-center gap-3 p-4 bg-sidebar w-full rounded-md border border-input">
      <div className="min-w-0 flex-1 flex flex-col items-start justify-center">
        <p className="truncate text-sm font-medium">{name}</p>
        {meta && <p className="text-xs text-muted-foreground">{meta}</p>}
      </div>
      <Button variant="outline" size="icon">
        <PreviewIcon className="size-5" />
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// File preview cell (grid cell) — renders the slim preview shape through the
// standard ItemCard by filling the picker → StashItem adapter defaults.
// ---------------------------------------------------------------------------

function PreviewItemCard({ item }: { item: StashPickerItem }) {
  const stashItem: StashItem = {
    ...item,
    status: 'normal',
    inclusiveSize: item.size,
    updatedAt: null,
    parentId: null,
    parent: null,
    ownerId: '',
    workspaceId: null,
    driveId: '',
    tags: [],
    thumbnails: item.thumbnailUrl
      ? [
          {
            id: item.id,
            url: item.thumbnailUrl,
            width: null,
            height: null,
            size: 'medium' as const,
            view: 'grid' as const,
            // The picker only ever carries a finished thumbnail URL, so this
            // stands in as a stage-2 row — what `ItemCard.Cover` looks for.
            stage: 2,
          },
        ]
      : [],
    favorites: [],
    locked: null,
    file: null,
    folder: null,
  }

  return (
    <ItemCard {...stashItem} className="rounded-md border! border-input">
      <ItemCard.Content>
        <ItemCard.Thumbnail />
        <ItemCard.Name />
      </ItemCard.Content>
      <ItemCard.Footer>
        <ItemCard.Size />
      </ItemCard.Footer>
    </ItemCard>
  )
}

export function FilePreviewGrid({
  files,
  title,
  onPreviewAll,
}: {
  files: StashPickerItem[]
  title: string
  onPreviewAll?: () => void
}) {
  if (!files.length) return null
  return (
    <div className="w-full flex flex-col gap-2">
      <p className="text-sm font-medium">{title}</p>
      {onPreviewAll && (
        <button
          type="button"
          onClick={onPreviewAll}
          className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          Preview all
          <ChevronRightIcon className="size-3.5" />
        </button>
      )}
      <GridLayout>
        {files.slice(0, 6).map((file) => (
          <PreviewItemCard key={file.id} item={file} />
        ))}
      </GridLayout>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Personal message / note block
// ---------------------------------------------------------------------------

export function NoteBlock({
  message,
  fromName,
}: {
  message?: string | null
  fromName?: string | null
}) {
  const label = fromName ? `Message from ${fromName.split(' ')[0]}` : 'Message'
  return (
    <div className="relative rounded-md border border-input bg-sidebar text-primary p-4 m-4">
      <span className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <MessageFillIcon className="size-5" />
        {label ?? 'From sender'}
      </span>
      <p className="pt-1 text-base leading-relaxed font-medium">
        {message && message.trim()
          ? `${message}`
          : `Hi — I shared a file with you. Please take a look and let me know if you have any questions.`}
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Meta grid (label / value cells, optional icon)
// ---------------------------------------------------------------------------

export function MetaCell({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: React.ReactNode
  icon?: ReturnType<typeof toIcon>
}) {
  return (
    <Card className="border-none flex flex-row items-start gap-1 bg-transparent  rounded-md">
      <Item className="flex aspect-square items-center justify-center p-2 rounded-md bg-accent text-accent-foreground shrink-0">
        {Icon && <Icon className="size-5" />}
      </Item>
      <CardFooter className="w-full h-full flex-1 flex flex-col items-start justify-center ">
        <CardDescription>{label}</CardDescription>
        <CardTitle>{value}</CardTitle>
      </CardFooter>
    </Card>
  )
}

export function MetaGrid({
  columns = 2,
  children,
}: {
  columns?: 2 | 3
  children: React.ReactNode
}) {
  return (
    <div className={`flex gap-2 w-full items-center justify-between`}>
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Access permissions list
// ---------------------------------------------------------------------------

export function AccessPermissions({
  permissions,
}: {
  permissions: AccessPermission[]
}) {
  return (
    <div className="divide-y divide-input">
      {permissions.map(({ icon: Icon, label, allowed }) => (
        <div key={label} className="flex items-center gap-3 py-2">
          <div
            className={cn(
              'grid size-7 shrink-0 place-items-center rounded-lg',
              allowed
                ? 'bg-green-500/15 text-green-600 dark:text-green-400'
                : 'bg-muted text-muted-foreground'
            )}
          >
            <Icon className="size-3.5" />
          </div>
          <span
            className={cn(
              'flex-1 text-sm',
              allowed ? 'font-medium' : 'text-muted-foreground'
            )}
          >
            {label}
          </span>
          {allowed ? (
            <CheckIcon className="size-4 text-green-600 dark:text-green-400" />
          ) : (
            <LockIcon className="size-3.5 text-muted-foreground" />
          )}
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Member row (People section)
// ---------------------------------------------------------------------------

export function MemberRow({ member }: { member: StashWorkspaceMember }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <Avatar className="size-8 shrink-0">
        <AvatarImage src={member.member.image ?? undefined} />
        <AvatarFallback className="font-stashly text-xs">
          {toUserInitial(member.member.name)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{member.member.name}</p>
        {member.role && (
          <p className="truncate text-xs capitalize text-muted-foreground">
            {member.role}
          </p>
        )}
      </div>
      {member.role === 'owner' && (
        <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
          Owner
        </span>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Section heading (uppercase label used across the rail)
// ---------------------------------------------------------------------------

export function SectionLabel({
  children,
  action,
}: {
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className="mb-3 flex items-center justify-between font-stashly">
      <p className="font-stashly text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {children}
      </p>
      {action}
    </div>
  )
}
