import type { NotificationKind } from '@/prisma/enums'
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
// `kind` → the subject/event, which owns the *glyph*. A share, an upload, and a
// quota warning each read at a glance from real app icons.
//
// This map stays in the component tree — it pulls 13 React components, so it
// must not be reachable from `@/utils` or `@/types`. The pure model (types,
// labels, filtering, grouping) lives in `@/types/notification.types` and
// `@/utils/notifications`.
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

export function getKindIcon(kind: NotificationKind) {
  return KIND_ICON[kind] ?? KIND_ICON.system
}
