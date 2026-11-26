import { describe, it, expect } from 'vitest'
import {
  MIN_QUERY_LENGTH,
  RRF_K,
  SEARCH_MAX_TAKE,
  SEARCH_PAGE_SIZE,
  SEARCH_VECTOR_DIM,
  buildSnippet,
  buildSentenceSnippet,
  SENTENCE_SNIPPET_MAX_LENGTH,
  findHitOffsets,
  hitPassageWindow,
  clampTake,
  formatSearchScope,
  isSearchableQuery,
  normalizeQuery,
  parseSearchScope,
  reciprocalRankFusion,
  shouldEmbedQuery,
  toVectorLiteral,
} from '../search-query'

describe('parseSearchScope', () => {
  it('reads a folder or collection scope', () => {
    expect(parseSearchScope('folder:fol_abc')).toEqual({ kind: 'folder', id: 'fol_abc' })
    expect(parseSearchScope('collection:col_1')).toEqual({ kind: 'collection', id: 'col_1' })
  })
  it('treats anything else as no scope', () => {
    for (const raw of [null, undefined, '', 'folder', 'folder:', ':fol_1', 'file:x', 'Folder:x']) {
      expect(parseSearchScope(raw)).toBeNull()
    }
  })
  it('round-trips through formatSearchScope', () => {
    const scope = { kind: 'folder' as const, id: 'fol_9' }
    expect(parseSearchScope(formatSearchScope(scope))).toEqual(scope)
  })
})

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

describe('buildSentenceSnippet', () => {
  // ~50 characters: two fit under the 128-character cap, three don't.
  const s = (n: number, word = 'filler') => `Sentence ${n} has ${word} ${'text '.repeat(5).trim()}.`

  it('opens on the sentence holding the hit and adds the next one when it fits', () => {
    const passage = [s(1), s(2, 'vector'), s(3), s(4)].join(' ')
    const snippet = buildSentenceSnippet(passage, 'vector')
    expect(snippet.text).toBe(`${s(2, 'vector')} ${s(3)}`)
    expect(snippet.truncatedStart).toBe(true)
    expect(snippet.truncatedEnd).toBe(true)
  })

  it('never shows more than two sentences', () => {
    const short = (n: number) => `Hit ${n} vector.`
    const snippet = buildSentenceSnippet([1, 2, 3, 4, 5].map(short).join(' '), 'vector')
    expect(snippet.text).toBe('Hit 1 vector. Hit 2 vector.')
  })

  it('keeps one sentence when a second would pass the length cap', () => {
    const long = `The vector ${'word '.repeat(15).trim()}.`
    const snippet = buildSentenceSnippet(`${long} ${long}`, 'vector')
    expect(snippet.text).toBe(long)
    expect(snippet.text.length).toBeLessThanOrEqual(SENTENCE_SNIPPET_MAX_LENGTH)
  })

  it('cuts a single sentence longer than the cap at a word, around the hit', () => {
    const passage = `${'lead '.repeat(120)}vector ${'tail '.repeat(120)}`.trim() + '.'
    const snippet = buildSentenceSnippet(passage, 'vector')
    expect(snippet.text.length).toBeLessThanOrEqual(SENTENCE_SNIPPET_MAX_LENGTH)
    expect(snippet.text).toContain('vector')
    expect(snippet.truncatedStart).toBe(true)
    expect(snippet.truncatedEnd).toBe(true)
  })

  it('opens on the first sentence when nothing matches literally', () => {
    const passage = [s(1), s(2), s(3)].join(' ')
    expect(buildSentenceSnippet(passage, 'meaning').text).toBe(`${s(1)} ${s(2)}`)
  })

  it('does not split on decimals or a dot inside a word', () => {
    const passage = 'Version 3.5 ships the vector index in search.prisma today. Next one.'
    expect(buildSentenceSnippet(passage, 'vector').text).toBe(passage)
  })

  it('locates the matches inside the window', () => {
    const snippet = buildSentenceSnippet('One vector here. Another vector there.', 'vector')
    expect(snippet.matches).toHaveLength(2)
  })

  // The OCR'd slide from the Platform Blueprint PDF, as indexed.
  const slide = [
    'Exact keyword matching,   Browser WebGPU embeds',
    'Standard indexed   Conceptual mapping\r\nStorage   columns   Target   (Cosine similarity on\r\n768-dim vectors)',
    'SearchChunk (passages of\r\nM   Storage   ~300 tokens) to allow\r\nhighlighted matches',
    'Gemini Notebo',
    'The progressive thumbnail engine degrades gracefully without server compute',
  ].join('\r\n\r\n')

  it('keeps to the paragraph holding the hit', () => {
    const snippet = buildSentenceSnippet(slide, 'vectors')
    expect(snippet.text).toBe(
      'Standard indexed Conceptual mapping Storage columns Target (Cosine similarity on 768-dim vectors)',
    )
    expect(snippet.truncatedStart).toBe(true)
    expect(snippet.truncatedEnd).toBe(true)
  })
})

