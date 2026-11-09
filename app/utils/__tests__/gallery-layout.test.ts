import { describe, it, expect } from 'vitest'
import {
  buildJustifiedRows,
  groupByDate,
  aspectOf,
  parseGalleryPrefs,
  serializeGalleryPrefs,
  DEFAULT_GALLERY_PREFS,
  tileAspectFromId,
  aspectClassFromId,
} from '../gallery-layout'

const items = (aspects: number[]) => aspects.map((aspect, i) => ({ id: `i${i}`, aspect }))

describe('buildJustifiedRows', () => {
  it('breaks rows where the next image would overflow at the target height', () => {
    const rows = buildJustifiedRows(items([1, 1, 1, 1, 1]), 1000, {
      gap: 16,
      rowHeight: 300,
      maxPerRow: Infinity,
      aspectOf: (i) => i.aspect,
    })
    // 4 × 300 + 3 × 16 = 1248 ≥ 1000 → the 4th image closes the first row.
    expect(rows.map((r) => r.items.length)).toEqual([4, 1])
    expect(rows[0].justified).toBe(true)
    expect(rows[1].justified).toBe(false)
  })

  it('keeps its defaults for the existing river view (7 per row cap)', () => {
    const imgs = Array.from({ length: 10 }, (_, i) => ({ id: `x${i}` }))
    const rows = buildJustifiedRows(imgs as never, 100_000)
    expect(rows[0].items).toHaveLength(7)
    expect(rows[0].justified).toBe(true)
  })

  it('does not stretch the trailing row past the target height', () => {
    const rows = buildJustifiedRows(items([1]), 1000, {
      gap: 10,
      rowHeight: 200,
      aspectOf: (i) => i.aspect,
    })
    expect(rows).toHaveLength(1)
    expect(rows[0].justified).toBe(false)
    expect(rows[0].height).toBe(200)
  })
})

describe('aspectOf', () => {
  it('falls back to 1 without dimensions', () => {
    expect(aspectOf(null, 100)).toBe(1)
    expect(aspectOf(200, 100)).toBe(2)
  })
})

describe('groupByDate', () => {
  const now = new Date(Date.UTC(2026, 10, 3, 12)) // Tue Nov 3 2026, UTC
  const at = (y: number, m: number, d: number, id: string, hour = 9) => ({
    id,
    createdAt: new Date(Date.UTC(y, m, d, hour)).toISOString(),
  })

  it('splits days at UTC midnight, whatever zone the process runs in', () => {
    const groups = groupByDate(
      [at(2026, 10, 3, 'first-hour', 0), at(2026, 10, 2, 'last-hour', 23)],
      true,
      now
    )
    expect(groups.map((g) => [g.label, g.items.map((i) => i.id)])).toEqual([
      ['Today', ['first-hour']],
      ['Last week', ['last-hour']],
    ])
  })

  it('labels in English by default, not in the runtime locale', () => {
    const groups = groupByDate([at(2026, 9, 1, 'oct', 0)], true, now)
    expect(groups[0].label).toBe('October')
    expect(groups[0].sub).toBe('2026')
  })

  it('groups into Today, Last week and calendar months, dropping empty ones', () => {
    const groups = groupByDate(
      [
        at(2026, 9, 2, 'oct'),
        at(2026, 10, 3, 'today'),
        at(2026, 9, 28, 'week'),
        at(2026, 10, 2, 'yesterday'),
        at(2025, 9, 2, 'oct-last-year'),
      ],
      true,
      now,
      'en-US'
    )
    expect(groups.map((g) => g.label)).toEqual(['Today', 'Last week', 'October', 'October'])
    expect(groups[0].sub).toBe('Tue, Nov 3')
    expect(groups[1].sub).toBe('Oct 27 – Nov 2')
    expect(groups[1].items.map((i) => i.id)).toEqual(['yesterday', 'week'])
    expect(groups[2].sub).toBe('2026')
    expect(groups[3].sub).toBe('2025')
  })

  it('puts an item exactly 8 days old into its month, not last week', () => {
    const groups = groupByDate([at(2026, 9, 26, 'old')], true, now, 'en-US')
    expect(groups[0].label).toBe('October')
  })

  it('returns one unlabelled group when grouping is off', () => {
    const groups = groupByDate([at(2026, 10, 3, 'a')], false, now)
    expect(groups).toEqual([{ key: 'all', label: null, sub: null, items: [expect.anything()] }])
    expect(groupByDate([], false, now)).toEqual([])
  })
})

describe('gallery prefs cookie', () => {
  it('round-trips through serialize / parse', () => {
    const prefs = { zoom: 4, gap: 8, byDate: false }
    const header = `other=1; ${serializeGalleryPrefs(prefs).split(';')[0]}`
    expect(parseGalleryPrefs(header)).toEqual(prefs)
  })

  it('falls back per field on bad values', () => {
    expect(parseGalleryPrefs('stashly-gallery=9.7.x')).toEqual(DEFAULT_GALLERY_PREFS)
    expect(parseGalleryPrefs(null)).toEqual(DEFAULT_GALLERY_PREFS)
  })
})

describe('tileAspectFromId', () => {
  const ids = ['item_IYY5tZgB1KHu9s-9kiMQCQ', 'item_qbB8t1ks9N9Rl--zIYz_ww', 'item_k48LCIXz2eq2FPQEnMyJgA', 'a', 'bb', 'ccc']
  const CLASS_TO_RATIO: Record<string, number> = {
    'aspect-[2/2.5]': 2 / 2.5,
    'aspect-square': 1,
    'aspect-[1/2.5]': 1 / 2.5,
    'aspect-[3/2.5]': 3 / 2.5,
  }

  it('gives Waterfall the same shape the old view picked for each id', () => {
    for (const id of ids) {
      expect(tileAspectFromId('waterfall', id)).toBeCloseTo(CLASS_TO_RATIO[aspectClassFromId(id)])
    }
  })

  it('gives River the same shape the old justified rows used for each id', () => {
    for (const id of ids) {
      // buildJustifiedRows' default aspect is the old river's id hash.
      const [row] = buildJustifiedRows([{ id }] as never, 100_000)
      expect(tileAspectFromId('river', id)).toBe(row.items[0].aspect)
    }
  })

  it('keeps Grid cells 4:3', () => {
    expect(tileAspectFromId('grid', 'anything')).toBeCloseTo(4 / 3)
  })
})
