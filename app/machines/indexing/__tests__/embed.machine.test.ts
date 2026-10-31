/**
 * Embed machine tests.
 *
 * Both actors are stubbed, so these check the order of steps, what a retry
 * does, and which ending each failure lands in — not the embedding model or the
 * server, which have their own coverage.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { createActor, fromPromise, toPromise } from 'xstate'
import { embedMachine } from '../embed.machine'

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

const chunks = [
  { id: 'c1', content: 'hello' },
  { id: 'c2', content: 'world' },
]
const twoVectors = [
  [0.1, 0.2],
  [0.3, 0.4],
]

/** Actor stubs where every step succeeds; a test overrides only what it checks. */
function stubs(over: Record<string, unknown> = {}) {
  return {
    embedChunksOnGpu: fromPromise(async () => twoVectors),
    saveVectorsToServer: fromPromise(async () => undefined),
    ...over,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
}

function start(over: Record<string, unknown> = {}) {
  const actor = createActor(embedMachine.provide({ actors: stubs(over) }), {
    input: { itemId: 'i1', chunks },
  })
  actor.start()
  return actor
}

describe('embedMachine', () => {
  it('embeds every chunk, saves the vectors, and ends embedded', async () => {
    const saveVectors = vi.fn(async () => undefined)
    const output = await toPromise(
      start({ saveVectorsToServer: fromPromise(saveVectors) })
    )

    expect(saveVectors).toHaveBeenCalledTimes(1)
    expect(output).toEqual({ itemId: 'i1', outcome: 'embedded' })
  })

  it('ends withoutVectors, saving nothing, when embedding throws', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const saveVectors = vi.fn(async () => undefined)
    const output = await toPromise(
      start({
        embedChunksOnGpu: fromPromise(async () => {
          throw new Error('GPU lost')
        }),
        saveVectorsToServer: fromPromise(saveVectors),
      })
    )

    expect(saveVectors).not.toHaveBeenCalled()
    expect(output.outcome).toBe('withoutVectors')
  })

  it('never saves vectors whose count does not match the chunks', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const saveVectors = vi.fn(async () => undefined)
    const output = await toPromise(
      start({
        embedChunksOnGpu: fromPromise(async () => [[0.1, 0.2]]),
        saveVectorsToServer: fromPromise(saveVectors),
      })
    )

    expect(saveVectors).not.toHaveBeenCalled()
    expect(output.outcome).toBe('withoutVectors')
  })

  it('retries a failed vector save twice, then gives up on the vectors', async () => {
    vi.useFakeTimers()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    let calls = 0
    const actor = start({
      saveVectorsToServer: fromPromise(async () => {
        calls++
        throw new Error('503')
      }),
    })
    await vi.advanceTimersByTimeAsync(5_000)

    expect(calls).toBe(3)
    expect(actor.getSnapshot().output?.outcome).toBe('withoutVectors')
  })
})
