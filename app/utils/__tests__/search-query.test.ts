import { describe, it, expect } from 'vitest'
import {
  MIN_QUERY_LENGTH,
  RRF_K,
  SEARCH_MAX_TAKE,
  SEARCH_PAGE_SIZE,
  SEARCH_VECTOR_DIM,
  buildSnippet,
  clampTake,
  isSearchableQuery,
  normalizeQuery,
  reciprocalRankFusion,
  shouldEmbedQuery,
  toVectorLiteral,
} from '../search-query'

describe('normalizeQuery', () => {
  it('collapses runs of whitespace and trims', () => {
    expect(normalizeQuery('  refund   policy \n draft ')).toBe(
      'refund policy draft'
    )
  })

  it('leaves an already-clean query untouched', () => {
    expect(normalizeQuery('quarterly report')).toBe('quarterly report')
  })
})

describe('isSearchableQuery', () => {
  it('rejects queries below the minimum length', () => {
    expect(isSearchableQuery('')).toBe(false)
    expect(isSearchableQuery('a')).toBe(false)
    expect(isSearchableQuery('   ')).toBe(false)
  })

  it('accepts a query at the minimum length', () => {
    expect(isSearchableQuery('a'.repeat(MIN_QUERY_LENGTH))).toBe(true)
  })

  it('measures the normalized string, not the raw one', () => {
    // Four raw chars, but only one after trimming — not searchable.
    expect(isSearchableQuery('  a ')).toBe(false)
  })
})

describe('shouldEmbedQuery', () => {
  it('skips the model for short fragments trigrams handle better', () => {
    expect(shouldEmbedQuery('tax')).toBe(false)
  })

  it('embeds natural-language queries', () => {
    expect(shouldEmbedQuery('what is our refund policy')).toBe(true)
  })
})

describe('reciprocalRankFusion', () => {
  it('ranks a document found by both rankers above singles', () => {
    const fused = reciprocalRankFusion([
      ['a', 'b'],
      ['b', 'c'],
    ])
    expect(fused[0].id).toBe('b')
    expect(fused.map((r) => r.id).sort()).toEqual(['a', 'b', 'c'])
  })

  it('scores by 1/(k + rank) with 1-based ranks', () => {
    const [top] = reciprocalRankFusion([['a']])
    expect(top.score).toBeCloseTo(1 / (RRF_K + 1))
  })

  it('sums contributions across every list', () => {
    const [top] = reciprocalRankFusion([['a'], ['a']])
    expect(top.score).toBeCloseTo(2 / (RRF_K + 1))
  })

  it('breaks score ties by id so pagination is stable', () => {
    // Same rank in separate lists → identical scores.
    const fused = reciprocalRankFusion([['b'], ['a']])
    expect(fused.map((r) => r.id)).toEqual(['a', 'b'])
  })

  it('respects an explicit limit', () => {
    const fused = reciprocalRankFusion([['a', 'b', 'c']], { limit: 2 })
    expect(fused).toHaveLength(2)
  })

  it('returns nothing for empty input', () => {
    expect(reciprocalRankFusion([])).toEqual([])
    expect(reciprocalRankFusion([[], []])).toEqual([])
  })

  it('honours a custom k', () => {
    const [top] = reciprocalRankFusion([['a']], { k: 0 })
    expect(top.score).toBeCloseTo(1)
  })
})

describe('buildSnippet', () => {
  it('returns a short passage whole and locates the match', () => {
    const snippet = buildSnippet('Our refund policy is generous.', 'refund')
    expect(snippet.text).toBe('Our refund policy is generous.')
    expect(snippet.truncatedStart).toBe(false)
    expect(snippet.truncatedEnd).toBe(false)
    expect(snippet.text.slice(snippet.matches[0].start, snippet.matches[0].end))
      .toBe('refund')
  })

  it('centres the window on a match buried deep in a long passage', () => {
    const passage = `${'filler word '.repeat(200)}the termination clause applies${' trailing '.repeat(200)}`
    const snippet = buildSnippet(passage, 'termination clause')
    expect(snippet.text).toContain('termination clause')
    expect(snippet.truncatedStart).toBe(true)
    expect(snippet.text.length).toBeLessThanOrEqual(260)
  })

  it('falls back to the head of the passage when nothing matches literally', () => {
    // The semantic case: the passage is *about* the query without containing it.
    const passage = `Reimbursement takes thirty days. ${'more text '.repeat(100)}`
    const snippet = buildSnippet(passage, 'refund policy')
    expect(snippet.truncatedStart).toBe(false)
    expect(snippet.truncatedEnd).toBe(true)
    expect(snippet.matches).toEqual([])
    expect(snippet.text.startsWith('Reimbursement takes thirty days.')).toBe(true)
  })

  it('matches case-insensitively', () => {
    const snippet = buildSnippet('The REFUND was issued.', 'refund')
    expect(snippet.matches).toHaveLength(1)
  })

  it('merges overlapping term hits into one highlight', () => {
    // 'report' and 'port' overlap in the same word.
    const snippet = buildSnippet('the report is ready', 'report port')
    expect(snippet.matches).toHaveLength(1)
    expect(snippet.text.slice(snippet.matches[0].start, snippet.matches[0].end))
      .toBe('report')
  })

  it('ignores one-character terms', () => {
    const snippet = buildSnippet('a quarterly report', 'a')
    expect(snippet.matches).toEqual([])
  })

  it('normalizes whitespace inside the passage', () => {
    const snippet = buildSnippet('line one\n\n   line two', 'line')
    expect(snippet.text).toBe('line one line two')
  })

  it('finds every occurrence of a repeated term', () => {
    const snippet = buildSnippet('cost cost cost', 'cost')
    expect(snippet.matches).toHaveLength(3)
  })
})

