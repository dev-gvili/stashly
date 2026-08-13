import { describe, it, expect } from 'vitest'
import {
  MAX_BACKFILL_BATCHES,
  PENDING_EMBEDDING_BATCH,
  PENDING_EMBEDDING_MAX,
  clampPendingLimit,
  shouldRequestAnotherBatch,
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
