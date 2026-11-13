import { CATEGORIES, TYPES } from '@/utils/filter-data'
import type { FilterState } from '@/types/filter.types'
import type { SortDir, SortField } from '@/utils/sort-fields'
import { formatSearchScope, SEARCH_SCOPE_KEY, type SearchScope } from '@/utils/search-query'

/**
 * Where a search typed on this page looks: the folder or collection the page
 * shows, or `null` (the whole stash) everywhere else.
 */
export function scopeFromRouteParams(params: {
  folderId?: string
  collectionId?: string
}): SearchScope | null {
  if (params.folderId) return { kind: 'folder', id: params.folderId }
  if (params.collectionId) return { kind: 'collection', id: params.collectionId }
  return null
}

/**
 * The search page URL for a query typed somewhere else, carrying what the user
 * already chose (meaning mode, file types, kind) and the scope.
 *
 * @example
 * searchPageUrl('usr_1', { query: 'tax', searchMode: 'semantic', category: ['pdf'], type: [] },
 *   { kind: 'folder', id: 'fol_1' })
 * // '/usr_1/stash/search?query=tax&searchMode=semantic&category=pdf&layout=grid&in=folder%3Afol_1'
 */
export function searchPageUrl(
  me: string,
  state: Pick<FilterState, 'query' | 'searchMode' | 'category' | 'type'>,
  scope: SearchScope | null
): string {
  const params = new URLSearchParams()
  params.set('query', state.query)
  if (state.searchMode === 'semantic') params.set('searchMode', 'semantic')
  if (state.category.length) params.set('category', state.category.join(','))
  if (state.type.length) params.set('type', state.type.join(','))
  // The search page renders nothing without a layout; seed the default here
  // rather than paying for its own redirect.
  params.set('layout', 'grid')
  if (scope) params.set(SEARCH_SCOPE_KEY, formatSearchScope(scope))
  return `/${me}/stash/search?${params.toString()}`
}

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

/** How many chosen types are named before the rest fold into "+N" (owner's call: 5). */
export const CATEGORY_PREVIEW_LIMIT = 5

/** The chosen types to show by name, and how many fold into "+N". */
export function previewCategories(ids: string[]): { shown: string[]; more: number } {
  return {
    shown: ids.slice(0, CATEGORY_PREVIEW_LIMIT),
    more: Math.max(ids.length - CATEGORY_PREVIEW_LIMIT, 0),
  }
}

/** "Any", "Image, Pdf", or the first five and "+N" past that. */
export function describeCategories(ids: string[]): string {
  if (ids.length === 0) return 'Any'
  const { shown, more } = previewCategories(ids)
  const names = shown.map((id) => label(CATEGORIES, id)).join(', ')
  return more ? `${names} +${more}` : names
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
  return refinementParts(state, sort).join(' · ')
}

/** The same readout as separate parts, one chip each in the header field. */
export function refinementParts(
  state: FilterState,
  sort: { field: SortField; dir: SortDir; isDefault: boolean }
): string[] {
  const parts: string[] = []
  if (state.query)
    parts.push(`“${state.query}”${state.searchMode === 'semantic' ? ' by meaning' : ''}`)
  const kind = kindOf(state)
  if (kind !== 'all') parts.push(KINDS.find((k) => k.value === kind)!.label)
  else if (state.type.length > 1) parts.push(state.type.map((t) => label(TYPES, t)).join(', '))
  if (state.category.length) parts.push(describeCategories(state.category))
  if (state.flags.length) parts.push(describeFlags(state.flags))
  if (!sort.isDefault) parts.push(describeSort(sort.field, sort.dir))
  return parts
}
