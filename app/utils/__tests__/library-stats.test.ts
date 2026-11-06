import { describe, expect, it } from 'vitest'
import { toLibraryStats, type UsageMetrics } from '../library-stats'
import { formatSize } from '../formaters'

const metrics: UsageMetrics = {
  folders: 3,
  files: 12,
  favorites: 1,
  trashed: 2,
  usedBytes: 5_000_000n,
  quotaBytes: 10_000_000n,
}

describe('toLibraryStats', () => {
  it('passes the counts through and formats the byte totals', () => {
    expect(toLibraryStats(metrics)).toEqual({
      folders: 3,
      files: 12,
      favorites: 1,
      trashed: 2,
      size: formatSize('byte', 'unit', 5_000_000),
      quota: formatSize('byte', 'unit', 10_000_000),
      usedPercent: 50,
    })
  })

  it('reads no quota as 0%, not a division by zero', () => {
    expect(toLibraryStats({ ...metrics, quotaBytes: 0n }).usedPercent).toBe(0)
  })

  it('rounds the percentage', () => {
    expect(
      toLibraryStats({ ...metrics, usedBytes: 1n, quotaBytes: 3n }).usedPercent
    ).toBe(33)
  })

  it('handles totals past 2^31 bytes without overflow', () => {
    const stats = toLibraryStats({
      ...metrics,
      usedBytes: 30n * 1024n ** 3n,
      quotaBytes: 40n * 1024n ** 3n,
    })
    expect(stats.usedPercent).toBe(75)
  })

  it('contains no BigInt, so a loader can serialize it', () => {
    expect(() => JSON.stringify(toLibraryStats(metrics))).not.toThrow()
  })
})
