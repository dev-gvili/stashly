import type { Config } from '@/types/machine.types'
import { toMediaFile } from '@/utils/converters'
import { startFileHash } from '@/utils/file-hash'
import { normalizeFile } from '@/utils/sniff'
import { shallowEqual, useSelector } from '@xstate/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigation } from 'react-router'
import { UploadActorContext } from '@/machines/upload/upload.context'
import { addCreatedToStats, reviveCardItem, type RawStats } from '@/utils/pagination'

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Drains a directory reader completely. `readEntries` returns at most ~100
 * entries per call by design, so a single call silently truncates large
 * folders — it must be looped until it yields an empty batch.
 *
 * @param reader - Reader created from a `FileSystemDirectoryEntry`.
 *
 * @example
 * // Read every child of a dropped directory
 * const reader = (entry as FileSystemDirectoryEntry).createReader()
 * const children = await readAllEntries(reader)
 *
 * @example
 * // An empty directory resolves to an empty array, never hangs
 * await readAllEntries(emptyDirReader) // → []
 */
async function readAllEntries(
  reader: FileSystemDirectoryReader
): Promise<FileSystemEntry[]> {
  const entries: FileSystemEntry[] = []
  let batch: FileSystemEntry[]
  do {
    batch = await new Promise<FileSystemEntry[]>((res, rej) =>
      reader.readEntries(res, rej)
    )
    entries.push(...batch)
  } while (batch.length > 0)
  return entries
}

/**
 * Flattens a dropped entry into a list of `File`s, recursing through
 * directories. Folder structure is not preserved here — the upload machine
 * derives `parentId` separately.
 *
 * @param entry - A `FileSystemEntry` from `DataTransferItem.webkitGetAsEntry()`.
 *
 * @example
 * // Flatten everything the user dropped, files and folders alike
 * const files = (await Promise.all(entries.map(collectFiles))).flat()
 *
 * @example
 * // A single file entry resolves to a one-element array
 * await collectFiles(fileEntry) // → [File]
 */
async function collectFiles(entry: FileSystemEntry): Promise<File[]> {
  if (entry.isFile) {
    return new Promise<File[]>((res, rej) =>
      (entry as FileSystemFileEntry).file((f) => res([f]), rej)
    )
  }
  if (entry.isDirectory) {
    const reader = (entry as FileSystemDirectoryEntry).createReader()
    const children = await readAllEntries(reader)
    return (await Promise.all(children.map(collectFiles))).flat()
  }
  return []
}

/**
 * Asks the server once whether a whole batch fits in the user's free quota.
 * Checking the batch up front avoids a per-file round trip for a folder drop,
 * which is why `addBatch` then sends each file with `skipQuotaCheck: true`.
 *
 * @param totalSize - Combined byte size of every file in the batch.
 *
 * @example
 * // Gate a folder drop on one quota call
 * const totalSize = files.reduce((sum, f) => sum + f.size, 0)
 * if (!(await verifyBatchQuota(totalSize))) return false
 *
 * @example
 * // Check a single large file before queueing it
 * await verifyBatchQuota(file.size)
 */
async function verifyBatchQuota(totalSize: number): Promise<boolean> {
  const res = await fetch('/api/quota', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'verify-free-quota', dataSize: totalSize }),
  })
  return res.json() as Promise<boolean>
}

/**
 * The folder path an upload path files into, relative to its root: the segments between
 * the root id and the file name. Empty for a file straight in the root.
 *
 * @example
 * toFolderPath('item_root/photos/2026/a.jpg') // → 'photos/2026'
 */
function toFolderPath(uploadPath: string): string {
  return uploadPath.split('/').slice(1, -1).join('/')
}

/**
 * Asks the server once for the folder of every directory in a batch, creating
 * the missing ones, so each file is filed straight into its folder instead of
 * resolving its path again (`createUploadedItem`).
 *
 * Never fails the batch: on any error it answers `{}`, and every file then
 * resolves its own path on the server, as a single-file upload does. A path the
 * server refused (two live folders with one name) is left out the same way, so
 * its files are refused one by one with the reason.
 *
 * @param rootId - The destination folder every key starts with.
 * @param keys - The batch's S3 keys.
 * @returns Folder path (see `toFolderPath`) → folder id.
 *
 * @example
 * const folders = await resolveUploadFolders(rootId, mediaFiles.map((m) => m.key))
 * folders['photos/2026'] // → 'item_…'
 */
