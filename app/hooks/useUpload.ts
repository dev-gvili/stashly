import { uploadMachine } from '@/machines/upload/upload.machine'
import type { Config } from '@/types/machine.types'
import { toMediaFile } from '@/utils/converters'
import { startFileHash } from '@/utils/file-hash'
import { normalizeFile } from '@/utils/sniff'
import { shallowEqual, useSelector } from '@xstate/react'
import { useCallback, useRef, useState } from 'react'
import { createActor } from 'xstate'

export const upload = createActor(uploadMachine, { id: 'uploadManager' })
upload.start()

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
  return useSelector(
    upload,
    (s) => {
      const mediaFile = s.context.mediaFiles.get(mediaFileId)
      return {
        file: mediaFile?.file,
        thumbnail: mediaFile?.thumbnail,
        status: mediaFile?.status,
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
 * The `upload` actor is module-level and shared across all hook instances —
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
  }, [])

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
    [rootId]
  )

  const addBatch = useCallback(
    async (files: File[], overrideRootId?: string): Promise<boolean> => {
      const rid = overrideRootId ?? rootId
      if (!rid) return false
      const totalSize = files.reduce((sum, f) => sum + f.size, 0)
      const allowed = await verifyBatchQuota(totalSize)
      if (!allowed) return false
      for (const file of files) {
        const normalized = await normalizeFile(file)
        const mediaFile = toMediaFile(normalized, rid)
        startFileHash(mediaFile.id, normalized)
        upload.send({
          type: 'upload.add',
          mediaFile,
          skipQuotaCheck: true,
        })
      }
      return true
    },
    [rootId]
  )

  const cancel = useCallback((mediaFileId: string) => {
    upload.send({ type: 'upload.abort', mediaFileId })
  }, [])

  const pause = useCallback((mediaFileId: string) => {
    upload.send({ type: 'upload.pause', mediaFileId })
  }, [])

  const resume = useCallback((mediaFileId: string) => {
    upload.send({ type: 'upload.resume', mediaFileId })
  }, [])

  const toggleView = useCallback(() => {
    upload.send({ type: 'upload.view.toggle' })
  }, [])

  const dismiss = useCallback((mediaFileId: string) => {
    upload.send({ type: 'upload.dismiss', mediaFileId })
  }, [])

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
