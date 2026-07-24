import type { NotificationType, NotificationKind } from '@/prisma/enums'
import {
  InfoIcon,
  ShareFillIcon,
  UploadFillIcon,
  FileFillIcon,
  StorageFillIcon,
  SendInvitationIcon,
  WorkspaceMembersFillIcon,
  WorkspaceFillIcon,
  CollectionFillIcon,
  FavoritesFillIcon,
  PinItemFillIcon,
  DetailsFillIcon,
  LockFillIcon,
} from '@/components/icons'

// ---------------------------------------------------------------------------
// Notification model — mirrors the Prisma `Notification` record
// ---------------------------------------------------------------------------

export type Notification = {
  id: string
  message: string
  type: NotificationType
  kind: NotificationKind
  status: 'read' | 'unread'
  createdAt: string | Date
  updatedAt: string | Date
}

// ---------------------------------------------------------------------------
// Two orthogonal axes:
//   • `type`  → severity, which owns the tile *colour*. The Ink palette is
//     greyscale ("the signal is contrast, not hue"), so `error` is the single
//     chromatic exception — --destructive is spent here, once.
//   • `kind`  → the subject/event, which owns the *glyph*. A share, an upload,
//     and a quota warning each read at a glance from real app icons.
// ---------------------------------------------------------------------------

const KIND_ICON: Record<NotificationKind, typeof InfoIcon> = {
  system: InfoIcon,
  share: ShareFillIcon,
  upload: UploadFillIcon,
  file: FileFillIcon,
  storage: StorageFillIcon,
  invitation: SendInvitationIcon,
  member: WorkspaceMembersFillIcon,
  workspace: WorkspaceFillIcon,
  collection: CollectionFillIcon,
  favorite: FavoritesFillIcon,
  pin: PinItemFillIcon,
  comment: DetailsFillIcon,
  lock: LockFillIcon,
}

const TYPE_LABEL: Record<NotificationType, string> = {
  info: 'Info',
  success: 'Done',
  warning: 'Attention',
  error: 'Failed',
}

/** Tailwind classes for the glyph tile. Greyscale except `error`. */
const TYPE_TILE: Record<NotificationType, string> = {
  info: 'bg-muted text-muted-foreground',
  success: 'bg-primary text-primary-foreground',
  warning: 'bg-secondary text-secondary-foreground ring-1 ring-input',
  error: 'bg-destructive/10 text-destructive ring-1 ring-destructive/30',
}

export function getKindIcon(kind: NotificationKind) {
  return KIND_ICON[kind] ?? KIND_ICON.system
}

export function typeLabel(type: NotificationType) {
  return TYPE_LABEL[type] ?? TYPE_LABEL.info
}

export function typeTileClass(type: NotificationType) {
  return TYPE_TILE[type] ?? TYPE_TILE.info
}

export function isAlert(type: NotificationType) {
  return type === 'warning' || type === 'error'
}

// ---------------------------------------------------------------------------
// Filtering
// ---------------------------------------------------------------------------

export type NotificationFilter = 'all' | 'unread' | 'alerts'

export const NOTIFICATION_FILTERS: {
  key: NotificationFilter
  label: string
}[] = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'alerts', label: 'Alerts' },
]

export function applyFilter(
  notifications: Notification[],
  filter: NotificationFilter
) {
  if (filter === 'unread')
    return notifications.filter((n) => n.status === 'unread')
  if (filter === 'alerts') return notifications.filter((n) => isAlert(n.type))
  return notifications
}

export function countUnread(notifications: Notification[]) {
  return notifications.filter((n) => n.status === 'unread').length
}

// ---------------------------------------------------------------------------
// Grouping by day — buckets are derived, not stored, so an empty bucket
// simply never renders.
// ---------------------------------------------------------------------------

export type NotificationGroup = {
  label: string
  items: Notification[]
}

function startOfDay(d: Date) {
  const copy = new Date(d)
  copy.setHours(0, 0, 0, 0)
  return copy
}

function dayBucket(date: Date): string {
  const today = startOfDay(new Date())
  const then = startOfDay(date)
  const days = Math.round((today.getTime() - then.getTime()) / 86_400_000)

  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return 'This week'
  return 'Earlier'
}

const BUCKET_ORDER = ['Today', 'Yesterday', 'This week', 'Earlier']

export function groupByDay(notifications: Notification[]): NotificationGroup[] {
  const buckets = new Map<string, Notification[]>()

  for (const n of notifications) {
    const key = dayBucket(new Date(n.createdAt))
    const list = buckets.get(key)
    if (list) list.push(n)
    else buckets.set(key, [n])
  }

  return BUCKET_ORDER.filter((label) => buckets.has(label)).map((label) => ({
    label,
    items: buckets.get(label)!,
  }))
}

// ---------------------------------------------------------------------------
// Relative time — short, mono-friendly, no library
// ---------------------------------------------------------------------------

export function formatRelativeTime(value: string | Date): string {
  const then = new Date(value).getTime()
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000))

  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`

  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}
