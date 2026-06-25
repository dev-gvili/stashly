import { auth } from '@/.server/auth'
import { redirect, useFetcher } from 'react-router'
import type { Route } from './+types/invitations'
import { listReceivedInvitations, listSentInvitations } from '../../.server/invitation-actions'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/tabs'
import { Badge } from '@/ui/badge'
import { Button } from '@/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/ui/avatar'
import { cn } from '@/utils/styles'
import { toUserInitial } from '@/utils/converters'
import { ShareIcon, CheckIcon, RemoveIcon, TrashFillIcon, UserIcon } from '@/components/icons'
import type { StashInvitation, StashInvitationRecipient } from '@/types/stash.types'

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export async function loader({ request }: Route.LoaderArgs) {
    const session = await auth.api.getSession({
    headers: request.headers,
  })
  if (!session) throw redirect('/auth/sign-in')

  const [received, sent] = await Promise.all([
    listReceivedInvitations(session.user.email),
    listSentInvitations(session.user.id),
  ])

  return { received, sent, userEmail: session.user.email }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  accepted: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  canceled: 'bg-muted text-muted-foreground',
  expired: 'bg-muted text-muted-foreground',
}

// ---------------------------------------------------------------------------
// Received invitation card — shows the recipient entry matching the user
// ---------------------------------------------------------------------------

function ReceivedInvitationCard({
  invitation,
  recipient,
}: {
  invitation: StashInvitation
  recipient: StashInvitationRecipient
}) {
  const fetcher = useFetcher()
  const isPending = fetcher.state !== 'idle'

  const itemName = invitation.item?.name
  const workspaceName = invitation.workspace?.name
  const context = itemName ? `Item: ${itemName}` : workspaceName ? `Workspace: ${workspaceName}` : null

  return (
    <div className="flex items-center gap-4 rounded-lg border border-border bg-card px-4 py-3">
      <Avatar className="size-8 shrink-0">
        <AvatarImage src={invitation.sender.image ?? undefined} />
        <AvatarFallback className="text-xs">
          {toUserInitial(invitation.sender.name)}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          From {invitation.sender.name}
        </p>
        {context && (
          <p className="text-xs text-muted-foreground truncate">{context}</p>
        )}
        <p className="text-xs text-muted-foreground capitalize">{recipient.role} access</p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <span
          className={cn(
            'text-xs px-2 py-0.5 rounded-full font-medium capitalize',
            statusColors[recipient.status] ?? statusColors.pending
          )}
        >
          {recipient.status}
        </span>

        {recipient.status === 'pending' && (
          <>
            <fetcher.Form method="post" action="/api/invitations">
              <input type="hidden" name="intent" value="accept_invitation" />
              <input type="hidden" name="recipientId" value={recipient.id} />
              <Button size="sm" variant="default" disabled={isPending} type="submit">
                <CheckIcon className="size-3.5 mr-1" />
                Accept
              </Button>
            </fetcher.Form>
            <fetcher.Form method="post" action="/api/invitations">
              <input type="hidden" name="intent" value="reject_invitation" />
              <input type="hidden" name="recipientId" value={recipient.id} />
              <Button size="sm" variant="outline" disabled={isPending} type="submit">
                <RemoveIcon className="size-3.5 mr-1" />
                Decline
              </Button>
            </fetcher.Form>
          </>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sent invitation card — shows all recipients in the batch
// ---------------------------------------------------------------------------

function SentInvitationCard({ invitation }: { invitation: StashInvitation }) {
  const fetcher = useFetcher()
  const isPending = fetcher.state !== 'idle'

  const itemName = invitation.item?.name
  const workspaceName = invitation.workspace?.name
  const context = itemName ? `Item: ${itemName}` : workspaceName ? `Workspace: ${workspaceName}` : null
  const hasPending = invitation.recipients.some((r) => r.status === 'pending')

  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3 space-y-2">
      <div className="flex items-center justify-between">
        <div>
          {context && (
            <p className="text-sm font-medium truncate">{context}</p>
          )}
          <p className="text-xs text-muted-foreground">
            {new Date(invitation.createdAt).toLocaleDateString()}
            {' · '}
            {invitation.recipients.length} recipient{invitation.recipients.length !== 1 ? 's' : ''}
          </p>
        </div>
        {hasPending && (
          <fetcher.Form method="post" action="/api/invitations">
            <input type="hidden" name="intent" value="cancel_invitation" />
            <input type="hidden" name="invitationId" value={invitation.id} />
            <Button size="sm" variant="ghost" disabled={isPending} type="submit">
              <TrashFillIcon className="size-3.5 mr-1" />
              Cancel all
            </Button>
          </fetcher.Form>
        )}
      </div>

      {invitation.recipients.map((recipient) => (
        <div
          key={recipient.id}
          className="flex items-center gap-3 rounded-md bg-muted/50 px-3 py-2"
        >
          <div className="size-7 shrink-0 rounded-full bg-muted flex items-center justify-center">
            <UserIcon className="size-3.5 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">{recipient.email}</p>
            <p className="text-xs text-muted-foreground capitalize">{recipient.role} access</p>
          </div>
          <span
            className={cn(
              'text-xs px-2 py-0.5 rounded-full font-medium capitalize shrink-0',
              statusColors[recipient.status] ?? statusColors.pending
            )}
          >
            {recipient.status}
          </span>
        </div>
      ))}
    </div>
  )
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4 text-muted-foreground">
      <ShareIcon className="size-12 opacity-30" />
      <p className="text-sm font-stashly">{label}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function InvitationsPage({ loaderData }: Route.ComponentProps) {
  const { received, sent, userEmail } = loaderData

  // Count pending recipients for the current user across all received invitations
  const pendingCount = received.reduce(
    (count, inv) =>
      count +
      inv.recipients.filter(
        (r) => r.email === userEmail && r.status === 'pending'
      ).length,
    0
  )

  return (
    <div className="flex flex-col gap-4 p-4 max-w-2xl mx-auto w-full">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold font-stashly">Invitations</h1>
        {pendingCount > 0 && (
          <Badge variant="secondary">{pendingCount} pending</Badge>
        )}
      </div>

      <Tabs defaultValue="received">
        <TabsList className="w-full">
          <TabsTrigger value="received" className="flex-1">
            Received
            {pendingCount > 0 && (
              <span className="ml-1.5 rounded-full bg-primary/20 text-primary px-1.5 py-0.5 text-xs font-medium">
                {pendingCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="sent" className="flex-1">
            Sent
          </TabsTrigger>
        </TabsList>

        <TabsContent value="received" className="flex flex-col gap-2 mt-4">
          {received.length === 0 ? (
            <EmptyState label="No invitations received yet" />
          ) : (
            received.map((invitation) => {
              const myRecipient = invitation.recipients.find(
                (r) => r.email === userEmail
              )
              if (!myRecipient) return null
              return (
                <ReceivedInvitationCard
                  key={`${invitation.id}-${myRecipient.id}`}
                  invitation={invitation as StashInvitation}
                  recipient={myRecipient}
                />
              )
            })
          )}
        </TabsContent>

        <TabsContent value="sent" className="flex flex-col gap-2 mt-4">
          {sent.length === 0 ? (
            <EmptyState label="No invitations sent yet" />
          ) : (
            sent.map((invitation) => (
              <SentInvitationCard
                key={invitation.id}
                invitation={invitation as StashInvitation}
              />
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
