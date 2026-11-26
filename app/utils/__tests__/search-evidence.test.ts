/**
 * Unit tests for the search results layout's pure helpers — the parts that
 * decide what gets marked, how a result is banded, and what the meter width
 * compiles to.
 */
import { describe, it, expect } from 'vitest'
import {
  MATCH_KIND_LABEL,
  MATCH_KIND_NOTE,
  MATCH_KIND_ORDER,
  highlightSegments,
  scoreBand,
  fileLineOf,
  landingFromParams,
  landingWordEnd,
  passageLinkSearch,
  toEvidenceSnippet,
  toHitStops,
  tokenizeQuery,
} from '@/utils/search-evidence'
import { widthForPercent } from '@/utils/styles'
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

describe('toHitStops', () => {
  const at = (content: string, lineNum: number): SearchPassage => ({
    chunkId: null,
    content,
    pageNum: null,
    lineNum,
    section: null,
    charStart: 0,
    charEnd: content.length,
    similarity: 0,
  })
  // From semantic-search.md: hits 3 and 4 sit in one sentence pair.
  const shared =
    'Vectors and OCR wait in a deferred lane while any upload is moving bytes. The server owns chunk text: the client only sends vectors back.'

  it('merges hits that cut the same excerpt into one stop', () => {
    const stops = toHitStops(
      [at('Chunk vectors are 768-dim.', 10), at(`Earlier text. ${shared}`, 52), at(shared, 53), at('Last vectors line.', 80)],
      'vectors'
    )
    expect(stops.map((s) => [s.from, s.to])).toEqual([
      [1, 1],
      [2, 3],
      [4, 4],
    ])
    expect(stops[1].snippet.locator).toBe('line 52')
  })

  it('keeps distinct excerpts apart', () => {
    expect(toHitStops([at('One vectors.', 1), at('Two vectors.', 2)], 'vectors')).toHaveLength(2)
  })
})

describe('search permalinks', () => {
  const passage = (over: Partial<SearchPassage>): SearchPassage => ({
    chunkId: null,
    content: 'x',
    pageNum: null,
    lineNum: null,
    section: null,
    charStart: 0,
    charEnd: 1,
    similarity: null,
    ...over,
  })

  it('links to the hit line and column, counted in the index', () => {
    expect(passageLinkSearch(passage({ lineNum: 866, column: 12 }))).toBe('line=866&col=12&lines=index')
  })

  it('adds the page when the document has pages, and nothing it does not know', () => {
    expect(passageLinkSearch(passage({ lineNum: 1, pageNum: 13 }))).toBe('line=1&lines=index&page=13')
    expect(passageLinkSearch(passage({}))).toBe('')
    expect(passageLinkSearch(null)).toBe('')
  })

  it('maps an index line back past the blank lines the indexer trimmed', () => {
    // From the session log .txt: the file opens with a blank line.
    const NL = String.fromCharCode(10)
    expect(fileLineOf(`${NL}> one${NL}two`, 2, 4)).toEqual({ line: 3, column: 4 })
    expect(fileLineOf(`${NL}${NL}  export x`, 1, 1)).toEqual({ line: 3, column: 3 })
    expect(fileLineOf('no lead', 5, 2)).toEqual({ line: 5, column: 2 })
  })

  it('maps only links that count the index; a definition jump counts the file', () => {
    const NL = String.fromCharCode(10)
    const text = `${NL}a${NL}b`
    expect(landingFromParams(new URLSearchParams('line=2&col=1&lines=index'), text)).toEqual({ line: 3, column: 1 })
    expect(landingFromParams(new URLSearchParams('line=2&col=1'), text)).toEqual({ line: 2, column: 1 })
    expect(landingFromParams(new URLSearchParams('line=abc'), text)).toEqual({})
  })

  it('ends the landing word at the first character that is not a letter or digit', () => {
    expect(landingWordEnd('calls vectors(x)', 6)).toBe(13)
    expect(landingWordEnd('(x)', 0)).toBe(1)
  })
})

describe('MATCH_KIND_ORDER', () => {
  it('runs strongest evidence first', () => {
    expect(MATCH_KIND_ORDER).toEqual(['name', 'content', 'fuzzy', 'semantic'])
  })

  // The two no-literal-evidence kinds are distinct on purpose: `fuzzy` is an
  // approximate name from the trigram ranker, `semantic` a vector neighbour.
  // Their copy has to say different things or the split buys nothing.
  it('gives every kind its own label and note', () => {
    const labels = MATCH_KIND_ORDER.map((kind) => MATCH_KIND_LABEL[kind])
    const notes = MATCH_KIND_ORDER.map((kind) => MATCH_KIND_NOTE[kind])
    expect(new Set(labels).size).toBe(MATCH_KIND_ORDER.length)
    expect(new Set(notes).size).toBe(MATCH_KIND_ORDER.length)
  })
})
