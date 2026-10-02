/**
 * Indexing queue tests — scheduling only.
 *
 * The item machine is replaced with a stub the test finishes by hand, so these
 * check how many files run at once, in what order, and how metadata saves are
 * collected for the one page reload per batch.
 */
import { describe, it, expect } from 'vitest'
import { createActor, setup, emit } from 'xstate'
import {
  indexingQueueMachine,
  INDEXING_CONCURRENCY,
} from '../indexing-queue.machine'
import type {
  IndexItemEmitted,
  IndexItemInput,
  IndexItemOutput,
} from '../indexing.types'

/** Stands in for the item machine: runs until the test sends FINISH. */
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
  output: ({ context }) => ({ itemId: context.itemId, outcome: 'indexed' }),
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

const fileFor = (itemId: string) =>
  new File(['x'], `${itemId}.txt`, { type: 'text/plain' })

function startQueue() {
  const actor = createActor(
    indexingQueueMachine.provide({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      actors: { indexingItem: stubItemMachine as any },
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

describe('indexingQueue', () => {
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
})