describe('clampTake', () => {
  it('falls back to the default page size when absent or unparseable', () => {
    expect(clampTake(null)).toBe(SEARCH_PAGE_SIZE)
    expect(clampTake(undefined)).toBe(SEARCH_PAGE_SIZE)
    expect(clampTake('')).toBe(SEARCH_PAGE_SIZE)
    expect(clampTake('abc')).toBe(SEARCH_PAGE_SIZE)
  })

  it('caps a value above the maximum', () => {
    expect(clampTake('1000000000')).toBe(SEARCH_MAX_TAKE)
  })

  it('raises zero and negatives to one', () => {
    expect(clampTake('0')).toBe(1)
    expect(clampTake('-5')).toBe(1)
  })

  it('truncates fractional values rather than passing them to SQL', () => {
    expect(clampTake('7.9')).toBe(7)
  })
})

describe('toVectorLiteral', () => {
  const validVector = () => new Array(SEARCH_VECTOR_DIM).fill(0.1)

  it('renders a valid vector as a pgvector literal', () => {
    const literal = toVectorLiteral(validVector())
    expect(literal.startsWith('[0.1,')).toBe(true)
    expect(literal.endsWith(']')).toBe(true)
  })

  it('rejects a wrong-length vector', () => {
    expect(() => toVectorLiteral([0.1, 0.2])).toThrow(/768-dim/)
  })

  it('rejects non-array input', () => {
    expect(() => toVectorLiteral('not a vector')).toThrow(/array of numbers/)
    expect(() => toVectorLiteral(null)).toThrow(/array of numbers/)
  })

  it('rejects non-finite values that would break the ::vector cast', () => {
    const withNaN = validVector()
    withNaN[5] = Number.NaN
    expect(() => toVectorLiteral(withNaN)).toThrow(/non-finite/)

    const withString = validVector()
    withString[5] = '0.4'
    expect(() => toVectorLiteral(withString)).toThrow(/non-finite/)
  })

  it('honours an explicit dimension', () => {
    expect(toVectorLiteral([1, 2], 2)).toBe('[1,2]')
  })
})

describe('buildSnippet — word-boundary highlighting', () => {
  it('highlights a hyphenated term the query wrote with its hyphen', () => {
    // Regression: internal punctuation was stripped from the term but not the
    // passage, so 'browser-side' became 'browserside' and matched nothing.
    const snippet = buildSnippet(
      'patterns: browser-side WebGPU AI inference, XState 5',
      'browser-side WebGPU AI inference'
    )
    // Offsets index the original text, so casing is preserved on slice.
    const marked = snippet.matches.map((m) =>
      snippet.text.slice(m.start, m.end).toLowerCase()
    )
    expect(marked).toContain('browser-side')
    expect(marked).toContain('webgpu')
    expect(marked).toContain('inference')
    expect(marked).toContain('ai')
  })

  it('does not highlight a short term inside an unrelated word', () => {
    // Regression: 'ai' lit up the middle of 'chain' and 'thumbnails'.
    const snippet = buildSnippet('the chain of thumbnails is available', 'AI')
    expect(snippet.matches).toEqual([])
  })

  it('still highlights the term as its own word', () => {
    const snippet = buildSnippet('browser-side AI inference', 'AI')
    expect(snippet.matches).toHaveLength(1)
    expect(snippet.text.slice(snippet.matches[0].start, snippet.matches[0].end))
      .toBe('AI')
  })

  it('highlights a term that starts a word, as a prefix', () => {
    // 'infer' should mark the head of 'inference' — partial typing stays useful.
    const snippet = buildSnippet('WebGPU inference pipeline', 'infer')
    expect(snippet.matches).toHaveLength(1)
    expect(snippet.text.slice(snippet.matches[0].start, snippet.matches[0].end))
      .toBe('infer')
  })

  it('matches a term following punctuation, not just a space', () => {
    const snippet = buildSnippet('(WebGPU) and [AI]', 'webgpu')
    expect(snippet.matches).toHaveLength(1)
  })
})
