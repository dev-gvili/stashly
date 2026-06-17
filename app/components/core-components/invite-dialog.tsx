import React, { useEffect, useState } from 'react'
import { useFetcher } from 'react-router'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/ui/dialog'
import { Button } from '@/ui/button'
import { Input } from '@/ui/input'
import { Label } from '@/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui/select'
import { Separator } from '@/ui/separator'
import { ScrollArea } from '@/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/tabs'
import { cn } from '@/utils/styles'
import {
  UserIcon,
  GroupFillIcon,
  SubmitIcon,
  TrashFillIcon,
  LoaderIcon,
  AddIcon,
} from '@/components/icons'
import type { StashInvitation } from '@/types/stash.types'
import { Form } from 'react-router'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '../ui'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface InviteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  itemId: string
  itemName: string
}

type RecipientRow = { email: string; role: string }

type LoaderData = { invitations: StashInvitation[] }

// ---------------------------------------------------------------------------
// Status badge helper
// ---------------------------------------------------------------------------

const statusColors: Record<string, string> = {
  pending:
    'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  accepted:
    'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  canceled: 'bg-muted text-muted-foreground',
  expired: 'bg-muted text-muted-foreground',
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function InviteDialog({
  itemId,
  itemName,
  onOpenChange,
  open,
}: InviteDialogProps) {
  const loadFetcher = useFetcher<LoaderData>()
  const mutateFetcher = useFetcher()

  const [recipients, setRecipients] = useState<RecipientRow[]>([
    { email: '', role: 'read' },
  ])

  // Load invitations when dialog opens
  useEffect(() => {
    if (open) {
      loadFetcher.load(`/api/invitations?itemId=${itemId}`)
    }
  }, [open, itemId])

  // Reload after mutation and reset form on success
  useEffect(() => {
    if (mutateFetcher.state === 'idle' && mutateFetcher.data) {
      loadFetcher.load(`/api/invitations?itemId=${itemId}`)
      if ((mutateFetcher.data as { success?: boolean }).success) {
        setRecipients([{ email: '', role: 'read' }])
      }
    }
  }, [mutateFetcher.data])

  const invitations: StashInvitation[] = loadFetcher.data?.invitations ?? []
  const isMutating = mutateFetcher.state !== 'idle'
  const isLoading = loadFetcher.state === 'loading'

  const pendingCount = invitations.reduce(
    (count, inv) =>
      count + inv.recipients.filter((r) => r.status === 'pending').length,
    0
  )

  function addRecipient() {
    setRecipients((prev) => [...prev, { email: '', role: 'read' }])
  }

  function removeRecipient(index: number) {
    setRecipients((prev) => prev.filter((_, i) => i !== index))
  }

  function updateRecipient(
    index: number,
    field: keyof RecipientRow,
    value: string
  ) {
    setRecipients((prev) =>
      prev.map((r, i) => (i === index ? { ...r, [field]: value } : r))
    )
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const validRecipients = recipients.filter((r) => r.email.trim())
    if (validRecipients.length === 0) return

    mutateFetcher.submit(
      {
        intent: 'send_item_invitation',
        itemId,
        recipients: validRecipients,
      },
      { method: 'post', action: '/api/invitations' }
    )
  }

  function handleCancel(invitationId: string) {
    mutateFetcher.submit(
      { intent: 'cancel_invitation', invitationId },
      { method: 'post', action: '/api/invitations' }
    )
  }

  const mutateError =
    mutateFetcher.state === 'idle' && mutateFetcher.data
      ? (mutateFetcher.data as { error?: string }).error
      : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GroupFillIcon className="size-4" />
            Invite people
          </DialogTitle>
          <p className="text-xs text-muted-foreground truncate">{itemName}</p>
        </DialogHeader>

        <Tabs defaultValue="invite">
          <TabsList className="w-full">
            <TabsTrigger value="invite" className="flex-1">
              Invite
            </TabsTrigger>
            <TabsTrigger value="pending" className="flex-1">
              Sent
              {pendingCount > 0 && (
                <span className="ml-1.5 rounded-full bg-primary/20 text-primary px-1.5 py-0.5 text-xs font-medium">
                  {pendingCount}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ── Send invite tab ── */}
          <TabsContent value="invite" className="mt-4 space-y-4">
            <mutateFetcher.Form
              action="/api/invitations"
              method="post"
              className="space-y-3"
            >
              <Input hidden name="itemId" defaultValue={itemId} />
              <div className="space-y-2">
                <Label className="text-xs">Recipients</Label>
                {recipients.map((recipient, index) => (
                  <InputGroup>
                    <InputGroupAddon align="inline-start">
                      <UserIcon />
                    </InputGroupAddon>
                    <InputGroupInput
                      name={`recipients[${index}][email]`}
                      type="email"
                      placeholder="colleague@example.com"
                      className="pl-8 text-sm"
                      autoFocus={index === 0}
                    />
                    <Select
                      name={`recipients[${index}][role]`}
                      defaultValue="read"
                    >
                      <InputGroupAddon align="inline-end">
                        <InputGroupButton asChild>
                          <SelectTrigger className="bg-card border-none text-foreground">
                            <SelectValue />
                          </SelectTrigger>
                        </InputGroupButton>
                        <SelectContent>
                          <SelectItem value="read">Can view</SelectItem>
                          <SelectItem value="write">Can edit</SelectItem>
                        </SelectContent>
                      </InputGroupAddon>
                    </Select>
                    <InputGroupAddon
                      align="inline-end"
                      className={cn('hidden', recipients.length > 1 && 'block')}
                    >
                      <InputGroupButton onClick={() => removeRecipient(index)}>
                        <TrashFillIcon />
                      </InputGroupButton>
                    </InputGroupAddon>
                  </InputGroup>
                ))}
              </div>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={addRecipient}
                className="self-start"
              >
                <AddIcon className="size-3.5 mr-1.5" />
                Add another
              </Button>

              <Separator />

              {mutateError && (
                <p className="text-xs text-destructive rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2">
                  {mutateError}
                </p>
              )}

              <Button
                type="submit"
                className="w-full"
                name="intent"
                value="send_item_invitation"
                size="sm"
                // disabled={
                //   isMutating ||
                //   recipients.every((r) => !r.email.trim())
                // }
              >
                {isMutating ? (
                  <LoaderIcon className="size-3.5 mr-2 animate-spin" />
                ) : (
                  <SubmitIcon className="size-3.5 mr-2" />
                )}
                Send{' '}
                {recipients.filter((r) => r.email.trim()).length > 1
                  ? `${recipients.filter((r) => r.email.trim()).length} invitations`
                  : 'invitation'}
              </Button>
            </mutateFetcher.Form>
          </TabsContent>

          {/* ── Sent invitations tab ── */}
          <TabsContent value="pending" className="mt-4">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <LoaderIcon className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : invitations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground">
                <GroupFillIcon className="size-8 opacity-30" />
                <p className="text-xs">No invitations sent yet</p>
              </div>
            ) : (
              <ScrollArea className="max-h-64">
                <div className="flex flex-col gap-3 pr-2">
                  {invitations.map((inv) => (
                    <div key={inv.id} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">
                          {new Date(inv.createdAt).toLocaleDateString()}
                        </p>
                        {inv.recipients.some((r) => r.status === 'pending') && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 text-xs"
                            disabled={isMutating}
                            onClick={() => handleCancel(inv.id)}
                          >
                            Cancel all
                          </Button>
                        )}
                      </div>
                      {inv.recipients.map((recipient) => (
                        <div
                          key={recipient.id}
                          className="flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2"
                        >
                          <div className="size-7 shrink-0 rounded-full bg-muted flex items-center justify-center">
                            <UserIcon className="size-3.5 text-muted-foreground" />
                          </div>

                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">
                              {recipient.email}
                            </p>
                            <p className="text-xs text-muted-foreground capitalize">
                              {recipient.role} access
                            </p>
                          </div>

                          <span
                            className={cn(
                              'text-xs px-2 py-0.5 rounded-full font-medium capitalize shrink-0',
                              statusColors[recipient.status] ??
                                statusColors.pending
                            )}
                          >
                            {recipient.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
