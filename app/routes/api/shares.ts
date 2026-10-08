import { auth } from '@/services/auth'
import { parseFormData, parseSearchParams } from '@/utils/parsers'
import { redirect, data } from 'react-router'
import type { Route } from './+types/shares'
import { sharesApiRouteInput, sharesLoaderInput } from '@/schemas/api.schemas'
import {
  createViewLink,
  createEditLink,
  createEmbedLink,
  createUploadLink,
  updateShareLinkScope,
  updateShareLinkType,
  expireShareLink,
  revokeShareLink,
  revokeAllShareLinksForItem,
  updateShareLinkSettings,
  listShareLinksForItem,
} from '@/services/share-actions'
import { toErrorInfo } from '@/utils/api.errors'

// ---------------------------------------------------------------------------
// Loader — GET /api/shares?itemId=xxx
// Returns all share links for an item with permission details.
// Only the item owner or a user with a live write permission may list them;
// `listShareLinksForItem` enforces that and throws 404/403.
// ---------------------------------------------------------------------------

export async function loader({ request }: Route.LoaderArgs) {
    const session = await auth.api.getSession({
    headers: request.headers,
  })
  if (!session) throw redirect('/auth/sign-in')

  const { itemId } = parseSearchParams({
    request,
    schema: sharesLoaderInput,
  })

  try {
    const links = await listShareLinksForItem(session.user.id, itemId)
    return data({ links })
  } catch (e) {
    const err = toErrorInfo(e)
    if (err.status && err.status < 500) {
      return data({ error: err.message ?? 'Error' }, { status: err.status })
    }
    console.error('[shares loader]', e)
    return data({ error: 'Failed to load share links' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// Action — POST /api/shares
// Intent-based handler for all share link mutations. Each action is given the
// session user and checks itself that they may manage the item's links.
// ---------------------------------------------------------------------------

export async function action({ request }: Route.ActionArgs) {
    const session = await auth.api.getSession({
    headers: request.headers,
  })
  if (!session) throw redirect('/auth/sign-in')

  const parsedData = await parseFormData({
    request,
    schema: sharesApiRouteInput,
  })
  const actorId = session.user.id

  try {
    switch (parsedData.intent) {
      case 'create_view_link': {
        const link = await createViewLink(actorId, parsedData.itemId, parsedData.scope, {
          downloadable: parsedData.downloadable,
          password: parsedData.password,
          expiresAt: parsedData.expiresAt,
        })
        return data({ success: true, link })
      }

      case 'create_edit_link': {
        const link = await createEditLink(actorId, parsedData.itemId, parsedData.scope, {
          password: parsedData.password,
          expiresAt: parsedData.expiresAt,
        })
        return data({ success: true, link })
      }

      case 'create_embed_link': {
        const link = await createEmbedLink(actorId, parsedData.itemId, {
          password: parsedData.password,
          expiresAt: parsedData.expiresAt,
        })
        return data({ success: true, link })
      }

      case 'create_upload_link': {
        const link = await createUploadLink(
          actorId,
          parsedData.itemId,
          parsedData.scope,
          {
            password: parsedData.password,
            expiresAt: parsedData.expiresAt,
          }
        )
        return data({ success: true, link })
      }

      case 'update_link_scope': {
        const link = await updateShareLinkScope(
          actorId,
          parsedData.linkId,
          parsedData.scope
        )
        return data({ success: true, link })
      }

      case 'update_link_type': {
        const link = await updateShareLinkType(
          actorId,
          parsedData.linkId,
          parsedData.type
        )
        return data({ success: true, link })
      }

      case 'expire_link': {
        const link = await expireShareLink(
          actorId,
          parsedData.linkId,
          parsedData.expiresAt
        )
        return data({ success: true, link })
      }

      case 'remove_link_expiry': {
        const link = await updateShareLinkSettings(actorId, parsedData.linkId, {
          expiresAt: null,
        })
        return data({ success: true, link })
      }

      case 'update_link_downloadable': {
        const link = await updateShareLinkSettings(actorId, parsedData.linkId, {
          downloadable: parsedData.downloadable,
        })
        return data({ success: true, link })
      }

      case 'update_link_password': {
        const link = await updateShareLinkSettings(actorId, parsedData.linkId, {
          password: parsedData.password,
        })
        return data({ success: true, link })
      }

      case 'revoke_link': {
        await revokeShareLink(actorId, parsedData.linkId)
        return data({ success: true })
      }

      case 'revoke_all_links': {
        await revokeAllShareLinksForItem(actorId, parsedData.itemId)
        return data({ success: true })
      }

      default: {
        return data(
          { success: false, error: 'Unknown intent' },
          { status: 400 }
        )
      }
    }
  } catch (e) {
    const err = toErrorInfo(e)
    if (err.status) {
      return data(
        { success: false, error: err.message ?? 'Error' },
        { status: err.status }
      )
    }
    console.error('[shares action]', e)
    return data(
      { success: false, error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
