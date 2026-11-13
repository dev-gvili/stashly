import { describe, expect, it } from 'vitest'
import { readState } from '@/hooks/useFilters'
import { readSort } from '@/utils/sort-fields'
import {
  describeCategories,
  describeFlags,
  describeRefinement,
  kindOf,
  refinementParts,
  scopeFromRouteParams,
  searchPageUrl,
} from '@/utils/search-refine'

describe('scopeFromRouteParams', () => {
  it('scopes a folder or collection page and nothing else', () => {
    expect(scopeFromRouteParams({ folderId: 'fol_1' })).toEqual({ kind: 'folder', id: 'fol_1' })
    expect(scopeFromRouteParams({ collectionId: 'col_1' })).toEqual({ kind: 'collection', id: 'col_1' })
    expect(scopeFromRouteParams({})).toBeNull()
  })
})

describe('searchPageUrl', () => {
  const base = { query: 'tax', searchMode: 'fuzzy', category: [], type: [] } as const
  it('sends a global query to the search page with a layout', () => {
    expect(searchPageUrl('usr_1', { ...base, category: [], type: [] }, null)).toBe(
      '/usr_1/stash/search?query=tax&layout=grid'
    )
  })
  it('carries meaning mode, types, kind and the scope', () => {
    const url = new URL(
      searchPageUrl(
        'usr_1',
        { query: 'tax 2024', searchMode: 'semantic', category: ['pdf', 'image'], type: ['file'] },
        { kind: 'folder', id: 'fol_1' }
      ),
      'http://x'
    )
    expect(url.pathname).toBe('/usr_1/stash/search')
    expect(Object.fromEntries(url.searchParams)).toEqual({
      query: 'tax 2024',
      searchMode: 'semantic',
      category: 'pdf,image',
      type: 'file',
      layout: 'grid',
      in: 'folder:fol_1',
    })
  })
})

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
  it('reads Any, or names up to five', () => {
    expect(describeCategories([])).toBe('Any')
    expect(describeCategories(['image', 'pdf', 'video'])).toBe('Image, Pdf, Video')
    expect(describeCategories(['audio', 'code', 'document', 'image', 'pdf'])).toBe(
      'Audio, Code, Document, Image, Pdf'
    )
  })
  it('folds the sixth type on into a count', () => {
    expect(describeCategories(['audio', 'code', 'document', 'image', 'pdf', 'video', 'archive'])).toBe(
      'Audio, Code, Document, Image, Pdf +2'
    )
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