describe('findHitOffsets', () => {
  it('finds every occurrence of every term, case-insensitively, in order', () => {
    expect(findHitOffsets('Vector one, vector two. A VECTOR.', ['vector'])).toEqual([0, 12, 26])
  })

  it('merges terms and drops a repeat at the same offset', () => {
    // "vector" and "vectors" both start at 4: one place to jump to, not two.
    expect(findHitOffsets('The vectors and a vector', ['vector', 'vectors'])).toEqual([4, 18])
  })

  it('skips a hit inside a word, which the excerpt cannot highlight', () => {
    // From tech-debt.md line 866.
    const body = 'calls setSearchChunkVectors(entries) to overwrite chunk vectors by id'
    expect(findHitOffsets(body, ['vectors'])).toEqual([body.indexOf('chunk vectors') + 6])
  })

  it('returns nothing for an empty body or no terms', () => {
    expect(findHitOffsets('', ['vector'])).toEqual([])
    expect(findHitOffsets('vector', [])).toEqual([])
  })
})

describe('hitPassageWindow', () => {
  const body = `${'a'.repeat(500)}HIT${'b'.repeat(1000)}`

  it('cuts the same window as the first-hit query: 250 before, 500 long', () => {
    const w = hitPassageWindow(body, 500)
    expect(w.content).toBe(body.slice(250, 750))
    expect(w.content).toContain('HIT')
  })

  it('gives the same excerpt as the first-hit window, leading "…" included', () => {
    const text = `${'x'.repeat(300)} wording here. The HIT is in this sentence.`
    const offset = text.indexOf('HIT')
    const sql = text.slice(offset - 250, offset + 250)
    expect(hitPassageWindow(text, offset).content).toBe(sql)
    expect(buildSentenceSnippet(hitPassageWindow(text, offset).content, 'hit')).toEqual(
      buildSentenceSnippet(sql, 'hit'),
    )
  })

  it('clamps at the start of the body', () => {
    expect(hitPassageWindow(body, 10).content).toBe(body.slice(0, 500))
  })

  it('reports the 1-based column of the hit on its line', () => {
    const NL = String.fromCharCode(10)
    const text = ['first', '  calls HIT here'].join(NL)
    expect(hitPassageWindow(text, text.indexOf('HIT'))).toMatchObject({ lineNum: 2, column: 9 })
    expect(hitPassageWindow(['HIT', 'x'].join(NL), 0)).toMatchObject({ lineNum: 1, column: 1 })
    expect(hitPassageWindow('no lines HIT', 9).column).toBeNull()
  })

  it('reports a 1-based line only when the body has lines', () => {
    expect(hitPassageWindow(['one', 'two', 'three HIT'].join(String.fromCharCode(10)), 14).lineNum).toBe(3)
    expect(hitPassageWindow('no lines HIT', 9).lineNum).toBeNull()
  })
})
