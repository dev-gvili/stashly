/**
 * Watches the upload queue and hands each finished upload to the work that
 * follows it: search indexing, and the file its thumbnail will be made from.
 *
 * Subscribes to the upload queue once. When a file's item exists, it queues the
 * file's search indexing and holds the file. No thumbnail work starts here:
 * the thumbnail is made when the item's card comes on screen
 * (`useThumbnailWhenVisible`), from the held file.
 *
 * Also owns the upload-time page refreshes and pauses thumbnail downloads
 * while uploads are moving bytes.
 */
import { memo, useEffect } from 'react'
import { useLocation, useNavigate, useNavigation } from 'react-router'
import { useSelector } from '@xstate/react'
import { UploadActorContext } from '@/machines/upload/upload.context'
import { useDebouncedCommit } from '@/hooks/useDebouncedCommit'
import type { MediaFileStatus } from '@/types/machine.types'
import {
  holdUploadedFile,
  pauseDownloads,
  resumeDownloads,
} from '@/machines/thumbnail'
import { enqueueIndexing, useIndexingRevalidation } from '@/machines/indexing'

/** Files already handed over, so each is handed over once per tab. */
const handedOverIds = new Set<string>()

/** Debounce window for pulling newly-created items into the list. */
const REVALIDATE_DEBOUNCE_MS = 700

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

  // Pull newly-created items into the list with ONE debounced revalidation per
  // burst, not one per file. Previously each file that reached `itemCreated`
  // fired its own `navigate({ reset })`; a 534-file upload meant 534 loader
  // runs pounding the DB, which is a big part of why the app went sluggish and
  // the file route started failing to fetch. usePagination still resets on
  // `state.reset` — it just happens in waves now.
  //
  // Counts rows, not finished transfers. A `done` file has no row yet, and its
  // later `itemCreated` left a count that already included it unchanged, so
  // when the row took longer than the debounce the only reload missed it and
  // nothing followed (measured: 0 of 6 rows, grid empty until a manual reload).
  const createdCount = useSelector(
    upload,
    (s) =>
      Array.from(s.context.mediaFiles.values()).filter(
        (f) => f.status === 'itemCreated'
      ).length
  )
  const navigate = useNavigate()
  const location = useLocation()
  const navigation = useNavigation()

  // Facets written by `save_media_metadata` (page count, dimensions, EXIF)
  // reach the page with one reload per batch, once indexing drains.
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

  return null
})
