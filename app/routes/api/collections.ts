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
} from '../../.server/collection-actions'
import { auth } from '@/services/auth'
import type { Route } from './+types/collections'
import { parseFormData, parseSearchParams } from '../../utils/parsers'
import { collectionsApiRouteInput } from '../../schemas'

export async function loader({ request, params }: Route.LoaderArgs) {
  // TODO: implement loader logic
  return null
}

export async function action({ request }: Route.ActionArgs) {
  const session = await auth.api.getSession(request)
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
      await createWorkspaceCollection({ ...rest, driveId, workspaceId, ownerId: session.user.id })
    } else {
      await createCollection({ ...rest, driveId, ownerId: session.user.id })
    }
    return redirect(`${url.pathname}${url.search}`)
  }

  if (formData.intent === 'rename_collection') {
    let { intent, ...rest } = formData
    let res =  await renameCollection({ ...rest, userId: session.user.id })
    console.log("rename", res)
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
    return redirect(`${url.pathname}${url.search}`)
  }

  if (formData.intent === 'remove_item') {
    await removeItemFromCollection(session.user.id, formData.collectionId, formData.itemId)
    return redirect(`${url.pathname}${url.search}`)
  }

  // if (formData.intent === 'remove_items_from_collection') {
  //   let { intent, ...rest } = formData
  //   await removeItemsFromCollection({ ...rest, userId: session.user.id })
  //   return redirect(`${url.pathname}${url.search}`)
  // }


  return data({ error: 'Invalid intent' }, { status: 400 })
}
