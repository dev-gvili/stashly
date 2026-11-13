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
    'bg-warning/15 text-warning-foreground',
  accepted:
    'bg-info/15 text-info-foreground',
  rejected: 'bg-rejected/15 text-rejected-foreground',
  canceled: 'bg-chart-4 text-chart-800 dark:bg-chart-900/30 dark:text-chart-400',
  expired: 'bg-stone-100 text-stone-800 dark:bg-stone-900/30 dark:text-stone-400',
}

const dotColors: Record<InvitationStatus, string> = {
  pending: 'bg-warning',
  accepted: 'bg-info',
  rejected: 'bg-rejected',
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
        'capitalize',
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
