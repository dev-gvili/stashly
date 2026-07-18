import {
    DownloadFillIcon,
  DownloadIcon,
  EditFillIcon,
  EditIcon,
  FileFillIcon,
  FolderFillIcon,
  GroupFillIcon,
  GroupIcon,
  ImagesFillIcon,
  InfoFillIcon,
  InfoIcon,
  ViewFillIcon,
  ViewIcon,
  WorkspaceFillIcon,
  WorkspaceIcon,
} from '@/components/icons'
import type { InvitationStatus } from '@/prisma/enums'
import type {
  StashInvitation,
  StashInvitationRecipient,
} from '@/types/stash.types'
import { toIcon, type IconKey } from '@/utils';
import { formatSize } from '@/utils/formaters'

// ---------------------------------------------------------------------------
// Optional presentation fields the detail panel *can* surface when the loader
// provides them. Everything here is optional — the UI degrades gracefully when
// a field is absent, so no schema change is required to ship the panel.
//
// To light up the richer sections (personal message, file peek, mutual
// connection), extend the loader / `StashInvitation` with:
//   - message?: string
//   - mutualConnection?: string
//   - sender.title
//   - item.mimeType / item.fileCount
//   - workspace.size / workspace.fileCount / workspace.memberCount
//   - previews?: StashPickerItem[]
// ---------------------------------------------------------------------------

export type InvitationExtras = StashInvitation & {
  message?: string | null
  mutualConnection?: string | null
  sender: StashInvitation['sender'] & {
    title?: string | null
  }
  item:
    | (NonNullable<StashInvitation['item']> & {
        mimeType?: string | null
        fileCount?: number | null
      })
    | null
  workspace:
    | (NonNullable<StashInvitation['workspace']> & {
        size?: string | null
        fileCount?: number | null
        memberCount?: number | null
      })
    | null
}

// ---------------------------------------------------------------------------
// Context (what is being shared)
// ---------------------------------------------------------------------------

export type ContextKind = IconKey 



export function getContextKind(invitation: InvitationExtras): ContextKind {
  if (invitation.workspace) return 'workspace'
  const item = invitation.item
  const type = (item?.type ?? '').toLowerCase()
  const mime = (item?.mimeType ?? '').toLowerCase()
  if (type === 'folder') return 'folder'  
  return item?.category ?? (mime.startsWith('image/') ? 'image' : 'file')
}

export function getContextIcon(kind: ContextKind) {
  return toIcon(kind)
}

export function getContextLabel(kind: ContextKind): string {
  switch (kind) {
    case 'workspace':
      return 'Workspace'
    case 'folder':
      return 'Folder'
    case 'image':
      return 'Image'
    default:
      return 'File'
  }
}

export function getContextName(invitation: InvitationExtras): string {
  return invitation.item?.name ?? invitation.workspace?.name ?? 'Untitled'
}

export function getMemberCount(invitation: InvitationExtras): number | null {
  return (
    invitation.workspace?.memberCount ??
    invitation.workspace?.members?.length ??
    null
  )
}

/** Short meta line for the shared thing, e.g. "24 files · 512 MB". */
export function getContextMeta(invitation: InvitationExtras): string | null {
  const kind = getContextKind(invitation)
  const parts: string[] = []
  if (kind === 'workspace' || kind === 'folder') {
    const count =
      invitation.workspace?.fileCount ?? invitation.item?.fileCount ?? null
    if (count != null) parts.push(`${count} file${count === 1 ? '' : 's'}`)
  }
  const size =
    invitation.workspace?.size ??
    (invitation.item
      ? formatSize('byte', 'unit', invitation.item.size)
      : null)
  if (size) parts.push(size)
  return parts.length ? parts.join(' · ') : null
}

// ---------------------------------------------------------------------------
// Access / permissions derived from the recipient role
// ---------------------------------------------------------------------------

export type AccessPermission = {
  icon: ReturnType<typeof toIcon>
  label: string
  allowed: boolean
}

const EDIT_ROLES = new Set(['write', 'edit', 'editor', 'admin', 'owner'])
const MANAGE_ROLES = new Set(['admin', 'owner'])

export function canEdit(role: string | null | undefined): boolean {
  return EDIT_ROLES.has((role ?? '').toLowerCase())
}

export function roleLabel(role: string | null | undefined): string {
  const r = (role ?? '').toLowerCase()
  if (r === 'write' || r === 'edit' || r === 'editor') return 'Editor'
  if (r === 'admin') return 'Admin'
  if (r === 'owner') return 'Owner'
  if (r === 'read' || r === 'view' || r === 'viewer') return 'Viewer'
  return role ? role.charAt(0).toUpperCase() + role.slice(1) : 'Viewer'
}

export function getAccessPermissions(
  role: string | null | undefined
): AccessPermission[] {
  const edit = canEdit(role)
  const manage = MANAGE_ROLES.has((role ?? '').toLowerCase())
  return [
    { icon: ViewFillIcon, label: 'View & preview all files', allowed: true },
    { icon: DownloadFillIcon, label: 'Download & export', allowed: true },
    { icon: EditFillIcon, label: 'Upload, edit & organize', allowed: edit },
    { icon: InfoFillIcon, label: 'Comment & annotate', allowed: true },
    { icon: GroupFillIcon, label: 'Invite or remove members', allowed: manage },
  ]
}

// ---------------------------------------------------------------------------
// Recipient status roll-up (for the Sent side)
// ---------------------------------------------------------------------------

export function countByStatus(
  recipients: StashInvitationRecipient[]
): Record<InvitationStatus, number> {
  const counts: Record<InvitationStatus, number> = {
    pending: 0,
    accepted: 0,
    rejected: 0,
    canceled: 0,
    expired: 0,
  }
  for (const recipient of recipients) {
    if (recipient.status in counts) counts[recipient.status] += 1
  }
  return counts
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------


/** Relative "expires in" string, or null when there is no future expiry. */
export function formatExpiry(
  expiresAt: string | number | Date | null | undefined
): string | null {
  if (!expiresAt) return null
  const ms = new Date(expiresAt).getTime() - Date.now()
  if (Number.isNaN(ms)) return null
  if (ms <= 0) return 'Expired'
  const days = Math.ceil(ms / 86_400_000)
  if (days <= 1) return 'in 1 day'
  if (days < 30) return `in ${days} days`
  const months = Math.round(days / 30)
  return `in ${months} month${months === 1 ? '' : 's'}`
}
