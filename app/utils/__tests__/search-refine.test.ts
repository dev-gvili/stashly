import { describe, expect, it } from 'vitest'
import { readState } from '@/hooks/useFilters'
import { readSort } from '@/utils/sort-fields'
import {
  describeCategories,
  describeFlags,
  describeRefinement,
  kindOf,
  refinementParts,
} from '@/utils/search-refine'

const describe_ = (qs: string) => {
  const p = new URLSearchParams(qs)
  return describeRefinement(readState(p), readSort(p))
}

describe('kindOf', () => {
  it('is "all" for none or several types', () => {
    expect(kindOf({ type: [] })).toBe('all')
    expect(kindOf({ type: ['file', 'folder'] })).toBe('all')
  })
  it('is the one selected type', () => {
    expect(kindOf({ type: ['folder'] })).toBe('folder')
  })
})

describe('describeCategories', () => {
  it('reads Any, a pair, or the first plus a count', () => {
    expect(describeCategories([])).toBe('Any')
    expect(describeCategories(['image', 'pdf'])).toBe('Image, Pdf')
    expect(describeCategories(['image', 'pdf', 'video'])).toBe('Image +2')
  })
})

describe('describeFlags', () => {
  it('names the flags or says Everything', () => {
    expect(describeFlags([])).toBe('Everything')
    expect(describeFlags(['locked', 'favorited'])).toBe('Favorites, Locked')
  })
})

describe('describeRefinement', () => {
  it('is empty when nothing is refined', () => {
    expect(describe_('')).toBe('')
  })
  it('reads every refinement in order, leaving out the default sort', () => {
    expect(
      describe_('query=report&searchMode=semantic&type=file&category=image,pdf&favorited=true')
    ).toBe('“report” by meaning · Files · Image, Pdf · Favorites')
  })
  it('mentions a non-default sort', () => {
    expect(describe_('orderBy[size]=desc')).toBe('Size, Largest first')
  })
  it('lists several types when the URL has more than one', () => {
    expect(describe_('type=file,folder')).toBe('File, Folder')
  })
})

describe('refinementParts', () => {
  it('gives one part per refinement, for one chip each', () => {
    const p = new URLSearchParams('query=tax&category=pdf&locked=true&orderBy[size]=desc')
    expect(refinementParts(readState(p), readSort(p))).toEqual([
      '“tax”',
      'Pdf',
      'Locked',
      'Size, Largest first',
    ])
  })
  it('is empty when nothing is refined', () => {
    const p = new URLSearchParams('')
    expect(refinementParts(readState(p), readSort(p))).toEqual([])
  })
})
