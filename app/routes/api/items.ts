import { itemsApiRouteInput } from '@/schemas/api.schemas'
import { auth } from '@/services/auth'
import {
  createFolder,
  createUploadedItem,
  deleteItem,
  deleteItems,
  getChildFolders,
  moveItem,
  moveItems,
  renameItem,
  restoreItem,
  restoreItems,
  searchFolders,
  trashItem,
  trashItems,
  upsertAudioFacet,
  upsertImageFacet,
  upsertMarkdownFacet,
  upsertPdfFacet,
  upsertVideoFacet,
} from '@/services/item-actions'
import {
  appendSearchPage,
  chunkText,
  findReindexCandidates,
  findUnembeddedChunks,
  reindexTextItems,
  setSearchChunkVectors,
  upsertSearchChunks,
  upsertSearchContent,
} from '@/services/search-actions'
import { toErrorInfo } from '@/utils/api.errors'
import { clampPendingLimit } from '@/utils/embedding-backfill'
import { parseFormData } from '@/utils/parsers'
import { removeQueryParam, removeQueryParamValue } from '@/utils/query-params'
import { data, redirect } from 'react-router'
import { z } from 'zod'
import type { Route } from './+types/items'

export async function loader({ request }: Route.LoaderArgs) {
  const session = await auth.api.getSession({
    headers: request.headers,
  })
  if (!session) throw redirect('/auth/sign-in')

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

export async function action({ request, params }: Route.ActionArgs) {
  const session = await auth.api.getSession({
    headers: request.headers,
  })
  if (!session) throw redirect('/auth/sign-in')
  let { user } = session

  let parsedData = await parseFormData({ request, schema: itemsApiRouteInput })
  let referer = request.headers.get('referer')
  let url = new URL(referer || request.url)
  let searchParams = url.searchParams

  switch (parsedData.intent) {
    case 'rename_item': {
      try {
        await renameItem(parsedData.itemId, parsedData.newName)
        console.log({ referer, url: url.pathname })
        return redirect(`${url.pathname}`)
      } catch (e) {
        console.error(e)
        return { success: false, error: e }
      }
    }
    case 'trash_item': {
      try {
        await trashItem(parsedData.selectedItem, user.id)
        return redirect(`${url.pathname}${url.search}`)
      } catch (e) {
        console.error(e)
        return { success: false, error: e }
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
        return redirect(`${url.pathname}?${searchParams.toString()}`)
      } catch (e) {
        console.error(e)
        return { success: false, error: e }
      }
    }
    // Delete failures answer with their real status (403 for a refused delete)
    // rather than a 200 carrying `{ success: false }`.
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
        return { success: false, error: e }
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
        return redirect(`${url.pathname}?${searchParams.toString()}`)
      } catch (e) {
        console.error(e)
        return { success: false, error: e }
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
      try {
        const item = await createUploadedItem({
          id: parsedData.id,
          name: parsedData.name,
          key: parsedData.key,
          size: parsedData.size,
          mimeType: parsedData.mimeType,
          etag: parsedData.etag,
          hash: parsedData.hash,
          bucket: parsedData.bucket,
          driveId: parsedData.driveId,
          parentId: parsedData.parentId,
          ownerId: parsedData.ownerId,
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
        const err = e as { message?: string }
        return { success: false, error: err.message }
      }
    }
    case 'save_media_metadata': {
      try {
        const {
          itemId,
          imageWidth,
          imageHeight,
          horizontalResolution,
          verticalResolution,
          bitDepth,
          cameraMake,
          cameraModel,
          iso,
          fNumber,
          exposureTime,
          focalLength,
          takenDateTime,
          latitude,
          longitude,
          videoWidth,
          videoHeight,
          duration,
          frameRate,
          documentText,
          documentPageCount,
          pdfTitle,
          pdfAuthor,
          pdfSubject,
          pdfKeywords,
          pdfCreator,
          pdfProducer,
          pdfVersion,
          pdfLanguage,
          pdfIsEncrypted,
          pdfHasFormFields,
          pdfHasAnnotations,
          pdfHasSignatures,
          pdfPageWidth,
          pdfPageHeight,
          pdfDocCreatedAt,
          pdfDocModifiedAt,
          mdTitle,
          mdAuthor,
          mdDescription,
          mdTags,
          mdWordCount,
          mdReadingTime,
          mdHeadingCount,
          mdLinkCount,
          mdImageCount,
          mdCodeBlockCount,
          mdTaskCount,
          mdHasFrontmatter,
          mdDocCreatedAt,
          mdDocModifiedAt,
          ...audioData
        } = parsedData
        if (imageWidth != null || imageHeight != null) {
          await upsertImageFacet(itemId, {
            width: imageWidth,
            height: imageHeight,
            horizontalResolution,
            verticalResolution,
            bitDepth,
            cameraMake,
            cameraModel,
            iso,
            fNumber,
            exposureTime,
            focalLength,
            takenDateTime,
            latitude,
            longitude,
          })
        } else if (videoWidth || videoHeight) {
          await upsertVideoFacet(itemId, {
            width: videoWidth,
            height: videoHeight,
            duration,
            frameRate,
          })
        } else if (
          documentPageCount != null ||
          pdfVersion != null ||
          pdfIsEncrypted != null
        ) {
          await upsertPdfFacet(itemId, {
            pageCount: documentPageCount,
            title: pdfTitle,
            author: pdfAuthor,
            subject: pdfSubject,
            keywords: pdfKeywords,
            creator: pdfCreator,
            producer: pdfProducer,
            pdfVersion,
            language: pdfLanguage,
            isEncrypted: pdfIsEncrypted,
            hasFormFields: pdfHasFormFields,
            hasAnnotations: pdfHasAnnotations,
            hasSignatures: pdfHasSignatures,
            pageWidth: pdfPageWidth,
            pageHeight: pdfPageHeight,
            docCreatedAt: pdfDocCreatedAt,
            docModifiedAt: pdfDocModifiedAt,
          })
        } else if (
          mdWordCount != null ||
          mdHeadingCount != null ||
          mdHasFrontmatter != null
        ) {
          await upsertMarkdownFacet(itemId, {
            title: mdTitle,
            author: mdAuthor,
            description: mdDescription,
            tags: mdTags,
            wordCount: mdWordCount,
            readingTime: mdReadingTime,
            headingCount: mdHeadingCount,
            linkCount: mdLinkCount,
            imageCount: mdImageCount,
            codeBlockCount: mdCodeBlockCount,
            taskCount: mdTaskCount,
            hasFrontmatter: mdHasFrontmatter,
            docCreatedAt: mdDocCreatedAt,
            docModifiedAt: mdDocModifiedAt,
          })
        } else if (
          // Only when the extractor produced actual audio metadata — a bare
          // `else` here used to stamp an all-null Audio facet onto every
          // non-media file (text, code, …), which then routed them to the
          // audio stage in detectMediaKind.
          parsedData.audioDuration != null ||
          parsedData.audioBitrate != null ||
          parsedData.audioTitle != null
        ) {
          console.log('Audio Parsed Data: ', audioData)
          await upsertAudioFacet(itemId, {
            duration: parsedData.audioDuration,
            bitrate: parsedData.audioBitrate,
            title: parsedData.audioTitle,
            artist: parsedData.audioArtist,
            album: parsedData.audioAlbum,
            albumArtist: parsedData.audioAlbumArtist,
            composer: parsedData.audioComposer,
            genre: parsedData.audioGenre,
            copyright: parsedData.audioCopyright,
            year: parsedData.audioYear,
            track: parsedData.audioTrack,
            trackCount: parsedData.audioTrackCount,
            disc: parsedData.audioDisc,
            discCount: parsedData.audioDiscCount,
          })
        }
        // Chunked indexing: store full content (document-level fallback) and
        // per-passage chunks. Server is authoritative for chunk boundaries —
        // client only sees the resulting `{id, content}` pairs to embed.
        let chunks: { id: string; ord: number; content: string }[] = []
        if (documentText) {
          await upsertSearchContent(itemId, documentText)
          const split = chunkText(documentText)
          chunks = await upsertSearchChunks(itemId, split)
        }
        return data({ success: true, chunks })
      } catch (e) {
        const err = e as { message?: string }
        return { success: false, error: err.message }
      }
    }
    case 'save_ocr_page': {
      try {
        const chunks = await appendSearchPage({
          itemId: parsedData.itemId,
          pageNum: parsedData.pageNum,
          text: parsedData.text,
        })
        return data({ success: true, chunks })
      } catch (e) {
        const err = e as { message?: string }
        return { success: false, error: err.message }
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
        const written = await setSearchChunkVectors(parsed)
        return data({ success: true, written })
      } catch (e) {
        const err = e as { message?: string }
        return { success: false, error: err.message }
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
