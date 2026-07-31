import { InvitationsView } from '@/components/views/invitations-view';
import { auth } from '@/services/auth';
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

export async function loader({ request }: Route.LoaderArgs) {
  const session = await auth.api.getSession({
    headers: request.headers,
  })
  if (!session) throw redirect('/auth/sign-in')

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
