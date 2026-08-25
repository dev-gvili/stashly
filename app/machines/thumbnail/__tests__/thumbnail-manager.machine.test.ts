/**
 * Manager tests — scheduling only.
 *
 * The item machine is replaced with a stub the test drives by hand, so these
 * assert exactly the behaviour that used to be spread across three hand-rolled
 * queues: how many jobs run at once, in what order, what pausing does, and what
 * happens to a job whose card disappeared.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createActor, setup, emit, assign } from 'xstate'
import { thumbnailManagerMachine } from '../thumbnail-manager.machine'
import { resetAttemptStore, failedIds } from '../attempt-store'
import type {
  ThumbItemInput,
  ThumbItemOutput,
  ThumbItemEmitted,
  ThumbJob,
} from '../thumbnail.types'

/**
 * Stands in for the real item machine: runs until the test tells it to finish,
 * and relays whatever the test asks it to emit. Lets a scheduling test hold N
 * jobs "in flight" without any compute.
 */
const stubItemMachine = setup({
  types: {
    context: {} as ThumbItemInput & { thumbnailed: boolean },
    input: {} as ThumbItemInput,
    output: {} as ThumbItemOutput,
    emitted: {} as ThumbItemEmitted,
    events: {} as
      | { type: 'FINISH'; thumbnailed?: boolean }
      | { type: 'EMIT_PROGRESS'; src: string }
      | { type: 'EMIT_METADATA' },
  },
}).createMachine({
  context: ({ input }) => ({ ...input, thumbnailed: true }),
  initial: 'working',
  output: ({ context }) => ({
    itemId: context.itemId,
    thumbnailed: context.thumbnailed,
  }),
  states: {
    working: {
      on: {
        EMIT_PROGRESS: {
          actions: emit(({ context, event }) => ({
            type: 'progress' as const,
            itemId: context.itemId,
            progress: { stage: 2 as const, src: event.src },
          })),
        },
        EMIT_METADATA: {
          actions: emit(({ context }) => ({
            type: 'metadataSaved' as const,
            itemId: context.itemId,
          })),
        },
        FINISH: {
          target: 'done',
          actions: assign({
            thumbnailed: ({ event }) => event.thumbnailed ?? true,
          }),
        },
      },
    },
    done: { type: 'final' },
  },
})

const job = (itemId: string, mode: 'upload' | 'backfill'): ThumbJob => ({
  itemId,
  mode,
  file:
    mode === 'upload'
      ? new File([new Uint8Array([1])], `${itemId}.png`, { type: 'image/png' })
      : null,
})

function startManager() {
  const actor = createActor(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    thumbnailManagerMachine.provide({
      actors: { item: stubItemMachine as any },
    })
  )
  actor.start()
  return actor
}

/** The backfill lane drains on an idle frame, which is a `setTimeout` here. */
const tick = () => new Promise((r) => setTimeout(r, 10))

type Manager = ReturnType<typeof startManager>

const runningIds = (m: Manager) =>
  Array.from(m.getSnapshot().context.running.keys())
const queuedIds = (m: Manager) =>
  m.getSnapshot().context.queue.map((j) => j.itemId)

function finish(m: Manager, itemId: string, thumbnailed = true) {
  m.getSnapshot()
    .context.running.get(itemId)!
    .ref.send({ type: 'FINISH', thumbnailed })
}

beforeEach(() => {
  resetAttemptStore()
})

describe('thumbnailManager — upload lane', () => {
  it('runs at most four uploads at a time and queues the rest', () => {
    const m = startManager()
    for (const id of ['u1', 'u2', 'u3', 'u4', 'u5', 'u6']) {
      m.send({ type: 'enqueue', job: job(id, 'upload') })
    }

    expect(runningIds(m)).toEqual(['u1', 'u2', 'u3', 'u4'])
    expect(queuedIds(m)).toEqual(['u5', 'u6'])
  })

  it('starts the next queued upload as soon as one settles', () => {
    const m = startManager()
    for (const id of ['u1', 'u2', 'u3', 'u4', 'u5']) {
      m.send({ type: 'enqueue', job: job(id, 'upload') })
    }
    finish(m, 'u2')

    expect(runningIds(m)).toEqual(['u1', 'u3', 'u4', 'u5'])
    expect(queuedIds(m)).toEqual([])
  })

  it('runs uploads in the order they were dropped', () => {
    const m = startManager()
    for (const id of ['a', 'b', 'c', 'd', 'e', 'f']) {
      m.send({ type: 'enqueue', job: job(id, 'upload') })
    }
    finish(m, 'a')
    finish(m, 'b')

    expect(runningIds(m)).toEqual(['c', 'd', 'e', 'f'])
  })

  it('ignores a duplicate enqueue for an item already running', () => {
    const m = startManager()
    m.send({ type: 'enqueue', job: job('u1', 'upload') })
    m.send({ type: 'enqueue', job: job('u1', 'upload') })

    expect(runningIds(m)).toEqual(['u1'])
    expect(queuedIds(m)).toEqual([])
  })

  it('ignores a duplicate enqueue for an item still queued', () => {
    const m = startManager()
    for (const id of ['u1', 'u2', 'u3', 'u4', 'u5']) {
      m.send({ type: 'enqueue', job: job(id, 'upload') })
    }
    m.send({ type: 'enqueue', job: job('u5', 'upload') })

    expect(queuedIds(m)).toEqual(['u5'])
  })
})

