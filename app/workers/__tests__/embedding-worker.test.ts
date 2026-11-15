/**
 * `embedding.worker.ts` itself, with transformers.js mocked and `self` stubbed
 * (Vitest runs in Node, with no `Worker`). The client side is covered by
 * `embedding-batches.test.ts` against a fake worker; this covers the worker's
 * model cache: a failed load or a lost device must not stick.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { EmbeddingRequest, EmbeddingResponse } from '../embedding.worker'

const pipeline = vi.fn()
vi.mock('@huggingface/transformers', () => ({ pipeline }))

type Self = {
  postMessage: (m: EmbeddingResponse) => void
  onmessage: ((e: { data: EmbeddingRequest }) => Promise<void>) | null
}

let posted: EmbeddingResponse[]
let worker: Self

/** A pipeline stub: one 2-dim vector per text, or `fail` thrown when run. */
function extractor(fail?: Error) {
  const run = vi.fn(async (texts: string[]) => {
    if (fail) throw fail
    return {
      dims: [texts.length, 2],
      data: Float32Array.from(texts.flatMap(() => [1, 0])),
    }
  })
  return Object.assign(run, { dispose: vi.fn() })
}

async function send(request: EmbeddingRequest): Promise<EmbeddingResponse> {
  await worker.onmessage!({ data: request })
  return posted.at(-1)!
}

beforeEach(async () => {
  vi.resetModules()
  pipeline.mockReset()
  posted = []
  worker = { postMessage: (m) => posted.push(m), onmessage: null }
  vi.stubGlobal('self', worker)
  await import('../embedding.worker')
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('embedding.worker', () => {
  it('loads the model once for every request', async () => {
    pipeline.mockResolvedValue(extractor())
    expect(await send({ id: 1, texts: ['a'] })).toMatchObject({ type: 'result' })
    expect(await send({ id: 2, texts: ['b'] })).toMatchObject({ type: 'result' })
    expect(pipeline).toHaveBeenCalledTimes(1)
  })

  it('retries a model load that failed instead of replaying the rejection', async () => {
    pipeline
      .mockRejectedValueOnce(new Error('Failed to fetch'))
      .mockResolvedValueOnce(extractor())
    expect(await send({ id: 1, texts: ['a'] })).toEqual({
      type: 'error',
      id: 1,
      message: 'Failed to fetch',
    })
    expect(await send({ id: 2, texts: ['a'] })).toEqual({
      type: 'result',
      id: 2,
      vectors: [[1, 0]],
    })
    expect(pipeline).toHaveBeenCalledTimes(2)
  })

  it('drops and disposes the model on a lost device, and reloads it next time', async () => {
    const dead = extractor(new Error('[Device] is lost'))
    pipeline.mockResolvedValueOnce(dead).mockResolvedValueOnce(extractor())
    expect(await send({ id: 1, texts: ['a'] })).toMatchObject({ type: 'error' })
    expect(await send({ id: 2, texts: ['a'] })).toMatchObject({ type: 'result' })
    expect(pipeline).toHaveBeenCalledTimes(2)
    expect(dead.dispose).toHaveBeenCalledTimes(1)
  })

  it('keeps the model after any other inference error', async () => {
    pipeline.mockResolvedValue(extractor(new Error('shape mismatch')))
    await send({ id: 1, texts: ['a'] })
    await send({ id: 2, texts: ['a'] })
    expect(pipeline).toHaveBeenCalledTimes(1)
  })

  it('reports download progress only to a request that asked for it', async () => {
    pipeline.mockImplementation(async (_task, _model, options) => {
      options.progress_callback?.({ status: 'progress' })
      return extractor()
    })
    await send({ id: 1, texts: ['a'] })
    expect(pipeline.mock.calls[0][2]).not.toHaveProperty('progress_callback')
    expect(posted.map((m) => m.type)).toEqual(['result'])
  })

  it('reports a retried load’s progress against the request that retried it', async () => {
    pipeline
      .mockRejectedValueOnce(new Error('Failed to fetch'))
      .mockImplementationOnce(async (_task, _model, options) => {
        options.progress_callback?.({ status: 'progress' })
        return extractor()
      })
    await send({ id: 1, texts: ['a'] })
    posted = []
    await send({ id: 2, texts: ['a'], wantsProgress: true })
    expect(posted).toEqual([
      { type: 'progress', id: 2, progress: { status: 'progress' } },
      { type: 'result', id: 2, vectors: [[1, 0]] },
    ])
  })
})
