import React, { useEffect, useState } from 'react'
import { useFetcher } from 'react-router'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/ui/dialog'
import { Button } from '@/ui/button'
import { Input } from '@/ui/input'
import { Label } from '@/ui/label'
import { Badge } from '@/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/ui/avatar'
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
import { toUserInitial } from '@/utils/converters'
import {
  UserIcon,
  GroupIcon,
  SubmitIcon,
  CheckIcon,
  RemoveIcon,
  DeleteIcon,
  LoaderIcon,
} from '@/components/icons'
import type { StashInvitation } from '@/types/stash.types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface InviteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  itemId: string
  itemName: string
}

type LoaderData = { invitations: StashInvitation[] }

// ---------------------------------------------------------------------------
// Status badge helper
// ---------------------------------------------------------------------------

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  accepted: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  canceled: 'bg-muted text-muted-foreground',
  expired: 'bg-muted text-muted-foreground',
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function InviteDialog({ open, onOpenChange, itemId, itemName }: InviteDialogProps) {
  const loadFetcher = useFetcher<LoaderData>()
  const mutateFetcher = useFetcher()

  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'read' | 'write'>('read')
  const [emailError, setEmailError] = useState<string | null>(null)

  // Load invitations when dialog opens
  useEffect(() => {
    if (open) {
      loadFetcher.load(`/api/invitations?itemId=${itemId}`)
    }
  }, [open, itemId])

  // Reload after mutation
  useEffect(() => {
    if (mutateFetcher.state === 'idle' && mutateFetcher.data) {
      loadFetcher.load(`/api/invitations?itemId=${itemId}`)
      if ((mutateFetcher.data as { success?: boolean }).success) {
        setEmail('')
        setEmailError(null)
      }
    }
  }, [mutateFetcher.state, mutateFetcher.data])

  const invitations: StashInvitation[] = loadFetcher.data?.invitations ?? []
  const isMutating = mutateFetcher.state !== 'idle'
  const isLoading = loadFetcher.state === 'loading'

  function validateEmail(value: string): boolean {
    if (!value) {
      setEmailError('Email is required')
      return false
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setEmailError('Enter a valid email address')
      return false
    }
    setEmailError(null)
    return true
  }

  function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!validateEmail(email)) return
    mutateFetcher.submit(
      { intent: 'send_item_invitation', itemId, email, role },
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
            <GroupIcon className="size-4" />
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
              {invitations.filter((i) => i.status === 'pending').length > 0 && (
                <span className="ml-1.5 rounded-full bg-primary/20 text-primary px-1.5 py-0.5 text-xs font-medium">
                  {invitations.filter((i) => i.status === 'pending').length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ── Send invite tab ── */}
          <TabsContent value="invite" className="mt-4 space-y-4">
            <form onSubmit={handleSend} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="invite-email" className="text-xs">
                  Email address
                </Label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <UserIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
                    <Input
                      id="invite-email"
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value)
                        if (emailError) setEmailError(null)
                      }}
                      placeholder="colleague@example.com"
                      className={cn('pl-8 text-sm', emailError && 'border-destructive')}
                      autoComplete="off"
                    />
                  </div>
                  <Select
                    value={role}
                    onValueChange={(v) => setRole(v as 'read' | 'write')}
                  >
                    <SelectTrigger className="w-24 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="read" className="text-xs">
                        Can view
                      </SelectItem>
                      <SelectItem value="write" className="text-xs">
                        Can edit
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {emailError && (
                  <p className="text-xs text-destructive">{emailError}</p>
                )}
              </div>

              {mutateError && (
                <p className="text-xs text-destructive rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2">
                  {mutateError}
                </p>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={isMutating || !email}
                size="sm"
              >
                {isMutating ? (
                  <LoaderIcon className="size-3.5 mr-2 animate-spin" />
                ) : (
                  <SubmitIcon className="size-3.5 mr-2" />
                )}
                Send invitation
              </Button>
            </form>
          </TabsContent>

          {/* ── Sent invitations tab ── */}
          <TabsContent value="pending" className="mt-4">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <LoaderIcon className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : invitations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground">
                <GroupIcon className="size-8 opacity-30" />
                <p className="text-xs">No invitations sent yet</p>
              </div>
            ) : (
              <ScrollArea className="max-h-64">
                <div className="flex flex-col gap-2 pr-2">
                  {invitations.map((inv) => (
                    <div
                      key={inv.id}
                      className="flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2"
                    >
                      <Avatar className="size-7 shrink-0">
                        <AvatarFallback className="text-xs bg-muted">
                          <UserIcon className="size-3.5 text-muted-foreground" />
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{inv.email}</p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {inv.permission?.roles ?? 'read'} access
                        </p>
                      </div>

                      <span
                        className={cn(
                          'text-xs px-2 py-0.5 rounded-full font-medium capitalize shrink-0',
                          statusColors[inv.status] ?? statusColors.pending
                        )}
                      >
                        {inv.status}
                      </span>

                      {inv.status === 'pending' && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-6 shrink-0"
                          disabled={isMutating}
                          onClick={() => handleCancel(inv.id)}
                          title="Cancel invitation"
                        >
                          <DeleteIcon className="size-3" />
                        </Button>
                      )}
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
