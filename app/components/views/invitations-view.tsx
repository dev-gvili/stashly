import {
  AddIcon,
  InboxReciveFillIcon,
  InboxSentFillIcon,
  SearchIcon,
} from '@/components/icons'
import {
  InvitationDetailEmpty,
  InvitationDetailPanel,
  NewInvitationDialog,
  type ShareTarget,
} from '@/components/views/invitations'
import type {
  StashInvitation,
  StashInvitationRecipient,
} from '@/types/stash.types'
import { Avatar, AvatarFallback, AvatarImage } from '@/ui/avatar'
import { Button } from '@/ui/button'
import { Input } from '@/ui/input'
import { ScrollArea } from '@/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/tabs'
import { formatMediaDate } from '@/utils'
import { toUserInitial } from '@/utils/converters'
import {
  getContextIcon,
  getContextKind,
  getContextName,
} from '@/utils/invitations'
import { cn } from '@/utils/styles'
import { useState } from 'react'
import { useRevalidator } from 'react-router'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type InvitationTab = 'received' | 'sent'

type ReceivedEntry = {
  invitation: StashInvitation
  recipient: StashInvitationRecipient
}

function KindIcon({
  invitation,
  className,
}: {
  invitation: StashInvitation
  className?: string
}) {
  const Icon = getContextIcon(getContextKind(invitation))
  return <Icon className={className} />
}

// ---------------------------------------------------------------------------
// List rows
// ---------------------------------------------------------------------------

