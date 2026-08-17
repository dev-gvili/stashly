/**
 * Query expansion — the snippet's dotted "matched by meaning" tier.
 *
 * The risk this guards is a false expansion: marking a word claims the engine
 * matched on it, so a wrong mark is a lie about why a result is in the list.
 */
import { describe, it, expect } from 'vitest'
import {
  EXPANSION_MAX_TERMS,
  collectCandidateTerms,
  cosineSimilarity,
  pickExpandedTerms,
  queryWords,
} from '../search-expansion'

describe('queryWords', () => {
  it('lowercases and strips surrounding punctuation', () => {
    expect(queryWords('"Data", (Model)!')).toEqual(['data', 'model'])
  })

  it('keeps short words, which the marking tokenizer drops', () => {
    // Dropping "ai" here would let it return as its own expansion.
    expect(queryWords('ai models')).toEqual(['ai', 'models'])
  })
})

describe('collectCandidateTerms', () => {
  it('proposes distinctive words from the passages', () => {
    const terms = collectCandidateTerms(
      ['The Stashly data model spans 56 Prisma models.'],
      ['data', 'model']
    )
    expect(terms).toContain('prisma')
    expect(terms).toContain('stashly')
  })

  it('excludes the words the user typed', () => {
    const terms = collectCandidateTerms(['refund policy text'], ['refund'])
    expect(terms).not.toContain('refund')
  })

  // Otherwise one word wears both tiers: `highlightSegments` marks the "model"
  // inside "models" as a literal hit while the expansion tier dots the whole.
  it('excludes words that merely contain a query term', () => {
    const terms = collectCandidateTerms(['many models here'], ['model'])
    expect(terms).not.toContain('models')
  })

  it('excludes words contained by a query term', () => {
    const terms = collectCandidateTerms(['data flows'], ['database'])
    expect(terms).not.toContain('data')
  })

  it('drops common words, bare numbers and short tokens', () => {
    const terms = collectCandidateTerms(
      ['This document should have 56 the of an ok'],
      []
    )
    expect(terms).not.toContain('should')
    expect(terms).not.toContain('this')
    expect(terms).not.toContain('56')
    expect(terms).not.toContain('ok')
    expect(terms).toContain('document')
  })

  it('ranks by how many passages contain a word, not raw frequency', () => {
    // "repeated" dominates one passage; "shared" appears across three.
    const terms = collectCandidateTerms(
      [
        'repeated repeated repeated repeated shared',
        'shared elsewhere',
        'shared again',
      ],
      []
    )
    expect(terms.indexOf('shared')).toBeLessThan(terms.indexOf('repeated'))
  })

  it('honours the candidate cap', () => {
    const passage = Array.from({ length: 60 }, (_, i) => `word${i}aaa`).join(' ')
    expect(collectCandidateTerms([passage], [], 5)).toHaveLength(5)
  })

  it('returns nothing for empty passages', () => {
    expect(collectCandidateTerms([], ['x'])).toEqual([])
    expect(collectCandidateTerms([''], ['x'])).toEqual([])
  })
})

describe('cosineSimilarity', () => {
  it('is the dot product for normalized vectors', () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBe(1)
    expect(cosineSimilarity([1, 0], [0, 1])).toBe(0)
  })

  it('returns 0 for mismatched or empty vectors rather than throwing', () => {
    expect(cosineSimilarity([1, 0], [1])).toBe(0)
    expect(cosineSimilarity([], [])).toBe(0)
  })
})

describe('pickExpandedTerms', () => {
  const query = [1, 0]
  const near = [0.9, 0.436] // ~0.9 similarity
  const far = [0.1, 0.995] // ~0.1 similarity

  it('keeps only candidates the query vector actually matched', () => {
    expect(pickExpandedTerms(['prisma', 'lunch'], [near, far], query)).toEqual([
      'prisma',
    ])
  })

  it('orders by similarity, strongest first', () => {
    const mid = [0.6, 0.8]
    const picked = pickExpandedTerms(
      ['weak', 'strong', 'middle'],
      [far, near, mid],
      query
    )
    expect(picked).toEqual(['strong', 'middle'])
  })

  it('caps how many marks a snippet can carry', () => {
    const many = Array.from({ length: 20 }, (_, i) => `term${i}`)
    const vectors = many.map(() => near)
    expect(pickExpandedTerms(many, vectors, query)).toHaveLength(
      EXPANSION_MAX_TERMS
    )
  })

  it('respects an explicit threshold', () => {
    expect(
      pickExpandedTerms(['prisma'], [near], query, { minSimilarity: 0.95 })
    ).toEqual([])
  })

  // Misalignment would pair a word with someone else's embedding and mark
  // arbitrary text as "matched by meaning".
  it('refuses to guess when the lists are misaligned', () => {
    expect(pickExpandedTerms(['a', 'b'], [near], query)).toEqual([])
  })

  it('returns nothing without a query vector', () => {
    expect(pickExpandedTerms(['a'], [near], [])).toEqual([])
  })
})
