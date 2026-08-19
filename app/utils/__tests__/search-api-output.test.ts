import { describe, it, expect } from 'vitest'
import { searchApiRouteOutput } from '@/schemas/api.schemas'

const payload = {
  items: [
    {
      id: 'itm_1',
      name: 'Report.pdf',
      size: 1234n,
      inclusiveSize: 1234n,
      createdAt: new Date('2026-01-01'),
      tags: ['finance'],
      thumbnails: [{ id: 't1', url: '#abc', width: null }],
      passage: { chunkId: 'schk_1', content: 'hello', similarity: 0.82, pageNum: 3 },
      score: 100,
      matchKind: 'content',
      hitCount: 4,
      parent: {
        id: 'fld_1',
        name: 'Docs',
        size: 9999n,
        inclusiveSize: 88888n,
        parent: { id: 'root', name: 'Root', size: 5n, inclusiveSize: 7n },
      },
    },
  ],
  total: 1,
  hasMore: false,
  semantic: true,
  keywordCount: 1,
  semanticCount: 1,
}

describe('searchApiRouteOutput', () => {
  it('coerces BigInt sizes at every nesting level', () => {
    const parsed = searchApiRouteOutput.parse(payload)
    const item = parsed.items[0] as any
    expect(item.size).toBe(1234)
    expect(item.parent.size).toBe(9999)
    expect(item.parent.inclusiveSize).toBe(88888)
    expect(item.parent.parent.size).toBe(5)
  })

  it('survives JSON.stringify — the actual production failure', () => {
    expect(() => JSON.stringify(payload)).toThrow(/BigInt/)
    expect(() => JSON.stringify(searchApiRouteOutput.parse(payload))).not.toThrow()
  })

  it('passes non-declared fields through untouched', () => {
    const item = searchApiRouteOutput.parse(payload).items[0] as any
    expect(item.name).toBe('Report.pdf')
    expect(item.passage.similarity).toBe(0.82)
    expect(item.thumbnails[0].url).toBe('#abc')
    expect(item.parent.name).toBe('Docs')
  })

  it('accepts a null parent', () => {
    const orphan = { ...payload, items: [{ ...payload.items[0], parent: null }] }
    expect(() => searchApiRouteOutput.parse(orphan)).not.toThrow()
  })

  it('carries the grouping fields through', () => {
    const item = searchApiRouteOutput.parse(payload).items[0] as any
    expect(item.matchKind).toBe('content')
    expect(item.hitCount).toBe(4)
    expect(item.score).toBe(100)
  })

  // Without this the results page would silently drop every result into the
  // `semantic` group — a wrong page, not a crash, which is far harder to spot.
  it('rejects a payload that lost matchKind', () => {
    const { matchKind, ...rest } = payload.items[0]
    expect(() =>
      searchApiRouteOutput.parse({ ...payload, items: [rest] })
    ).toThrow()
  })

  // `fuzzy` is a real group — the trigram half's typo matches, which carry no
  // literal evidence and no vector either. It used to be an invalid value here.
  it('accepts every group the page renders', () => {
    for (const kind of ['name', 'content', 'fuzzy', 'semantic']) {
      const item = { ...payload.items[0], matchKind: kind }
      expect(() =>
        searchApiRouteOutput.parse({ ...payload, items: [item] })
      ).not.toThrow()
    }
  })

  it('rejects a matchKind outside the four groups', () => {
    const bad = { ...payload.items[0], matchKind: 'vibes' }
    expect(() =>
      searchApiRouteOutput.parse({ ...payload, items: [bad] })
    ).toThrow()
  })
})
