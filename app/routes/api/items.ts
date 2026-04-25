import { auth } from '@/services/auth'
import { toZodArraySchema } from '@/utils/converters'
import {
  createUploadedItem,
  upsertImageFacet,
  upsertVideoFacet,
  deleteItem,
  deleteItems,
  moveItem,
  moveItems,
  restoreItem,
  restoreItems,
  trashItem,
  trashItems,
} from '@/services/item-actions'
import { parseFormData } from '@/utils/parsers'
import { removeQueryParam, removeQueryParamValue } from '@/utils/query-params'
import { data, redirect } from 'react-router'
import type { Route } from './+types/items'
import { itemsApiRouteInput } from '@/schemas/api.schemas'
import { z } from 'zod'

export async function loader({ request, params }: Route.LoaderArgs) {
  // TODO: implement loader logic
  return null
}

export async function action({ request, params }: Route.ActionArgs) {
  let session = await auth.api.getSession(request)
  if (!session) throw redirect('/auth/sign-in')
  let { user } = session

  let parsedData = await parseFormData({ request, schema: itemsApiRouteInput })
  let referer = request.headers.get('referer')
  let url = new URL(referer || request.url)
  let searchParams = url.searchParams

  switch (parsedData.intent) {
    case 'trash_item': {
      try {
        await trashItem(parsedData.selectedItem)
        return redirect(`${url.pathname}${url.search}`)
      } catch (e) {
        console.error(e)
        return { success: false, error: e }
      }
    }
    case 'restore_item': {
      try {
        await restoreItem(parsedData.selectedItem)
        searchParams = removeQueryParamValue(
          searchParams,
          'selectedItems',
          parsedData.selectedItem
        )
        return redirect(`${url.pathname}?${searchParams.toString()}`)
      } catch (e) {
        console.error(e)
        return { success: false, error: e }
      }
    }
    case 'delete_item':
      try {
        await deleteItem(parsedData.selectedItem)
        searchParams = removeQueryParamValue(
          searchParams,
          'selectedItems',
          parsedData.selectedItem
        )
        return redirect(`${url.pathname}${url.search}`)
      } catch (e) {
        console.error(e)
        return { success: false, error: e }
      }
    case 'trash_items':
      try {
        await trashItems(parsedData.selectedItems)
        return redirect(`${url.pathname}${url.search}`)
      } catch (e) {
        console.error(e)
        return { success: false, error: e }
      }
    case 'move_items':
      try {
        await moveItems(parsedData.selectedItems, parsedData.targetFolderId)
        searchParams = removeQueryParam(searchParams, 'selectedItems')
        return redirect(`${url.pathname}?${searchParams.toString()}`)
      } catch (e) {
        console.error(e)
        return { success: false, error: e }
      }
    case 'restore_items':
      try {
        await restoreItems(parsedData.selectedItems)
        searchParams = removeQueryParam(searchParams, 'selectedItems')
        return redirect(`${url.pathname}?${searchParams.toString()}`)
      } catch (e) {
        console.error(e)
        return { success: false, error: e }
      }
    case 'delete_items':
      try {
        await deleteItems(parsedData.selectedItems)
        searchParams = removeQueryParam(searchParams, 'selectedItems')
        return redirect(`${url.pathname}${url.search}`)
      } catch (e) {
        console.error(e)
        return { success: false, error: e }
      }
    case 'move_item':
      try {
        await moveItem(parsedData.selectedItem, parsedData.targetFolderId)
        searchParams = removeQueryParam(searchParams, 'selectedItem')
        return redirect(`${url.pathname}?${searchParams.toString()}`)
      } catch (e) {
        console.error(e)
        return { success: false, error: e }
      }
    case 'create_upload_item': {
      try {
        const item = await createUploadedItem({
          id: parsedData.id,
          name: parsedData.name,
          key: parsedData.key,
          size: parsedData.size,
          mimeType: parsedData.mimeType,
          etag: parsedData.etag,
          bucket: parsedData.bucket,
          driveId: parsedData.driveId,
          parentId: parsedData.parentId,
          ownerId: parsedData.ownerId,
          category: parsedData.category,
        })
        const serializable = z
          .object({ size: z.coerce.string(), inclusiveSize: z.coerce.string() })
          .loose()
          .parse(item)
        return data({ success: true, item: serializable })
      } catch (e) {
        const err = e as { message?: string }
        return { success: false, error: err.message }
      }
    }
    case 'save_media_metadata': {
      try {
        const { itemId, imageWidth, imageHeight, cameraMake, cameraModel, iso, fNumber, exposureTime, focalLength, takenDateTime, latitude, longitude, videoWidth, videoHeight, duration, frameRate } = parsedData
        if (imageWidth != null || imageHeight != null) {
          await upsertImageFacet(itemId, { width: imageWidth, height: imageHeight, cameraMake, cameraModel, iso, fNumber, exposureTime, focalLength, takenDateTime, latitude, longitude })
        } else if (videoWidth != null || videoHeight != null || duration != null) {
          await upsertVideoFacet(itemId, { width: videoWidth, height: videoHeight, duration, frameRate })
        }
        return data({ success: true })
      } catch (e) {
        const err = e as { message?: string }
        return { success: false, error: err.message }
      }
    }
    default:
      break
  }
}
