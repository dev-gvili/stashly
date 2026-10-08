/**
 * `embedTexts` must never hand the GPU more than `EMBED_BATCH_SIZE` texts in
 * one model call.
 *
 * It used to embed a whole file in one call. For a 338-chunk source file that
 * asked WebGPU for a single 4,253,024,256-byte buffer — 338 × 12 heads × 512 ×
 * 512 × 4 bytes of attention scores — over the 2 GiB per-buffer limit, so the
 * call failed and every embedding after it in the tab failed the same way. A
 * 170-chunk file squeezed under the limit and took the GPU process from about
 * 5 GB to 10.9 GB (measured 2 Oct 2026).
 *
 * The model runs in `embedding.worker.ts`; here a fake worker that speaks the
 * same protocol stands in for it. These check how the texts are split and
 * queued, not the model.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { installFakeEmbeddingWorker } from './fake-embedding-worker'

// One 2-dimension "vector" per text: [its number, 0], so order is checkable.
const worker = installFakeEmbeddingWorker((text) => [Number(text), 0])
const calls = worker.calls

const { embedTexts, EMBED_BATCH_SIZE } = await import('../embedding.ai')
const { enqueue } = await import('../ai-queue')

const texts = (n: number) => Array.from({ length: n }, (_, i) => String(i))

beforeEach(() => {
  calls.length = 0
})

describe('embedTexts batching', () => {
  it('splits a large file into model calls of at most EMBED_BATCH_SIZE', async () => {
    await embedTexts(texts(338))

    expect(calls.length).toBe(Math.ceil(338 / EMBED_BATCH_SIZE))
    expect(Math.max(...calls.map((c) => c.length))).toBe(EMBED_BATCH_SIZE)
    expect(calls.flat()).toHaveLength(338)
  })

  it('returns one vector per text, in the original order', async () => {
    const vectors = await embedTexts(texts(40))

    expect(vectors).toHaveLength(40)
    expect(vectors.map((v) => v[0])).toEqual(texts(40).map(Number))
  })

  it('makes a single call when the texts fit in one batch', async () => {
    await embedTexts(texts(3))

    expect(calls).toEqual([['0', '1', '2']])
  })

  it('makes no call for no texts', async () => {
    expect(await embedTexts([])).toEqual([])
    expect(calls).toEqual([])
  })

  it('queues each batch separately, so a search query can run between them', async () => {
    const order: string[] = []
    const file = embedTexts(texts(EMBED_BATCH_SIZE * 3)).then(() =>
      order.push('file done')
    )
    // Arrives while the file's first batch is running.
    const query = enqueue(async () => {
      order.push('query')
    }, 'interactive')

    await Promise.all([file, query])

    expect(order).toEqual(['query', 'file done'])
  })
})

describe('embedTexts when the worker fails', () => {
  it('rejects with the error the worker reports, and keeps that worker', async () => {
    const before = worker.started
    worker.current!.failNext = 'Device is lost'
    await expect(embedTexts(texts(1))).rejects.toThrow('Device is lost')

    expect(await embedTexts(texts(2))).toHaveLength(2)
    expect(worker.started).toBe(before)
  })

  it('a crashed worker fails its waiting request and is replaced on the next call', async () => {
    const before = worker.started
    worker.current!.crashOnNext = 'out of memory'
    await expect(embedTexts(texts(1))).rejects.toThrow('Embedding worker failed: out of memory')

    expect(await embedTexts(texts(1))).toHaveLength(1)
    expect(worker.started).toBe(before + 1)
  })
})
