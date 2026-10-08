import { useRecipientRows } from '@/hooks/useRecipientRows'
import { Dialog, DialogContent } from '@/ui/dialog'
import { ScrollArea } from '@/ui/scroll-area'
import { useEffect, useState } from 'react'
import { useFetcher } from 'react-router'
import type { InvitationExtras } from '@/types/stash.types'
import {
  getContextIcon,
  getContextKind,
  getContextLabel,
  getContextName,
} from '@/utils/invitations'
import {
  INVITE_DESCRIPTION,
  InviteDialogFooter,
  InviteDialogHeader,
  focusAddEmails,
  MessageField,
  RecipientsField,
} from './invite-form-fields'

export interface AddRecipientsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The invitation whose shared thing we're adding people to. */
  invitation: InvitationExtras
  /** Called after recipients are successfully added. */
  onAdded?: () => void
}

// ---------------------------------------------------------------------------
// AddRecipientsDialog — add more people to an existing shared item/workspace.
// Opened from the "Add" button in the Sent detail rail.
// ---------------------------------------------------------------------------

export function AddRecipientsDialog({
  open,
  onOpenChange,
  invitation,
  onAdded,
}: AddRecipientsDialogProps) {
  const fetcher = useFetcher<{ success?: boolean; error?: string }>()
  const { rows, addEmails, remove, patch, reset, valid, toPayload } =
    useRecipientRows()
  const [message, setMessage] = useState('')

  const kind = getContextKind(invitation)
  const ContextIcon = getContextIcon(kind)
  const name = getContextName(invitation)
  const existing = invitation.recipients.length
  const isSubmitting = fetcher.state !== 'idle'

  // Reset the form each time the dialog opens.
  useEffect(() => {
    if (open) {
      reset()
      setMessage('')
    }
  }, [open, reset])

  // Close on success.
  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data?.success) {
      onOpenChange(false)
      onAdded?.()
    }
  }, [fetcher.state, fetcher.data, onOpenChange, onAdded])

  const error =
    fetcher.state === 'idle' && fetcher.data?.error ? fetcher.data.error : null

  function handleAdd() {
    if (!valid.length) return
    // Same intents as sending a fresh invitation — the server dedupes/merges
    // recipients onto the existing item/workspace invitation.
    const base: Record<string, string> | null = invitation.item
      ? { intent: 'send_item_invitation', itemId: invitation.item.id }
      : invitation.workspace
        ? {
            intent: 'send_workspace_invitation',
            workspaceId: invitation.workspace.id,
          }
        : null
    if (!base) return
    fetcher.submit(
      { ...base, message, ...toPayload() },
      { method: 'post', action: '/api/invitations' }
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        onOpenAutoFocus={focusAddEmails}
        className="gap-6 rounded-3xl font-stashly border-input bg-card p-6 shadow-stashly sm:max-w-xl sm:p-8">
        <InviteDialogHeader
          icon={ContextIcon}
          title={`Add people to ${name}`}
          description={INVITE_DESCRIPTION}
        />

        <ScrollArea type="hidden" className="-mx-1 max-h-[60vh]">
          <div className="flex flex-col gap-5 p-1">
            {/* Context chip */}
            <div className="flex items-center gap-3 rounded-xl bg-muted p-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-md bg-accent text-accent-foreground">
                <ContextIcon className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium leading-tight">
                  {name}
                </p>
                <p className="text-xs leading-tight text-muted-foreground">
                  {getContextLabel(kind)} · already shared with {existing}{' '}
                  {existing === 1 ? 'person' : 'people'}
                </p>
              </div>
            </div>

            {/* Recipients */}
            <RecipientsField
              rows={rows}
              onAddEmails={addEmails}
              onRemove={remove}
              onEmail={(id, v) => patch(id, { email: v })}
              onRole={(id, v) => patch(id, { role: v })}
            />

            {/* Message */}
            <MessageField value={message} onChange={setMessage} />

            {error && (
              <p className="rounded-xl bg-muted px-3 py-2 text-xs text-destructive">
                {error}
              </p>
            )}
          </div>
        </ScrollArea>

        <InviteDialogFooter
          submitLabel={
            valid.length > 1 ? `Add ${valid.length} people` : 'Add person'
          }
          onSubmit={handleAdd}
          disabled={!valid.length}
          submitting={isSubmitting}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
