import { describe, it, expect, vi } from 'vitest'
import { enqueue, aiQueueDepth, isDeviceLostError, createModelCache } from '@/workers/ai-queue'

/** A job that resolves only when told to, so ordering is deterministic. */
function gate() {
  let release!: () => void
  const promise = new Promise<void>((r) => (release = r))
  return { promise, release }
}

describe('ai-queue', () => {
  it('runs one job at a time', async () => {
    const g = gate()
    let secondStarted = false

    const first = enqueue(async () => {
      await g.promise
      return 'first'
    })
    const second = enqueue(async () => {
      secondStarted = true
      return 'second'
    })

    expect(secondStarted).toBe(false)
    g.release()
    await Promise.all([first, second])
    expect(secondStarted).toBe(true)
  })

  it('keeps FIFO order within one priority', async () => {
    const g = gate()
    const order: number[] = []
    const blocker = enqueue(() => g.promise)

    const jobs = [1, 2, 3].map((n) =>
      enqueue(async () => {
        order.push(n)
      })
    )

    g.release()
    await Promise.all([blocker, ...jobs])
    expect(order).toEqual([1, 2, 3])
  })

  it('lets an interactive job jump ahead of queued background work', async () => {
    // The real scenario: OCR pages queued, then the user searches. Without
    // priority the search waits for every page.
    const g = gate()
    const order: string[] = []
    const blocker = enqueue(() => g.promise)

    const bg1 = enqueue(async () => void order.push('ocr-page-1'), 'background')
    const bg2 = enqueue(async () => void order.push('ocr-page-2'), 'background')
    const query = enqueue(async () => void order.push('query'), 'interactive')

    g.release()
    await Promise.all([blocker, bg1, bg2, query])
    expect(order[0]).toBe('query')
  })

  it('does not preempt a job already running', async () => {
    const g = gate()
    const order: string[] = []

    const running = enqueue(async () => {
      await g.promise
      order.push('running-background')
    }, 'background')
    const query = enqueue(async () => void order.push('query'), 'interactive')

    g.release()
    await Promise.all([running, query])
    expect(order).toEqual(['running-background', 'query'])
  })

  it('frees the queue when a job throws', async () => {
    await expect(
      enqueue(async () => {
        throw new Error('boom')
      })
    ).rejects.toThrow('boom')

    // A leaked `running` flag here would deadlock every later job.
    await expect(enqueue(async () => 'after')).resolves.toBe('after')
    expect(aiQueueDepth()).toEqual({ waiting: 0, running: false })
  })

  it('reports queue depth', async () => {
    const g = gate()
    const blocker = enqueue(() => g.promise)
    const queued = enqueue(async () => 'x')

    expect(aiQueueDepth().waiting).toBe(1)
    g.release()
    await Promise.all([blocker, queued])
    expect(aiQueueDepth()).toEqual({ waiting: 0, running: false })
  })
})

describe('isDeviceLostError', () => {
  it('recognises the ways a lost WebGPU device is reported', () => {
    // Shortened from the ONNX Runtime error after a Windows GPU watchdog reset (31 Oct 2026).
    expect(
      isDeviceLostError(
        new Error(
          "failed to call OrtRun(). ERROR_CODE: 1, ERROR_MESSAGE: ... Failed to execute 'mapAsync' on 'GPUBuffer': [Device] is lost.",
        ),
      ),
    ).toBe(true)
    expect(isDeviceLostError(new Error('Device was lost'))).toBe(true)
    expect(isDeviceLostError('GPU device-lost')).toBe(true)
    expect(isDeviceLostError(new Error('DXGI_ERROR_DEVICE_HUNG (0x887A0006)'))).toBe(true)
  })

  it('leaves other failures alone', () => {
    expect(isDeviceLostError(new Error('out of memory'))).toBe(false)
    expect(isDeviceLostError(new Error('Failed to fetch'))).toBe(false)
    expect(isDeviceLostError(undefined)).toBe(false)
  })
})

describe('createModelCache', () => {
  const deviceLost = new Error("Failed to execute 'mapAsync' on 'GPUBuffer': [Device] is lost.")

  /** A cache whose loads return numbered models, with spies on load and dispose. */
  function counting() {
    let loads = 0
    const load = vi.fn(async () => ({ id: ++loads }))
    const dispose = vi.fn()
    return { cache: createModelCache(load, dispose), load, dispose }
  }

  it('loads once and shares the model, concurrent callers included', async () => {
    const { cache, load } = counting()
    const [a, b] = await Promise.all([cache.get(), cache.get()])
    const c = await cache.get()
    expect(load).toHaveBeenCalledTimes(1)
    expect(a).toBe(b)
    expect(c).toBe(a)
  })

  it('drops the model on a lost device, disposes it and reloads on next use', async () => {
    const { cache, load, dispose } = counting()
    const first = await cache.get()

    expect(cache.failed(deviceLost)).toBe(true)
    const second = await cache.get()

    expect(load).toHaveBeenCalledTimes(2)
    expect(second).not.toBe(first)
    expect(dispose).toHaveBeenCalledWith(first)
  })

  it('keeps the model for any other error', async () => {
    const { cache, load, dispose } = counting()
    const first = await cache.get()

    expect(cache.failed(new Error('shape mismatch'))).toBe(false)

    expect(await cache.get()).toBe(first)
    expect(load).toHaveBeenCalledTimes(1)
    expect(dispose).not.toHaveBeenCalled()
  })

  it('has nothing to drop before a load', () => {
    const { cache, dispose } = counting()
    expect(cache.failed(deviceLost)).toBe(false)
    expect(dispose).not.toHaveBeenCalled()
  })

  it('retries a load that failed instead of replaying the rejection', async () => {
    const load = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('Failed to fetch'))
      .mockResolvedValueOnce('model')
    const cache = createModelCache(load, () => {})

    await expect(cache.get()).rejects.toThrow('Failed to fetch')
    await expect(cache.get()).resolves.toBe('model')
    expect(load).toHaveBeenCalledTimes(2)
  })

  it('survives a dispose that throws', async () => {
    const cache = createModelCache(
      async () => 'model',
      () => {
        throw new Error('already destroyed')
      },
    )
    await cache.get()
    expect(cache.failed(deviceLost)).toBe(true)
    // Let the dispose run; an unhandled rejection would fail the run.
    await new Promise((resolve) => setTimeout(resolve, 0))
    await expect(cache.get()).resolves.toBe('model')
  })
})
