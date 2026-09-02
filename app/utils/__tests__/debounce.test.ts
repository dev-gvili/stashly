import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDebouncer } from '@/utils/debounce'

describe('createDebouncer', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('runs the call after the delay', () => {
    const d = createDebouncer()
    const fn = vi.fn()
    d.call(fn, 200)
    expect(fn).not.toHaveBeenCalled()
    vi.advanceTimersByTime(199)
    expect(fn).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('replaces a pending call rather than queueing it', () => {
    const d = createDebouncer()
    const first = vi.fn()
    const second = vi.fn()
    d.call(first, 200)
    vi.advanceTimersByTime(150)
    d.call(second, 200)
    vi.advanceTimersByTime(200)
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
  })

  it('restarts the delay on every call', () => {
    const d = createDebouncer()
    const fn = vi.fn()
    for (let i = 0; i < 5; i++) {
      d.call(fn, 100)
      vi.advanceTimersByTime(90)
    }
    expect(fn).not.toHaveBeenCalled()
    vi.advanceTimersByTime(100)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('cancel drops the pending call', () => {
    const d = createDebouncer()
    const fn = vi.fn()
    d.call(fn, 200)
    d.cancel()
    vi.advanceTimersByTime(1000)
    expect(fn).not.toHaveBeenCalled()
  })

  it('flush runs the pending call immediately and only once', () => {
    const d = createDebouncer()
    const fn = vi.fn()
    d.call(fn, 200)
    d.flush()
    expect(fn).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(1000)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('flush with nothing pending is a no-op', () => {
    const d = createDebouncer()
    expect(() => d.flush()).not.toThrow()
  })

  it('reports whether a call is pending', () => {
    const d = createDebouncer()
    expect(d.pending).toBe(false)
    d.call(() => {}, 200)
    expect(d.pending).toBe(true)
    vi.advanceTimersByTime(200)
    expect(d.pending).toBe(false)
  })

  it('is reusable after firing', () => {
    const d = createDebouncer()
    const fn = vi.fn()
    d.call(fn, 100)
    vi.advanceTimersByTime(100)
    d.call(fn, 100)
    vi.advanceTimersByTime(100)
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('a zero delay still defers past the current tick', () => {
    const d = createDebouncer()
    const fn = vi.fn()
    d.call(fn, 0)
    expect(fn).not.toHaveBeenCalled()
    vi.advanceTimersByTime(0)
    expect(fn).toHaveBeenCalledTimes(1)
  })
})
