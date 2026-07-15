import {
  CheckIcon,
  CopyFillIcon,
  LinkIcon,
  LoaderIcon,
  SendInvitationIcon,
  SubmitIcon,
} from '@/components/icons'
import { useClipboard } from '@/hooks/useClipboard'
import { Button } from '@/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ui/dialog'
import { Label } from '@/ui/label'
import { ScrollArea } from '@/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui/select'
import { cn } from '@/utils/styles'
import { useEffect, useMemo, useState } from 'react'
import { useFetcher } from 'react-router'
import { getContextIcon, type ContextKind } from './invitation-model'
import {
  MessageField,
  RecipientsField,
  useRecipientRows,
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
    <div className="flex min-w-0 items-center gap-2.5">
      <div className="grid size-7 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
        <Icon className="size-4" />
      </div>
      <div className="min-w-0 text-left">
        <p className="truncate font-stashly text-sm font-medium leading-tight">
          {target.name}
        </p>
        <p className="truncate text-xs leading-tight text-muted-foreground">
          {kindLabel(target.kind)}
          {target.path && (
            <span className="text-muted-foreground/70"> · {target.path}</span>
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
  const { rows, add, remove, patch, reset, valid, toPayload } =
    useRecipientRows()
  const [message, setMessage] = useState('')
  const [targetId, setTargetId] = useState(
    defaultTargetId ?? targets[0]?.id ?? ''
  )
  const { copy, copied } = useClipboard()

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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SendInvitationIcon className="size-5 text-primary" />
            New invitation
          </DialogTitle>
          <DialogDescription>
            Share a file or workspace with people.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="flex flex-col gap-5 px-1 py-1">
            {/* Target picker */}
            <div className="flex flex-col gap-2">
              <Label className="text-xs">What do you want to share?</Label>
              <Select value={targetId} onValueChange={setTargetId}>
                <SelectTrigger className="h-auto w-full border-input bg-card py-2">
                  <SelectValue>
                    {target && <TargetOption target={target} />}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="max-h-72 border-input bg-card shadow-stashly">
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
              onAdd={add}
              onRemove={remove}
              onEmail={(id, v) => patch(id, { email: v })}
              onRole={(id, v) => patch(id, { role: v })}
            />

            {/* Message */}
            <MessageField value={message} onChange={setMessage} />

            {/* Invite by link */}
            <div className="flex items-center gap-3 rounded-xl border border-input p-3">
              <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                <LinkIcon className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-tight">
                  Invite by link
                </p>
                <p className="text-xs leading-tight text-muted-foreground">
                  Anyone with the link can request access
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => copy(linkUrl)}
                className={cn(copied && 'text-green-600 dark:text-green-400')}
              >
                {copied ? (
                  <CheckIcon className="mr-1.5 size-4" />
                ) : (
                  <CopyFillIcon className="mr-1.5 size-4" />
                )}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>

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
            onClick={handleSend}
            disabled={isSubmitting || !valid.length || !target}
          >
            {isSubmitting ? (
              <LoaderIcon className="mr-2 size-4 animate-spin" />
            ) : (
              <SubmitIcon className="mr-2 size-4" />
            )}
            Send{' '}
            {valid.length > 1 ? `${valid.length} invitations` : 'invitation'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
