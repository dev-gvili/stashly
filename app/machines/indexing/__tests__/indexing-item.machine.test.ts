/**
 * Metadata machine tests.
 *
 * Both actors are stubbed, so these check the order of steps, what a retry
 * does, which ending each failure lands in, and what the output hands the
 * queue for the deferred lane — not the metadata reading or the server, which
 * have their own coverage.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { createActor, fromPromise, toPromise } from 'xstate'
import { indexingItemMachine } from '../indexing-item.machine'

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

const textFile = () =>
  new File(['hello world'], 'notes.md', { type: 'text/markdown' })

const chunks = [
  { id: 'c1', content: 'hello' },
  { id: 'c2', content: 'world' },
]

/** Actor stubs where every step succeeds; a test overrides only what it checks. */
function stubs(over: Record<string, unknown> = {}) {
  return {
    readMetadataFromFile: fromPromise(async () => ({
      mdWordCount: 2,
      documentText: 'hello world',
      needsOcr: false,
    })),
    saveMetadataToServer: fromPromise(async () => chunks),
    ...over,
    // eslint-disable-next-line no-restricted-syntax -- test stub standing in for a child machine or actor, only the events this test sends exist
  } as any
}

function start(over: Record<string, unknown> = {}) {
  const emitted: string[] = []
  const actor = createActor(
    indexingItemMachine.provide({ actors: stubs(over) }),
    { input: { itemId: 'i1', file: textFile() } }
  )
  actor.on('metadataSaved', () => emitted.push('metadataSaved'))
  actor.on('failed', () => emitted.push('failed'))
  actor.start()
  return { actor, emitted }
}

async function run(over: Record<string, unknown> = {}) {
  const { actor, emitted } = start(over)
  const output = await toPromise(actor)
  return { output, emitted }
}

describe('indexingItemMachine — normal file', () => {
  it('saves the metadata, announces it, and hands the chunks back for embedding', async () => {
    const { output, emitted } = await run()

    expect(output).toMatchObject({
      itemId: 'i1',
      outcome: 'indexed',
      chunks,
      needsOcr: false,
    })
    expect(output.file).toBeInstanceOf(File)
    expect(emitted).toEqual(['metadataSaved'])
  })

  it('ends as soon as the save lands: no GPU work in this machine', async () => {
    const { actor } = start()
    await toPromise(actor)

    expect(actor.getSnapshot().value).toBe('indexed')
  })

  it('hands back no chunks when the server cut none', async () => {
    const { output } = await run({
      saveMetadataToServer: fromPromise(async () => []),
    })

    expect(output.chunks).toEqual([])
    expect(output.outcome).toBe('indexed')
  })
})

describe('indexingItemMachine — scanned PDF', () => {
  it('saves a scanned PDF that read nothing else, and flags it for OCR', async () => {
    const save = vi.fn(async () => [])
    const { output } = await run({
      readMetadataFromFile: fromPromise(async () => ({ needsOcr: true })),
      saveMetadataToServer: fromPromise(save),
    })

    expect(save).toHaveBeenCalledTimes(1)
    expect(output.needsOcr).toBe(true)
  })

  it('does not flag a file with a text layer for OCR', async () => {
    const { output } = await run()

    expect(output.needsOcr).toBe(false)
  })

  it('does not flag OCR when the metadata never reached the server', async () => {
    vi.useFakeTimers()
    const { actor } = start({
      readMetadataFromFile: fromPromise(async () => ({ needsOcr: true })),
      saveMetadataToServer: fromPromise(async () => {
        throw new Error('500')
      }),
    })
    await vi.advanceTimersByTimeAsync(5_000)

    expect(actor.getSnapshot().output).toMatchObject({
      outcome: 'failed',
      needsOcr: false,
    })
  })
})

describe('indexingItemMachine — metadata save', () => {
  it('retries a failed metadata save and carries on once it lands', async () => {
    vi.useFakeTimers()
    let calls = 0
    const { actor, emitted } = start({
      saveMetadataToServer: fromPromise(async () => {
        calls++
        if (calls < 2) throw new Error('503')
        return chunks
      }),
    })
    await vi.advanceTimersByTimeAsync(3_000)

    expect(calls).toBe(2)
    expect(emitted).toEqual(['metadataSaved'])
    expect(actor.getSnapshot().output?.outcome).toBe('indexed')
  })

  it('ends failed after the retry budget, without announcing a save', async () => {
    vi.useFakeTimers()
    let calls = 0
    const { actor, emitted } = start({
      saveMetadataToServer: fromPromise(async () => {
        calls++
        throw new Error('500')
      }),
    })
    await vi.advanceTimersByTimeAsync(5_000)

    expect(calls).toBe(3)
    expect(emitted).toEqual(['failed'])
    expect(actor.getSnapshot().output?.outcome).toBe('failed')
  })

  it.each([
    ['a zip', {}],
    ['only client-only keys', { needsOcr: false }],
  ])('makes no request and announces no save for %s', async (_, metadata) => {
    const save = vi.fn(async () => chunks)
    const { output, emitted } = await run({
      readMetadataFromFile: fromPromise(async () => metadata),
      saveMetadataToServer: fromPromise(save),
    })

    expect(save).not.toHaveBeenCalled()
    expect(emitted).toEqual([])
    expect(output).toMatchObject({ outcome: 'indexed', chunks: [], needsOcr: false })
  })

  it('ends failed without a request when the file cannot be read', async () => {
    const save = vi.fn(async () => chunks)
    const { output } = await run({
      readMetadataFromFile: fromPromise(async () => {
        throw new Error('worker timeout')
      }),
      saveMetadataToServer: fromPromise(save),
    })

    expect(save).not.toHaveBeenCalled()
    expect(output.outcome).toBe('failed')
  })
})
