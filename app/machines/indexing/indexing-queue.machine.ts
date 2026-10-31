/**
 * Decides which uploaded files are being indexed at any moment, in two lanes.
 *
 * - **Metadata**, always open: each file's metadata machine starts right after
 *   its row exists, two at a time, oldest first. It needs the compute worker
 *   and one request, nothing on the GPU, so a batch's facets are saved within
 *   seconds of its rows. It also collects "metadata saved" reports, so the page
 *   reloads once when the batch is done instead of once per file.
 * - **Deferred**: vectors (`embed.machine`) and OCR (`ocr.machine`), which need
 *   the GPU. Paused while an upload is moving bytes; the upload runner resumes
 *   it once uploads have been idle for a moment. A running job is never
 *   stopped by a pause, it just isn't followed by another.
 *
 * Until tech-debt item 53 one machine per file did all of it in a single slot,
 * so a file's facets waited behind every earlier file's GPU work, and a reload
 * before its turn left it with none.
 *
 * Both lanes run two at a time. The heavy steps all funnel into resources that
 * run one job at a time anyway (the compute worker, the WebGPU queue), so more
 * slots would only queue work there; two keeps one job's server round trips
 * overlapping another's compute time.
 *
 * One instance for the whole tab lives in `client.ts`.
 */
import { setup, assign, raise, type AnyActorRef } from 'xstate'
import { indexingItemMachine } from './indexing-item.machine'
import { embedMachine } from './embed.machine'
import { ocrMachine } from './ocr.machine'
import type {
  DeferredJob,
  IndexItemOutput,
  IndexQueueContext,
  IndexQueueEvent,
  OcrEmitted,
} from './indexing.types'

/** How many files have their metadata read and saved at the same time. */
export const INDEXING_CONCURRENCY = 2

/** How many embed or OCR jobs run at the same time. */
export const DEFERRED_CONCURRENCY = 2

