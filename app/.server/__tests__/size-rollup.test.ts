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
//
// The test imports the whole server module (Express, React Router, Vinktar),
// so its time follows the machine's load. Measured 12 Nov on this 16-core
// machine: 363-593 ms alone, 724 ms in a full parallel run, 1,735-2,490 ms
// with 16 CPU-bound processes beside it, and 5,047 ms once in a full run on
// 9 Nov (tech-debt item 81). The default 5 s left no headroom over that, so
// it gets 20 s: four times the worst seen.
const SERVER_IMPORT_TIMEOUT_MS = 20_000

describe('server start', () => {
  it('loading the server module starts the rollup loop', { timeout: SERVER_IMPORT_TIMEOUT_MS }, async () => {
    vi.resetModules()
    const ensureSizeRollup = vi.fn()
    vi.doMock('@/services/size-rollup', () => ({ ensureSizeRollup }))
    await import('../../../server/app')
    expect(ensureSizeRollup).toHaveBeenCalledOnce()
    vi.doUnmock('@/services/size-rollup')
  })
})
