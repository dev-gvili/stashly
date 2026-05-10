/**
 * Per-file thumbnail orchestrator. Mounts one `<FileThumbnailWatcher>` per
 * active media file in the upload queue so each in-flight pipeline gets its
 * own `useThumbnailV2()` instance — and therefore its own React Router
 * fetchers (presign, patch, metadata, embedding).
 *
 * Why per-file: a single `useFetcher()` is single-flight by design. Sharing
 * one instance across N concurrent uploads causes their `load`/`submit` calls
 * to cancel each other and stomp `fetcher.data`. Per-file mounts give each
 * in-flight upload an isolated set of fetchers.
 *
 * The orchestrator is rendered once in the app layout (next to `UploadPanel`)
 * so it stays mounted regardless of which route is active. It returns `null`;
 * it's pure side-effect.
 */
import { memo, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { shallowEqual, useSelector } from '@xstate/react'
import { upload, useUploadFile } from '@/hooks/useUpload'
import { useThumbnailV2 } from '@/hooks/useThumbnailV2'

// Module-level dedupe so a file's pipeline runs exactly once per session,
// even if its watcher remounts.
const thumbnailedIds = new Set<string>()

function FileThumbnailWatcher({ mediaFileId }: { mediaFileId: string }) {
  const mediaFile = useUploadFile(mediaFileId)
  const { run: runThumbnail } = useThumbnailV2()
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (!mediaFile) return
    if (mediaFile.status !== 'itemCreated') return
    if (thumbnailedIds.has(mediaFile.id)) return
    thumbnailedIds.add(mediaFile.id)

    // Refresh the current route + reset usePagination's cursor so the
    // newly-created item shows up in the gallery view.
    navigate(location.pathname + location.search, {
      replace: true,
      state: { reset: true },
    })

    runThumbnail(mediaFile.id, mediaFile.file, () => {
      // onReady fires after stage 1's local objectURL is ready; nudge the
      // route again so any view that re-fetched between status transitions
      // picks up the latest state.
      navigate(location.pathname + location.search, {
        replace: true,
        state: { reset: true },
      })
    }).catch((err) => {
      console.error(`Thumbnail failed for ${mediaFile.id}:`, err)
    })
    // We only want to react to the status field; navigate / location identity
    // changes shouldn't re-fire the pipeline.
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
