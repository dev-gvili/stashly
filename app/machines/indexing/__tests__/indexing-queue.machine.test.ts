/**
 * Indexing queue tests — scheduling only.
 *
 * The metadata, embed and OCR machines are replaced with stubs the test
 * finishes by hand, so these check how many jobs run at once, in what order,
 * what each finished file leaves for the deferred lane, that a paused lane
 * starts nothing, and how metadata saves are collected for the one page
 * reload per batch.
 */
import { describe, it, expect } from 'vitest'
import { createActor, setup, emit } from 'xstate'
import {
  indexingQueueMachine,
  INDEXING_CONCURRENCY,
  DEFERRED_CONCURRENCY,
} from '../indexing-queue.machine'
import type {
  EmbedInput,
  IndexItemEmitted,
  IndexItemInput,
  IndexItemOutput,
  OcrEmitted,
  OcrInput,
  SearchChunkDraft,
} from '../indexing.types'

/** What each stubbed metadata run hands back, by item id; default: nothing to defer. */
let outputs: Record<string, Partial<IndexItemOutput>> = {}

/** Stands in for the metadata machine: runs until the test sends FINISH. */
const stubItemMachine = setup({
  types: {
    context: {} as IndexItemInput,
    input: {} as IndexItemInput,
    output: {} as IndexItemOutput,
    emitted: {} as IndexItemEmitted,
    events: {} as { type: 'FINISH' } | { type: 'SAVE_METADATA' },
  },
}).createMachine({
  context: ({ input }) => input,
  initial: 'working',
  output: ({ context }) => ({
    itemId: context.itemId,
    outcome: 'indexed',
    chunks: [],
    needsOcr: false,
    file: context.file,
    ...outputs[context.itemId],
  }),
  states: {
    working: {
      on: {
        SAVE_METADATA: {
          actions: emit(({ context }) => ({
            type: 'metadataSaved' as const,
            itemId: context.itemId,
          })),
        },
        FINISH: 'done',
      },
    },
    done: { type: 'final' },
  },
})

/** Stands in for the embed machine: runs until FINISH. */
const stubEmbedMachine = setup({
  types: {
    context: {} as EmbedInput,
    input: {} as EmbedInput,
    events: {} as { type: 'FINISH' },
  },
}).createMachine({
  context: ({ input }) => input,
  initial: 'working',
  states: { working: { on: { FINISH: 'done' } }, done: { type: 'final' } },
})

/** Stands in for the OCR machine: PAGE hands out a page's chunks, FINISH ends it. */
const stubOcrMachine = setup({
  types: {
    context: {} as OcrInput,
    input: {} as OcrInput,
    emitted: {} as OcrEmitted,
    events: {} as
      | { type: 'FINISH' }
      | { type: 'PAGE'; chunks: SearchChunkDraft[] },
  },
}).createMachine({
  context: ({ input }) => input,
  initial: 'working',
  states: {
    working: {
      on: {
        PAGE: {
          actions: emit(({ context, event }) => ({
            type: 'pageChunks' as const,
            itemId: context.itemId,
            chunks: event.chunks,
          })),
        },
        FINISH: 'done',
      },
    },
    done: { type: 'final' },
  },
})

const fileFor = (itemId: string) =>
  new File(['x'], `${itemId}.txt`, { type: 'text/plain' })
const chunk = (id: string) => [{ id, content: id }]

function startQueue() {
  outputs = {}
  const actor = createActor(
    indexingQueueMachine.provide({
      actors: {
        // eslint-disable-next-line no-restricted-syntax -- test stub standing in for a child machine or actor, only the events this test sends exist
        indexingItem: stubItemMachine as any,
        // eslint-disable-next-line no-restricted-syntax -- test stub standing in for a child machine or actor, only the events this test sends exist
        embed: stubEmbedMachine as any,
        // eslint-disable-next-line no-restricted-syntax -- test stub standing in for a child machine or actor, only the events this test sends exist
        ocr: stubOcrMachine as any,
      },
    })
  )
  actor.start()
  return actor
}

type Queue = ReturnType<typeof startQueue>

const enqueue = (q: Queue, itemId: string) =>
  q.send({ type: 'enqueue', job: { itemId, file: fileFor(itemId) } })
const runningIds = (q: Queue) =>
  Array.from(q.getSnapshot().context.running.keys())
const queuedIds = (q: Queue) =>
  q.getSnapshot().context.queue.map((j) => j.itemId)
const send = (q: Queue, itemId: string, type: 'FINISH' | 'SAVE_METADATA') =>
  q.getSnapshot().context.running.get(itemId)!.send({ type })
const deferredRunning = (q: Queue) =>
  Array.from(q.getSnapshot().context.deferredRunning.keys())
const deferredQueued = (q: Queue) =>
  q.getSnapshot().context.deferred.map((j) => j.key)
const finishDeferred = (q: Queue, key: string) =>
  q.getSnapshot().context.deferredRunning.get(key)!.send({ type: 'FINISH' })

