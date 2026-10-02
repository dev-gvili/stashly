/**
 * The thumbnail scheduler: decides which visible cards get their thumbnail
 * made, and when.
 *
 * Every job starts the same way: a card came on screen without a thumbnail
 * (`useThumbnailWhenVisible`). Nothing is made for a card nobody has seen. The
 * job's lane is decided by where its bytes come from:
 *
 *   memoryLane    the file was uploaded in this tab and is still held
 *                 (`held-files.ts`). No download, every stage. 4 at a time,
 *                 never paused.
 *   downloadLane  no file in memory; the original is downloaded first, and
 *                 the salient crop is skipped. 2 at a time, and paused while
 *                 uploads are moving bytes so the two don't fight over
 *                 bandwidth.
 *
 * Both lanes take the newest request first: that is the card the user just
 * scrolled to; the ones they flew past are worth less.
 *
 * Pausing is a state, not a flag: `startQueuedDownloads` is only handled in
 * `downloadLane.active`, so a paused lane cannot start work even if some
 * caller forgets to check.
 *
 * This machine schedules; it does not compute. The per-item work lives in
 * `thumbnail-item.machine.ts`.
 */
import { setup, assign, raise, type AnyActorRef } from 'xstate'
import { thumbnailItemMachine } from './thumbnail-item.machine'
import { markAttempted, rememberFailure, whenIdle } from './attempt-store'
import { releaseFile } from './held-files'
import type {
  ThumbJob,
  ThumbManagerContext,
  ThumbManagerEvent,
  ThumbMode,
} from './thumbnail.types'

/**
 * Jobs that need no download. Four at a time was tuned against a 534-file
 * drop, where one pipeline per file buried the server.
 */
const MEMORY_CONCURRENCY = 4

/** Each of these jobs costs a full download of the original. */
const DOWNLOAD_CONCURRENCY = 2

/**
 * Takes the newest queued job of one kind out of the queue.
 *
 * @param queue - The queue to take from; modified in place.
 * @param mode - Which lane is asking.
 * @returns The job, or null when none of that kind is queued.
 */
function takeNewest(queue: ThumbJob[], mode: ThumbMode): ThumbJob | null {
  // Hand-rolled instead of `findLastIndex`, which needs `lib: es2023` — not
  // worth a repo-wide tsconfig change for one line.
  for (let i = queue.length - 1; i >= 0; i--) {
    if (queue[i].mode === mode) return queue.splice(i, 1)[0]
  }
  return null
}

/** How many jobs of one kind are running. */
function runningInLane(
  running: ThumbManagerContext['running'],
  mode: ThumbMode
): number {
  let n = 0
  for (const entry of running.values()) if (entry.mode === mode) n++
  return n
}

