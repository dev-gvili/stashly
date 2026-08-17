import { describe, it, expect } from 'vitest'
import { enqueue, aiQueueDepth } from '@/workers/ai-queue'

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
