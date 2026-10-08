/**
 * The embedding model is released after `EMBEDDING_IDLE_RELEASE_MS` without
 * use, and loaded again on the next call.
 *
 * On a machine with integrated graphics every byte the GPU holds is system
 * RAM. After a 64-file upload had finished indexing, Chrome's GPU process
 * still held about 2.9 GB for the loaded model and its buffers, and gave it
 * back only when the tab closed (measured 2 Oct 2026).
 *
 * The model runs in `embedding.worker.ts`, and releasing it terminates that
 * worker, which frees its whole GPU device. A fake worker stands in: a model
 * load is a worker start, a release is a termination.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { installFakeEmbeddingWorker } from './fake-embedding-worker'

const worker = installFakeEmbeddingWorker()
const loads = () => worker.started
const disposals = () => worker.terminated
let loadsAtStart = 0
let disposalsAtStart = 0

const { embedTexts, releaseEmbeddingModel, EMBEDDING_IDLE_RELEASE_MS } =
  await import('../embedding.ai')

beforeEach(async () => {
  vi.useFakeTimers()
  // Start every test with no model loaded.
  await releaseEmbeddingModel()
  loadsAtStart = loads()
  disposalsAtStart = disposals()
})

const newLoads = () => loads() - loadsAtStart
const newDisposals = () => disposals() - disposalsAtStart

afterEach(() => {
  vi.useRealTimers()
})

describe('embedding model idle release', () => {
  it('releases the model after the idle period', async () => {
    await embedTexts(['a'])
    expect(newDisposals()).toBe(0)

    await vi.advanceTimersByTimeAsync(EMBEDDING_IDLE_RELEASE_MS + 10)

    expect(newDisposals()).toBe(1)
  })

  it('keeps the model while it is still being used', async () => {
    await embedTexts(['a'])
    await vi.advanceTimersByTimeAsync(EMBEDDING_IDLE_RELEASE_MS - 1000)
    await embedTexts(['b'])
    await vi.advanceTimersByTimeAsync(EMBEDDING_IDLE_RELEASE_MS - 1000)

    expect(newDisposals()).toBe(0)
    expect(newLoads()).toBe(1)
  })

  it('loads the model again for the next call after a release', async () => {
    await embedTexts(['a'])
    await vi.advanceTimersByTimeAsync(EMBEDDING_IDLE_RELEASE_MS + 10)
    const vectors = await embedTexts(['b', 'c'])

    expect(newLoads()).toBe(2)
    expect(vectors).toHaveLength(2)
  })

  it('does nothing when no model was loaded', async () => {
    await releaseEmbeddingModel()

    expect(newDisposals()).toBe(0)
  })
})
