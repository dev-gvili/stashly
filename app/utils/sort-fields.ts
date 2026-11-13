import { CURSOR_KEY } from '@/utils/filter-data'

export type SortDir = 'asc' | 'desc'

export type SortField = {
  key: 'name' | 'updated' | 'created' | 'size' | 'type' | 'count'
  /** The `orderBy[...]` column(s) written to the URL. Count sorts folders and collections by different relations, so it writes two indexed keys. */
  column: string | string[]
  label: string
  hint: (dir: SortDir) => string
}

export const SORT_FIELDS: SortField[] = [
  { key: 'name', column: 'name', label: 'Name', hint: (d) => (d === 'asc' ? 'A → Z' : 'Z → A') },
  { key: 'updated', column: 'updatedAt', label: 'Updated', hint: (d) => (d === 'asc' ? 'Old → New' : 'New → Old') },
  { key: 'created', column: 'createdAt', label: 'Created', hint: (d) => (d === 'asc' ? 'Old → New' : 'New → Old') },
  { key: 'size', column: 'size', label: 'Size', hint: (d) => (d === 'asc' ? 'Smallest first' : 'Largest first') },
  { key: 'type', column: 'type', label: 'Type', hint: (d) => (d === 'asc' ? 'A → Z' : 'Z → A') },
  {
    key: 'count',
    column: ['folder][childCount', 'members][_count'],
    label: 'Count',
    hint: (d) => (d === 'asc' ? 'Fewest first' : 'Most first'),
  },
]

/** Inside a collection there is nothing to count: it holds files only. */
export const COLLECTION_SORT_FIELDS = SORT_FIELDS.filter((f) => f.key !== 'count')

export const sortFieldsFor = (collectionId?: string) =>
  collectionId ? COLLECTION_SORT_FIELDS : SORT_FIELDS

const ORDER_BY_KEY = /^orderBy\[(?:\d+\]\[)?(.+)\]$/

/** The sort in the URL, or the first field ascending when there is none (nothing is written for the default). */
export function readSort(
  params: URLSearchParams,
  fields: SortField[] = SORT_FIELDS
): { field: SortField; dir: SortDir; isDefault: boolean } {
  for (const [k, v] of params.entries()) {
    const m = k.match(ORDER_BY_KEY)
    if (m && (v === 'asc' || v === 'desc')) {
      const col = m[1]
      const found = fields.find((f) =>
        Array.isArray(f.column) ? f.column.includes(col) : f.column === col
      )
      if (found) return { field: found, dir: v, isDefault: false }
    }
  }
  return { field: fields[0], dir: 'asc', isDefault: true }
}

/** A copy of `params` sorted by `field`/`dir`: earlier `orderBy[...]` keys and the paging cursor are dropped. */
export function writeSort(
  params: URLSearchParams,
  field: SortField,
  dir: SortDir
): URLSearchParams {
  const out = new URLSearchParams(params)
  for (const k of Array.from(out.keys())) {
    if (k.startsWith('orderBy[')) out.delete(k)
  }
  const cols = Array.isArray(field.column) ? field.column : [field.column]
  if (cols.length > 1) {
    cols.forEach((col, i) => out.set(`orderBy[${i}][${col}]`, dir))
  } else {
    out.set(`orderBy[${cols[0]}]`, dir)
  }
  out.delete(CURSOR_KEY)
  return out
}
