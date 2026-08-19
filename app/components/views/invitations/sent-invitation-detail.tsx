import {
  InvitationStatusDot,
  InvitationStatusPill,
} from '@/components/core-components/invitation-status'
import { invitationStatusLabel } from '@/utils/formaters'
import {
  AddIcon,
  CalendarFillIcon,
  CalendarIcon,
  CheckIcon,
  DoubleCheckIcon,
  RemoveIcon,
  SendInvitationIcon,
  SubmitIcon,
  TrashFillIcon,
  UserFillIcon,
  UserIcon,
} from '@/components/icons'
import type { InvitationStatus } from '@/prisma/enums'
import type { StashInvitationRecipient } from '@/types/stash.types'
import { Button } from '@/ui/button'
import { ScrollArea } from '@/ui/scroll-area'
import { useFetcher } from 'react-router'
import type { InvitationExtras } from '@/types/stash.types'
import {
  countByStatus,
  getContextIcon,
  getContextKind,
  getContextLabel,
  getContextMeta,
  getContextName,
  roleLabel,
} from '@/utils/invitations'
import {
  ContextThumbnail,
  ContextThumbnailFooter,
  MetaCell,
  MetaGrid,
  NoteBlock,
  SectionLabel,
} from './invitation-parts'
import {
  Avatar,
  AvatarFallback,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
} from '@/components/ui'
import { AddRecipientsDialog } from './add-recipients-dialog'
import React from 'react'
import { formatMediaDate } from '@/utils'

// ---------------------------------------------------------------------------
// Response summary bar (accepted / pending / declined / canceled)
// ---------------------------------------------------------------------------

const SEGMENT_COLORS: Record<InvitationStatus, string> = {
  accepted: 'bg-sky-400',
  pending: 'bg-amber-400',
  rejected: 'bg-rose-400',
  canceled: 'bg-gray-400',
  expired: 'bg-stone-400 ',
}