async function resolveUploadFolders(
  rootId: string,
  keys: string[]
): Promise<{ folders: Record<string, string>; created: Record<string, unknown>[] }> {
  const none = { folders: {}, created: [] }
  const dirs = [...new Set(keys.map(toFolderPath).filter(Boolean))]
  if (dirs.length === 0) return none
  try {
    const form = new FormData()
    form.append('intent', 'resolve_upload_folders')
    form.append('rootId', rootId)
    form.append('dirs', JSON.stringify(dirs))
    const res = await fetch('/api/items', { method: 'POST', body: form })
    // An expired session redirects to the sign-in page, which isn't JSON.
    const body = (await res.json()) as {
      success?: boolean
      folders?: Record<string, string>
      created?: Record<string, unknown>[]
    }
    return body.success && body.folders
      ? { folders: body.folders, created: body.created ?? [] }
      : none
  } catch {
    return none
  }
}

/**
 * Which new rows a mounted page showed for certain, and whether any arrived
 * that it could not show. The upload runner takes this when a batch ends and
 * reloads the page once unless every row it created was shown (tech-debt
 * item 45). Module state: one tab has one upload manager and one page.
 */
let shownRows = { ids: new Set<string>(), missed: false }

/**
 * Hands over what pages showed since the last call, and starts again.
 *
 * @returns The ids shown for certain, and whether a row was missed.
 *
 * @example
 * const { ids, missed } = takeShownRows()
 * if (missed || created.some((id) => !ids.has(id))) reload()
 */
export function takeShownRows() {
  const taken = shownRows
  shownRows = { ids: new Set(), missed: false }
  return taken
}

/**
 * Shows an upload's new rows on the page that lists their folder, without
 * reloading it (tech-debt item 45). Each row the upload manager emits (a
 * file's, or a folder upload's folders) is revived to the loader's types,
 * handed to `insert` once, and added to the page's counts. The counts start
 * again from `stats` whenever the loader's change, since a fresh load already
 * includes the rows before it.
 *
 * @param options.statsFolderId - The folder the stats describe, or null when
 *   they are drive-wide (the stash root page).
 * @param options.stats - The loader's stats with raw counts. Pass the loader's
 *   own object: a new identity is what starts the counts again.
 * @param options.insert - Shows the rows (`usePagination`'s `insertItems`) and
 *   returns the ids it showed for certain. Not called while a navigation is in
 *   flight: the page on screen is about to be replaced.
 * @returns The counts with the new rows added.
 *
 * @example
 * const live = useCreatedItems({
 *   statsFolderId: params.folderId,
 *   stats: loaderData.stats,
 *   insert: (rows) => insertItems(rows, { foldersFirst: true, parentId: params.folderId }),
 * })
 */
export function useCreatedItems<T extends { id: string }, S extends RawStats>({
  statsFolderId,
  stats,
  insert,
}: {
  statsFolderId: string | null
  stats: S
  insert: (rows: T[]) => Set<string>
}): S {
  const upload = UploadActorContext.useActorRef()
  const [live, setLive] = useState({ base: stats, value: stats })
  // A new load includes every row created before it: start again from it.
  if (live.base !== stats) setLive({ base: stats, value: stats })

  // Each row is shown and counted once, however often it arrives.
  const seen = useRef(new Set<string>())
  // The latest closures, so the subscription isn't torn down every render.
  const navigating = useNavigation().state !== 'idle'
  const latest = useRef({ statsFolderId, insert, navigating })
  latest.current = { statsFolderId, insert, navigating }

  useEffect(() => {
    const subscription = upload.on('items.created', ({ items }) => {
      const rows = (items.map(reviveCardItem) as unknown as (T & { type: unknown })[]).filter(
        (row) => !seen.current.has(row.id)
      )
      if (rows.length === 0) return
      for (const row of rows) seen.current.add(row.id)
      const { statsFolderId, insert, navigating } = latest.current
      const shown = navigating ? new Set<string>() : insert(rows)
      for (const id of shown) shownRows.ids.add(id)
      if (rows.some((row) => !shown.has(row.id))) shownRows.missed = true
      setLive((prev) => ({
        ...prev,
        value: addCreatedToStats(prev.value, rows, { folderId: statsFolderId }),
      }))
    })
    return () => subscription.unsubscribe()
  }, [upload])

  return live.value
}

// ── Per-file hooks ────────────────────────────────────────────────────────────
// These are standalone hooks — call them in child components, not inside loops.

