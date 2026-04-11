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
import { ShareIcon, CheckIcon, RemoveIcon, DeleteIcon, UserIcon } from '@/components/icons'
import type { StashInvitation } from '@/types/stash.types'

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export async function loader({ request }: Route.LoaderArgs) {
  const session = await auth.api.getSession(request)
  if (!session) throw redirect('/auth/sign-in')

  const [received, sent] = await Promise.all([
    listReceivedInvitations(session.user.email),
    listSentInvitations(session.user.id),
  ])

  return { received, sent }
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

function InvitationCard({
  invitation,
  mode,
}: {
  invitation: StashInvitation
  mode: 'received' | 'sent'
}) {
  const fetcher = useFetcher()
  const isPending = fetcher.state !== 'idle'

  const itemName = invitation.permission?.item?.name
  const workspaceName = invitation.workspace?.name
  const context = itemName ? `Item: ${itemName}` : workspaceName ? `Workspace: ${workspaceName}` : null
  const roleLabel = invitation.permission?.roles ?? invitation.role ?? null

  return (
    <div className="flex items-center gap-4 rounded-lg border border-border bg-card px-4 py-3">
      <Avatar className="size-8 shrink-0">
        {mode === 'received' ? (
          <>
            <AvatarImage src={invitation.sender.image ?? undefined} />
            <AvatarFallback className="text-xs">
              {toUserInitial(invitation.sender.name)}
            </AvatarFallback>
          </>
        ) : (
          <AvatarFallback className="text-xs bg-muted">
            <UserIcon className="size-4 text-muted-foreground" />
          </AvatarFallback>
        )}
      </Avatar>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          {mode === 'received'
            ? `From ${invitation.sender.name}`
            : `To ${invitation.email}`}
        </p>
        {context && (
          <p className="text-xs text-muted-foreground truncate">{context}</p>
        )}
        {roleLabel && (
          <p className="text-xs text-muted-foreground capitalize">{roleLabel} access</p>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <span
          className={cn(
            'text-xs px-2 py-0.5 rounded-full font-medium capitalize',
            statusColors[invitation.status] ?? statusColors.pending
          )}
        >
          {invitation.status}
        </span>

        {mode === 'received' && invitation.status === 'pending' && (
          <>
            <fetcher.Form method="post" action="/api/invitations">
              <input type="hidden" name="intent" value="accept_invitation" />
              <input type="hidden" name="invitationId" value={invitation.id} />
              <Button size="sm" variant="default" disabled={isPending} type="submit">
                <CheckIcon className="size-3.5 mr-1" />
                Accept
              </Button>
            </fetcher.Form>
            <fetcher.Form method="post" action="/api/invitations">
              <input type="hidden" name="intent" value="reject_invitation" />
              <input type="hidden" name="invitationId" value={invitation.id} />
              <Button size="sm" variant="outline" disabled={isPending} type="submit">
                <RemoveIcon className="size-3.5 mr-1" />
                Decline
              </Button>
            </fetcher.Form>
          </>
        )}

        {mode === 'sent' && invitation.status === 'pending' && (
          <fetcher.Form method="post" action="/api/invitations">
            <input type="hidden" name="intent" value="cancel_invitation" />
            <input type="hidden" name="invitationId" value={invitation.id} />
            <Button size="sm" variant="ghost" disabled={isPending} type="submit">
              <DeleteIcon className="size-3.5 mr-1" />
              Cancel
            </Button>
          </fetcher.Form>
        )}
      </div>
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
  const { received, sent } = loaderData

  const pendingCount = received.filter((i) => i.status === 'pending').length

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
            received.map((invitation) => (
              <InvitationCard key={invitation.id} invitation={invitation as StashInvitation} mode="received" />
            ))
          )}
        </TabsContent>

        <TabsContent value="sent" className="flex flex-col gap-2 mt-4">
          {sent.length === 0 ? (
            <EmptyState label="No invitations sent yet" />
          ) : (
            sent.map((invitation) => (
              <InvitationCard key={invitation.id} invitation={invitation as StashInvitation} mode="sent" />
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
