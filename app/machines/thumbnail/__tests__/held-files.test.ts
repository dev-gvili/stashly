/**
 * The held-files store: uploaded files waiting for their card to be seen.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  holdFile,
  getHeldFile,
  hasHeldFile,
  releaseFile,
  subscribeToHeldFiles,
  resetHeldFiles,
} from '../held-files'

const file = (name: string) => new File(['x'], name, { type: 'text/plain' })

beforeEach(() => {
  resetHeldFiles()
})

describe('held files', () => {
  it('holds a file until it is released', () => {
    const f = file('a.ts')
    holdFile('a', f)

    expect(hasHeldFile('a')).toBe(true)
    expect(getHeldFile('a')).toBe(f)

    releaseFile('a')

    expect(hasHeldFile('a')).toBe(false)
    expect(getHeldFile('a')).toBeNull()
  })

  it('tells subscribers when a file is held or released', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeToHeldFiles(listener)

    holdFile('a', file('a.ts'))
    releaseFile('a')
    expect(listener).toHaveBeenCalledTimes(2)

    unsubscribe()
    holdFile('b', file('b.ts'))
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('stays quiet for a change that changes nothing', () => {
    const f = file('a.ts')
    holdFile('a', f)
    const listener = vi.fn()
    subscribeToHeldFiles(listener)

    holdFile('a', f)
    releaseFile('never-held')

    expect(listener).not.toHaveBeenCalled()
  })
})
