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
import { memo, useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { shallowEqual, useSelector } from '@xstate/react'
import { upload, useUploadFile } from '@/hooks/useUpload'
import { useThumbnailV2 } from '@/hooks/useThumbnailV2'

const thumbnailedIds = new Set<string>()

/** Debounce window for pulling newly-created items into the list. */
const REVALIDATE_DEBOUNCE_MS = 700

function FileThumbnailWatcher({ mediaFileId }: { mediaFileId: string }) {
  const mediaFile = useUploadFile(mediaFileId)
  const { run: runThumbnail } = useThumbnailV2(mediaFileId)

  useEffect(() => {
    if (!mediaFile) return
    if (mediaFile.status !== 'itemCreated') return
    if (thumbnailedIds.has(mediaFile.id)) return
    thumbnailedIds.add(mediaFile.id)

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

  // Pull newly-created items into the list with ONE debounced revalidation per
  // burst, not one per file. Previously each file that reached `itemCreated`
  // fired its own `navigate({ reset })`; a 534-file upload meant 534 loader
  // runs pounding the DB, which is a big part of why the app went sluggish and
  // the file route started failing to fetch. usePagination still resets on
  // `state.reset` — it just happens in waves now.
  const createdCount = useSelector(
    upload,
    (s) =>
      Array.from(s.context.mediaFiles.values()).filter(
        (f) => f.status === 'itemCreated' || f.status === 'done'
      ).length
  )
  const navigate = useNavigate()
  const location = useLocation()
  const lastRevalidated = useRef(0)

  useEffect(() => {
    if (createdCount === lastRevalidated.current) return
    const timer = setTimeout(() => {
      lastRevalidated.current = createdCount
      navigate(`${location.pathname}${location.search}`, {
        replace: true,
        state: { reset: true },
      })
    }, REVALIDATE_DEBOUNCE_MS)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createdCount])

  return (
    <>
      {fileIds.map((id) => (
        <FileThumbnailWatcher key={id} mediaFileId={id} />
      ))}
    </>
  )
})
