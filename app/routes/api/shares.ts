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
  updateShareLink,
} from '@/services/share-actions'
import { toErrorInfo } from '@/utils/api.errors'
import { prisma } from '@/services/db'

// ---------------------------------------------------------------------------
// Loader — GET /api/shares?itemId=xxx
// Returns all share links for an item with permission details.
// Only accessible to the item owner or users with write permission.
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

  // Validate the user has access to manage this item's links
  // (must be the owner or have an explicit write-level permission)
  const item = await prisma.item.findUnique({
    where: { id: itemId },
    select: { ownerId: true },
  })

  if (!item) {
    return data({ error: 'Item not found' }, { status: 404 })
  }

  const isOwner = item.ownerId === session.user.id
  if (!isOwner) {
    const writePermission = await prisma.permission.findFirst({
      where: {
        itemId,
        users: { some: { id: session.user.id } },
        roles: { in: ['write', 'owner'] },
        deletedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    })
    if (!writePermission) {
      return data({ error: 'Access denied' }, { status: 403 })
    }
  }

  try {
    const links = await prisma.shareLink.findMany({
      where: { permission: { some: { itemId } } },
      include: {
        permission: {
          include: {
            users: {
              select: { id: true, email: true, name: true, image: true },
            },
          },
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
    const session = await auth.api.getSession({
    headers: request.headers,
  })
  if (!session) throw redirect('/auth/sign-in')

  const parsedData = await parseFormData({
    request,
    schema: sharesApiRouteInput,
  })

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
        const link = await createUploadLink(
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
          parsedData.linkId,
          parsedData.scope
        )
        return data({ success: true, link })
      }

      case 'update_link_type': {
        const link = await updateShareLinkType(
          parsedData.linkId,
          parsedData.type
        )
        return data({ success: true, link })
      }

      case 'expire_link': {
        const link = await expireShareLink(
          parsedData.linkId,
          parsedData.expiresAt
        )
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

      case 'update_link_password': {
        const link = await updateShareLink({
          where: { id: parsedData.linkId },
          data: { password: parsedData.password },
        })
        return data({ success: true, link })
      }

      case 'revoke_link': {
        await revokeShareLink(parsedData.linkId)
        return data({ success: true })
      }

      case 'revoke_all_links': {
        await revokeAllShareLinksForItem(parsedData.itemId)
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
