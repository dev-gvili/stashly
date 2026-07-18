import {
    CalendarFillIcon,
  CalendarIcon,
  CheckIcon,
  FileFillIcon,
  GroupFillIcon,
  GroupIcon,
  InboxSentFillIcon,
  RemoveIcon,
  SendInvitationIcon,
  UndoIcon,
} from '@/components/icons'
import { invitationStatusLabel } from '@/components/core-components/invitation-status'
import type { StashInvitationRecipient } from '@/types/stash.types'
import { Button } from '@/ui/button'
import { ScrollArea } from '@/ui/scroll-area'
import { cn } from '@/utils/styles'
import { useFetcher } from 'react-router'
import {
  formatExpiry,
  getAccessPermissions,
  getContextKind,
  getContextLabel,
  getContextMeta,
  getContextName,
  getMemberCount,
  roleLabel,
  type InvitationExtras,
} from './invitation-model'
import {
  AccessPermissions,
  ContextThumbnail,
  ContextThumbnailFooter,
  FilePreviewGrid,
  MetaCell,
  MetaGrid,
  NoteBlock,
  SectionLabel,
  SenderBlock,
} from './invitation-parts'
import { toCategory } from '@/utils/converters'
import { Sidebar } from '@/components/ui'
import { formatMediaDate } from '@/utils';

// ---------------------------------------------------------------------------
// Received invitation — full detail panel (2-column: preview + decision rail)
// ---------------------------------------------------------------------------

export function ReceivedInvitationDetail({
  invitation,
  recipient,
}: {
  invitation: InvitationExtras
  recipient: StashInvitationRecipient
}) {
  const fetcher = useFetcher()
  const isSubmitting = fetcher.state !== 'idle'

  const kind = getContextKind(invitation)
  const isSingle = kind === 'file' || kind === 'image'
  const name = getContextName(invitation)
  const meta = getContextMeta(invitation)
  const permissions = getAccessPermissions(recipient.role)
  const previews = invitation.previews ?? []
  const memberCount = getMemberCount(invitation)
  const isPending = recipient.status === 'pending'
  const expiry = isPending ? formatExpiry(invitation.expiresAt) : null

  return (
    <>
      <div className="flex bg-card! border border-input rounded-md h-[calc(100vh-4rem)] w-full overflow-hidden">
        {/* ── LEFT: preview / contents / message ── */}
        <ScrollArea className="min-w-0 flex-1">
          <div className="flex flex-col gap-y-5 p-6 w-full">
                <SenderBlock
              name={invitation.sender.name}
              subtitle={
                invitation.sender.title ?? invitation.sender.email ?? null
              }
              image={invitation.sender.image}
              status={recipient.status}
            />
            <NoteBlock
              message={invitation.message}
              fromName={invitation.sender.name}
            />
            <ContextThumbnail
              kind={invitation.item?.category ?? 'file'}
              previewUrl={invitation.item?.thumbnailUrl}
            >
              {isSingle && <ContextThumbnailFooter name={name} meta={meta} />}
            </ContextThumbnail>

            {!isSingle && previews.length > 0 && (
              <FilePreviewGrid
                title={meta ? `Contents · ${meta}` : 'Contents'}
                files={previews}
              />
            )}

          </div>
        </ScrollArea>
      </div>

      {/* ── RIGHT: decision rail ── */}
      <Sidebar
        variant="floating"
        collapsible="none"
        width="32rem"
        side="right"
        className="h-[calc(100vh-4rem)] bg-card rounded-md overflow-hidden border border-input"
      >
        <ScrollArea className="flex-1">
          <div className="flex flex-col gap-6 p-6">
        

            {/* Invited-to callout */}
            <div className="rounded-xl bg-primary/10 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                You&apos;re invited to
              </p>
              <p className="mt-0.5 truncate font-stashly text-base font-semibold">
                {name}
              </p>
              <p className="mt-1 text-xs text-primary">
                {getContextLabel(kind)} · as{' '}
                <span className="font-semibold">
                  {roleLabel(recipient.role)}
                </span>
              </p>
            </div>

            <MetaGrid columns={2}>
              <MetaCell
                label="Sent"
                value={formatMediaDate(invitation.createdAt)}
                icon={InboxSentFillIcon}
              />
              <MetaCell
                label={isPending ? 'Expires' : 'Status'}
                value={
                  isPending ? (
                    (expiry ?? 'No expiry')
                  ) : (
                    <span className="capitalize">
                      {invitationStatusLabel(recipient.status)}
                    </span>
                  )
                }
                icon={CalendarFillIcon}
              />
              {meta && (
                <MetaCell
                  label={isSingle ? 'Details' : 'Contains'}
                  value={meta}
                  icon={FileFillIcon}
                />
              )}
              {memberCount != null && (
                <MetaCell
                  label="Members"
                  value={memberCount}
                  icon={GroupFillIcon}
                />
              )}
            </MetaGrid>

            <div className="border-t border-input pt-4">
              <SectionLabel>Your access</SectionLabel>
              <AccessPermissions permissions={permissions} />
            </div>

            {invitation.mutualConnection && (
              <div className="flex items-start gap-3 border-t border-input pt-4">
                <GroupFillIcon className="mt-0.5 size-4 shrink-0 text-primary" />
                <p className="text-xs leading-relaxed text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {invitation.mutualConnection}
                  </span>{' '}
                  is already here — you two already collaborate.
                </p>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Actions pinned to the bottom of the rail */}
        {isPending ? (
          <div className="flex shrink-0 flex-col gap-2.5 border-t border-input bg-card p-4">
            <fetcher.Form method="post" action="/api/invitations">
              <input type="hidden" name="intent" value="accept_invitation" />
              <input type="hidden" name="recipientId" value={recipient.id} />
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                <CheckIcon className="mr-2 size-4" />
                Accept invitation
              </Button>
            </fetcher.Form>
            <fetcher.Form method="post" action="/api/invitations">
              <input type="hidden" name="intent" value="reject_invitation" />
              <input type="hidden" name="recipientId" value={recipient.id} />
              <Button
                type="submit"
                variant="outline"
                className="w-full"
                disabled={isSubmitting}
              >
                <RemoveIcon className="mr-2 size-4" />
                Decline
              </Button>
            </fetcher.Form>
          </div>
        ) : (
          <div className="flex shrink-0 items-center justify-between gap-3 border-t border-input bg-card p-4">
            <p
              className={cn(
                'flex items-center gap-2 text-sm',
                recipient.status === 'accepted'
                  ? 'text-green-700 dark:text-green-400'
                  : 'text-muted-foreground'
              )}
            >
              {recipient.status === 'accepted' ? (
                <CheckIcon className="size-4" />
              ) : (
                <RemoveIcon className="size-4" />
              )}
              You {recipient.status === 'accepted' ? 'accepted' : 'declined'}{' '}
              this invitation.
            </p>
            {(recipient.status === 'accepted' ||
              recipient.status === 'rejected') && (
              <fetcher.Form method="post" action="/api/invitations">
                <input
                  type="hidden"
                  name="intent"
                  value="undo_invitation_response"
                />
                <input type="hidden" name="recipientId" value={recipient.id} />
                <Button
                  type="submit"
                  size="sm"
                  variant="outline"
                  disabled={isSubmitting}
                  className="gap-1.5 text-muted-foreground"
                >
                  <UndoIcon className="size-4" />
                  Undo
                </Button>
              </fetcher.Form>
            )}
          </div>
        )}
      </Sidebar>
    </>
  )
}
