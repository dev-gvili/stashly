/**
 * Per-file thumbnail orchestrator. Mounts one `<FileThumbnailWatcher>` per
 * active media file in the upload queue so each in-flight pipeline gets its
 * own `useThumbnailV2()` instance — and therefore its own React Router
 * fetchers (presign, patch, metadata, embedding).
 *
 * Per-file mounts give each in-flight upload an isolated set of fetchers
 * and an isolated broadcast channel keyed by itemId. Cards subscribe via
 * `useLiveThumbnail(id)` and re-render independently of route revalidation.
 */
import { memo, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { shallowEqual, useSelector } from '@xstate/react'
import { upload, useUploadFile } from '@/hooks/useUpload'
import { useThumbnailV2 } from '@/hooks/useThumbnailV2'

const thumbnailedIds = new Set<string>()

function FileThumbnailWatcher({ mediaFileId }: { mediaFileId: string }) {
  const mediaFile = useUploadFile(mediaFileId)
  const { run: runThumbnail } = useThumbnailV2(mediaFileId)
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (!mediaFile) return
    if (mediaFile.status !== 'itemCreated') return
    if (thumbnailedIds.has(mediaFile.id)) return
    thumbnailedIds.add(mediaFile.id)

    // Pull the newly created item into the current list. usePagination
    // detects `state.reset` and resets its cursor. The per-card silo
    // handles subsequent stage 1/2/3 progression without further reloads.
    navigate(`${location.pathname}${location.search}`, {
      replace: true,
      state: { reset: true },
    })

    runThumbnail(mediaFile.file).catch((err) => {
      console.error(`Thumbnail failed for ${mediaFile.id}:`, err)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaFile?.status, mediaFile?.id])

  return null
}

export const UploadThumbnailRunner = memo(function UploadThumbnailRunner() {
  const fileIds = useSelector(
    upload,
    (s) => Array.from(s.context.mediaFiles.keys()),
    shallowEqual,
  )

  return (
    <>
      {fileIds.map((id) => (
        <FileThumbnailWatcher key={id} mediaFileId={id} />
      ))}
    </>
  )
})
