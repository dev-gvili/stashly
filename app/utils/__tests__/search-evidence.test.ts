/**
 * Unit tests for the search results layout's pure helpers — the parts that
 * decide what gets marked, how a result is banded, and what the meter width
 * compiles to.
 */
import { describe, it, expect } from 'vitest'
import {
  MATCH_KIND_ORDER,
  highlightSegments,
  scoreBand,
  toEvidenceSnippet,
  tokenizeQuery,
  widthForPercent,
} from '@/components/views/search-components/search-helpers'
import type { SearchPassage } from '@/types/stash.types'

describe('tokenizeQuery', () => {
  it('drops stopwords and single characters', () => {
    expect(tokenizeQuery('the cost of a refund')).toEqual(['cost', 'refund'])
  })

  it('strips surrounding punctuation but keeps interior marks', () => {
    expect(tokenizeQuery('"revenue", (q3-2026)!')).toEqual([
      'revenue',
      'q3-2026',
    ])
  })

  it('deduplicates case-insensitively', () => {
    expect(tokenizeQuery('Report report REPORT')).toEqual(['report'])
  })

  it('returns nothing for a query made entirely of stopwords', () => {
    expect(tokenizeQuery('the and of')).toEqual([])
  })
})

describe('highlightSegments', () => {
  it('returns one plain segment when there is nothing to mark', () => {
    expect(highlightSegments('untouched text', [])).toEqual([
      { text: 'untouched text', kind: 'plain' },
    ])
  })

  it('marks a literal term and leaves the surrounding text plain', () => {
    expect(highlightSegments('the refund window', ['refund'])).toEqual([
      { text: 'the ', kind: 'plain' },
      { text: 'refund', kind: 'literal' },
      { text: ' window', kind: 'plain' },
    ])
  })

  it('keeps the two tiers distinct', () => {
    const segments = highlightSegments(
      'refund and reimbursement',
      ['refund'],
      ['reimbursement']
    )
    expect(segments.map((s) => s.kind)).toEqual([
      'literal',
      'plain',
      'expanded',
    ])
  })

  it('preserves the original casing of a case-insensitive match', () => {
    const segments = highlightSegments('Refund policy', ['refund'])
    expect(segments[0]).toEqual({ text: 'Refund', kind: 'literal' })
  })

  it('prefers the longest term so a prefix cannot orphan its tail', () => {
    // 'report' alone would mark the first six characters and leave 'ing'
    // unmarked in the middle of a word the user actually typed.
    const segments = highlightSegments('quarterly reporting', [
      'report',
      'reporting',
    ])
    expect(segments).toEqual([
      { text: 'quarterly ', kind: 'plain' },
      { text: 'reporting', kind: 'literal' },
    ])
  })

  it('never labels an expansion as a literal hit', () => {
    const segments = highlightSegments('salary', [], ['salary'])
    expect(segments).toEqual([{ text: 'salary', kind: 'expanded' }])
  })

  it('treats regex metacharacters in a term as literal text', () => {
    const segments = highlightSegments('a+b and a plus b', ['a+b'])
    expect(segments[0]).toEqual({ text: 'a+b', kind: 'literal' })
  })
})

describe('scoreBand', () => {
  it('bands on the documented boundaries', () => {
    expect(scoreBand(100)).toBe('strong')
    expect(scoreBand(80)).toBe('strong')
    expect(scoreBand(79)).toBe('related')
    expect(scoreBand(40)).toBe('related')
    expect(scoreBand(39)).toBe('distant')
    expect(scoreBand(0)).toBe('distant')
  })
})

describe('widthForPercent', () => {
  it('snaps to the nearest 5% step', () => {
    expect(widthForPercent(0)).toBe('w-[0%]')
    expect(widthForPercent(42)).toBe('w-[40%]')
    expect(widthForPercent(43)).toBe('w-[45%]')
    expect(widthForPercent(100)).toBe('w-[100%]')
  })

  it('clamps out-of-range input rather than indexing past the map', () => {
    expect(widthForPercent(-20)).toBe('w-[0%]')
    expect(widthForPercent(180)).toBe('w-[100%]')
  })

  it('only ever returns a class name Tailwind can see in source', () => {
    for (let percent = 0; percent <= 100; percent += 1) {
      expect(widthForPercent(percent)).toMatch(/^w-\[\d+%\]$/)
    }
  })
})

describe('toEvidenceSnippet', () => {
  const passage = (over: Partial<SearchPassage> = {}): SearchPassage => ({
    chunkId: 'chunk_1',
    content: 'The refund window closes thirty days after delivery.',
    pageNum: null,
    lineNum: null,
    section: null,
    charStart: 0,
    charEnd: 51,
    similarity: 0.8,
    ...over,
  })

  it('renders a page locator when the source is paginated', () => {
    expect(toEvidenceSnippet(passage({ pageNum: 5 }), 'refund').locator).toBe(
      'page 5'
    )
  })

  it('prefers the section, which names the passage as well as placing it', () => {
    expect(
      toEvidenceSnippet(
        passage({ section: 'Why chunk?', pageNum: 5, lineNum: 41 }),
        'refund'
      ).locator
    ).toBe('§ Why chunk?')
  })

  // A markdown result used to show "8 hits" with nothing saying where they
  // were, because only paginated formats got a locator at all.
  it('falls back to a line when the format has no pages', () => {
    expect(toEvidenceSnippet(passage({ lineNum: 41 }), 'refund').locator).toBe(
      'line 41'
    )
  })

  it('prefers the page over the line when both are known', () => {
    expect(
      toEvidenceSnippet(passage({ pageNum: 8, lineNum: 41 }), 'refund').locator
    ).toBe('page 8')
  })

  it('falls back to a line when there is no section or page', () => {
    expect(toEvidenceSnippet(passage({ lineNum: 41 }), 'refund').locator).toBe(
      'line 41'
    )
  })

  // The thumbnail already carries a relevance percentage. A second, unrelated
  // percentage in the snippet header reads as a number to compare it against.
  it('never renders a percentage as a locator', () => {
    for (const over of [{ section: 'Refunds' }, { pageNum: 3 }, { lineNum: 9 }]) {
      const { locator } = toEvidenceSnippet(passage(over), 'refund')
      expect(locator).not.toMatch(/%/)
    }
  })

  it('omits the locator only when nothing at all is known', () => {
    expect(toEvidenceSnippet(passage(), 'refund').locator).toBeUndefined()
  })

  it('ignores an empty section rather than rendering a bare §', () => {
    expect(
      toEvidenceSnippet(passage({ section: '', lineNum: 12 }), 'refund').locator
    ).toBe('line 12')
  })

  it('keeps page 0 addressable rather than treating it as absent', () => {
    expect(toEvidenceSnippet(passage({ pageNum: 0 }), 'refund').locator).toBe(
      'page 0'
    )
  })

  it('carries the windowed text through', () => {
    const snippet = toEvidenceSnippet(passage(), 'refund')
    expect(snippet.text).toContain('refund')
  })
})

describe('MATCH_KIND_ORDER', () => {
  it('runs strongest evidence first', () => {
    expect(MATCH_KIND_ORDER).toEqual(['name', 'content', 'semantic'])
  })
})