/**
 * The whole queued-file record for one upload, straight from the machine.
 * Re-renders on every progress tick because the object gets a fresh identity
 * each event — prefer `useUploadFileMeta` + `useUploadProgress` in list rows.
 *
 * @param mediaFileId - Id of the queued file (`MediaFile.id`).
 *
 * @example
 * // Detail panel that genuinely needs every field
 * const mediaFile = useUploadFile(id)
 * if (!mediaFile) return null
 * return <pre>{JSON.stringify(mediaFile, null, 2)}</pre>
 *
 * @example
 * // Undefined once the file is dropped from the queue
 * const mediaFile = useUploadFile(removedId) // → undefined
 */
export function useUploadFile(mediaFileId: string) {
  const upload = UploadActorContext.useActorRef()
  return useSelector(upload, (s) => s.context.mediaFiles.get(mediaFileId))
}

/**
 * The identity fields of a queued file — everything that stays constant while
 * bytes fly, plus `status`. Deliberately excludes `progress` so a component
 * rendering a row doesn't re-render on every progress tick; subscribe to
 * `useUploadProgress` from a leaf instead.
 *
 * @param mediaFileId - Id of the queued file (`MediaFile.id`).
 *
 * @example
 * // Row header — name, thumbnail and status, no progress churn
 * const { file, thumbnail, status } = useUploadFileMeta(id)
 * <Row icon={thumbnail} title={file?.name} badge={status} />
 *
 * @example
 * // Pair with the progress hook in a leaf so only the bar re-renders
 * const { status } = useUploadFileMeta(id)
 * {status === 'uploading' && <UploadProgressBar id={id} />}
 */
export function useUploadFileMeta(mediaFileId: string) {
  const upload = UploadActorContext.useActorRef()
  return useSelector(
    upload,
    (s) => {
      const mediaFile = s.context.mediaFiles.get(mediaFileId)
      return {
        file: mediaFile?.file,
        thumbnail: mediaFile?.thumbnail,
        status: mediaFile?.status,
        // Why a row needs this: `itemFailed` says the bytes are in S3 but the
        // item row is not, and `error` is the only thing that says whether to
        // retry or sign in again. It was written and never projected, so the
        // panel could not have shown it even if it had tried.
        error: mediaFile?.error,
      }
    },
    shallowEqual
  )
}

/**
 * Ids of the non-dismissed queue, newest first. Stable across progress ticks —
 * list containers should subscribe to this rather than to the file objects,
 * which get a fresh identity on every progress event.
 *
 * @example
 * // Render the queue without re-rendering the list on every progress tick
 * const ids = useUploadFileIds()
 * return ids.map((id) => <UploadRow key={id} id={id} />)
 *
 * @example
 * // Empty once everything has been dismissed — handy for hiding the panel
 * const ids = useUploadFileIds()
 * if (ids.length === 0) return null
 */
export function useUploadFileIds() {
  const upload = UploadActorContext.useActorRef()
  return useSelector(
    upload,
    (s) =>
      Array.from(s.context.mediaFiles.values())
        .filter((f) => !s.context.dismissed.has(f.id))
        .map((f) => f.id)
        .reverse(),
    shallowEqual
  )
}

/**
 * Per-status counts across the non-dismissed queue. Numbers only, so the
 * subscriber re-renders on status transitions and nothing else.
 *
 * @example
 * // Panel header summary
 * const { total, done, uploading } = useUploadCounts()
 * <h3>Uploading {done}/{total}{uploading > 0 && ` · ${uploading} in flight`}</h3>
 *
 * @example
 * // Show a "all done" state without touching per-file data
 * const { total, done } = useUploadCounts()
 * {total > 0 && done === total && <CheckCircle2 />}
 */
export function useUploadCounts() {
  const upload = UploadActorContext.useActorRef()
  return useSelector(
    upload,
    (s) => {
      const counts = {
        total: 0,
        uploading: 0,
        pending: 0,
        done: 0,
        aborted: 0,
      }
      for (const mediaFile of s.context.mediaFiles.values()) {
        if (s.context.dismissed.has(mediaFile.id)) continue
        counts.total++
        if (mediaFile.status in counts) {
          counts[mediaFile.status as keyof typeof counts]++
        }
      }
      return counts
    },
    shallowEqual
  )
}

