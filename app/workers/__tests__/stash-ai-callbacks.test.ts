import { describe, it, expect } from 'vitest'
import { normalizeTranscript, serializeSummaryPayload } from '../stash.ai'

describe('normalizeTranscript', () => {
  it('joins partial texts with comma-space', () => {
    expect(normalizeTranscript(['Hello', 'world'])).toBe('Hello, world')
  })
  it('trims leading and trailing whitespace from the result', () => {
    expect(normalizeTranscript(['  Hello', 'world  '])).toBe('Hello, world')
  })
  it('returns empty string for empty array', () => {
    expect(normalizeTranscript([])).toBe('')
  })
})

describe('serializeSummaryPayload', () => {
  it('returns generated_text from array payload', () => {
    expect(serializeSummaryPayload([{ generated_text: 'hi' }])).toBe('hi')
  })
  it('returns the string directly', () => {
    expect(serializeSummaryPayload('hi')).toBe('hi')
  })
  it('returns generated_text from object payload', () => {
    expect(serializeSummaryPayload({ generated_text: 'hi' })).toBe('hi')
  })
  it('falls back to empty string for unknown shapes', () => {
    expect(serializeSummaryPayload(null)).toBe('')
  })
})