function ResponseSummary({
  recipients,
}: {
  recipients: StashInvitationRecipient[]
}) {
  const total = recipients.length || 1
  const counts = countByStatus(recipients)
  const order: InvitationStatus[] = [
    'accepted',
    'pending',
    'rejected',
    'canceled',
    'expired',
  ]
  const present = order.filter((key) => counts[key] > 0)

  return (
    <div className="flex flex-col gap-3 rounded-md bg-sidebar p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Response summary</p>
        <p className="text-xs text-muted-foreground">
          {counts.accepted} of {recipients.length} accepted
        </p>
      </div>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-muted">
        {present.map((key) => (
          <div
            key={key}
            className={SEGMENT_COLORS[key]}
            style={{ width: `${(counts[key] / total) * 100}%` }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-1.5 pt-0.5">
        {present.map((key) => (
          <div key={key} className="flex items-center gap-2">
            <InvitationStatusDot status={key} />
            <span className="text-sm font-medium">{counts[key]}</span>
            <span className="text-xs text-muted-foreground">
              {invitationStatusLabel(key)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Recipient row — status + per-recipient cancel (pending only)
// ---------------------------------------------------------------------------

function RecipientRow({
  recipient,
  disabled,
}: {
  recipient: StashInvitationRecipient
  disabled: boolean
}) {
  const cancelFetcher = useFetcher()
  const cancelable = recipient.status === 'pending'

  return (
    <div className="flex items-center justify-evenly gap-2 rounded-md bg-sidebar-accent  text-sm p-4 h-full flex-1">
      <Avatar className="size-8 bg-primary/20 surface-glass text-muted-foreground rounded-md items-center justify-center">
        <UserFillIcon className="size-5 text-accent-foreground" />
      </Avatar>
      <span className="flex-1 overflow-hidden min-w-0 flex flex-col gap-0.5 w-40">
        <h2 className="truncate font-stashly text-sm leading-tight">
          {recipient.email}
        </h2>
        <p className="text-xs text-muted-foreground">
          {roleLabel(recipient.role)} access
        </p>
      </span>
      {cancelable && (
        <cancelFetcher.Form
          id={`cancel-${recipient.id}`}
          method="post"
          action="/api/invitations"
          className="items-end justify-end"
        >
          <input type="hidden" name="intent" value="cancel_recipient" />
          <input type="hidden" name="recipientId" value={recipient.id} />
          <Button
            variant="outline"
            size="icon-sm"
            type="submit"
            title="Cancel this invitation"
            disabled={disabled || cancelFetcher.state !== 'idle'}
            className="border border-input size-6 rounded "
          >
            <RemoveIcon className="size-4 text-current" />
          </Button>
        </cancelFetcher.Form>
      )}
      <InvitationStatusPill status={recipient.status} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sent invitation — full detail panel (2-column: preview + recipients rail)
// ---------------------------------------------------------------------------

export function SentInvitationDetail({
  invitation,
}: {
  invitation: InvitationExtras
}) {
  const cancelAllFetcher = useFetcher()
  const [open, setOpen] = React.useState(false)
  const isSubmitting = cancelAllFetcher.state !== 'idle'

  const kind = getContextKind(invitation)
  const ContextIcon = getContextIcon(kind)
  const name = getContextName(invitation)
  const meta = getContextMeta(invitation)
  const counts = countByStatus(invitation.recipients)
  const hasPending = counts.pending > 0

  return (
    <>
      <div className="flex w-full bg-card border border-input rounded-md h-[calc(100vh-4rem)]">
        {/* ── LEFT: preview + response summary + message ── */}

        <ScrollArea className="min-w-0 h-full w-full rounded-md">
          <div className="flex flex-col gap-6 p-6">
            {invitation.message && (
              <NoteBlock
                message={invitation.message}
                fromName={invitation.sender.name}
              />
            )}
            <ContextThumbnail
              kind={invitation.item?.category || kind}
              previewUrl={invitation.item?.thumbnailUrl}
            >
              <ContextThumbnailFooter name={name} meta={meta} />
            </ContextThumbnail>
          </div>
        </ScrollArea>
      </div>

      {/* ── RIGHT: recipients rail ── */}
      <Sidebar
        collapsible="none"
        width="32rem"
        side="right"
        className="h-[calc(100vh-4rem)] bg-card rounded-md border border-input overflow-hidden w-full max-w-max"
      >
        <SidebarHeader>
          {/* Header */}
          <div className="flex items-start gap-3">
            <div className="grid size-12 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
              <ContextIcon className="size-6" />
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-xs text-muted-foreground">
                You shared · {getContextLabel(kind)}
              </p>
              <h2 className="truncate font-stashly text-base font-semibold leading-tight">
                {name}
              </h2>
              <p className="text-xs text-muted-foreground">
                on {formatMediaDate(invitation.createdAt)}
              </p>
            </div>
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <ResponseSummary recipients={invitation.recipients} />
          </SidebarGroup>

          <SidebarGroup className="flex-1 p-1 h-full">
            <SidebarGroupLabel>Recipients</SidebarGroupLabel>
            <ScrollArea type="hidden" className="h-full pb-12">
              <AddRecipientsDialog
                open={open}
                onOpenChange={setOpen}
                invitation={invitation}
              />
              <div className="flex flex-col gap-1.5">
                {invitation.recipients.map((recipient) => (
                  <RecipientRow
                    key={recipient.id}
                    recipient={recipient}
                    disabled={isSubmitting}
                  />
                ))}
              </div>
            </ScrollArea>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          {/* Cancel-all pinned to the bottom of the rail */}
          {hasPending ? (
            <div className="flex items-center justify-between gap-3 border-t border-input bg-card p-4">
              <p className="text-xs text-muted-foreground">
                {counts.pending} awaiting reply
              </p>
              <cancelAllFetcher.Form method="post" action="/api/invitations">
                <input type="hidden" name="intent" value="cancel_invitation" />
                <input
                  type="hidden"
                  name="invitationId"
                  value={invitation.id}
                />
                <Button
                  type="submit"
                  variant="outline"
                  size="sm"
                  disabled={isSubmitting}
                  className="text-destructive hover:bg-destructive/10"
                >
                  <TrashFillIcon className="mr-1.5 size-5" />
                  Cancel all pending
                </Button>
              </cancelAllFetcher.Form>
            </div>
          ) : (
            <div className="flex shrink-0 items-center gap-2 border-t border-input bg-card p-4 text-sm text-muted-foreground">
              <CheckIcon className="size-5" />
              Everyone has responded.
            </div>
          )}
        </SidebarFooter>
      </Sidebar>
    </>
  )
}