function ReceivedListRow({
  entry,
  selected,
  onSelect,
}: {
  entry: ReceivedEntry
  selected: boolean
  onSelect: () => void
}) {
  const { invitation } = entry
  return (
    <Button
      variant="ghost"
      size="lg"
      value={invitation.id}
      onClick={onSelect}
      className={cn(
        'flex min-w-0 w-70 mx-auto h-full items-center gap-3 rounded-md px-3 py-2.5 mt-2 overflow-hidden hover:bg-accent',
        selected
          ? 'bg-accent hover:bg-muted!'
          : 'border-transparent hover:bg-accent'
      )}
    >
      <Avatar className="size-10 rounded-md shadow-stashly">
        <AvatarImage src={invitation.sender.image ?? undefined} />
        <AvatarFallback
          className={cn(
            'text-xs font-medium',
            selected && 'bg-primary text-primary-foreground'
          )}
        >
          {toUserInitial(invitation.sender.name)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-medium">
            {invitation.sender.name}
          </p>
          <span className="shrink-0 text-xs text-muted-foreground">
            {formatMediaDate(invitation.createdAt).split(',')[0]}
          </span>
        </div>
        <p className="flex items-center justify-start gap-1 min-w-0 w-full truncate ">
          <KindIcon
            invitation={invitation}
            className={cn(
              'size-5',
              invitation.item?.type === 'folder' && 'text-current!'
            )}
          />
          <span className="truncate">{getContextName(invitation)}</span>
        </p>
      </div>
    </Button>
  )
}

function SentListRow({
  invitation,
  selected,
  onSelect,
}: {
  invitation: StashInvitation
  selected: boolean
  onSelect: () => void
}) {
  const pending = invitation.recipients.filter(
    (r) => r.status === 'pending'
  ).length
  return (
    <Button
      variant="ghost"
      size="lg"
      onClick={onSelect}
      className={cn(
        'flex min-w-0 w-70 mx-auto h-full items-center gap-3 rounded-md px-3 py-2.5 mt-2 overflow-hidden hover:bg-accent',
        selected
          ? 'bg-accent hover:bg-muted!'
          : 'border-transparent hover:bg-accent'
      )}
    >
      <div className="grid size-10 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
        <KindIcon invitation={invitation} className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-medium">
            {getContextName(invitation)}
          </p>
          <span className=" text-xs text-muted-foreground">
            {formatMediaDate(invitation.createdAt).split(',')[0]}
          </span>
        </div>
        <p className="truncate text-xs text-muted-foreground text-start">
          {pending
            ? `${pending} of ${invitation.recipients.length} pending`
            : 'all responded'}
        </p>
      </div>
    </Button>
  )
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

export function InvitationsView({
  received,
  sent,
  targets = [],
  userEmail,
}: {
  received: StashInvitation[]
  sent: StashInvitation[]
  targets?: ShareTarget[]
  userEmail: string
}) {
  const [tab, setTab] = useState<InvitationTab>('received')
  const [query, setQuery] = useState('')
  const [selRecvId, setSelRecvId] = useState<string | null>(null)
  const [selSentId, setSelSentId] = useState<string | null>(null)
  const [newOpen, setNewOpen] = useState(false)
  const revalidator = useRevalidator()

  const receivedEntries: ReceivedEntry[] = received.flatMap((invitation) => {
    const recipient = invitation.recipients.find((r) => r.email === userEmail)
    return recipient ? [{ invitation, recipient }] : []
  })

  const pendingCount = receivedEntries.filter(
    (e) => e.recipient.status === 'pending'
  ).length

  const q = query.trim().toLowerCase()
  const filteredReceived = q
    ? receivedEntries.filter(
        ({ invitation }) =>
          invitation.sender.name.toLowerCase().includes(q) ||
          invitation.sender.email.toLowerCase().includes(q) ||
          getContextName(invitation).toLowerCase().includes(q)
      )
    : receivedEntries
  const filteredSent = q
    ? sent.filter(
        (invitation) =>
          getContextName(invitation).toLowerCase().includes(q) ||
          invitation.recipients.some((r) => r.email.toLowerCase().includes(q))
      )
    : sent

  const selectedReceived =
    filteredReceived.find((e) => e.invitation.id === selRecvId) ??
    filteredReceived[0]
  const selectedSent =
    filteredSent.find((i) => i.id === selSentId) ?? filteredSent[0]

  return (
    <div className="relative flex gap-2 h-full overflow-hidden">
      {/* List pane */}
      <div className="flex flex-col h-[calc(100vh-4rem)] min-h-0 p-0 w-92 rounded-md border border-input bg-card items-stretch gap-2 overflow-hidden justify-around">
        <div className="flex shrink-0 items-center justify-between px-3 pt-3">
          <p className="font-stashly text-sm font-semibold">Invitations</p>
          <Button size="sm" onClick={() => setNewOpen(true)}>
            <AddIcon className="mr-1.5 size-4" />
            New
          </Button>
        </div>
        <NewInvitationDialog
          open={newOpen}
          onOpenChange={setNewOpen}
          targets={targets}
          onSent={() => revalidator.revalidate()}
        />
        <Tabs
          value={tab}
          onValueChange={(value) => setTab(value as InvitationTab)}
          className="flex-1 min-h-0"
        >
          <TabsList className="w-full">
            <TabsTrigger value="received" className="flex-1 rounded-md" asChild>
              <Button
                variant="ghost"
                className="flex items-center gap-1.5 data-[state=active]:bg-accent! data-[state=active]:text-primary"
              >
                <InboxReciveFillIcon className="size-4" />
                Received
                {pendingCount > 0 && (
                  <span className="rounded bg-primary/15 px-1.5 py-0.5 text-xs font-semibold text-accent-foreground">
                    {pendingCount}
                  </span>
                )}
              </Button>
            </TabsTrigger>
            <TabsTrigger value="sent" className="flex-1" asChild>
              <Button
                variant="ghost"
                className="flex items-center gap-1.5 data-[state=active]:bg-accent data-[state=active]:text-primary"
              >
                <InboxSentFillIcon className="size-5" />
                Sent
              </Button>
            </TabsTrigger>
          </TabsList>
          <div className="relative">
            <SearchIcon className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${tab}`}
              className="h-9 pl-8"
            />
          </div>

          <TabsContent value={tab} className="min-h-0 ">
            {tab === 'received' ? (
              <ScrollArea type="hidden" className="h-full space-y-4">
                {filteredReceived.map((entry) => (
                  <ReceivedListRow
                    key={entry.invitation.id}
                    entry={entry}
                    selected={
                      entry.invitation.id === selectedReceived?.invitation.id
                    }
                    onSelect={() => setSelRecvId(entry.invitation.id)}
                  />
                ))}
              </ScrollArea>
            ) : (
              <ScrollArea type="hidden" className="h-full space-y-4">
                {filteredSent.map((invitation) => (
                  <SentListRow
                    key={invitation.id}
                    invitation={invitation}
                    selected={invitation.id === selectedSent?.id}
                    onSelect={() => setSelSentId(invitation.id)}
                  />
                ))}
              </ScrollArea>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Detail pane */}

      {tab === 'received' ? (
        selectedReceived ? (
          <InvitationDetailPanel
            key={selectedReceived.invitation.id}
            tab="received"
            invitation={selectedReceived.invitation}
            recipient={selectedReceived.recipient}
          />
        ) : (
          <InvitationDetailEmpty label="No invitations received yet" />
        )
      ) : selectedSent ? (
        <InvitationDetailPanel
          key={selectedSent.id}
          tab="sent"
          invitation={selectedSent}
        />
      ) : (
        <InvitationDetailEmpty label="No invitations sent yet" />
      )}
    </div>
  )
}
