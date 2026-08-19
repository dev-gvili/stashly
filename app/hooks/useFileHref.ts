import { href, useParams } from 'react-router'
import type { GalleryImage } from '@/types/stash.types'

/**
 * Builds the file-page href for a gallery item. The gallery route is reused for
 * both the personal stash (`/:me/stash/images`) and workspaces
 * (`/:me/workspaces/:workspaceId/gallery`), so the target file route depends on
 * which context we're rendering in.
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
