/**
 * The indexing queue for this tab, and the functions that drive it.
 *
 * Module scope, like the thumbnail manager, so a file keeps indexing after the
 * component that queued it unmounts or the route changes.
 */
import { createActor } from 'xstate'
import { indexingQueueMachine } from './indexing-queue.machine'

export const indexingQueue = createActor(indexingQueueMachine, {
  id: 'indexingQueue',
})

indexingQueue.start()

/**
 * Debug handle for the app's own queue instance. Importing this module from the
 * devtools console gets a second copy under Vite, which nothing feeds; use
 * `window.__indexingQueue` instead.
 */
if (typeof window !== 'undefined') {
  ;(window as unknown as { __indexingQueue?: unknown }).__indexingQueue =
    indexingQueue
}

/**
 * Queues an uploaded file for search indexing.
 *
 * Call it once the file's `Item` row exists (`itemCreated`), with the `File`
 * that was uploaded. A second call for the same item while it is queued or
 * running is ignored.
 *
 * @param itemId - The new item's id.
 * @param file - The uploaded file, still in memory.
 *
 * @example
 * if (mediaFile.status === 'itemCreated') enqueueIndexing(mediaFile.id, mediaFile.file)
 */
export function enqueueIndexing(itemId: string, file: File): void {
  indexingQueue.send({ type: 'enqueue', job: { itemId, file } })
}

/**
 * Holds back the GPU work (vectors and OCR) while an upload moves bytes.
 * Jobs keep queueing; running ones finish; none is started.
 *
 * @example
 * if (uploading) pauseDeferredIndexing()
 */
export function pauseDeferredIndexing(): void {
  indexingQueue.send({ type: 'pauseDeferred' })
}

/**
 * Lets the GPU work (vectors and OCR) run again, oldest first. The upload
 * runner calls it once uploads have been idle for a moment.
 *
 * @example
 * resumeLater.call(resumeDeferredIndexing, DEFERRED_RESUME_DELAY_MS)
 */
export function resumeDeferredIndexing(): void {
  indexingQueue.send({ type: 'resumeDeferred' })
}

/**
 * Tells the queue the page has reloaded, so the metadata saves it collected
 * no longer need a reload.
 *
 * @example
 * revalidator.revalidate()
 * markIndexingRevalidated()
 */
export function markIndexingRevalidated(): void {
  indexingQueue.send({ type: 'revalidationDone' })
}
