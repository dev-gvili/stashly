import { describe, expect, it, vi } from 'vitest'
import { nextSizeRollupDelay, SIZE_ROLLUP_BATCH, SIZE_ROLLUP_INTERVAL_MS, type SizeRollupOutcome } from '@/services/size-rollup'

const applied = (deltas: number): SizeRollupOutcome => ({ kind: 'applied', deltas, ancestors: 3, oldestMs: 120, ms: 8 })

describe('nextSizeRollupDelay', () => {
  it('waits one interval when nothing is pending, after a run, a skip or a lock timeout', () => {
    for (const outcome of [{ kind: 'idle' }, applied(25), { kind: 'skipped' }, { kind: 'timeout' }] as SizeRollupOutcome[])
      expect(nextSizeRollupDelay(outcome)).toBe(SIZE_ROLLUP_INTERVAL_MS)
  })

  it('runs again at once while a full batch suggests a backlog', () => {
    expect(nextSizeRollupDelay(applied(SIZE_ROLLUP_BATCH))).toBe(0)
  })

  it('backs off after an unexpected error', () => {
    expect(nextSizeRollupDelay({ kind: 'error' })).toBeGreaterThan(SIZE_ROLLUP_INTERVAL_MS)
  })
})

// A process that stops with deltas pending leaves folders reading short until
// some loop applies them. Until 1 Nov only an upload started one, so they
// waited for the next upload; the server module now starts it as it loads.
describe('server start', () => {
  it('loading the server module starts the rollup loop', async () => {
    vi.resetModules()
    const ensureSizeRollup = vi.fn()
    vi.doMock('@/services/size-rollup', () => ({ ensureSizeRollup }))
    await import('../../../server/app')
    expect(ensureSizeRollup).toHaveBeenCalledOnce()
    vi.doUnmock('@/services/size-rollup')
  })
})
