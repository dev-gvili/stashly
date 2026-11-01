/**
 * Watches the upload queue and hands each finished upload to the work that
 * follows it: search indexing, and the file its thumbnail will be made from.
 *
 * Subscribes to the upload queue once. When a file's item exists, it queues the
 * file's search indexing and holds the file. No thumbnail work starts here:
 * the thumbnail is made when the item's card comes on screen
 * (`useThumbnailWhenVisible`), from the held file.
 *
 * Also owns the upload-time page refreshes, and pauses thumbnail downloads and
 * indexing's GPU work while uploads are moving bytes.
 */
import { memo, useEffect, useMemo, useRef } from 'react'
import { useLocation, useNavigate, useNavigation } from 'react-router'
import { useSelector } from '@xstate/react'
import { UploadActorContext } from '@/machines/upload/upload.context'
import { createDebouncer } from '@/utils/debounce'
import { takeShownRows } from '@/hooks/useUpload'
import type { MediaFileStatus } from '@/types/machine.types'
import {
  holdUploadedFile,
  pauseDownloads,
  resumeDownloads,
} from '@/machines/thumbnail'
import {
  enqueueIndexing,
  pauseDeferredIndexing,
  resumeDeferredIndexing,
  useIndexingRevalidation,
} from '@/machines/indexing'

/** Files already handed over, so each is handed over once per tab. */
const handedOverIds = new Set<string>()


/** How long uploads must be idle before indexing's GPU work starts again. */
const DEFERRED_RESUME_DELAY_MS = 2_000

/**
 * Upload statuses that still hold bandwidth. Anything else (`itemCreated`,
 * `done`, `aborted`, `itemFailed`, `failed`, `skipped`) is finished work that merely
 * stays listed in the panel.
 */
const IN_FLIGHT: ReadonlySet<MediaFileStatus> = new Set<MediaFileStatus>([
  'pending',
  'queued',
  'validating',
  'uploading',
  'paused',
])

export const UploadThumbnailRunner = memo(function UploadThumbnailRunner() {
  const upload = UploadActorContext.useActorRef()

  // Once a file's item exists, queue its search indexing and hold the file for
  // its thumbnail. One subscription for the whole queue: a watcher component
  // per file made this component re-create one element per file on every
  // render, and it renders on every created row (tech-debt item 52).
  useEffect(() => {
    const handOver = (snapshot: ReturnType<typeof upload.getSnapshot>) => {
      for (const mediaFile of snapshot.context.mediaFiles.values()) {
        if (mediaFile.status !== 'itemCreated') continue
        if (handedOverIds.has(mediaFile.id)) continue
        handedOverIds.add(mediaFile.id)

        enqueueIndexing(mediaFile.id, mediaFile.file)
        holdUploadedFile(mediaFile.id, mediaFile.file)
      }
    }
    handOver(upload.getSnapshot())
    const subscription = upload.subscribe(handOver)
    return () => subscription.unsubscribe()
  }, [upload])

  // Counts rows, not finished transfers: a `done` file has no row yet.
  const createdCount = useSelector(
    upload,
    (s) =>
      Array.from(s.context.mediaFiles.values()).filter(
        (f) => f.status === 'itemCreated'
      ).length
  )
  // A batch ends when no file is moving bytes or waiting for its row.
  const batchPending = useSelector(upload, (s) =>
    Array.from(s.context.mediaFiles.values()).some(
      (f) => IN_FLIGHT.has(f.status) || f.status === 'done'
    )
  )
  const navigate = useNavigate()
  const location = useLocation()
  const navigation = useNavigation()

  // Facets written by `save_media_metadata` (page count, dimensions, EXIF)
  // reach the pages that show them with one reload per batch, once indexing
  // drains.
  useIndexingRevalidation()

  // Uploads own the bandwidth. Thumbnail jobs that must download an original
  // stand down until no file is still in flight; jobs from a held upload need
  // no download and keep running.
  //
  // "In flight" excludes finished files: they stay listed in the panel until
  // the user clears it, and counting them kept downloads paused indefinitely
  // after every upload.
  const uploading = useSelector(upload, (s) =>
    Array.from(s.context.mediaFiles.values()).some((f) =>
      IN_FLIGHT.has(f.status)
    )
  )
  useEffect(() => {
    if (uploading) pauseDownloads()
    else resumeDownloads()
    return () => resumeDownloads()
  }, [uploading])

  // Indexing's GPU work (vectors and OCR) waits until no file has been in
  // flight for DEFERRED_RESUME_DELAY_MS, so it never delays a batch's uploads
  // or their metadata, and back-to-back drops don't start and stop it
  // (tech-debt item 53). The metadata itself is saved as each row lands.
  const resumeLater = useMemo(() => createDebouncer(), [])
  useEffect(() => {
    if (uploading) {
      resumeLater.cancel()
      pauseDeferredIndexing()
    } else {
      resumeLater.call(resumeDeferredIndexing, DEFERRED_RESUME_DELAY_MS)
    }
  }, [uploading, resumeLater])
  useEffect(
    () => () => {
      resumeLater.cancel()
      resumeDeferredIndexing()
    },
    [resumeLater]
  )

  // New rows reach a folder page without a reload: the page inserts each one
  // the upload hands it (`useCreatedItems`). Reloading the folder after every
  // row instead ran its loader 139–146 times per 650-file upload and sent the
  // reader back to the first page each time (tech-debt item 45).
  //
  // When a batch ends, the page is reloaded once unless it showed every row
  // the batch created (`takeShownRows`): another route, a filter, a row past
  // the loaded page or a folder the page doesn't list all leave one out. Not
  // while a navigation is in flight: its destination loads fresh anyway, and
  // `location` still names the page being left, so navigating there would
  // abort the user's navigation. The check waits until it settles.
  const accounted = useRef<Set<string> | null>(null)
  accounted.current ??= new Set(
    Array.from(upload.getSnapshot().context.mediaFiles.values())
      .filter((f) => f.status === 'itemCreated')
      .map((f) => f.id)
  )
  useEffect(() => {
    if (batchPending || navigation.state !== 'idle') return
    const created = Array.from(upload.getSnapshot().context.mediaFiles.values())
      .filter((f) => f.status === 'itemCreated' && !accounted.current!.has(f.id))
      .map((f) => f.id)
    if (created.length === 0) return
    for (const id of created) accounted.current!.add(id)
    const { ids, missed } = takeShownRows()
    if (!missed && created.every((id) => ids.has(id))) return
    navigate(`${location.pathname}${location.search}`, {
      replace: true,
      state: { reset: true },
    })
  }, [batchPending, createdCount, navigation.state])

  return null
})