describe('indexingQueue — metadata lane', () => {
  it(`runs ${INDEXING_CONCURRENCY} files at a time and queues the rest`, () => {
    const q = startQueue()
    for (const id of ['a', 'b', 'c', 'd']) enqueue(q, id)

    expect(runningIds(q)).toEqual(['a', 'b'])
    expect(queuedIds(q)).toEqual(['c', 'd'])
  })

  it('starts the oldest queued file when one finishes', () => {
    const q = startQueue()
    for (const id of ['a', 'b', 'c', 'd']) enqueue(q, id)
    send(q, 'a', 'FINISH')

    expect(runningIds(q)).toEqual(['b', 'c'])
    expect(queuedIds(q)).toEqual(['d'])
  })

  it('ignores a second enqueue for a file already running or queued', () => {
    const q = startQueue()
    for (const id of ['a', 'b', 'c']) enqueue(q, id)
    enqueue(q, 'a')
    enqueue(q, 'c')

    expect(runningIds(q)).toEqual(['a', 'b'])
    expect(queuedIds(q)).toEqual(['c'])
  })

  it('collects metadata saves once per file until the page reloads', () => {
    const q = startQueue()
    enqueue(q, 'a')
    enqueue(q, 'b')
    send(q, 'a', 'SAVE_METADATA')
    send(q, 'a', 'SAVE_METADATA')
    send(q, 'b', 'SAVE_METADATA')

    expect(q.getSnapshot().context.metadataSaved).toEqual(['a', 'b'])

    q.send({ type: 'revalidationDone' })
    expect(q.getSnapshot().context.metadataSaved).toEqual([])
  })

  it('keeps reading metadata while the deferred lane is paused', () => {
    const q = startQueue()
    q.send({ type: 'pauseDeferred' })
    for (const id of ['a', 'b', 'c']) enqueue(q, id)
    send(q, 'a', 'FINISH')

    expect(runningIds(q)).toEqual(['b', 'c'])
  })
})

describe('indexingQueue — deferred lane', () => {
  it("embeds a finished file's chunks, then OCRs it when it is a scanned PDF", () => {
    const q = startQueue()
    q.send({ type: 'pauseDeferred' })
    outputs = { a: { chunks: chunk('a1'), needsOcr: true } }
    enqueue(q, 'a')
    send(q, 'a', 'FINISH')

    expect(deferredQueued(q)).toEqual(['embed-a-0', 'ocr-a'])
    expect(deferredRunning(q)).toEqual([])
  })

  it('queues nothing for a file with no chunks and no OCR, or one that failed', () => {
    const q = startQueue()
    outputs = { b: { outcome: 'failed', chunks: chunk('b1'), needsOcr: true } }
    enqueue(q, 'a')
    enqueue(q, 'b')
    send(q, 'a', 'FINISH')
    send(q, 'b', 'FINISH')

    expect(deferredQueued(q)).toEqual([])
    expect(deferredRunning(q)).toEqual([])
  })

  it('starts nothing while paused, then starts oldest first on resume', () => {
    const q = startQueue()
    q.send({ type: 'pauseDeferred' })
    outputs = {
      a: { chunks: chunk('a1') },
      b: { chunks: chunk('b1') },
      c: { chunks: chunk('c1') },
    }
    for (const id of ['a', 'b', 'c']) enqueue(q, id)
    for (const id of ['a', 'b']) send(q, id, 'FINISH')
    send(q, 'c', 'FINISH')

    expect(deferredRunning(q)).toEqual([])

    q.send({ type: 'resumeDeferred' })
    expect(deferredRunning(q)).toEqual(['embed-a-0', 'embed-b-1'])
    expect(deferredQueued(q)).toEqual(['embed-c-2'])
  })

  it(`runs ${DEFERRED_CONCURRENCY} deferred jobs at a time while running`, () => {
    const q = startQueue()
    outputs = {
      a: { chunks: chunk('a1') },
      b: { chunks: chunk('b1') },
      c: { chunks: chunk('c1') },
    }
    for (const id of ['a', 'b', 'c']) enqueue(q, id)
    for (const id of ['a', 'b']) send(q, id, 'FINISH')
    send(q, 'c', 'FINISH')

    expect(deferredRunning(q)).toEqual(['embed-a-0', 'embed-b-1'])

    finishDeferred(q, 'embed-a-0')
    expect(deferredRunning(q)).toEqual(['embed-b-1', 'embed-c-2'])
  })

  it('lets a running job finish when paused, but starts no new one', () => {
    const q = startQueue()
    outputs = { a: { chunks: chunk('a1') }, b: { chunks: chunk('b1') }, c: { chunks: chunk('c1') } }
    for (const id of ['a', 'b', 'c']) enqueue(q, id)
    for (const id of ['a', 'b']) send(q, id, 'FINISH')
    send(q, 'c', 'FINISH')
    q.send({ type: 'pauseDeferred' })
    finishDeferred(q, 'embed-a-0')

    expect(deferredRunning(q)).toEqual(['embed-b-1'])
    expect(deferredQueued(q)).toEqual(['embed-c-2'])
  })

  it('turns each OCR page into an embed job', () => {
    const q = startQueue()
    outputs = { s: { needsOcr: true } }
    enqueue(q, 's')
    send(q, 's', 'FINISH')
    expect(deferredRunning(q)).toEqual(['ocr-s'])

    const ocr = q.getSnapshot().context.deferredRunning.get('ocr-s')!
    ocr.send({ type: 'PAGE', chunks: chunk('p1') })
    ocr.send({ type: 'PAGE', chunks: chunk('p2') })

    expect(deferredRunning(q)).toEqual(['ocr-s', 'embed-s-0'])
    expect(deferredQueued(q)).toEqual(['embed-s-1'])
  })
})
