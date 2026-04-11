import { auth } from '@/services/auth'
import { parseFormData } from '@/utils/parsers'
import { redirect, data } from 'react-router'
import type { Route } from './+types/shares'
import { sharesApiRouteInput } from '@/schemas/api.schemas'
import {
  createViewLink,
  createEditLink,
  createEmbedLink,
  createUploadLink,
  findShareLinksForItem,
  updateShareLinkScope,
  updateShareLinkType,
  expireShareLink,
  deleteShareLink,
  revokeAllShareLinksForItem,
  updateShareLink,
} from '@/services/share-actions'
import { getLinkPermissions } from '@/services/permission-actions'
import { prisma } from '@/services/db'

// ---------------------------------------------------------------------------
// Loader — GET /api/shares?itemId=xxx
// Returns all share links for an item with permission details.
// ---------------------------------------------------------------------------

export async function loader({ request }: Route.LoaderArgs) {
  const session = await auth.api.getSession(request)
  if (!session) throw redirect('/auth/sign-in')

  const itemId = new URL(request.url).searchParams.get('itemId')
  if (!itemId) {
    return data({ error: 'itemId is required' }, { status: 400 })
  }

  try {
    const links = await prisma.shareLink.findMany({
      where: { permission: { some: { itemId } } },
      include: {
        permission: {
          include: { users: { select: { id: true, name: true, image: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return data({ links })
  } catch (e) {
    console.error('[shares loader]', e)
    return data({ error: 'Failed to load share links' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// Action — POST /api/shares
// Intent-based handler for all share link mutations.
// ---------------------------------------------------------------------------

export async function action({ request }: Route.ActionArgs) {
  const session = await auth.api.getSession(request)
  if (!session) throw redirect('/auth/sign-in')

  let parsedData: Awaited<ReturnType<typeof parseFormData<typeof sharesApiRouteInput>>>
  try {
    parsedData = await parseFormData({ request, schema: sharesApiRouteInput })
  } catch (e) {
    return data({ success: false, error: 'Invalid input' }, { status: 400 })
  }

  try {
    switch (parsedData.intent) {
      case 'create_view_link': {
        const link = await createViewLink(parsedData.itemId, parsedData.scope, {
          downloadable: parsedData.downloadable,
          password: parsedData.password,
          expiresAt: parsedData.expiresAt,
        })
        return data({ success: true, link })
      }

      case 'create_edit_link': {
        const link = await createEditLink(parsedData.itemId, parsedData.scope, {
          password: parsedData.password,
          expiresAt: parsedData.expiresAt,
        })
        return data({ success: true, link })
      }

      case 'create_embed_link': {
        const link = await createEmbedLink(parsedData.itemId, {
          password: parsedData.password,
          expiresAt: parsedData.expiresAt,
        })
        return data({ success: true, link })
      }

      case 'create_upload_link': {
        const link = await createUploadLink(parsedData.itemId, parsedData.scope, {
          password: parsedData.password,
          expiresAt: parsedData.expiresAt,
        })
        return data({ success: true, link })
      }

      case 'update_link_scope': {
        const link = await updateShareLinkScope(parsedData.linkId, parsedData.scope)
        return data({ success: true, link })
      }

      case 'update_link_type': {
        const link = await updateShareLinkType(parsedData.linkId, parsedData.type)
        return data({ success: true, link })
      }

      case 'expire_link': {
        const link = await expireShareLink(parsedData.linkId, parsedData.expiresAt)
        return data({ success: true, link })
      }

      case 'remove_link_expiry': {
        const link = await updateShareLink({
          where: { id: parsedData.linkId },
          data: { expiresAt: null },
        })
        return data({ success: true, link })
      }

      case 'update_link_downloadable': {
        const link = await updateShareLink({
          where: { id: parsedData.linkId },
          data: { downloadable: parsedData.downloadable },
        })
        return data({ success: true, link })
      }

      case 'revoke_link': {
        // Delete permission records first, then the link
        const permissions = await getLinkPermissions(parsedData.linkId)
        for (const perm of permissions) {
          await prisma.permission.delete({ where: { id: perm.id } })
        }
        await deleteShareLink(parsedData.linkId)
        return data({ success: true })
      }

      case 'revoke_all_links': {
        await revokeAllShareLinksForItem(parsedData.itemId)
        return data({ success: true })
      }

      default: {
        return data({ success: false, error: 'Unknown intent' }, { status: 400 })
      }
    }
  } catch (e) {
    const err = e as { statusCode?: number; message?: string }
    if (err?.statusCode) {
      return data({ success: false, error: err.message ?? 'Error' }, { status: err.statusCode })
    }
    console.error('[shares action]', e)
    return data({ success: false, error: 'An unexpected error occurred' }, { status: 500 })
  }
}
