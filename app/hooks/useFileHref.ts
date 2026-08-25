import { href, useParams } from 'react-router'
import type { GalleryImage } from '@/types/stash.types'

/**
 * Builds the file-page href for a gallery item. The gallery route is reused for
 * both the personal stash (`/:me/stash/images`) and workspaces
 * (`/:me/workspaces/:workspaceId/gallery`), so the target file route depends on
 * which context we're rendering in. Yields `null` when the route has no `:me`
 * param or the image has no parent folder to route through.
 *
 * @param img - The gallery item to link to; its `parentId` becomes the folder
 *   segment and its `id` the file segment.
 *
 * @example
 * // Wrap a gallery tile in a link when one can be built
 * const to = useFileHref(img)
 * return to ? <Link to={to}><Tile img={img} /></Link> : <Tile img={img} />
 *
 * @example
 * // Same call works inside a workspace gallery — the workspace route is picked
 * // automatically from the `:workspaceId` param
 * const to = useFileHref(img) // → /:me/workspaces/:workspaceId/folders/:folderId/files/:fileId
 */
export function useFileHref(img: GalleryImage): string | null {
  const { me, workspaceId } = useParams()
  if (!me || !img.parentId) return null
  if (workspaceId) {
    return href('/:me/workspaces/:workspaceId/folders/:folderId/files/:fileId', {
      me,
      workspaceId,
      folderId: img.parentId,
      fileId: img.id,
    })
  }
  return href('/:me/stash/folders/:folderId/files/:fileId', {
    me,
    folderId: img.parentId,
    fileId: img.id,
  })
}
