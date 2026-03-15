import { describe, it, expect } from 'vitest'
import {
  extractAudioChunk,
  makeChunks,
  toChunk,
} from '../stash.worker.helpers'

// ─── extractAudioChunk ────────────────────────────────────────────────────────

describe('extractAudioChunk', () => {
  it('extracts the correct samples for a given start and duration', () => {
    const audio = new Float32Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
    // sampleRate=10: 0s–0.5s → samples 0..4
    const chunk = extractAudioChunk({ audio, startSeconds: 0, durationSeconds: 0.5, sampleRate: 10 })
    expect(Array.from(chunk)).toEqual([0, 1, 2, 3, 4])
  })

  it('starts at the correct offset when startSeconds > 0', () => {
    const audio = new Float32Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
    // sampleRate=10: 0.3s–0.6s → samples 3..5
    const chunk = extractAudioChunk({ audio, startSeconds: 0.3, durationSeconds: 0.3, sampleRate: 10 })
    expect(Array.from(chunk)).toEqual([3, 4, 5])
  })

  it('clamps to the end of the buffer when duration exceeds remaining audio', () => {
    const audio = new Float32Array([0, 1, 2, 3, 4])
    // sampleRate=10: request 1s (10 samples) but only 5 remain
    const chunk = extractAudioChunk({ audio, startSeconds: 0, durationSeconds: 1, sampleRate: 10 })
    expect(chunk.length).toBe(5)
    expect(Array.from(chunk)).toEqual([0, 1, 2, 3, 4])
  })

  it('returns an empty Float32Array when startSeconds equals audio length', () => {
    const audio = new Float32Array([0, 1, 2])
    const chunk = extractAudioChunk({ audio, startSeconds: 0.3, durationSeconds: 0.1, sampleRate: 10 })
    expect(chunk.length).toBe(0)
  })

  it('returns an empty Float32Array when startSeconds is past the end', () => {
    const audio = new Float32Array([0, 1, 2])
    const chunk = extractAudioChunk({ audio, startSeconds: 1, durationSeconds: 0.1, sampleRate: 10 })
    expect(chunk.length).toBe(0)
  })

  it('defaults to 16000 Hz when sampleRate is omitted', () => {
    // 1 sample at 16000 Hz = 1/16000 seconds
    const audio = new Float32Array(16000).fill(1)
    const chunk = extractAudioChunk({ audio, startSeconds: 0, durationSeconds: 0.5 })
    expect(chunk.length).toBe(8000)
  })
})

// ─── makeChunks ───────────────────────────────────────────────────────────────

describe('makeChunks', () => {
  it('returns a single chunk when audio is shorter than chunkSec', () => {
    const audio = new Float32Array([1, 2, 3])
    const chunks = makeChunks(audio, 10, 1) // 1s @ 10Hz = 10 samples; audio only has 3
    expect(chunks.length).toBe(1)
    expect(Array.from(chunks[0])).toEqual([1, 2, 3])
  })

  it('splits audio into equal chunks with no stride', () => {
    const audio = new Float32Array([1, 2, 3, 4, 5, 6])
    const chunks = makeChunks(audio, 1, 2) // 2s @ 1Hz = 2 samples per chunk
    expect(chunks.length).toBe(3)
    expect(Array.from(chunks[0])).toEqual([1, 2])
    expect(Array.from(chunks[1])).toEqual([3, 4])
    expect(Array.from(chunks[2])).toEqual([5, 6])
  })

  it('creates overlapping chunks when stride is set', () => {
    // 6 samples @ 1Hz, chunkSec=3, strideSec=1 → step=2 each time
    const audio = new Float32Array([1, 2, 3, 4, 5, 6])
    const chunks = makeChunks(audio, 1, 3, 1)
    // start=0: [1,2,3], start=2: [3,4,5], start=4: [5,6]
    expect(chunks.length).toBe(3)
    expect(Array.from(chunks[0])).toEqual([1, 2, 3])
    expect(Array.from(chunks[1])).toEqual([3, 4, 5])
  })

  it('last chunk does not exceed the buffer length', () => {
    const audio = new Float32Array([1, 2, 3, 4, 5]) // 5 samples, not divisible by chunk
    const chunks = makeChunks(audio, 1, 2) // 2 samples per chunk
    const last = chunks[chunks.length - 1]
    expect(last.length).toBeLessThanOrEqual(2)
    // all samples combined should not exceed original length
    const total = chunks.reduce((s, c) => s + c.length, 0)
    expect(total).toBeLessThanOrEqual(audio.length + (chunks.length - 1) * 0) // no overlap
  })

  it('returns an empty array for an empty audio buffer', () => {
    const chunks = makeChunks(new Float32Array(0), 16000, 30)
    expect(chunks.length).toBe(0)
  })
})

// ─── toChunk ──────────────────────────────────────────────────────────────────

describe('toChunk', () => {
  it('returns the whole text as one chunk when it is within maxLength', () => {
    const text = 'Hello world.'
    expect(toChunk(text, 100)).toEqual(['Hello world.'])
  })

  it('splits on sentence boundaries to stay within maxLength', () => {
    const text = 'First sentence. Second sentence. Third sentence.'
    const chunks = toChunk(text, 35)
    expect(chunks.length).toBeGreaterThan(1)
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(35)
    }
    // each sentence appears in one of the chunks (trim() removes boundary spaces)
    expect(chunks.some((c) => c.includes('First sentence.'))).toBe(true)
    expect(chunks.some((c) => c.includes('Second sentence.'))).toBe(true)
    expect(chunks.some((c) => c.includes('Third sentence.'))).toBe(true)
  })

  it('handles text with no sentence terminators as a single chunk', () => {
    const text = 'no punctuation here'
    expect(toChunk(text, 50)).toEqual(['no punctuation here'])
  })

  it('handles empty string', () => {
    expect(toChunk('', 100)).toEqual([])
  })

  it('splits question marks and exclamation marks as sentence boundaries', () => {
    const text = 'Is this working? Yes it is! Great.'
    const chunks = toChunk(text, 20)
    expect(chunks.length).toBeGreaterThan(1)
    // each fragment appears somewhere in the result
    expect(chunks.some((c) => c.includes('Is this working?'))).toBe(true)
    expect(chunks.some((c) => c.includes('Great.'))).toBe(true)
  })
})
