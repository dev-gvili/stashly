import { cn } from '@/utils/styles'
import type { InvitationStatus } from '@/prisma/enums'

// ---------------------------------------------------------------------------
// Shared status visuals for invitations — pill badge and small colored dot.
// Used by the invitations view, invite dialog, and share dialog.
// ---------------------------------------------------------------------------

const pillColors: Record<InvitationStatus, string> = {
  pending:
    'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  accepted:
    'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  canceled: 'bg-muted text-muted-foreground',
  expired: 'bg-muted text-muted-foreground',
}

const dotColors: Record<InvitationStatus, string> = {
  pending: 'bg-yellow-500',
  accepted: 'bg-green-500',
  rejected: 'bg-red-500',
  canceled: 'bg-muted-foreground',
  expired: 'bg-muted-foreground',
}

export function invitationStatusLabel(status: InvitationStatus) {
  return status === 'rejected' ? 'declined' : status
}

export function InvitationStatusPill({
  status,
  className,
}: {
  status: InvitationStatus
  className?: string
}) {
  return (
    <span
      className={cn(
        'shrink-0 rounded-full px-2 py-0.5 text-xs font-medium capitalize',
        pillColors[status] ?? pillColors.pending,
        className
      )}
    >
      {invitationStatusLabel(status)}
    </span>
  )
}

export function InvitationStatusDot({
  status,
  className,
}: {
  status: InvitationStatus
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-block size-2 shrink-0 rounded-full',
        dotColors[status] ?? dotColors.pending,
        className
      )}
    />
  )
}
