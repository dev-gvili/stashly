import {
    invitationsApiRouteInput,
    invitationsLoaderInput,
} from '@/schemas/api.schemas';
import { auth } from '@/services/auth';
import {
    acceptInvitation,
    cancelInvitation,
    cancelInvitationRecipient,
    listItemInvitations,
    listReceivedInvitations,
    listSentInvitations,
    rejectInvitation,
    sendItemInvitation,
    sendWorkspaceInvitation,
    undoInvitationResponse,
} from '@/services/invitation-actions';
import { parseFormData, parseSearchParams } from '@/utils/parsers';
import { data, redirect } from 'react-router';
import type { Route } from './+types/invitations';

// ---------------------------------------------------------------------------
// Loader — GET /api/invitations?type=sent|received[&itemId=xxx]
// ---------------------------------------------------------------------------

export async function loader({ request }: Route.LoaderArgs) {
    const session = await auth.api.getSession({
    headers: request.headers,
  })
  if (!session) throw redirect('/auth/sign-in')

  const { type, itemId } = parseSearchParams({
    request,
    schema: invitationsLoaderInput,
  })

  try {
    if (itemId) {
      const invitations = await listItemInvitations(itemId)
      return data({ invitations })
    }

    const invitations =
      type === 'sent'
        ? await listSentInvitations(session.user.id)
        : await listReceivedInvitations(session.user.email)

    return data({ invitations })
  } catch (e) {
    console.error('[invitations loader]', e)
    return data({ error: 'Failed to load invitations' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// Action — POST /api/invitations
// ---------------------------------------------------------------------------

export async function action({ request }: Route.ActionArgs) {
    const session = await auth.api.getSession({
    headers: request.headers,
  })
  if (!session) throw redirect('/auth/sign-in')

  const parsedData = await parseFormData({
    request,
    schema: invitationsApiRouteInput,
  })

  try {
    switch (parsedData.intent) {
      case 'send_item_invitation': {
        const invitation = await sendItemInvitation(
          session.user.id,
          parsedData.itemId,
          parsedData.recipients,
          { expiresAt: parsedData.expiresAt, message: parsedData.message }
        )
        return data({ success: true, invitation })
      }

      case 'send_workspace_invitation': {
        const invitation = await sendWorkspaceInvitation(
          session.user.id,
          parsedData.workspaceId,
          parsedData.recipients,
          { expiresAt: parsedData.expiresAt, message: parsedData.message }
        )
        return data({ success: true, invitation })
      }

      case 'accept_invitation': {
        const invitation = await acceptInvitation(
          parsedData.recipientId,
          session.user.id,
          session.user.email
        )
        return data({ success: true, invitation })
      }

      case 'reject_invitation': {
        const invitation = await rejectInvitation(
          parsedData.recipientId,
          session.user.id,
          session.user.email
        )
        return data({ success: true, invitation })
      }

      case 'undo_invitation_response': {
        const invitation = await undoInvitationResponse(
          parsedData.recipientId,
          session.user.id,
          session.user.email
        )
        return data({ success: true, invitation })
      }

      case 'cancel_recipient': {
        const invitation = await cancelInvitationRecipient(
          parsedData.recipientId,
          session.user.id
        )
        return data({ success: true, invitation })
      }

      case 'cancel_invitation': {
        const invitation = await cancelInvitation(
          parsedData.invitationId,
          session.user.id
        )
        return data({ success: true, invitation })
      }

      default: {
        return data(
          { success: false, error: 'Unknown intent' },
          { status: 400 }
        )
      }
    }
  } catch (e) {
    const err = e as { statusCode?: number; message?: string }
    if (err?.statusCode) {
      return data(
        { success: false, error: err.message ?? 'Error' },
        { status: err.statusCode }
      )
    }
    console.error('[invitations action]', e)
    return data(
      { success: false, error: `An unexpected error occurred: ${e}` },
      { status: 500 }
    )
  }
}
