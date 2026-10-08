import { useRecipientRows } from '@/hooks/useRecipientRows'
import { Dialog, DialogContent } from '@/ui/dialog'
import { ScrollArea } from '@/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui/select'
import { useEffect, useMemo, useState } from 'react'
import { useFetcher } from 'react-router'
import { getContextIcon, type ContextKind } from '@/utils/invitations'
import {
  INVITE_CAPTION,
  INVITE_DESCRIPTION,
  InviteDialogFooter,
  InviteDialogHeader,
  focusAddEmails,
  MessageField,
  RecipientsField,
  sendInvitesLabel,
} from './invite-form-fields'

// ---------------------------------------------------------------------------
// A thing the user can share. The invitations route loader supplies the list
// (recent items + workspaces the current user owns / can invite to).
// ---------------------------------------------------------------------------

export type ShareTarget = {
  id: string
  type: 'item' | 'workspace'
  name: string
  kind: ContextKind
  /** Short parent trail (e.g. "Home / docs") to disambiguate same-named items. */
  path?: string | null
}

export interface NewInvitationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Shareable items + workspaces to choose from. */
  targets: ShareTarget[]
  /** Pre-select a target (e.g. when opened from a specific item). */
  defaultTargetId?: string
  /** Optional absolute base for the "invite by link" URL. */
  inviteLinkBase?: string
  /** Called after a successful send. */
  onSent?: () => void
}

// ---------------------------------------------------------------------------
// Target picker option (icon + name + category label + parent path)
// ---------------------------------------------------------------------------

/**
 * Human label for a target kind — the item's category ("PDF", "Image", "Code")
 * rather than a generic "File".
 */
function kindLabel(kind: ContextKind): string {
  switch (kind) {
    case 'workspace':
      return 'Workspace'
    case 'folder':
      return 'Folder'
    case 'pdf':
      return 'PDF'
    case 'file':
    case 'unknown':
      return 'File'
    default:
      return kind.charAt(0).toUpperCase() + kind.slice(1)
  }
}

function TargetOption({ target }: { target: ShareTarget }) {
  const Icon = getContextIcon(target.kind)
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="grid size-8 shrink-0 place-items-center rounded-md bg-accent text-accent-foreground">
        <Icon className="size-4" />
      </div>
      <div className="min-w-0 text-left">
        <p className="truncate font-stashly text-sm font-medium leading-tight">
          {target.name}
        </p>
        <p className="truncate text-xs leading-tight text-muted-foreground">
          {kindLabel(target.kind)}
          {target.path && (
            <span className="text-muted-foreground"> · {target.path}</span>
          )}
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// NewInvitationDialog — share a file/folder/workspace with new people
// ---------------------------------------------------------------------------

export function NewInvitationDialog({
  open,
  onOpenChange,
  targets,
  defaultTargetId,
  inviteLinkBase,
  onSent,
}: NewInvitationDialogProps) {
  const fetcher = useFetcher<{ success?: boolean; error?: string }>()
  const { rows, addEmails, remove, patch, reset, valid, toPayload } =
    useRecipientRows()
  const [message, setMessage] = useState('')
  const [targetId, setTargetId] = useState(
    defaultTargetId ?? targets[0]?.id ?? ''
  )

  const target = useMemo(
    () => targets.find((t) => t.id === targetId) ?? targets[0],
    [targets, targetId]
  )
  const isSubmitting = fetcher.state !== 'idle'

  // Reset the form each time the dialog opens.
  useEffect(() => {
    if (open) {
      reset()
      setMessage('')
      setTargetId(defaultTargetId ?? targets[0]?.id ?? '')
    }
  }, [open, defaultTargetId, targets, reset])

  // Close on success.
  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data?.success) {
      onOpenChange(false)
      onSent?.()
    }
  }, [fetcher.state, fetcher.data, onOpenChange, onSent])

  const error =
    fetcher.state === 'idle' && fetcher.data?.error ? fetcher.data.error : null

  function handleSend() {
    if (!target || !valid.length) return
    const base: Record<string, string> =
      target.type === 'item'
        ? { intent: 'send_item_invitation', itemId: target.id }
        : { intent: 'send_workspace_invitation', workspaceId: target.id }
    fetcher.submit(
      { ...base, message, ...toPayload() },
      { method: 'post', action: '/api/invitations' }
    )
  }

  const linkUrl = target
    ? `${inviteLinkBase ?? (typeof window !== 'undefined' ? window.location.origin : '')}/invite/${target.id}`
    : ''

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        onOpenAutoFocus={focusAddEmails}
        className="gap-6 rounded-3xl font-stashly border-input bg-card p-6 shadow-stashly sm:max-w-xl sm:p-8">
        <InviteDialogHeader
          icon={getContextIcon(target?.kind ?? 'file')}
          title={target ? `Invite to ${target.name}` : 'New invitation'}
          description={INVITE_DESCRIPTION}
        />

        <ScrollArea type="hidden" className="-mx-1 max-h-[60vh]">
          <div className="flex flex-col gap-5 p-1">
            {/* Target picker */}
            <div className="flex flex-col gap-2">
              <span className={INVITE_CAPTION}>Sharing</span>
              <Select value={targetId} onValueChange={setTargetId}>
                <SelectTrigger
                  aria-label="What do you want to share?"
                  className="w-full rounded-xl border-0 bg-muted py-2 pl-2.5 pr-3 shadow-none hover:bg-accent data-[size=default]:h-12 dark:bg-muted dark:hover:bg-accent"
                >
                  <SelectValue>
                    {target && <TargetOption target={target} />}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="max-h-72 w-(--radix-select-trigger-width) rounded-xl border-input bg-card shadow-stashly">
                  {targets.map((t) => (
                    <SelectItem
                      key={t.id}
                      value={t.id}
                      className="rounded-md py-2 focus:bg-accent focus:text-accent-foreground"
                    >
                      <TargetOption target={t} />
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
          submitLabel={sendInvitesLabel(valid.length)}
          onSubmit={handleSend}
          disabled={!valid.length || !target}
          submitting={isSubmitting}
          onCancel={() => onOpenChange(false)}
          copyLinkUrl={linkUrl || undefined}
        />
      </DialogContent>
    </Dialog>
  )
}
