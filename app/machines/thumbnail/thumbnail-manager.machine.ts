/**
 * The thumbnail scheduler — one queue for work that used to have three.
 *
 * Before this machine, effective concurrency was nobody's decision: the upload
 * runner held a 4-slot promise semaphore, the backfill hook held a separate
 * 2-slot LIFO queue with a `paused` boolean, and neither knew about the other.
 * A single manager owns both lanes, so "how much thumbnail work is in flight"
 * is one answer in one place.
 *
 * Two lanes, because the two kinds of work want opposite orderings:
 *
 *   upload    FIFO — the order the user dropped the files in is the order they
 *             expect to see them appear.
 *   backfill  LIFO — the newest request is the card the user just scrolled to;
 *             the 200 cards they flew past are worth less than the one under
 *             their eyes.
 *
 * The lanes are parallel regions rather than a `paused` flag, so pausing is
 * structural: `drainBackfillNow` is only handled inside `backfillLane.active`,
 * which means a paused lane cannot start work even if some future caller
 * forgets to check a boolean.
 *
 * This machine schedules; it does not compute. The per-item work lives in
 * `thumbnail-item.machine.ts`, and the compute under that is the untouched
 * `@/utils/thumbnail-pipeline`.
 */
import { setup, assign, raise, type AnyActorRef } from 'xstate'
import { thumbnailItemMachine } from './thumbnail-item.machine'
import { markAttempted, rememberFailure, whenIdle } from './attempt-store'
import type {
  ThumbJob,
  ThumbManagerContext,
  ThumbManagerEvent,
  ThumbMode,
} from './thumbnail.types'

/**
 * Fresh uploads own the compute worker and the bandwidth. Four at a time was
 * tuned against a 534-file drop, where one pipeline per file buried the server.
 */
const UPLOAD_CONCURRENCY = 4

/** Backfill is strictly background work, and each job costs a full download. */
const BACKFILL_CONCURRENCY = 2

/**
 * Picks the next job for a lane and removes it from the queue.
 *
 * The lane's ordering lives here and nowhere else: upload takes from the front,
 * backfill from the back.
 */
