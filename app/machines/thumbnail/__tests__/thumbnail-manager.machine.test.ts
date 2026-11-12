/**
 * Manager tests — scheduling only.
 *
 * The item machine is replaced with a stub the test finishes by hand, so these
 * check how many jobs run at once, in what order, what pausing does, what a
 * card leaving the screen does, and what happens to an uploaded file's job.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { createActor, setup, emit, assign } from 'xstate'
import { thumbnailManagerMachine } from '../thumbnail-manager.machine'
import { resetAttemptStore, failedIds, shouldSkip } from '../attempt-store'
import { holdFile, hasHeldFile, resetHeldFiles } from '../held-files'
import type {
  ThumbItemInput,
  ThumbItemOutput,
  ThumbItemEmitted,
  ThumbJob,
  ThumbMode,
} from '../thumbnail.types'

/**
 * Stands in for the real item machine: runs until the test tells it to
 * finish, and paints a stage when asked. Lets a test hold N jobs "in flight"
 * without any compute.
 */
const stubItemMachine = setup({
  types: {
    context: {} as ThumbItemInput & { thumbnailed: boolean },
    input: {} as ThumbItemInput,
    output: {} as ThumbItemOutput,
    emitted: {} as ThumbItemEmitted,
    events: {} as
      | { type: 'FINISH'; thumbnailed?: boolean }
      | { type: 'EMIT_PROGRESS'; src: string },
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

const fileFor = (itemId: string) =>
  new File([new Uint8Array([1])], `${itemId}.png`, { type: 'image/png' })

const job = (itemId: string, mode: ThumbMode): ThumbJob => ({
  itemId,
  mode,
  file: mode === 'fromMemory' ? fileFor(itemId) : null,
})

function startManager() {
  const actor = createActor(
    thumbnailManagerMachine.provide({
      // eslint-disable-next-line no-restricted-syntax -- test stub standing in for a child machine or actor, only the events this test sends exist
      actors: { item: stubItemMachine as any },
    })
  )
  actor.start()
  return actor
}

/** The download lane starts on an idle frame, which is a `setTimeout` here. */
const tick = () => new Promise((r) => setTimeout(r, 10))

type Manager = ReturnType<typeof startManager>

const runningIds = (m: Manager) =>
  Array.from(m.getSnapshot().context.running.keys())
const queuedIds = (m: Manager) =>
  m.getSnapshot().context.queue.map((j) => j.itemId)
const enqueue = (m: Manager, itemId: string, mode: ThumbMode) =>
  m.send({ type: 'enqueue', job: job(itemId, mode) })

function finish(m: Manager, itemId: string, thumbnailed = true) {
  m.getSnapshot()
    .context.running.get(itemId)!
    .ref.send({ type: 'FINISH', thumbnailed })
}

beforeEach(() => {
  resetAttemptStore()
  resetHeldFiles()
})

describe('thumbnailManager — memory lane', () => {
  it('runs at most four jobs at a time and queues the rest', () => {
    const m = startManager()
    for (const id of ['a', 'b', 'c', 'd', 'e', 'f']) enqueue(m, id, 'fromMemory')

    expect(runningIds(m)).toEqual(['a', 'b', 'c', 'd'])
    expect(queuedIds(m)).toEqual(['e', 'f'])
  })

  it('starts the newest queued job when one finishes', () => {
    const m = startManager()
    for (const id of ['a', 'b', 'c', 'd', 'e', 'f']) enqueue(m, id, 'fromMemory')
    finish(m, 'a')

    // f was requested last: it is the card the user just scrolled to.
    expect(runningIds(m)).toEqual(['b', 'c', 'd', 'f'])
    expect(queuedIds(m)).toEqual(['e'])
  })

  it('moves a re-requested queued job to the newest position', () => {
    const m = startManager()
    for (const id of ['a', 'b', 'c', 'd', 'e', 'f']) enqueue(m, id, 'fromMemory')
    enqueue(m, 'e', 'fromMemory')
    finish(m, 'a')

    expect(runningIds(m)).toContain('e')
    expect(queuedIds(m)).toEqual(['f'])
  })

  it('ignores a request for an item already running', () => {
    const m = startManager()
    enqueue(m, 'a', 'fromMemory')
    enqueue(m, 'a', 'fromMemory')

    expect(runningIds(m)).toEqual(['a'])
    expect(queuedIds(m)).toEqual([])
  })

  it('keeps running while downloads are paused', async () => {
    const m = startManager()
    m.send({ type: 'pauseDownloads' })
    enqueue(m, 'd1', 'fromDownload')
    enqueue(m, 'u1', 'fromMemory')
    await tick()

    expect(runningIds(m)).toEqual(['u1'])
  })

  it('lets go of the uploaded file once its job finishes', () => {
    const m = startManager()
    holdFile('a', fileFor('a'))
    enqueue(m, 'a', 'fromMemory')
    expect(hasHeldFile('a')).toBe(true)

    finish(m, 'a', false)

    expect(hasHeldFile('a')).toBe(false)
  })
})

describe('thumbnailManager — download lane', () => {
  it('runs at most two downloads, newest first', async () => {
    const m = startManager()
    for (const id of ['b1', 'b2', 'b3', 'b4']) enqueue(m, id, 'fromDownload')
    await tick()

    expect(runningIds(m)).toEqual(['b4', 'b3'])
    expect(queuedIds(m)).toEqual(['b1', 'b2'])
  })

  it('does not start downloads while paused, and picks them up on resume', async () => {
    const m = startManager()
    m.send({ type: 'pauseDownloads' })
    enqueue(m, 'b1', 'fromDownload')
    await tick()
    expect(runningIds(m)).toEqual([])

    m.send({ type: 'resumeDownloads' })
    await tick()
    expect(runningIds(m)).toEqual(['b1'])
  })

  it('gives each lane its own slots', async () => {
    const m = startManager()
    for (const id of ['u1', 'u2', 'u3', 'u4']) enqueue(m, id, 'fromMemory')
    enqueue(m, 'b1', 'fromDownload')
    await tick()

    expect(runningIds(m)).toContain('b1')
    expect(runningIds(m)).toHaveLength(5)
  })

  it('switches a queued download to memory when the upload file arrives', async () => {
    const m = startManager()
    m.send({ type: 'pauseDownloads' })
    enqueue(m, 'x', 'fromDownload')
    await tick()

    const file = fileFor('x')
    m.send({ type: 'fileHeld', itemId: 'x', file })

    expect(runningIds(m)).toEqual(['x'])
    expect(m.getSnapshot().context.running.get('x')?.mode).toBe('fromMemory')
    expect(queuedIds(m)).toEqual([])
  })

  it('queues nothing when a file arrives for a card nobody has seen', () => {
    const m = startManager()
    m.send({ type: 'fileHeld', itemId: 'unseen', file: fileFor('unseen') })

    expect(runningIds(m)).toEqual([])
    expect(queuedIds(m)).toEqual([])
  })
})

describe('thumbnailManager — card leaves the screen', () => {
  it('drops a queued job', async () => {
    const m = startManager()
    for (const id of ['b1', 'b2', 'b3']) enqueue(m, id, 'fromDownload')
    await tick()
    m.send({ type: 'cancel', itemId: 'b1' })

    expect(queuedIds(m)).toEqual([])
  })

  it('leaves a running job alone', async () => {
    const m = startManager()
    enqueue(m, 'b1', 'fromDownload')
    await tick()
    m.send({ type: 'cancel', itemId: 'b1' })

    expect(runningIds(m)).toEqual(['b1'])
  })

  it('keeps the uploaded file when its queued job is dropped', () => {
    const m = startManager()
    for (const id of ['a', 'b', 'c', 'd']) enqueue(m, id, 'fromMemory')
    holdFile('e', fileFor('e'))
    enqueue(m, 'e', 'fromMemory')
    m.send({ type: 'cancel', itemId: 'e' })

    // The next time the card is seen it still runs from memory.
    expect(queuedIds(m)).toEqual([])
    expect(hasHeldFile('e')).toBe(true)
    expect(shouldSkip('e', 'fromMemory')).toBe(false)
  })
})

describe('thumbnailManager — progress', () => {
  it('records what a child paints, keyed by item', () => {
    const m = startManager()
    enqueue(m, 'u1', 'fromMemory')
    m.getSnapshot().context.running.get('u1')!.ref.send({
      type: 'EMIT_PROGRESS',
      src: 'https://s3.test/u1.webp?v=2',
    })

    expect(m.getSnapshot().context.progress.get('u1')).toEqual({
      stage: 2,
      src: 'https://s3.test/u1.webp?v=2',
    })
  })
})

describe('thumbnailManager — what is tried again', () => {
  it('puts a download that produced nothing on the permanent skip list', async () => {
    const m = startManager()
    enqueue(m, 'b1', 'fromDownload')
    await tick()
    finish(m, 'b1', false)

    expect(failedIds().has('b1')).toBe(true)
    expect(shouldSkip('b1', 'fromDownload')).toBe(true)
  })

  it('leaves one download open after a memory job fails', () => {
    const m = startManager()
    enqueue(m, 'u1', 'fromMemory')
    finish(m, 'u1', false)

    expect(failedIds().has('u1')).toBe(false)
    expect(shouldSkip('u1', 'fromMemory')).toBe(true)
    expect(shouldSkip('u1', 'fromDownload')).toBe(false)
  })

  it('does not remember a download that succeeded', async () => {
    const m = startManager()
    enqueue(m, 'b1', 'fromDownload')
    await tick()
    finish(m, 'b1', true)

    expect(failedIds().has('b1')).toBe(false)
  })
})
