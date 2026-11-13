import { describe, expect, it } from 'vitest'
import {
  COLLECTION_SORT_FIELDS,
  readSort,
  SORT_FIELDS,
  writeSort,
} from '@/utils/sort-fields'

const field = (key: string) => SORT_FIELDS.find((f) => f.key === key)!

describe('readSort', () => {
  it('defaults to name ascending when the URL has no orderBy', () => {
    const s = readSort(new URLSearchParams('query=x'))
    expect(s.field.key).toBe('name')
    expect(s.dir).toBe('asc')
    expect(s.isDefault).toBe(true)
  })

  it('reads a single-column sort', () => {
    const s = readSort(new URLSearchParams('orderBy[size]=desc'))
    expect(s.field.key).toBe('size')
    expect(s.dir).toBe('desc')
    expect(s.isDefault).toBe(false)
  })

  it('reads the indexed count keys', () => {
    const s = readSort(new URLSearchParams('orderBy[0][folder][childCount]=asc&orderBy[1][members][_count]=asc'))
    expect(s.field.key).toBe('count')
  })

  it('ignores a column the field list does not offer', () => {
    const s = readSort(
      new URLSearchParams('orderBy[0][folder][childCount]=desc'),
      COLLECTION_SORT_FIELDS
    )
    expect(s.isDefault).toBe(true)
  })
})

describe('writeSort', () => {
  it('replaces earlier orderBy keys and drops the cursor', () => {
    const out = writeSort(new URLSearchParams('orderBy[name]=asc&cursor=abc&query=x'), field('updated'), 'desc')
    expect(out.toString()).toBe('query=x&orderBy%5BupdatedAt%5D=desc')
  })

  it('writes both indexed keys for count', () => {
    const out = writeSort(new URLSearchParams(), field('count'), 'asc')
    expect(out.get('orderBy[0][folder][childCount]')).toBe('asc')
    expect(out.get('orderBy[1][members][_count]')).toBe('asc')
  })

  it('round-trips through readSort', () => {
    const out = writeSort(new URLSearchParams(), field('size'), 'desc')
    const s = readSort(out)
    expect([s.field.key, s.dir]).toEqual(['size', 'desc'])
  })
})
