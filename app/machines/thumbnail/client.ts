/**
 * The running scheduler — one actor for the whole tab.
 *
 * Module scope, matching how `useUpload.ts` starts the upload manager. That is
 * the whole point of the conversion: the queue has to outlive every component
 * that talks to it, so a card scrolling away or a route changing mid-pipeline
 * can't take the work with it.
 *
 * Everything below is a plain function rather than a hook, so non-React callers
 * (and the upload machine) can drive the queue without a component.
 */
import { createActor } from 'xstate'
import { thumbnailManagerMachine } from './thumbnail-manager.machine'
import { shouldSkip } from './attempt-store'
import { getHeldFile, holdFile } from './held-files'

export const thumbnailManager = createActor(thumbnailManagerMachine, {
  id: 'thumbnailManager',
})

thumbnailManager.start()

/**
 * Debug handle for the *app's* actor instance.
 *
 * Not a convenience: a raw `import('/app/machines/thumbnail/client.ts')` from
 * the devtools console gets its own module graph under Vite, so probing the
 * scheduler that way reads a duplicate actor nothing is subscribed to and
 * reports work as silently broken when it is fine. Reach the real one with
 * `window.__thumbMgr`.
 */
if (typeof window !== 'undefined') {
  ;(window as unknown as { __thumbMgr?: unknown }).__thumbMgr = thumbnailManager
}

/**
 * Keeps a freshly uploaded file for its thumbnail, without starting any work.
 *
 * The thumbnail is made when the item's card comes on screen, from this file,
 * with no download. If the card was already seen and its job is queued as a
 * download, that job switches to the held file.
 *
 * @param itemId - The new item's id.
 * @param file - The uploaded file, still in memory.
 *
 * @example
 * if (mediaFile.status === 'itemCreated') holdUploadedFile(mediaFile.id, mediaFile.file)
 */
export function holdUploadedFile(itemId: string, file: File): void {
  holdFile(itemId, file)
  thumbnailManager.send({ type: 'fileHeld', itemId, file })
}

/**
 * Asks for a thumbnail for an item whose card just came on screen.
 *
 * Uses the held upload when there is one, otherwise queues a download of the
 * original. Does nothing when that kind of job was already tried in this tab,
 * or when a download already failed for good.
 *
 * @example
 * observer: entry.isIntersecting && requestThumbnail(itemId)
 */
export function requestThumbnail(itemId: string): void {
  if (hasPaintedThumbnail(itemId)) return
  const file = getHeldFile(itemId)
  const mode = file ? 'fromMemory' : 'fromDownload'
  if (shouldSkip(itemId, mode)) return
  thumbnailManager.send({ type: 'enqueue', job: { itemId, mode, file } })
}

/**
 * True once this tab has painted a real thumbnail (stage 2 or 3) for the item.
 *
 * The card's own `thumbnails` come from the loader and stay empty until the
 * page reloads, so without this a card whose job just finished would look
 * eligible again and have its thumbnail made a second time.
 *
 * @example
 * if (hasPaintedThumbnail(itemId)) return
 */
export function hasPaintedThumbnail(itemId: string): boolean {
  const stage = thumbnailManager.getSnapshot().context.progress.get(itemId)?.stage
  return stage === 2 || stage === 3
}

/**
 * Drops the item's queued job because its card left the screen. A job that
 * has started finishes anyway: its work is already paid for.
 */
export function cancelQueuedThumbnail(itemId: string): void {
  thumbnailManager.send({ type: 'cancel', itemId })
}

/** Uploads are moving bytes: stop starting downloads until they finish. */
export function pauseDownloads(): void {
  thumbnailManager.send({ type: 'pauseDownloads' })
}

/** No upload is moving bytes any more: downloads may start again. */
export function resumeDownloads(): void {
  thumbnailManager.send({ type: 'resumeDownloads' })
}
