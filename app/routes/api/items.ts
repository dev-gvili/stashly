import { itemsApiRouteInput } from '@/schemas/api.schemas'
import { authMiddleware } from '@/services/middleware/auth'
import { sessionContext } from '@/services/middleware/context'
import { track } from '@/services/vinktar'
import { log } from '@/services/log'
import { headUploadedObject } from '@/services/s3'
import {
  createFolder,
  createUploadedItem,
  deleteItem,
  discardUploadedObject,
  deleteItems,
  getChildFolders,
  moveItem,
  moveItems,
  renameItem,
  resolveUploadFolders,
  restoreItem,
  restoreItems,
  searchFolders,
  trashItem,
  trashItems,
} from '@/services/item-actions'
import {
  appendSearchPage,
  findReindexCandidates,
  findUnembeddedChunks,
  reindexTextItems,
  saveMediaMetadata,
  setSearchChunkVectors,
} from '@/services/search-actions'
import { toErrorInfo } from '@/utils/api.errors'
import { toTrashRedirectUrl } from '@/utils/trash-urls'
import { clampPendingLimit } from '@/utils/embedding-backfill'
import { parseFormData } from '@/utils/parsers'
import { removeQueryParam, removeQueryParamValue } from '@/utils/query-params'
import { data, redirect } from 'react-router'
import { z } from 'zod'
import type { Route } from './+types/items'

// Resolves the session once and forwards the cache cookie it refreshed, which
// a bare `getSession` here would drop: an upload is a long run of API calls
// with no page load in between (tech-debt item 35).
export const middleware: Route.MiddlewareFunction[] = [authMiddleware]

export async function loader({ request, context }: Route.LoaderArgs) {
  const session = context.get(sessionContext)

  const user = session.user
  const url = new URL(request.url)
  const intent = url.searchParams.get('intent')

  if (intent === 'list_folders') {
    const parentId = url.searchParams.get('parentId')
    const driveId: string = user.driveId
    const rootId: string = user.rootId
    const resolvedParentId =
      !parentId || parentId === 'root' ? rootId : parentId
    const folders = await getChildFolders(resolvedParentId, driveId)
    return data({
      rootId,
      folders: folders.map((f) => ({
        id: f.id,
        name: f.name,
        parentId: f.parentId,
        childFolderCount: f._count.children,
      })),
    })
  }

  // Feeds the client-side embedding backfill: chunks whose text was saved but
  // whose vector never got written because the tab closed mid-run. Scoped to
  // the session owner, so one user can never read another's passages.
  if (intent === 'pending_search_embeddings') {
    const limit = clampPendingLimit(url.searchParams.get('limit'))
    const chunks = await findUnembeddedChunks(user.id, limit)
    return data({ chunks })
  }

  // Text documents whose index is missing or was truncated by an older
  // extractor. Read-only — the rebuild itself is a POST, since it writes.
  if (intent === 'reindex_candidates') {
    const limit = clampPendingLimit(url.searchParams.get('limit'))
    const candidates = await findReindexCandidates(user.id, limit)
    return data({ candidates })
  }

  if (intent === 'search_folders') {
    const q = url.searchParams.get('q') ?? ''
    const driveId: string = user.driveId
    const rootId: string = user.rootId
    const results = await searchFolders(q, driveId)
    return data({
      rootId,
      folders: results.map((f) => ({
        id: f.id,
        name: f.name,
        parentId: f.parentId,
        childFolderCount: f._count.children,
      })),
    })
  }

  return null
}

