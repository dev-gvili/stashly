import {
  readSort,
  sortFieldsFor,
  writeSort,
  type SortDir,
  type SortField,
} from '@/utils/sort-fields'
import { useParams, useSearchParams } from 'react-router'

/**
 * The page's sort as `SortPill` writes it: the `orderBy[...]` URL params,
 * history replace, paging reset. (`useSort` is the older `orderBy`/`direction`
 * primitive and writes a different shape.)
 */
export function useSortOrder() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { collectionId } = useParams()
  const fields = sortFieldsFor(collectionId)
  const { field, dir, isDefault } = readSort(searchParams, fields)

  const set = (next: { field?: SortField; dir?: SortDir }) =>
    setSearchParams((p) => writeSort(p, next.field ?? field, next.dir ?? dir), {
      replace: true,
    })

  const toggleDir = () => set({ dir: dir === 'asc' ? 'desc' : 'asc' })

  /** Picking the current field again flips its direction; another field starts ascending. */
  const pick = (f: SortField) =>
    f.key === field.key ? toggleDir() : set({ field: f, dir: 'asc' })

  const reset = () =>
    setSearchParams(
      (p) => {
        const out = new URLSearchParams(p)
        for (const k of Array.from(out.keys())) {
          if (k.startsWith('orderBy[')) out.delete(k)
        }
        return out
      },
      { replace: true }
    )

  return { fields, field, dir, isDefault, hint: field.hint(dir), set, toggleDir, pick, reset }
}
