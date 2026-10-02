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
import { useLocation, useNavigate, useNavigation } from 'react-router'
import { shallowEqual, useSelector } from '@xstate/react'
import { useUploadFile } from '@/hooks/useUpload'
import { UploadActorContext } from '@/machines/upload/upload.context'
import { useDebouncedCommit } from '@/hooks/useDebouncedCommit'
import type { MediaFileStatus } from '@/types/machine.types'
// Implementation switch — see `app/machines/thumbnail/index.ts`. Points at
// either the original hooks or the XState scheduler without changing shape.
import {
  useThumbnail,
  pauseBackfill,
  resumeBackfill,
  USE_THUMBNAIL_MACHINE,
} from '@/machines/thumbnail'
import { enqueueIndexing, useIndexingRevalidation } from '@/machines/indexing'

const thumbnailedIds = new Set<string>()

/** Debounce window for pulling newly-created items into the list. */
const REVALIDATE_DEBOUNCE_MS = 700

/**
 * Upload statuses that still hold bandwidth. Anything else (`itemCreated`,
 * `done`, `aborted`, `itemFailed`, `skipped`) is finished work that merely
 * stays listed in the panel.
 */
const IN_FLIGHT: ReadonlySet<MediaFileStatus> = new Set<MediaFileStatus>([
  'pending',
  'queued',
  'validating',
  'uploading',
  'paused',
])

// Concurrency gate for the thumbnail pipeline. Each in-flight upload mounts its
// own watcher, so a 534-file upload would otherwise fire 534 pipelines at once
// — each doing presign + compute + patch + metadata + embedding — and bury the
// server (this was a big part of the request storm). Cap how many run at a time.
const MAX_CONCURRENT_THUMBNAILS = 4
let activeThumbnails = 0
const thumbnailQueue: Array<() => void> = []

function acquireThumbnailSlot(): Promise<() => void> {
  return new Promise((resolve) => {
    const grant = () => {
      activeThumbnails++
      resolve(() => {
        activeThumbnails--
        thumbnailQueue.shift()?.()
      })
    }
    if (activeThumbnails < MAX_CONCURRENT_THUMBNAILS) grant()
    else thumbnailQueue.push(grant)
  })
}

function FileThumbnailWatcher({ mediaFileId }: { mediaFileId: string }) {
  const mediaFile = useUploadFile(mediaFileId)
  const { run: runThumbnail } = useThumbnail(mediaFileId)

  useEffect(() => {
    if (!mediaFile) return
    if (mediaFile.status !== 'itemCreated') return
    if (thumbnailedIds.has(mediaFile.id)) return
    thumbnailedIds.add(mediaFile.id)

    const file = mediaFile.file
    const id = mediaFile.id

    // Indexing has its own queue and runs for every upload, so it is queued
    // here, ahead of the thumbnail slot below rather than behind it. The legacy
    // `useThumbnail` indexes by itself, so only the machine path needs this.
    if (USE_THUMBNAIL_MACHINE) enqueueIndexing(id, file)

    void (async () => {
      const release = await acquireThumbnailSlot()
      try {
        await runThumbnail(file)
      } catch (err) {
        console.error(`Thumbnail failed for ${id}:`, err)
      } finally {
        release()
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaFile?.status, mediaFile?.id])

  return null
}

export const UploadThumbnailRunner = memo(function UploadThumbnailRunner() {
  const upload = UploadActorContext.useActorRef()
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
  const navigation = useNavigation()

  // Facets written by `save_media_metadata` (page count, dimensions, EXIF)
  // reach the page with one reload per batch, once indexing drains. On the
  // legacy path the indexing queue stays empty, so this never fires; that
  // path's fetchers reload the page themselves.
  useIndexingRevalidation()

  // Fresh uploads own the compute worker and the bandwidth. On-demand backfill
  // of older items is strictly background work, so it stands down until the
  // queue drains — otherwise a big upload competes with itself for slots.
  //
  // "Drains" means no file is still in flight. Finished files stay listed in
  // the panel until the user clears it, and counting them kept the backfill
  // lane paused indefinitely after every upload.
  const uploading = useSelector(upload, (s) =>
    Array.from(s.context.mediaFiles.values()).some((f) =>
      IN_FLIGHT.has(f.status)
    )
  )
  useEffect(() => {
    if (uploading) pauseBackfill()
    else resumeBackfill()
    return () => resumeBackfill()
  }, [uploading])

  // The hook's committed guard replaces the `lastRevalidated` ref this used to
  // keep, and holding `navigate` in a ref means the pathname and search read at
  // commit time are the current ones rather than the ones captured on schedule.
  //
  // Skipped while a navigation is in flight: its destination loads fresh
  // anyway, and `location` still names the page being left until it commits,
  // so navigating there would abort the user's navigation (React Router's
  // `startNavigation` aborts any pending one) and keep them where they were.
  useDebouncedCommit(
    createdCount,
    () => {
      if (navigation.state !== 'idle') return
      navigate(`${location.pathname}${location.search}`, {
        replace: true,
        state: { reset: true },
      })
    },
    { delayMs: REVALIDATE_DEBOUNCE_MS }
  )

  return (
    <>
      {fileIds.map((id) => (
        <FileThumbnailWatcher key={id} mediaFileId={id} />
      ))}
    </>
  )
})
