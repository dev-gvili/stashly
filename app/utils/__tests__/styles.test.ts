import { describe, it, expect } from 'vitest'
import { cn } from '../styles'

describe('cn', () => {
  it('returns a single class unchanged', () => {
    expect(cn('foo')).toBe('foo')
  })

  it('merges multiple classes', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('filters out falsy values', () => {
    expect(cn('foo', false, undefined, null, 'bar')).toBe('foo bar')
  })

  it('handles conditional classes via objects', () => {
    expect(cn({ foo: true, bar: false })).toBe('foo')
  })

  it('handles conditional classes via objects — all true', () => {
    expect(cn({ foo: true, bar: true })).toBe('foo bar')
  })

  it('handles arrays of classes', () => {
    expect(cn(['foo', 'bar'])).toBe('foo bar')
  })

  it('handles nested arrays', () => {
    expect(cn(['foo', ['bar', 'baz']])).toBe('foo bar baz')
  })

  it('deduplicates conflicting Tailwind classes (tailwind-merge behavior)', () => {
    // tailwind-merge resolves conflicts: latter class wins
    expect(cn('p-2', 'p-4')).toBe('p-4')
  })

  it('deduplicates text color conflicts', () => {
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500')
  })

  it('returns empty string when no classes provided', () => {
    expect(cn()).toBe('')
  })

  it('returns empty string for all falsy inputs', () => {
    expect(cn(false, null, undefined)).toBe('')
  })
})
