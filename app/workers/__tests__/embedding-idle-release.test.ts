/**
 * The embedding model is released after `EMBEDDING_IDLE_RELEASE_MS` without
 * use, and loaded again on the next call.
 *
 * On a machine with integrated graphics every byte the GPU holds is system
 * RAM. After a 64-file upload had finished indexing, Chrome's GPU process
 * still held about 2.9 GB for the loaded model and its buffers, and gave it
 * back only when the tab closed (measured 2 Oct 2026).
 *
 * The model is mocked: these check when it is disposed and reloaded.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const loads = vi.fn()
const disposals = vi.fn()

vi.mock('@huggingface/transformers', () => ({
  pipeline: vi.fn(async () => {
    loads()
    const extractor = async (texts: string[]) => ({
      dims: [texts.length, 1],
      data: new Float32Array(texts.length),
    })
    return Object.assign(extractor, { dispose: async () => disposals() })
  }),
}))

const { embedTexts, releaseEmbeddingModel, EMBEDDING_IDLE_RELEASE_MS } =
  await import('../embedding.ai')

beforeEach(async () => {
  vi.useFakeTimers()
  // Start every test with no model loaded.
  await releaseEmbeddingModel()
  loads.mockClear()
  disposals.mockClear()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('embedding model idle release', () => {
  it('releases the model after the idle period', async () => {
    await embedTexts(['a'])
    expect(disposals).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(EMBEDDING_IDLE_RELEASE_MS + 10)

    expect(disposals).toHaveBeenCalledTimes(1)
  })

  it('keeps the model while it is still being used', async () => {
    await embedTexts(['a'])
    await vi.advanceTimersByTimeAsync(EMBEDDING_IDLE_RELEASE_MS - 1000)
    await embedTexts(['b'])
    await vi.advanceTimersByTimeAsync(EMBEDDING_IDLE_RELEASE_MS - 1000)

    expect(disposals).not.toHaveBeenCalled()
    expect(loads).toHaveBeenCalledTimes(1)
  })

  it('loads the model again for the next call after a release', async () => {
    await embedTexts(['a'])
    await vi.advanceTimersByTimeAsync(EMBEDDING_IDLE_RELEASE_MS + 10)
    const vectors = await embedTexts(['b', 'c'])

    expect(loads).toHaveBeenCalledTimes(2)
    expect(vectors).toHaveLength(2)
  })

  it('does nothing when no model was loaded', async () => {
    await releaseEmbeddingModel()

    expect(disposals).not.toHaveBeenCalled()
  })
})
