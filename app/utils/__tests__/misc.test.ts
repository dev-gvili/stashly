import { describe, it, expect, vi } from 'vitest'
import { callAll } from '../misc'

describe('callAll', () => {
  it('calls all provided functions with the same arguments', () => {
    const fn1 = vi.fn()
    const fn2 = vi.fn()
    const combined = callAll(fn1, fn2)
    combined('arg1', 'arg2')
    expect(fn1).toHaveBeenCalledWith('arg1', 'arg2')
    expect(fn2).toHaveBeenCalledWith('arg1', 'arg2')
  })

  it('calls a single function', () => {
    const fn1 = vi.fn()
    const combined = callAll(fn1)
    combined(42)
    expect(fn1).toHaveBeenCalledWith(42)
    expect(fn1).toHaveBeenCalledTimes(1)
  })

  it('skips non-function values without throwing', () => {
    const fn1 = vi.fn()
    // Passing a non-function should not throw
    expect(() => callAll(fn1, null as any, undefined as any)('test')).not.toThrow()
    expect(fn1).toHaveBeenCalledWith('test')
  })

  it('works with no arguments', () => {
    const combined = callAll()
    expect(() => combined()).not.toThrow()
  })

  it('works with no call arguments', () => {
    const fn1 = vi.fn()
    const combined = callAll(fn1)
    combined()
    expect(fn1).toHaveBeenCalledWith()
  })

  it('calls functions in order', () => {
    const order: number[] = []
    const fn1 = vi.fn(() => order.push(1))
    const fn2 = vi.fn(() => order.push(2))
    const fn3 = vi.fn(() => order.push(3))
    callAll(fn1, fn2, fn3)()
    expect(order).toEqual([1, 2, 3])
  })
})
