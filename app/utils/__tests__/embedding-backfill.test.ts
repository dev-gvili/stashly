import { describe, it, expect, beforeEach } from 'vitest'
import {
  MAX_BACKFILL_BATCHES,
  PENDING_EMBEDDING_BATCH,
  PENDING_EMBEDDING_MAX,
  clampPendingLimit,
  shouldRequestAnotherBatch,
  getBackfillState,
  reportBackfill,
  resetBackfillState,
  subscribeBackfill,
} from '../embedding-backfill'

describe('clampPendingLimit', () => {
  it('falls back to the default batch when absent', () => {
    expect(clampPendingLimit(null)).toBe(PENDING_EMBEDDING_BATCH)
    expect(clampPendingLimit(undefined)).toBe(PENDING_EMBEDDING_BATCH)
    expect(clampPendingLimit('')).toBe(PENDING_EMBEDDING_BATCH)
  })

  it('falls back to the default batch for non-numeric input', () => {
    expect(clampPendingLimit('abc')).toBe(PENDING_EMBEDDING_BATCH)
    expect(clampPendingLimit(Number.NaN)).toBe(PENDING_EMBEDDING_BATCH)
  })

  it('passes through a value inside the range', () => {
    expect(clampPendingLimit('10')).toBe(10)
    expect(clampPendingLimit(10)).toBe(10)
  })

  it('caps a value above the maximum', () => {
    expect(clampPendingLimit('1000000000')).toBe(PENDING_EMBEDDING_MAX)
  })

  it('raises zero and negatives to one', () => {
    expect(clampPendingLimit('0')).toBe(1)
    expect(clampPendingLimit('-5')).toBe(1)
  })

  it('truncates fractional values rather than passing them to SQL', () => {
    expect(clampPendingLimit('7.9')).toBe(7)
  })
})

describe('shouldRequestAnotherBatch', () => {
  it('continues after a full batch', () => {
    expect(
      shouldRequestAnotherBatch({ received: 32, limit: 32, batchesRun: 1 })
    ).toBe(true)
  })

  it('stops on a short batch — the backlog is drained', () => {
    expect(
      shouldRequestAnotherBatch({ received: 5, limit: 32, batchesRun: 1 })
    ).toBe(false)
  })

  it('stops when a batch came back empty', () => {
    expect(
      shouldRequestAnotherBatch({ received: 0, limit: 32, batchesRun: 1 })
    ).toBe(false)
  })

  it('stops once the per-load batch cap is reached', () => {
    expect(
      shouldRequestAnotherBatch({
        received: 32,
        limit: 32,
        batchesRun: MAX_BACKFILL_BATCHES,
      })
    ).toBe(false)
  })

  it('honours an explicit lower cap', () => {
    expect(
      shouldRequestAnotherBatch({
        received: 32,
        limit: 32,
        batchesRun: 2,
        maxBatches: 2,
      })
    ).toBe(false)
  })
})

describe('backfill progress store', () => {
  beforeEach(() => resetBackfillState())

  it('starts idle with nothing recorded', () => {
    const state = getBackfillState()
    expect(state.phase).toBe('idle')
    expect(state.embedded).toBe(0)
    expect(state.error).toBeNull()
  })

  it('returns a stable snapshot identity between updates', () => {
    // useSyncExternalStore compares snapshots by identity and re-renders
    // forever if getSnapshot builds a fresh object per call.
    expect(getBackfillState()).toBe(getBackfillState())
    reportBackfill({ phase: 'fetching' })
    expect(getBackfillState()).toBe(getBackfillState())
  })

  it('replaces the snapshot on update so React sees a change', () => {
    const before = getBackfillState()
    reportBackfill({ phase: 'embedding' })
    expect(getBackfillState()).not.toBe(before)
    expect(getBackfillState().phase).toBe('embedding')
  })

  it('merges patches rather than clobbering the snapshot', () => {
    reportBackfill({ embedded: 32, batches: 1 })
    reportBackfill({ phase: 'saving' })
    const state = getBackfillState()
    expect(state.embedded).toBe(32)
    expect(state.batches).toBe(1)
    expect(state.phase).toBe('saving')
  })

  it('notifies subscribers and stops after unsubscribe', () => {
    let calls = 0
    const unsubscribe = subscribeBackfill(() => calls++)
    reportBackfill({ phase: 'fetching' })
    expect(calls).toBe(1)
    unsubscribe()
    reportBackfill({ phase: 'done' })
    expect(calls).toBe(1)
  })

  it('records a failure reason for the status panel', () => {
    reportBackfill({ phase: 'failed', error: 'no WebGPU adapter' })
    expect(getBackfillState().phase).toBe('failed')
    expect(getBackfillState().error).toBe('no WebGPU adapter')
  })
})