function takeNext(queue: ThumbJob[], mode: ThumbMode): ThumbJob | null {
  let index = -1
  if (mode === 'upload') {
    index = queue.findIndex((j) => j.mode === 'upload')
  } else {
    // Hand-rolled instead of `findLastIndex`, which needs `lib: es2023` — not
    // worth a repo-wide tsconfig change for one line.
    for (let i = queue.length - 1; i >= 0; i--) {
      if (queue[i].mode === 'backfill') {
        index = i
        break
      }
    }
  }
  if (index === -1) return null
  return queue.splice(index, 1)[0]
}

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
     * Queues a job unless the item is already queued or running. The dedup is
     * what replaces the module-level `thumbnailedIds` Set the old runner used.
     */
    /**
     * Queues a job, one per item.
     *
     * An upload job **replaces** a queued backfill for the same item. The two
     * race on every upload: the item is created, the route revalidates, and the
     * new card's viewport backfill queues a file-less job before the runner's
     * upload job lands. Keeping the first one threw away the only in-memory
     * copy of the file and left a job that re-downloads it and stops at stage
     * 2. A job that is already running is left alone either way.
     */
    addJob: assign(({ context, event }) => {
      if (event.type !== 'enqueue') return {}
      const { job } = event
      if (context.running.has(job.itemId)) return {}
      const queued = context.queue.findIndex((q) => q.itemId === job.itemId)
      if (queued === -1) return { queue: [...context.queue, job] }
      if (job.mode === 'upload' && context.queue[queued].mode === 'backfill') {
        const queue = [...context.queue]
        queue[queued] = job
        return { queue }
      }
      return {}
    }),

    /**
     * Drops a *queued* job only. A running one is deliberately left to finish:
     * its download is already paid for, and throwing the result away would be
     * strictly worse than keeping it. Because the machine outlives every card,
     * the result still persists even though the card that asked for it is gone
     * — the old code needed a separate detached-PATCH path for exactly this.
     */
    dropQueued: assign(({ context, event }) => {
      if (event.type !== 'cancel') return {}
      return { queue: context.queue.filter((q) => q.itemId !== event.itemId) }
    }),

    recordProgress: assign(({ context, event }) => {
      if (event.type !== 'child.progress') return {}
      const progress = new Map(context.progress)
      progress.set(event.itemId, event.progress)
      return { progress }
    }),

    /**
     * Frees the slot and, for a backfill that produced nothing, writes the item
     * to the permanent skip list.
     *
     * Only backfill failures are remembered. An upload-time failure is often
     * transient (a compute timeout in a huge batch), and remembering it would
     * block the very backfill that exists to recover from it.
     */
    freeSlot: assign(({ context, event }) => {
      if (event.type !== 'child.settled') return {}
      const entry = context.running.get(event.itemId)
      if (entry?.mode === 'backfill' && !event.thumbnailed) {
        rememberFailure(event.itemId)
      }
      const running = new Map(context.running)
      running.delete(event.itemId)
      return { running }
    }),

    drainUpload: assign(({ context, spawn, self }) =>
      drainLane(context, spawn, self, 'upload', UPLOAD_CONCURRENCY)
    ),

    drainBackfill: assign(({ context, spawn, self }) =>
      drainLane(context, spawn, self, 'backfill', BACKFILL_CONCURRENCY)
    ),

    /**
     * Defers the backfill drain to an idle frame, so a backfill never begins on
     * a frame the user is scrolling or typing in. If the lane pauses in the
     * meantime the follow-up event is simply unhandled — which is the point of
     * making `paused` a state.
     */
    scheduleBackfillDrain: ({ self }) => {
      whenIdle(() => self.send({ type: 'drainBackfillNow' }))
    },
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QBcAWBXAtgIwHYEMBLAGwFpN8CYAnAYjFwEd0wWBtABgF1FQAHAPaxCyQgNy8QAD0QAmAByyAdAE4VigKzqAbABZts2QHYNAGhABPRBt3KAjLLs3HugMy6Ns1wF9v5tFh4RGQUVGB0AMaUEWDEnDxIIILCouKSMggK9i5G8iraHHbadkZG5lYIuvpK8hpG2hqusip2ahz6vv4YOAQk5JT4NLQRqCQQSnzUAlDUcLDxkskiYhKJGcauSqUaRUUmDhz55YiuO0parvVVuhye8tqdIAE9wf1hkaPE45hgyPgQ+D+AGV8AA3SALRJLVKrUDrDQcJTGbQqDjNDhGfK3Y6ZDTaJRNdQmDR5DjabTyR7PIJ9UKDcLDT7jWC-ZDECHcRZCZZpNZyeR2LZ2dwtRr5U7yHF2DFI7SueQK2p2fR2eS6KndGkhAZDWag-DEQgAmEAYXEsCwHIS-G5MPScg8SjszpUrj2eg2rilsg1gV62veSmw+AiAGsAGYkYgAGUoYCUIdE4NoojDACEQxGo5CbSkVvaEM7BXitPlPOWmmVLIh1PIlBw3e52tLlUY7L6XrSdeEg5nI8QY3GExEk2BaBBqERcBmw-3iAA5AQAdxzSVt+b5hccSKMHHucpU+jFuhxeWU9SMHicJIpOw7Wre9OovdnUdjuHjicIyb4+HQLJnLMB1XaENzhE5HXlGxVQbVEOFuKsKmdYwkQ8NwiVcAoSXvf1HxoF8gMHD8Jj-FkIFoWYLR+QC5xA9deXAhB3A0Alal0GDXDghCpQxIwlDcdEmk8JoHkeXABAgOBJGpXC6RoLk8wY6REFIZUcW0XInXkEwFAVaU6h9Pwnk1WTu2fdA+GIAR-nfMAFJ5WFlMqRDEHqFivAUeD9FRYUcNeOSe2DV8B1s+y7U3dxT1uLZDHQ+U1RUXI-K7QMgsI2zh1HMKwKcxQeIVJEVE8ZpZGKAoVGSgMnwIucMt-f9IGypSMh2XRVAKW5kOKBtZClBxBU0LIvExQxDN8IA */
  id: 'thumbnail-manager',
  context: {
    queue: [],
    running: new Map(),
    progress: new Map(),
  },

  on: {
    enqueue: {
      actions: ['addJob', 'drainUpload', raise({ type: 'tickBackfill' })],
    },
    cancel: { actions: 'dropQueued' },
    'child.progress': { actions: 'recordProgress' },
    'child.settled': {
      actions: ['freeSlot', 'drainUpload', raise({ type: 'tickBackfill' })],
    },
  },

  type: 'parallel',
  states: {
    /**
     * Uploads never pause — a file the user is actively dropping is the highest
     * priority thing in the app — so this lane has no states of its own and is
     * driven entirely by the root handlers above.
     */
    uploadLane: {},

    backfillLane: {
      initial: 'active',
      states: {
        active: {
          // Covers the resume case: entering `active` immediately looks for work
          // that piled up while paused.
          entry: 'scheduleBackfillDrain',
          on: {
            tickBackfill: { actions: 'scheduleBackfillDrain' },
            drainBackfillNow: { actions: 'drainBackfill' },
            pauseBackfill: { target: 'paused' },
          },
        },
        paused: {
          on: {
            resumeBackfill: { target: 'active' },
            // `tickBackfill` and `drainBackfillNow` are intentionally unhandled
            // here — a paused lane cannot start work, by construction.
          },
        },
      },
    },
  },
})

/**
 * Fills a lane's free slots, spawning one item actor per job.
 *
 * `spawn` is only reachable from inside `assign`, and a child's emissions have
 * to be wired to the manager at the moment its ref exists — so the
 * subscriptions are set up here, alongside the spawn, rather than in a separate
 * action that would have to go looking for the ref again.
 *
 * The child reports outward with `emit` rather than `sendParent` so that it can
 * be unit-tested as a root actor; the cost of that choice is paid right here,
 * in two explicit `.on(...)` hookups and a completion subscription.
 */
function drainLane(
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
  let spawned = false

  while (free > 0) {
    const job = takeNext(queue, mode)
    if (!job) break
    free--
    spawned = true

    markAttempted(job.itemId)

    const ref = spawn('item', {
      // Actor id is the item id, which makes the inspector readable and keeps
      // a second spawn for the same item impossible.
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

  return spawned ? { queue, running } : {}
}
