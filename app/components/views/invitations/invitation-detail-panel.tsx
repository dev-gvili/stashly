import { SendInvitationIcon } from '@/components/icons'
import type { StashInvitationRecipient } from '@/types/stash.types'
import type { InvitationExtras } from './invitation-model'
import { ReceivedInvitationDetail } from './received-invitation-detail'
import { SentInvitationDetail } from './sent-invitation-detail'

// ---------------------------------------------------------------------------
// Empty / no-selection state for the detail pane
// ---------------------------------------------------------------------------

export function InvitationDetailEmpty({
  label = 'Select an invitation to see the details',
}: {
  label?: string
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-10 text-center text-muted-foreground">
      <SendInvitationIcon className="size-12 opacity-30" />
      <p className="font-stashly text-sm">{label}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Detail panel — the right pane of the two-pane invitations layout.
// Renders the correct detail for the active tab + selection.
// ---------------------------------------------------------------------------

export type InvitationDetailPanelProps =
  | {
      tab: 'received'
      invitation?: InvitationExtras | null
      /** the recipient entry matching the current user */
      recipient?: StashInvitationRecipient | null
    }
  | {
      tab: 'sent'
      invitation?: InvitationExtras | null
    }

export function InvitationDetailPanel(props: InvitationDetailPanelProps) {
  if (!props.invitation) {
    return (
      <InvitationDetailEmpty
        label={
          props.tab === 'sent'
            ? 'Select a sent invitation to track responses'
            : 'Select an invitation to review and respond'
        }
      />
    )
  }

  if (props.tab === 'received') {
    if (!props.recipient) return <InvitationDetailEmpty />
    return (
      <div className="flex h-full w-full gap-2 overflow-hidden items-stretch">
        <ReceivedInvitationDetail
          invitation={props.invitation}
          recipient={props.recipient}
        />
      </div>
    )
  }

  return (
    <div className="flex h-full w-full gap-2 overflow-hidden">
      <SentInvitationDetail invitation={props.invitation} />
    </div>
  )
}