export const thumbnailManagerMachine = setup({
  types: {
    context: {} as ThumbManagerContext,
    events: {} as ThumbManagerEvent,
  },
  actors: {
    item: thumbnailItemMachine,
  },
  actions: {
    /**
     * Queues a visible card's job at the newest position, one job per item.
     *
     * A job already running is left alone. One already queued is moved to the
     * newest position, since its card was just seen again; if either copy can
     * run from memory, that one is kept, because it skips the download.
     */
    queueJob: assign(({ context, event }) => {
      if (event.type !== 'enqueue') return {}
      const { job } = event
      if (context.running.has(job.itemId)) return {}
      const existing = context.queue.find((q) => q.itemId === job.itemId)
      const keep = existing?.mode === 'fromMemory' ? existing : job
      const queue = context.queue.filter((q) => q.itemId !== job.itemId)
      return { queue: [...queue, keep] }
    }),

    /**
     * An upload's file just arrived: a queued download job for that item
     * becomes a memory job. Nothing is queued if the card hasn't been seen.
     */
    switchQueuedJobToMemory: assign(({ context, event }) => {
      if (event.type !== 'fileHeld') return {}
      const index = context.queue.findIndex(
        (q) => q.itemId === event.itemId && q.mode === 'fromDownload'
      )
      if (index === -1) return {}
      const queue = [...context.queue]
      queue[index] = { itemId: event.itemId, mode: 'fromMemory', file: event.file }
      return { queue }
    }),

    /**
     * Drops a *queued* job only; its card left the screen. A running one is
     * left to finish: the work is already paid for, and because this machine
     * outlives every card, the result still lands. A held file stays held, so
     * the next time the card is seen it runs from memory again.
     */
    dropQueuedJob: assign(({ context, event }) => {
      if (event.type !== 'cancel') return {}
      return { queue: context.queue.filter((q) => q.itemId !== event.itemId) }
    }),

    /** Stores the stage a child just painted; `useLiveThumbnail` reads it. */
    recordProgress: assign(({ context, event }) => {
      if (event.type !== 'child.progress') return {}
      const progress = new Map(context.progress)
      progress.set(event.itemId, event.progress)
      return { progress }
    }),

    /**
     * Lets go of the uploaded file once its memory job has finished, whatever
     * the outcome. On failure the item stays eligible for one download job.
     */
    releaseHeldFile: ({ context, event }) => {
      if (event.type !== 'child.settled') return
      if (context.running.get(event.itemId)?.mode === 'fromMemory') {
        releaseFile(event.itemId)
      }
    },

    /**
     * Frees the finished job's slot. A download job that produced nothing goes
     * on the permanent skip list, so the original is never downloaded again
     * for nothing.
     */
    freeSlot: assign(({ context, event }) => {
      if (event.type !== 'child.settled') return {}
      const entry = context.running.get(event.itemId)
      if (entry?.mode === 'fromDownload' && !event.thumbnailed) {
        rememberFailure(event.itemId)
      }
      const running = new Map(context.running)
      running.delete(event.itemId)
      return { running }
    }),

    startQueuedMemoryJobs: assign(({ context, spawn, self }) =>
      startJobs(context, spawn, self, 'fromMemory', MEMORY_CONCURRENCY)
    ),

    startQueuedDownloadJobs: assign(({ context, spawn, self }) =>
      startJobs(context, spawn, self, 'fromDownload', DOWNLOAD_CONCURRENCY)
    ),

    /**
     * Starts downloads on the next idle frame, never on a frame the user is
     * scrolling or typing in. If the lane pauses meanwhile, the follow-up
     * event is simply unhandled; that is the point of `paused` being a state.
     */
    startDownloadsWhenIdle: ({ self }) => {
      whenIdle(() => self.send({ type: 'startQueuedDownloads' }))
    },
  },
}).createMachine({
  id: 'thumbnail-manager',
  description:
    'Makes thumbnails for cards that came on screen: from the uploaded file when it is still in memory, otherwise by downloading the original.',
  context: {
    queue: [],
    running: new Map(),
    progress: new Map(),
  },

  on: {
    enqueue: {
      actions: [
        'queueJob',
        'startQueuedMemoryJobs',
        raise({ type: 'downloadSlotMaybeFree' }),
      ],
    },
    fileHeld: {
      actions: ['switchQueuedJobToMemory', 'startQueuedMemoryJobs'],
    },
    cancel: { actions: 'dropQueuedJob' },
    'child.progress': { actions: 'recordProgress' },
    'child.settled': {
      actions: [
        'releaseHeldFile',
        'freeSlot',
        'startQueuedMemoryJobs',
        raise({ type: 'downloadSlotMaybeFree' }),
      ],
    },
  },

  type: 'parallel',
  states: {
    memoryLane: {
      description:
        'Jobs whose uploaded file is still held: no download, every stage. 4 at a time, newest request first, never paused. Driven by the handlers on the machine itself.',
    },

    downloadLane: {
      description:
        'Jobs that must download the original first and skip the salient crop. 2 at a time, newest request first.',
      initial: 'active',
      states: {
        active: {
          description:
            'Starts queued downloads on an idle frame whenever a slot may be free. Entering it after a pause picks up whatever queued meanwhile.',
          entry: 'startDownloadsWhenIdle',
          on: {
            downloadSlotMaybeFree: { actions: 'startDownloadsWhenIdle' },
            startQueuedDownloads: { actions: 'startQueuedDownloadJobs' },
            pauseDownloads: { target: 'paused' },
          },
        },
        paused: {
          description:
            'An upload is moving bytes, so no download starts; jobs keep queueing. Starting work is not handled here at all, so nothing can slip through.',
          on: {
            resumeDownloads: { target: 'active' },
          },
        },
      },
    },
  },
})

/**
 * Fills one lane's free slots with its newest queued jobs, starting an item
 * machine for each.
 *
 * `spawn` is only reachable inside `assign`, and a child's reports have to be
 * wired up the moment its ref exists, so the subscriptions are set up here.
 * The child reports with `emit` rather than `sendParent` so it can be tested
 * on its own; the cost is these explicit `.on(...)` hookups.
 *
 * @returns The context changes, or an empty object when nothing started.
 */
function startJobs(
  context: ThumbManagerContext,
  spawn: (
    src: 'item',
    opts: {
      id: string
      input: { itemId: string; mode: ThumbMode; file: File | null }
    }
  ) => AnyActorRef,
  self: { send: (event: ThumbManagerEvent) => void },
  mode: ThumbMode,
  cap: number
): Partial<ThumbManagerContext> {
  let free = cap - runningInLane(context.running, mode)
  if (free <= 0) return {}

  const queue = [...context.queue]
  const running = new Map(context.running)
  let started = false

  while (free > 0) {
    const job = takeNewest(queue, mode)
    if (!job) break
    free--
    started = true

    markAttempted(job.itemId, job.mode)

    const ref = spawn('item', {
      // The item id as actor id keeps a second spawn for the same item
      // impossible and makes the inspector readable.
      id: `thumb-${job.itemId}`,
      input: { itemId: job.itemId, mode: job.mode, file: job.file },
    })

    ref.on('progress', (e) =>
      self.send({
        type: 'child.progress',
        itemId: e.itemId,
        progress: e.progress,
      })
    )
    ref.on('failed', (e) => console.error('[thumbnail]', e.itemId, e.reason))
    ref.subscribe({
      complete: () => {
        const snapshot = ref.getSnapshot() as {
          output?: { thumbnailed: boolean }
        }
        self.send({
          type: 'child.settled',
          itemId: job.itemId,
          thumbnailed: snapshot.output?.thumbnailed ?? false,
        })
      },
    })

    running.set(job.itemId, { mode: job.mode, ref })
  }

  return started ? { queue, running } : {}
}
