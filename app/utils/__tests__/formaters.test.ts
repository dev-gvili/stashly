import { describe, it, expect } from 'vitest'
import { capitalize, formatTime, formatSize, datetime, currency } from '../formaters'

describe('capitalize', () => {
  it('capitalizes the first letter of a word', () => {
    expect(capitalize('hello')).toBe('Hello')
  })

  it('capitalizes the first letter of a multi-word string', () => {
    expect(capitalize('hello world')).toBe('Hello world')
  })

  it('returns the same string when first letter is already uppercase', () => {
    expect(capitalize('Hello')).toBe('Hello')
  })

  it('returns empty string for empty input', () => {
    expect(capitalize('')).toBe('')
  })

  it('returns empty string for undefined input', () => {
    expect(capitalize(undefined)).toBe('')
  })

  it('handles single character strings', () => {
    expect(capitalize('a')).toBe('A')
  })

  it('handles strings that are all uppercase', () => {
    expect(capitalize('HELLO')).toBe('HELLO')
  })

  it('handles strings with leading spaces', () => {
    // spaces are not trimmed — first char is a space
    expect(capitalize(' hello')).toBe(' hello')
  })
})

describe('formatTime', () => {
  it('formats zero milliseconds as 00:00:00', () => {
    expect(formatTime(0)).toBe('00:00:00')
  })

  it('formats 1000ms (1 second) as 00:00:01', () => {
    expect(formatTime(1000)).toBe('00:00:01')
  })

  it('formats 60000ms (1 minute) as 00:01:00', () => {
    expect(formatTime(60000)).toBe('00:01:00')
  })

  it('formats 3600000ms (1 hour) as 01:00:00', () => {
    expect(formatTime(3600000)).toBe('01:00:00')
  })

  it('formats 3661000ms (1h 1m 1s) as 01:01:01', () => {
    expect(formatTime(3661000)).toBe('01:01:01')
  })

  it('formats 7384500ms (2h 3m 4.5s truncated) as 02:03:04', () => {
    expect(formatTime(7384500)).toBe('02:03:04')
  })

  it('pads single-digit values with leading zeros', () => {
    expect(formatTime(9000)).toBe('00:00:09')
  })

  it('handles more than 23 hours', () => {
    // 25 hours = 90000000 ms
    expect(formatTime(90000000)).toBe('25:00:00')
  })
})

describe('formatSize', () => {
  it('formats bytes with default parameters', () => {
    const result = formatSize('byte', 'unit', 1024)
    expect(result).toContain('1')
    expect(result).toContain('K')
  })

  it('formats 0 bytes', () => {
    const result = formatSize('byte', 'unit', 0)
    expect(result).toContain('0')
  })

  it('replaces BB suffix with GB for gigabytes', () => {
    // 1 billion bytes in compact notation may produce "BB" which should be fixed to "GB"
    const result = formatSize('byte', 'unit', 1_000_000_000)
    expect(result).not.toContain('BB')
  })
})

describe('datetime', () => {
  it('formats a date with default locale and style', () => {
    const date = new Date('2024-01-15')
    const result = datetime('en-US', 'short', date)
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('formats a date with long style', () => {
    const date = new Date('2024-01-15')
    const result = datetime('en-US', 'long', date)
    expect(result).toContain('2024')
  })
})

describe('currency', () => {
  it('formats a number as currency', () => {
    const result = currency('en-US', 'USD', 42.5)
    expect(result).toContain('42')
    expect(typeof result).toBe('string')
  })

  it('formats zero as currency', () => {
    const result = currency('en-US', 'USD', 0)
    expect(result).toContain('0')
  })
})