describe('thumbnailManager — backfill lane', () => {
  it('runs at most two backfills, newest first', async () => {
    const m = startManager()
    for (const id of ['b1', 'b2', 'b3', 'b4']) {
      m.send({ type: 'enqueue', job: job(id, 'backfill') })
    }
    await tick()

    // LIFO: the cards the user just scrolled to win over the ones they flew past.
    expect(runningIds(m)).toEqual(['b4', 'b3'])
    expect(queuedIds(m)).toEqual(['b1', 'b2'])
  })

  it('keeps taking from the back as slots free up', async () => {
    const m = startManager()
    for (const id of ['b1', 'b2', 'b3', 'b4']) {
      m.send({ type: 'enqueue', job: job(id, 'backfill') })
    }
    await tick()
    finish(m, 'b4')
    await tick()

    expect(runningIds(m)).toEqual(['b3', 'b2'])
  })

  it('does not start backfills while paused', async () => {
    const m = startManager()
    m.send({ type: 'pauseBackfill' })
    m.send({ type: 'enqueue', job: job('b1', 'backfill') })
    await tick()

    expect(runningIds(m)).toEqual([])
    expect(queuedIds(m)).toEqual(['b1'])
  })

  it('picks the backlog up on resume', async () => {
    const m = startManager()
    m.send({ type: 'pauseBackfill' })
    m.send({ type: 'enqueue', job: job('b1', 'backfill') })
    await tick()
    m.send({ type: 'resumeBackfill' })
    await tick()

    expect(runningIds(m)).toEqual(['b1'])
  })

  it('lets uploads through while backfill is paused', async () => {
    const m = startManager()
    m.send({ type: 'pauseBackfill' })
    m.send({ type: 'enqueue', job: job('b1', 'backfill') })
    m.send({ type: 'enqueue', job: job('u1', 'upload') })
    await tick()

    expect(runningIds(m)).toEqual(['u1'])
  })

  it('gives each lane its own slots', async () => {
    const m = startManager()
    for (const id of ['u1', 'u2', 'u3', 'u4']) {
      m.send({ type: 'enqueue', job: job(id, 'upload') })
    }
    m.send({ type: 'enqueue', job: job('b1', 'backfill') })
    await tick()

    // The upload lane being full must not starve backfill, and vice versa.
    expect(runningIds(m)).toContain('b1')
    expect(runningIds(m)).toHaveLength(5)
  })
})

describe('thumbnailManager — cancellation', () => {
  it('drops a queued job', async () => {
    const m = startManager()
    for (const id of ['b1', 'b2', 'b3']) {
      m.send({ type: 'enqueue', job: job(id, 'backfill') })
    }
    await tick()
    m.send({ type: 'cancel', itemId: 'b1' })

    expect(queuedIds(m)).toEqual([])
  })

  it('leaves a running job alone — its download is already paid for', async () => {
    const m = startManager()
    m.send({ type: 'enqueue', job: job('b1', 'backfill') })
    await tick()
    m.send({ type: 'cancel', itemId: 'b1' })

    expect(runningIds(m)).toEqual(['b1'])
  })
})

describe('thumbnailManager — signal and revalidation', () => {
  it('records what a child paints, keyed by item', () => {
    const m = startManager()
    m.send({ type: 'enqueue', job: job('u1', 'upload') })
    m.getSnapshot().context.running.get('u1')!.ref.send({
      type: 'EMIT_PROGRESS',
      src: 'https://s3.test/u1.webp?v=2',
    })

    expect(m.getSnapshot().context.progress.get('u1')).toEqual({
      stage: 2,
      src: 'https://s3.test/u1.webp?v=2',
    })
  })

  it('buffers metadata saves instead of signalling one revalidation per file', () => {
    const m = startManager()
    for (const id of ['u1', 'u2']) {
      m.send({ type: 'enqueue', job: job(id, 'upload') })
      m.getSnapshot()
        .context.running.get(id)!
        .ref.send({ type: 'EMIT_METADATA' })
    }

    expect(m.getSnapshot().context.metadataSaved).toEqual(['u1', 'u2'])

    m.send({ type: 'revalidationConsumed' })
    expect(m.getSnapshot().context.metadataSaved).toEqual([])
  })
})

describe('thumbnailManager — skip list', () => {
  it('remembers a backfill that produced nothing', async () => {
    const m = startManager()
    m.send({ type: 'enqueue', job: job('b1', 'backfill') })
    await tick()
    finish(m, 'b1', false)

    expect(failedIds().has('b1')).toBe(true)
  })

  it('does not remember an upload failure — backfill exists to recover from it', () => {
    const m = startManager()
    m.send({ type: 'enqueue', job: job('u1', 'upload') })
    finish(m, 'u1', false)

    expect(failedIds().has('u1')).toBe(false)
  })

  it('does not remember a backfill that succeeded', async () => {
    const m = startManager()
    m.send({ type: 'enqueue', job: job('b1', 'backfill') })
    await tick()
    finish(m, 'b1', true)

    expect(failedIds().has('b1')).toBe(false)
  })
})