export async function action({ request, params, context }: Route.ActionArgs) {
  const session = context.get(sessionContext)
  let { user } = session

  // A malformed body is the caller's error: parseFormData throws INVALID_INPUT,
  // which answers with its own status (400) here instead of escaping the action,
  // where React Router turns any unhandled throw into a 500.
  let parsedData = await parseFormData({ request, schema: itemsApiRouteInput }).catch(
    (e: unknown) => {
      const err = toErrorInfo(e)
      throw data(
        { success: false, error: err.message ?? 'Invalid request' },
        { status: err.status ?? 400 }
      )
    }
  )
  let referer = request.headers.get('referer')
  let url = new URL(referer || request.url)
  let searchParams = url.searchParams

  switch (parsedData.intent) {
    case 'rename_item': {
      try {
        await renameItem(parsedData.itemId, parsedData.newName, user.id)
        console.log({ referer, url: url.pathname })
        return redirect(`${url.pathname}`)
      } catch (e) {
        console.error(e)
        return { success: false, error: e }
      }
    }
    // Trash, restore and delete failures answer with their real status (403 when
    // access is refused) rather than a 200 carrying `{ success: false }`.
    case 'trash_item': {
      try {
        await trashItem(parsedData.selectedItem, user.id)
        return redirect(`${url.pathname}${url.search}`)
      } catch (e) {
        console.error(e)
        const err = toErrorInfo(e)
        return data(
          { success: false, error: err.message ?? 'Trash failed' },
          { status: err.status ?? 500 }
        )
      }
    }
    case 'restore_item': {
      try {
        await restoreItem(parsedData.selectedItem, user.id)
        searchParams = removeQueryParamValue(
          searchParams,
          'selectedItems',
          parsedData.selectedItem
        )
        url.search = searchParams.toString()
        // From inside a trashed folder this goes back to Trash: the restore
        // took the folder out of Trash too, and its view would 404.
        return redirect(toTrashRedirectUrl(url))
      } catch (e) {
        console.error(e)
        const err = toErrorInfo(e)
        return data(
          { success: false, error: err.message ?? 'Restore failed' },
          { status: err.status ?? 500 }
        )
      }
    }
    case 'delete_item':
      try {
        await deleteItem(parsedData.selectedItem, user.id)
        searchParams = removeQueryParamValue(
          searchParams,
          'selectedItems',
          parsedData.selectedItem
        )
        return redirect(`${url.pathname}${url.search}`)
      } catch (e) {
        console.error(e)
        const err = toErrorInfo(e)
        return data(
          { success: false, error: err.message ?? 'Delete failed' },
          { status: err.status ?? 500 }
        )
      }
    case 'trash_items':
      try {
        await trashItems(parsedData.selectedItems, user.id)
        console.log('searchParams before:', `${url.pathname}${url.search}`)
        searchParams = removeQueryParam(searchParams, 'selectedItems')
        return redirect(`${url.pathname}?${searchParams.toString()}`)
      } catch (e) {
        console.error(e)
        const err = toErrorInfo(e)
        return data(
          { success: false, error: err.message ?? 'Trash failed' },
          { status: err.status ?? 500 }
        )
      }
    case 'move_items':
      try {
        await moveItems(
          parsedData.selectedItems,
          parsedData.targetFolderId,
          user.id,
          parsedData.currentParentId
        )
        searchParams = removeQueryParam(searchParams, 'selectedItems')
        return redirect(`${url.pathname}?${searchParams.toString()}`)
      } catch (e) {
        console.error(e)
        return { success: false, error: e }
      }
    case 'restore_items':
      try {
        await restoreItems(parsedData.selectedItems, user.id)
        searchParams = removeQueryParam(searchParams, 'selectedItems')
        url.search = searchParams.toString()
        // Same as `restore_item`: from inside a trashed folder, back to Trash.
        return redirect(toTrashRedirectUrl(url))
      } catch (e) {
        console.error(e)
        const err = toErrorInfo(e)
        return data(
          { success: false, error: err.message ?? 'Restore failed' },
          { status: err.status ?? 500 }
        )
      }
    case 'delete_items':
      try {
        await deleteItems(parsedData.selectedItems, user.id)
        searchParams = removeQueryParam(searchParams, 'selectedItems')
        return redirect(`${url.pathname}${url.search}`)
      } catch (e) {
        console.error(e)
        const err = toErrorInfo(e)
        return data(
          { success: false, error: err.message ?? 'Delete failed' },
          { status: err.status ?? 500 }
        )
      }
    case 'move_item':
      try {
        await moveItem(
          parsedData.selectedItem,
          parsedData.targetFolderId,
          user.id,
          parsedData.currentParentId
        )
        searchParams = removeQueryParam(searchParams, 'selectedItem')
        return redirect(`${url.pathname}?${searchParams.toString()}`)
      } catch (e) {
        console.error(e)
        return { success: false, error: e }
      }
    case 'create_folder': {
      try {
        await createFolder(
          parsedData.name,
          parsedData.parentId,
          user.id,
          user.driveId
        )
        return redirect(`${url.pathname}?${searchParams.toString()}`)
      } catch (e) {
        const err = e as { message?: string }
        return { success: false, error: err.message }
      }
    }
    case 'create_folder_inline': {
      try {
        const folder = await createFolder(
          parsedData.name,
          parsedData.parentId,
          user.id,
          parsedData.driveId
        )
        return data({
          folder: {
            id: folder.id,
            name: folder.name,
            parentId: folder.parentId,
            childFolderCount: 0,
          },
        })
      } catch (e) {
        const err = e as { message?: string }
        return data({ error: err.message }, { status: 500 })
      }
    }
    case 'create_upload_item': {
      // Every S3 call of an upload uses the session user's bucket
      // (`/api/s3/upload`), so that is where the bytes are. The form's `bucket`
      // is only the client's claim of it.
      if (!user.bucket) {
        return { success: false, error: 'Your account has no storage bucket' }
      }
      const refusalProps = {
        size_bytes: Number(parsedData.size),
        mime_type: parsedData.mimeType ?? null,
        category: parsedData.category ?? null,
        has_parent: Boolean(parsedData.parentId),
      }
      // The charge and `Item.size` are the stored object's, read from storage:
      // the form's size is the client's claim, and a claim of 0 stored any
      // file for free. Read before the `try`, whose refusal deletes the bytes:
      // no row serves this object yet, so a storage blip must not delete a
      // good upload. A missing or unreadable object is left to the sweep.
      let stored: Awaited<ReturnType<typeof headUploadedObject>>
      try {
        stored = await headUploadedObject(user.bucket, parsedData.key)
      } catch (e) {
        const err = toErrorInfo(e)
        track('upload_item_refused', { status: err.status ?? 503, ...refusalProps }, { userId: user.id })
        return { success: false, error: err.message }
      }
      if (!stored) {
        track('upload_item_refused', { status: 404, ...refusalProps }, { userId: user.id })
        return { success: false, error: 'The uploaded file was not found in storage' }
      }
      const etagMatches =
        !parsedData.etag || parsedData.etag.replace(/"/g, '') === stored.etag?.replace(/"/g, '')
      if (stored.size !== parsedData.size || !etagMatches) {
        // An honest client always matches (223 of 223 in the 31 Oct probe).
        log.warn('upload claim differs from the stored object', {
          itemId: parsedData.id,
          claimed_bytes: Number(parsedData.size),
          stored_bytes: Number(stored.size),
          etag_matches: etagMatches,
        })
      }
      try {
        const item = await createUploadedItem({
          id: parsedData.id,
          name: parsedData.name,
          key: parsedData.key,
          uploadPath: parsedData.uploadPath,
          size: stored.size,
          mimeType: parsedData.mimeType,
          // The stored object's, like the size; none rather than the claim.
          etag: stored.etag,
          hash: parsedData.hash,
          bucket: user.bucket,
          // The session's drive, like the bucket and owner: a form naming
          // another user's drive filed the row (and any folders made for it)
          // there, owned by this user.
          driveId: user.driveId,
          parentId: parsedData.parentId,
          // The session's user, never the form's `ownerId`: the form is the
          // client's word, and `createUploadedItem` checks access as this user.
          ownerId: user.id,
          category: parsedData.category,
          uploadId: parsedData.uploadId,
        })
        const serializable = z
          .object({
            size: z.coerce.number(),
            inclusiveSize: z.coerce.number().optional(),
            parent: z
              .object({
                size: z.coerce.number(),
                inclusiveSize: z.coerce.number().optional(),
              })
              .loose()
              .optional(),
          })
          .loose()
          .parse(item)

        return data({ success: true, item: serializable })
      } catch (e) {
        // Nothing retries a refused row, so its bytes would stay in S3 for
        // good. `toErrorInfo`, not `.message`: an access refusal is a
        // `DataWithResponseInit` whose text lives on `data`.
        const err = toErrorInfo(e)
        await discardUploadedObject(user.id, parsedData.key)
        track(
          'upload_item_refused',
          { status: err.status ?? 500, ...refusalProps, size_bytes: Number(stored.size) },
          { userId: user.id }
        )
        return { success: false, error: err.message }
      }
    }
    case 'resolve_upload_folders': {
      // A folder upload's folders, resolved once before its files start. The
      // drive is the session's, like every folder the uploader creates.
      try {
        const { folders } = await resolveUploadFolders({
          userId: user.id,
          rootId: parsedData.rootId,
          driveId: user.driveId,
          dirs: parsedData.dirs,
        })
        return data({ success: true, folders })
      } catch (e) {
        const err = toErrorInfo(e)
        return data({ success: false, error: err.message }, { status: err.status ?? 500 })
      }
    }
    // The three index writes answer a refused request with its real status
    // (403), not a 200 carrying `{ success: false }`. `toErrorInfo`, not
    // `.message`: an access refusal is a `DataWithResponseInit`.
    case 'save_media_metadata': {
      try {
        const { intent, ...input } = parsedData
        const chunks = await saveMediaMetadata(user.id, input)
        return data({ success: true, chunks })
      } catch (e) {
        const err = toErrorInfo(e)
        return data(
          { success: false, error: err.message },
          { status: err.status ?? 500 }
        )
      }
    }
    case 'save_ocr_page': {
      try {
        const chunks = await appendSearchPage(user.id, {
          itemId: parsedData.itemId,
          pageNum: parsedData.pageNum,
          text: parsedData.text,
        })
        return data({ success: true, chunks })
      } catch (e) {
        const err = toErrorInfo(e)
        return data(
          { success: false, error: err.message },
          { status: err.status ?? 500 }
        )
      }
    }
    case 'save_search_chunk_embeddings': {
      try {
        const parsed: { chunkId: string; vector: number[] }[] = JSON.parse(
          parsedData.embeddings
        )
        if (!Array.isArray(parsed) || parsed.length === 0) {
          return data({ success: true, written: 0 })
        }
        const written = await setSearchChunkVectors(user.id, parsed)
        return data({ success: true, written })
      } catch (e) {
        const err = toErrorInfo(e)
        return data(
          { success: false, error: err.message },
          { status: err.status ?? 500 }
        )
      }
    }
    case 'reindex_text': {
      try {
        // Chunks come back with a NULL vector, which is exactly what
        // `pending_search_embeddings` looks for — so the existing embedding
        // backfill picks them up without being told about this at all.
        const result = await reindexTextItems(user.id, parsedData.limit)
        return data({ success: true, ...result })
      } catch (e) {
        const err = e as { message?: string }
        return { success: false, error: err.message }
      }
    }
    default:
      break
  }
}
