import { sessionContext } from '@/.server/middleware/context'
import { InvitationsView } from '@/components/views/invitations-view';
import {
    listReceivedInvitations,
    listSentInvitations,
    listShareTargets,
} from '@/services/invitation-actions';
import type { StashInvitation } from '@/types/stash.types';
import { redirect } from 'react-router';
import type { Route } from './+types/invitations';

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export async function loader({ request, context }: Route.LoaderArgs) {
  const session = context.get(sessionContext)

  const [received, sent, targets] = await Promise.all([
    listReceivedInvitations(session.user.email),
    listSentInvitations(session.user.id),
    listShareTargets(session.user.id),
  ])

  return { received, sent, targets, userEmail: session.user.email }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function InvitationsPage({ loaderData }: Route.ComponentProps) {
  const { received, sent, targets, userEmail } = loaderData

  return (
    <InvitationsView
      received={received as StashInvitation[]}
      sent={sent as StashInvitation[]}
      targets={targets}
      userEmail={userEmail}
    />
  )
}