/**
 * Upload progress (0–100) for one queued file. This is the churny subscription
 * — call it from the leaf that draws the bar, never from a list container.
 *
 * @param mediaFileId - Id of the queued file (`MediaFile.id`).
 *
 * @example
 * // Leaf component: the only thing that re-renders per progress event
 * function UploadProgressBar({ id }: { id: string }) {
 *   const progress = useUploadProgress(id)
 *   return <Progress value={progress ?? 0} />
 * }
 *
 * @example
 * // Undefined before the first byte moves — fall back to zero
 * const progress = useUploadProgress(id) ?? 0
 */
export function useUploadProgress(mediaFileId: string) {
  const upload = UploadActorContext.useActorRef()
  return useSelector(
    upload,
    (s) => s.context.mediaFiles.get(mediaFileId)?.progress
  )
}

/**
 * Lifecycle status of one queued file (`pending` / `uploading` / `done` /
 * `aborted`). Narrow on purpose, so a status change re-renders only the badge.
 *
 * @param mediaFileId - Id of the queued file (`MediaFile.id`).
 *
 * @example
 * // Status badge for a queue row
 * const status = useUploadStatus(id)
 * <Badge variant={status === 'aborted' ? 'destructive' : 'secondary'}>{status}</Badge>
 *
 * @example
 * // Only offer retry once the upload has actually failed
 * const status = useUploadStatus(id)
 * {status === 'aborted' && <Button onClick={() => resume(id)}>Retry</Button>}
 */
export function useUploadStatus(mediaFileId: string) {
  const upload = UploadActorContext.useActorRef()
  return useSelector(
    upload,
    (s) => s.context.mediaFiles.get(mediaFileId)?.status
  )
}

// ── Main hook ─────────────────────────────────────────────────────────────────

/**
 * Primary interface to the global XState upload machine (`upload` actor).
 * Manages file queue state, drag-and-drop, quota verification, thumbnail pipeline,
 * and per-file lifecycle (add / pause / resume / cancel / dismiss).
 *
 * The `upload` actor is provided by `UploadActorContext` at the authenticated
 * layout and shared across all hook instances —
 * state is consistent regardless of which component calls this hook.
 * Exposes upload state, action functions, and drag event handlers.
 *
 * @example
 * // Add a single file to the queue
 * const { add } = useUpload()
 * <input type="file" onChange={(e) => add(e.target.files![0])} />
 *
 * @example
 * // Attach drag-and-drop to a container
 * const { dragHandlers, isDragging } = useUpload()
 * <div {...dragHandlers} className={isDragging ? 'ring-2 ring-primary' : ''}>
 *   Drop files here
 * </div>
 *
 * @example
 * // Show upload progress panel conditionally
 * const { toggleView, isVisible } = useUpload()
 * {isVisible && <UploadPanel onClose={toggleView} />}
 *
 * @remarks
 * This hook subscribes only to state that changes rarely (config, visibility,
 * active count). Per-file data lives in the narrower hooks — `useUploadFileIds`,
 * `useUploadCounts`, `useUploadFileMeta`, `useUploadProgress`, `useUploadStatus`
 * — so a progress tick re-renders one leaf instead of the whole panel.
 */