export const indexingQueueMachine = setup({
  types: {
    context: {} as IndexQueueContext,
    events: {} as IndexQueueEvent,
  },

  actors: {
    indexingItem: indexingItemMachine,
    embed: embedMachine,
    ocr: ocrMachine,
  },

  actions: {
    /**
     * Puts the file at the back of the metadata queue. A file already queued or
     * running is ignored, so a repeated enqueue for the same upload is harmless.
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
     * Starts queued files until every metadata slot is taken, oldest first.
     *
     * Each started machine reports back by `emit`, so the subscriptions that
     * forward those reports to this queue are set up here, the moment the
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
              output: output ?? {
                itemId: job.itemId,
                outcome: 'failed',
                chunks: [],
                needsOcr: false,
                file: job.file,
              },
            })
          },
        })

        running.set(job.itemId, ref)
      }

      return { queue, running }
    }),

    /** Frees the finished file's metadata slot. */
    removeFinished: assign(({ context, event }) => {
      if (event.type !== 'item.finished') return {}
      const running = new Map(context.running)
      running.delete(event.output.itemId)
      return { running }
    }),

    /**
     * Queues the GPU work a file's metadata step left: an embed job for the
     * chunks the server cut, then OCR for a scanned PDF.
     */
    deferFollowUps: assign(({ context, event }) => {
      if (event.type !== 'item.finished') return {}
      const { itemId, outcome, chunks, needsOcr, file } = event.output
      if (outcome !== 'indexed') return {}

      const added: DeferredJob[] = []
      let seq = context.deferredSeq
      if (chunks.length > 0) {
        added.push({
          kind: 'embed',
          key: `embed-${itemId}-${seq++}`,
          job: { itemId, chunks },
        })
      }
      if (needsOcr) {
        added.push({ kind: 'ocr', key: `ocr-${itemId}`, job: { itemId, file } })
      }
      if (added.length === 0) return {}
      return { deferred: [...context.deferred, ...added], deferredSeq: seq }
    }),

    /** Queues an embed job for one OCR page's chunks. */
    addPageEmbedJob: assign(({ context, event }) => {
      if (event.type !== 'deferred.chunks') return {}
      const seq = context.deferredSeq
      return {
        deferred: [
          ...context.deferred,
          {
            kind: 'embed' as const,
            key: `embed-${event.itemId}-${seq}`,
            job: { itemId: event.itemId, chunks: event.chunks },
          },
        ],
        deferredSeq: seq + 1,
      }
    }),

    /** Tells the deferred lane that jobs arrived, whichever state it is in. */
    announceDeferredJobs: raise({ type: 'deferred.added' }),

    /** Starts deferred jobs until every slot is taken, oldest first. */
    startDeferredJobs: assign(({ context, spawn, self }) => {
      let free = DEFERRED_CONCURRENCY - context.deferredRunning.size
      if (free <= 0 || context.deferred.length === 0) return {}

      const deferred = [...context.deferred]
      const deferredRunning = new Map(context.deferredRunning)

      while (free > 0 && deferred.length > 0) {
        const next = deferred.shift()!
        free--

        let ref: AnyActorRef
        if (next.kind === 'embed') {
          ref = spawn('embed', { id: next.key, input: next.job })
        } else {
          const ocr = spawn('ocr', { id: next.key, input: next.job })
          ocr.on('pageChunks', (e: Extract<OcrEmitted, { type: 'pageChunks' }>) =>
            self.send({
              type: 'deferred.chunks',
              itemId: e.itemId,
              chunks: e.chunks,
            })
          )
          ocr.on('failed', (e: Extract<OcrEmitted, { type: 'failed' }>) =>
            console.error('[ocr] failed', e.itemId, e.reason)
          )
          ref = ocr
        }
        ref.subscribe({
          complete: () =>
            self.send({ type: 'deferred.finished', key: next.key }),
        })
        deferredRunning.set(next.key, ref)
      }

      return { deferred, deferredRunning }
    }),

    /** Frees the finished embed or OCR job's slot. */
    removeDeferredFinished: assign(({ context, event }) => {
      if (event.type !== 'deferred.finished') return {}
      const deferredRunning = new Map(context.deferredRunning)
      deferredRunning.delete(event.key)
      return { deferredRunning }
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
    'Runs search indexing for uploaded files in two lanes: metadata at once, two at a time; vectors and OCR once uploads are idle. Collects metadata saves so the page reloads once per batch.',
  type: 'parallel',
  context: {
    queue: [],
    running: new Map(),
    metadataSaved: [],
    deferred: [],
    deferredRunning: new Map(),
    deferredSeq: 0,
  },
  states: {
    metadata: {
      description:
        "Reads and saves each uploaded file's metadata as soon as its row exists, two at a time, oldest first.",
      initial: 'accepting',
      states: {
        accepting: {
          description:
            "Always open: queues files as they arrive, starts the next one whenever a slot frees up, and passes each finished file's GPU work to the deferred lane.",
          on: {
            enqueue: { actions: ['addToQueue', 'startQueuedFiles'] },
            'item.finished': {
              actions: [
                'removeFinished',
                'deferFollowUps',
                'startQueuedFiles',
                'announceDeferredJobs',
              ],
            },
            'item.metadataSaved': { actions: 'collectMetadataSave' },
            revalidationDone: { actions: 'clearMetadataSaves' },
          },
        },
      },
    },

    deferred: {
      description:
        'Embedding and OCR, which need the GPU. Kept off while uploads move bytes, so they never delay an upload or its metadata.',
      initial: 'running',
      on: {
        'deferred.chunks': {
          actions: ['addPageEmbedJob', 'announceDeferredJobs'],
        },
        'deferred.finished': {
          actions: ['removeDeferredFinished', 'announceDeferredJobs'],
        },
      },
      states: {
        running: {
          description:
            'Starts embed and OCR jobs, two at a time, oldest first, whenever a slot is free.',
          entry: 'startDeferredJobs',
          on: {
            'deferred.added': { actions: 'startDeferredJobs' },
            pauseDeferred: 'paused',
          },
        },
        paused: {
          description:
            'An upload is moving bytes: jobs keep queueing and running jobs finish, but none is started. The upload runner resumes the lane once uploads are idle.',
          on: {
            resumeDeferred: 'running',
          },
        },
      },
    },
  },
})
