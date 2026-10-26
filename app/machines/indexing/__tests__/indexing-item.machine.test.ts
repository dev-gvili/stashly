/**
 * Indexing item machine tests.
 *
 * Every actor is stubbed, so these check the order of steps, what a retry does,
 * and which ending each failure lands in — not the metadata reading, the
 * embedding model or the server, which have their own coverage.
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
const twoVectors = [
  [0.1, 0.2],
  [0.3, 0.4],
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
    embedChunksOnGpu: fromPromise(async () => twoVectors),
    saveVectorsToServer: fromPromise(async () => undefined),
    transcribeScannedPdf: fromPromise(async () => 120),
    ...over,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  it('saves metadata, embeds every chunk, saves the vectors, and ends indexed', async () => {
    const saveVectors = vi.fn(async () => undefined)
    const { output, emitted } = await run({
      saveVectorsToServer: fromPromise(saveVectors),
    })

    expect(saveVectors).toHaveBeenCalledTimes(1)
    expect(output).toEqual({ itemId: 'i1', outcome: 'indexed' })
    expect(emitted).toEqual(['metadataSaved'])
  })

  it('skips embedding when the server cut no chunks', async () => {
    const embed = vi.fn(async () => [])
    const { output } = await run({
      saveMetadataToServer: fromPromise(async () => []),
      embedChunksOnGpu: fromPromise(embed),
    })

    expect(embed).not.toHaveBeenCalled()
    expect(output.outcome).toBe('indexed')
  })
})

describe('indexingItemMachine — scanned PDF', () => {
  it('runs OCR when the PDF has no text layer', async () => {
    const ocr = vi.fn(async () => 300)
    const { output } = await run({
      readMetadataFromFile: fromPromise(async () => ({ needsOcr: true })),
      saveMetadataToServer: fromPromise(async () => []),
      transcribeScannedPdf: fromPromise(ocr),
    })

    expect(ocr).toHaveBeenCalledTimes(1)
    expect(output.outcome).toBe('indexed')
  })

  it('embeds the chunks it has first, then runs OCR', async () => {
    const order: string[] = []
    await run({
      readMetadataFromFile: fromPromise(async () => ({ needsOcr: true })),
      embedChunksOnGpu: fromPromise(async () => {
        order.push('embed')
        return twoVectors
      }),
      transcribeScannedPdf: fromPromise(async () => {
        order.push('ocr')
        return 1
      }),
    })

    expect(order).toEqual(['embed', 'ocr'])
  })

  it('does not run OCR for a file with a text layer', async () => {
    const ocr = vi.fn(async () => 0)
    await run({ transcribeScannedPdf: fromPromise(ocr) })

    expect(ocr).not.toHaveBeenCalled()
  })

  it('ends failed when OCR breaks', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { output, emitted } = await run({
      readMetadataFromFile: fromPromise(async () => ({ needsOcr: true })),
      saveMetadataToServer: fromPromise(async () => []),
      transcribeScannedPdf: fromPromise(async () => {
        throw new Error('model crashed')
      }),
    })

    expect(output.outcome).toBe('failed')
    expect(emitted).toContain('failed')
  })
})

describe('indexingItemMachine — vectors that do not make it', () => {
  it('ends indexedWithoutVectors when embedding throws', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const saveVectors = vi.fn(async () => undefined)
    const { output } = await run({
      embedChunksOnGpu: fromPromise(async () => {
        throw new Error('GPU lost')
      }),
      saveVectorsToServer: fromPromise(saveVectors),
    })

    expect(saveVectors).not.toHaveBeenCalled()
    expect(output.outcome).toBe('indexedWithoutVectors')
  })

  it('never saves vectors whose count does not match the chunks', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const saveVectors = vi.fn(async () => undefined)
    const { output } = await run({
      embedChunksOnGpu: fromPromise(async () => [[0.1, 0.2]]),
      saveVectorsToServer: fromPromise(saveVectors),
    })

    expect(saveVectors).not.toHaveBeenCalled()
    expect(output.outcome).toBe('indexedWithoutVectors')
  })

  it('retries a failed vector save twice, then gives up on vectors only', async () => {
    vi.useFakeTimers()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    let calls = 0
    const { actor } = start({
      saveVectorsToServer: fromPromise(async () => {
        calls++
        throw new Error('503')
      }),
    })
    await vi.advanceTimersByTimeAsync(5_000)

    expect(calls).toBe(3)
    expect(actor.getSnapshot().output?.outcome).toBe('indexedWithoutVectors')
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
    expect(output.outcome).toBe('indexed')
  })

  it('still saves a scanned PDF that read nothing else', async () => {
    const save = vi.fn(async () => [])
    const ocr = vi.fn(async () => 3)
    await run({
      readMetadataFromFile: fromPromise(async () => ({ needsOcr: true })),
      saveMetadataToServer: fromPromise(save),
      transcribeScannedPdf: fromPromise(ocr),
    })

    expect(save).toHaveBeenCalledTimes(1)
    expect(ocr).toHaveBeenCalledTimes(1)
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
