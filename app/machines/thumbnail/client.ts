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
 * Queues the full pipeline for a freshly uploaded file, whose bytes are still
 * in memory. Resolves when the item settles — the contract the upload runner
 * already expects from `run(file)`.
 */
export function enqueueUpload(itemId: string, file: File): Promise<void> {
  thumbnailManager.send({
    type: 'enqueue',
    job: { itemId, mode: 'upload', file },
  })
  return waitForSettle(itemId)
}

/**
 * Queues a backfill for an item that never got a thumbnail. The original is
 * re-downloaded by the job itself, so there is no `File` to hand over.
 */
export function enqueueBackfill(itemId: string): void {
  if (shouldSkip(itemId)) return
  thumbnailManager.send({
    type: 'enqueue',
    job: { itemId, mode: 'backfill', file: null },
  })
}

/**
 * Drops a job that has not started. A running one keeps going on purpose: its
 * download is already paid for, and the manager outlives the card that asked.
 */
export function cancelJob(itemId: string): void {
  thumbnailManager.send({ type: 'cancel', itemId })
}

/** Yields the pipeline to in-flight uploads. */
export function pauseBackfill(): void {
  thumbnailManager.send({ type: 'pauseBackfill' })
}

/** Hands it back once the upload queue drains. */
export function resumeBackfill(): void {
  thumbnailManager.send({ type: 'resumeBackfill' })
}

/** Acknowledges the buffered metadata saves after revalidating the route. */
export function consumeRevalidation(): void {
  thumbnailManager.send({ type: 'revalidationConsumed' })
}

/**
 * Resolves once an item is neither queued nor running.
 *
 * An item that is in neither on the first look was deduplicated — already
 * running from an earlier enqueue, or already finished — so it resolves
 * immediately rather than waiting for a transition that will never come.
 */
function waitForSettle(itemId: string): Promise<void> {
  const present = (snapshot: ReturnType<typeof thumbnailManager.getSnapshot>) =>
    snapshot.context.running.has(itemId) ||
    snapshot.context.queue.some((j) => j.itemId === itemId)

  if (!present(thumbnailManager.getSnapshot())) return Promise.resolve()

  return new Promise((resolve) => {
    const sub = thumbnailManager.subscribe((snapshot) => {
      if (present(snapshot)) return
      sub.unsubscribe()
      resolve()
    })
  })
}
