import { uploadMachine } from '@/machines/upload/upload.machine'
import type { Config } from '@/types/machine.types'
import { toMediaFile } from '@/utils/converters'
import { normalizeFile } from '@/utils/sniff'
import { shallowEqual, useSelector } from '@xstate/react'
import { useCallback, useRef, useState } from 'react'
import { createActor } from 'xstate'

export const upload = createActor(uploadMachine, { id: 'uploadManager' })
upload.start()

// ── Helpers ──────────────────────────────────────────────────────────────────

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

export function useUploadFile(mediaFileId: string) {
  return useSelector(upload, (s) => s.context.mediaFiles.get(mediaFileId))
}

/**
 * The identity fields of a queued file — everything that stays constant while
 * bytes fly, plus `status`. Deliberately excludes `progress` so a component
 * rendering a row doesn't re-render on every progress tick; subscribe to
 * `useUploadProgress` from a leaf instead.
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

/** Per-status counts. Numbers only, so no churn between status transitions. */
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

export function useUploadProgress(mediaFileId: string) {
  return useSelector(
    upload,
    (s) => s.context.mediaFiles.get(mediaFileId)?.progress
  )
}

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
 *
 * @returns Upload state, action functions, and drag event handlers.
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
      const id = overrideRootId ?? rootId
      if (!id) return
      // Correct browser-misreported MIME (.ts → video/vnd.dlna.mpeg-tts)
      // before the file is snapshotted into the machine.
      file = await normalizeFile(file)
      const mediaFile = toMediaFile(file, id)
      upload.send({ type: 'upload.add', mediaFile, skipQuotaCheck })
    },
    [rootId]
  )

  const addBatch = useCallback(
    async (files: File[], overrideRootId?: string): Promise<boolean> => {
      const id = overrideRootId ?? rootId
      if (!id) return false
      const totalSize = files.reduce((sum, f) => sum + f.size, 0)
      const allowed = await verifyBatchQuota(totalSize)
      if (!allowed) return false
      for (const file of files) {
        upload.send({
          type: 'upload.add',
          mediaFile: toMediaFile(await normalizeFile(file), id),
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
