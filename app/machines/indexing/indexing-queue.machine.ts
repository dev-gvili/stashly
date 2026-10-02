/**
 * Decides which uploaded files are being indexed at any moment.
 *
 * First in, first out, two at a time. The heavy steps all funnel into
 * resources that run one job at a time anyway — the compute worker reads
 * metadata, the WebGPU queue embeds and OCRs — so more slots would only queue
 * work there. Two keeps one file's server round trips overlapping another's
 * GPU time.
 *
 * It also collects "metadata saved" reports from the files it runs, so the page
 * can reload once when the batch is done instead of once per file.
 *
 * One instance for the whole tab lives in `client.ts`.
 */
import { setup, assign } from 'xstate'
import { indexingItemMachine } from './indexing-item.machine'
import type {
  IndexItemOutput,
  IndexQueueContext,
  IndexQueueEvent,
} from './indexing.types'

/** How many files are indexed at the same time. See the header for why two. */
export const INDEXING_CONCURRENCY = 2

export const indexingQueueMachine = setup({
  types: {
    context: {} as IndexQueueContext,
    events: {} as IndexQueueEvent,
  },

  actors: {
    indexingItem: indexingItemMachine,
  },

  actions: {
    /**
     * Puts the file at the back of the queue. A file already queued or running
     * is ignored, so a repeated enqueue for the same upload is harmless.
     */
    addToQueue: assign(({ context, event }) => {
      if (event.type !== 'enqueue') return {}
      const { job } = event
      if (context.running.has(job.itemId)) return {}
      if (context.queue.some((queued) => queued.itemId === job.itemId))
        return {}
      return { queue: [...context.queue, job] }
    }),

    /**
     * Starts queued files until every slot is taken, oldest first.
     *
     * Each started machine reports back by `emit`, so the two subscriptions
     * that forward those reports to this queue are set up here, the moment the
     * machine exists.
     */
    startQueuedFiles: assign(({ context, spawn, self }) => {
      let free = INDEXING_CONCURRENCY - context.running.size
      if (free <= 0 || context.queue.length === 0) return {}

      const queue = [...context.queue]
      const running = new Map(context.running)

      while (free > 0 && queue.length > 0) {
        const job = queue.shift()!
        free--

        const ref = spawn('indexingItem', {
          id: `index-${job.itemId}`,
          input: job,
        })
        ref.on('metadataSaved', (e) =>
          self.send({ type: 'item.metadataSaved', itemId: e.itemId })
        )
        ref.on('failed', (e) =>
          console.error('[indexing] failed', e.itemId, e.reason)
        )
        ref.subscribe({
          complete: () => {
            const output = ref.getSnapshot().output as
              IndexItemOutput | undefined
            self.send({
              type: 'item.finished',
              itemId: job.itemId,
              outcome: output?.outcome ?? 'failed',
            })
          },
        })

        running.set(job.itemId, ref)
      }

      return { queue, running }
    }),

    /** Frees the finished file's slot. */
    removeFinished: assign(({ context, event }) => {
      if (event.type !== 'item.finished') return {}
      const running = new Map(context.running)
      running.delete(event.itemId)
      return { running }
    }),

    /** Notes a metadata save, once per file, for the batch-end page reload. */
    collectMetadataSave: assign(({ context, event }) => {
      if (event.type !== 'item.metadataSaved') return {}
      if (context.metadataSaved.includes(event.itemId)) return {}
      return { metadataSaved: [...context.metadataSaved, event.itemId] }
    }),

    /** Forgets the collected saves; the page has just reloaded them. */
    clearMetadataSaves: assign({ metadataSaved: [] }),
  },
}).createMachine({
  id: 'indexingQueue',
  description:
    'Runs search indexing for uploaded files, two at a time, oldest first, and collects metadata saves so the page reloads once per batch.',
  context: {
    queue: [],
    running: new Map(),
    metadataSaved: [],
  },
  initial: 'accepting',
  states: {
    accepting: {
      description:
        'Always open: queues files as they arrive and starts the next one whenever a slot frees up.',
      on: {
        enqueue: { actions: ['addToQueue', 'startQueuedFiles'] },
        'item.finished': { actions: ['removeFinished', 'startQueuedFiles'] },
        'item.metadataSaved': { actions: 'collectMetadataSave' },
        revalidationDone: { actions: 'clearMetadataSaves' },
      },
    },
  },
})
