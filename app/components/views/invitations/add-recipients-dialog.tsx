import { AddIcon, LoaderIcon } from '@/components/icons'
import { useRecipientRows } from '@/hooks/useRecipientRows'
import { Button } from '@/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ui/dialog'
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
import { MessageField, RecipientsField } from './invite-form-fields'

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
  const { rows, add, remove, patch, reset, valid, toPayload } =
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AddIcon className="size-5 text-primary" />
            Add recipients
          </DialogTitle>
          <DialogDescription className="truncate">{name}</DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="flex flex-col gap-5 px-1 py-1">
            {/* Context chip */}
            <div className="flex items-center gap-3 rounded-xl border border-primary/40 bg-primary/10 p-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-card text-primary">
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
              onAdd={add}
              onRemove={remove}
              onEmail={(id, v) => patch(id, { email: v })}
              onRole={(id, v) => patch(id, { role: v })}
            />

            {/* Message */}
            <MessageField value={message} onChange={setMessage} />

            {error && (
              <p className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                {error}
              </p>
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleAdd}
            disabled={isSubmitting || !valid.length}
          >
            {isSubmitting ? (
              <LoaderIcon className="mr-2 size-4 animate-spin" />
            ) : (
              <AddIcon className="mr-2 size-4" />
            )}
            Add {valid.length > 1 ? `${valid.length} people` : 'person'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