export function useUpload() {
  const upload = UploadActorContext.useActorRef()
  const [isDragging, setIsDragging] = useState(false)
  const dragCounter = useRef(0)

  // NOTE: deliberately no subscription to `mediaFiles` here. Those objects get
  // a fresh identity on every progress event, so a `files` selector re-rendered
  // every consumer of this hook — and with 20+ concurrent uploads that render
  // storm kept Radix's Popper anchor effect re-firing until React threw
  // "Maximum update depth exceeded". Use `useUploadFileIds` / `useUploadCounts`
  // / `useUploadFileMeta` / `useUploadProgress` for per-file data instead.
  const config = useSelector(upload, (s) => s.context.config)
  const activeCount = useSelector(upload, (s) => s.context.queues.active.size)
  const rootId = useSelector(upload, (s) => s.context.config?.user?.rootId)
  const isVisible = useSelector(upload, (s) => s.context.isVisible)

  // ── Actions ──

  const configure = useCallback((config: Config) => {
    upload.send({ type: 'upload.config', config })
  }, [upload])

  const add = useCallback(
    async (file: File, overrideRootId?: string, skipQuotaCheck?: boolean) => {
      const rid = overrideRootId ?? rootId
      if (!rid) return
      // Correct browser-misreported MIME (.ts → video/vnd.dlna.mpeg-tts)
      // before the file is snapshotted into the machine.
      file = await normalizeFile(file)
      const mediaFile = toMediaFile(file, rid)
      // Fire-and-forget, off the main thread. Never awaited here — hashing a
      // file means reading all of it, and doing that before `upload.add` is
      // what used to strand a whole batch in `pending`.
      startFileHash(mediaFile.id, file)
      upload.send({ type: 'upload.add', mediaFile, skipQuotaCheck })
    },
    [rootId, upload]
  )

  const addBatch = useCallback(
    async (files: File[], overrideRootId?: string): Promise<boolean> => {
      const rid = overrideRootId ?? rootId
      if (!rid) return false
      const totalSize = files.reduce((sum, f) => sum + f.size, 0)
      const allowed = await verifyBatchQuota(totalSize)
      if (!allowed) return false
      // One request for the whole tree, so no file resolves its path again.
      // Keyed from the original files: `normalizeFile` keeps
      // `webkitRelativePath`, so these are the upload paths `toMediaFile` builds below.
      const { folders, created } = await resolveUploadFolders(
        rid,
        files.map((file) => `${rid}/${file.webkitRelativePath || file.name}`)
      )
      // The folders it made, for the page to show before their files land.
      if (created.length > 0) upload.send({ type: 'upload.items.created', items: created })
      // Hand files over one at a time, each after its own `normalizeFile`: its
      // disk read lets the machine start the uploads already queued. Queuing a
      // 639-file folder in one synchronous burst instead started 100 uploads
      // at once, and the upload took 872 s instead of 707 s (measured
      // 2026-10-25).
      for (const file of files) {
        const normalized = await normalizeFile(file)
        const mediaFile = toMediaFile(normalized, rid)
        const parentId = folders[toFolderPath(mediaFile.uploadPath)]
        startFileHash(mediaFile.id, normalized)
        upload.send({
          type: 'upload.add',
          mediaFile: parentId ? { ...mediaFile, parentId } : mediaFile,
          skipQuotaCheck: true,
        })
      }
      return true
    },
    [rootId, upload]
  )

  const cancel = useCallback((mediaFileId: string) => {
    upload.send({ type: 'upload.abort', mediaFileId })
  }, [upload])

  const pause = useCallback((mediaFileId: string) => {
    upload.send({ type: 'upload.pause', mediaFileId })
  }, [upload])

  const resume = useCallback((mediaFileId: string) => {
    upload.send({ type: 'upload.resume', mediaFileId })
  }, [upload])

  const toggleView = useCallback(() => {
    upload.send({ type: 'upload.view.toggle' })
  }, [upload])

  const dismiss = useCallback((mediaFileId: string) => {
    upload.send({ type: 'upload.dismiss', mediaFileId })
  }, [upload])

  // ── Drag handlers ──

  const onDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current++
    if (dragCounter.current === 1) setIsDragging(true)
  }, [])

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current--
    if (dragCounter.current === 0) setIsDragging(false)
  }, [])

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  const makeDropHandler = useCallback(
    (folderId?: string) => async (e: React.DragEvent) => {
      e.preventDefault()
      dragCounter.current = 0
      setIsDragging(false)
      const targetId = folderId ?? rootId
      if (!targetId) return

      // Snapshot synchronously — browser clears DataTransferItemList after first await
      type SnapshotItem = { entry: FileSystemEntry | null; file: File | null }
      const items: SnapshotItem[] = []
      for (const item of e.dataTransfer.items) {
        items.push({ entry: item.webkitGetAsEntry(), file: item.getAsFile() })
      }

      let hasFolderDrop = false
      const resolved = await Promise.all(
        items.map(({ entry, file }) => {
          if (entry) {
            if (entry.isDirectory) hasFolderDrop = true
            return collectFiles(entry)
          }
          return Promise.resolve(file ? [file] : [])
        })
      )
      const allFiles = resolved.flat()
      if (allFiles.length === 0) return

      if (hasFolderDrop && allFiles.length > 1) {
        await addBatch(allFiles, targetId)
      } else {
        for (const file of allFiles) await add(file, targetId)
      }
    },
    [rootId, add, addBatch]
  )

  const onDrop = useCallback(makeDropHandler(), [makeDropHandler])

  return {
    // state
    activeCount,
    config,
    isDragging,
    isVisible,

    // actions
    add,
    addBatch,
    cancel,
    pause,
    resume,
    configure,
    toggleView,
    dismiss,

    // spread onto a droppable container
    dragHandlers: { onDragEnter, onDragLeave, onDragOver, onDrop },

    // raw actor for advanced selectors / inspect
    actor: upload,
    makeDropHandler,
  } as const
}
