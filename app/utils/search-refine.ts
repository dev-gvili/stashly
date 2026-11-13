import { CATEGORIES, TYPES } from '@/utils/filter-data'
import type { FilterState } from '@/types/filter.types'
import type { SortDir, SortField } from '@/utils/sort-fields'

/** The six file types most people reach for; the rest sit behind "more types". */
export const COMMON_CATEGORY_IDS = ['image', 'pdf', 'document', 'video', 'audio', 'code']

export const KINDS = [
  { value: 'all', label: 'All' },
  { value: 'file', label: 'Files' },
  { value: 'folder', label: 'Folders' },
  { value: 'collection', label: 'Collections' },
] as const

export type KindValue = (typeof KINDS)[number]['value']

const label = (list: typeof CATEGORIES, id: string) =>
  list.find((x) => x.id === id)?.label ?? id

/** The single kind the segmented control shows: "all" unless exactly one type is selected. */
export function kindOf(state: Pick<FilterState, 'type'>): KindValue {
  if (state.type.length !== 1) return 'all'
  const t = state.type[0]
  return KINDS.some((k) => k.value === t) ? (t as KindValue) : 'all'
}

/** "Any", "Image, Pdf", or "Image +2" for three or more. */
export function describeCategories(ids: string[]): string {
  if (ids.length === 0) return 'Any'
  const names = ids.map((id) => label(CATEGORIES, id))
  return names.length <= 2 ? names.join(', ') : `${names[0]} +${names.length - 1}`
}

/** "Everything", "Favorites", "Favorites, Locked". */
export function describeFlags(flags: string[]): string {
  const out: string[] = []
  if (flags.includes('favorited')) out.push('Favorites')
  if (flags.includes('locked')) out.push('Locked')
  return out.length ? out.join(', ') : 'Everything'
}

export function describeSort(field: SortField, dir: SortDir): string {
  return `${field.label}, ${field.hint(dir)}`
}

/**
 * The words the header field reads back when the dialog is closed, e.g.
 * `"report" by meaning · Files · Image, Pdf · Favorites · Size, Largest first`.
 * Empty when nothing is refined (the default sort is not mentioned).
 */
export function describeRefinement(
  state: FilterState,
  sort: { field: SortField; dir: SortDir; isDefault: boolean }
): string {
  const parts: string[] = []
  if (state.query)
    parts.push(`“${state.query}”${state.searchMode === 'semantic' ? ' by meaning' : ''}`)
  const kind = kindOf(state)
  if (kind !== 'all') parts.push(KINDS.find((k) => k.value === kind)!.label)
  else if (state.type.length > 1) parts.push(state.type.map((t) => label(TYPES, t)).join(', '))
  if (state.category.length) parts.push(describeCategories(state.category))
  if (state.flags.length) parts.push(describeFlags(state.flags))
  if (!sort.isDefault) parts.push(describeSort(sort.field, sort.dir))
  return parts.join(' · ')
}
