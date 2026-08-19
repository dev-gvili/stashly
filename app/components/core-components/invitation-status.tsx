import { cn } from '@/utils/styles'
import { invitationStatusLabel } from '@/utils/formaters'
import type { InvitationStatus } from '@/prisma/enums'
import { Badge } from '../ui';

// ---------------------------------------------------------------------------
// Shared status visuals for invitations — pill badge and small colored dot.
// Used by the invitations view, invite dialog, and share dialog.
// ---------------------------------------------------------------------------

const pillColors: Record<InvitationStatus, string> = {
  pending:
    'bg-amber-400 text-amber-900 dark:bg-amber-900/30 dark:text-amber-400',
  accepted:
    'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400',
  rejected: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400',
  canceled: 'bg-chart-4 text-chart-800 dark:bg-chart-900/30 dark:text-chart-400',
  expired: 'bg-stone-100 text-stone-800 dark:bg-stone-900/30 dark:text-stone-400',
}

const dotColors: Record<InvitationStatus, string> = {
  pending: 'bg-amber-400',
  accepted: 'bg-sky-400',
  rejected: 'bg-rose-400',
  canceled: 'bg-gray-400',
  expired: 'bg-stone-400',
}

export function InvitationStatusPill({
  status,
  className,
}: {
  status: InvitationStatus
  className?: string
}) {
  return (
    <Badge
      variant="default"
      className={cn(
        'rounded font-stashly capitalize',
        pillColors[status] ?? pillColors.pending,
        className
      )}
    >
      {invitationStatusLabel(status)}
    </Badge>
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
        'inline-block size-3 shrink-0 rounded',
        dotColors[status] ?? dotColors.pending,
        className
      )}
    />
  )
}
