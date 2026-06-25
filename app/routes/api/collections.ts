import { data, redirect } from 'react-router'
import {
  createCollection,
  createWorkspaceCollection,
  renameCollection,
  trashCollection,
  clearCollection,
  deleteCollection,
  restoreCollection,
  addItemsToCollection,
  removeItemFromCollection,
  removeItemsFromCollection,
} from '../../.server/collection-actions'
import { auth } from '@/services/auth'
import type { Route } from './+types/collections'
import { parseFormData, parseSearchParams } from '../../utils/parsers'
import {
  addItemsToCollectionInput,
  collectionsApiRouteInput,
} from '../../schemas'
import { paginateItems } from '@/.server/item-actions'
import {
  buildItemFilters,
  itemFilterSchema,
} from '@/utils/filters/item.filters'

export async function loader({ request, params }: Route.LoaderArgs) {
    const session = await auth.api.getSession({
    headers: request.headers,
  })
  if (!session) throw redirect('/auth/signin')

  let searchParams = new URL(request.url).searchParams
  searchParams.set('currentUserId', session.user.id)
  if(params.collectionId) {
    searchParams.set('collectionId', params.collectionId)
  }

  let parsedParams = parseSearchParams({
    schema: itemFilterSchema,
    searchParams,
  })

  let filters = buildItemFilters(parsedParams)

  let allItems = await paginateItems({
    limit: parsedParams.take,
    cursor: parsedParams.cursor,
    where: {
      ...filters,
      ownerId: session.user.id,
      status: 'normal',
      type: { not: 'collection' },
    },
    orderBy: { createdAt: 'desc' },
    include: {
      thumbnails: {
        select: {
          height: true,
          width: true,
          url: true,
          size: true,
          id: true,
          stage: true,
        },
      },
    },
  })

  // Map to lightweight shape for the picker
  const availableItems = allItems.items.map((item) => ({
    id: item.id,
    name: item.name,
    type: item.type,
    category: item.category,
    size: item.size,
    createdAt: item.createdAt,
    thumbnailUrl:
      item.thumbnails?.find((t) => t.url && !t.url.startsWith('#'))?.url ??
      null,
  }))

  return data({
    items: availableItems,
    nextCursor: allItems.nextCursor,
    hasMore: allItems.hasMore,
  })
}

export async function action({ request, params }: Route.ActionArgs) {
    const session = await auth.api.getSession({
    headers: request.headers,
  })
  if (!session) throw redirect('/auth/signin')

  const formData = await parseFormData({
    request,
    schema: collectionsApiRouteInput,
  })

  let referer = request.headers.get('referer')
  let url = new URL(referer || request.url)
  if (formData.intent === 'create_collection') {
    const driveId = formData.driveId ?? (session.user as any).driveId
    const { workspaceId, ...rest } = formData
    if (workspaceId) {
      await createWorkspaceCollection({
        ...rest,
        driveId,
        workspaceId,
        ownerId: session.user.id,
      })
    } else {
      await createCollection({ ...rest, driveId, ownerId: session.user.id })
    }
    return redirect(`${url.pathname}${url.search}`)
  }

  if (formData.intent === 'rename_collection') {
    let { intent, ...rest } = formData
    let res = await renameCollection({ ...rest, userId: session.user.id })
    console.log('rename', res)
    return redirect(`${url.pathname}${url.search}`)
    // return null
  }

  if (formData.intent === 'trash_collection') {
    let { intent, ...rest } = formData
    await trashCollection({ ...rest, userId: session.user.id })
    return redirect(`${url.pathname}${url.search}`)
  }

  if (formData.intent === 'clear_collection') {
    let { intent, ...rest } = formData
    await clearCollection({ ...rest, userId: session.user.id })
    return redirect(`${url.pathname}${url.search}`)
  }

  if (formData.intent === 'delete_collection') {
    let { intent, ...rest } = formData
    await deleteCollection({ ...rest, userId: session.user.id })
    return redirect(`${url.pathname}${url.search}`)
  }

  if (formData.intent === 'restore_collection') {
    let { intent, ...rest } = formData
    await restoreCollection({ ...rest, userId: session.user.id })
    return redirect(`${url.pathname}${url.search}`)
  }

  if (formData.intent === 'add_items_to_collection') {
    let { intent, ...rest } = formData
    await addItemsToCollection({ ...rest, userId: session.user.id })
    return redirect(`${url.pathname}${url.search}`, { status: 303 })
  }

  if (formData.intent === 'remove_item_from_collection') {
    let { intent, ...rest } = formData
    await removeItemFromCollection({ ...rest, userId: session.user.id })
    return redirect(`${url.pathname}${url.search}`)
  }

  if (formData.intent === 'remove_items_from_collection') {
    let { intent, ...rest } = formData
    await removeItemsFromCollection({ ...rest, userId: session.user.id })
    return redirect(`${url.pathname}${url.search}`)
  }

  return data({ error: 'Invalid intent' }, { status: 400 })
}
