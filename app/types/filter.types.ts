/**
 * Filter domain types.
 *
 * Moved out of `app/components/filters/filter.types.ts` so `app/hooks/useFilters.ts`
 * and `app/hooks/useItemSearch.ts` stop reaching into the component tree for the
 * shape of their own return values.
 *
 * `app/schemas/filters.schemas.ts` is unrelated — it only carries the `date`
 * schema, so nothing here is derivable from Zod.
 */
import type { ItemCategory, ItemStatus, ItemType } from '@/prisma/enums'
import type { JSX, SVGProps } from 'react'

export type FilterSourceKey = 'category' | 'status' | 'type'
export type FlagKey = 'locked' | 'favorited'
export type FilterToggleKey = FilterSourceKey | 'flags'

export type GlyphItem = {
  id: ItemCategory | ItemStatus | ItemType
  label: string
  glyph: string
  icon?: (props: SVGProps<SVGSVGElement>) => JSX.Element
}

export type FlagItem = {
  id: FlagKey
  label: string
}

export type SearchMode = 'fuzzy' | 'semantic'

export type FilterState = {
  category: string[]
  status: string[]
  type: string[]
  flags: FlagKey[]
  query: string
  searchMode: SearchMode
}

export type ActiveChip = {
  key: string
  group: FilterSourceKey
  value: string
  icon?: (props: SVGProps<SVGSVGElement>) => JSX.Element
  label: string
}

export type UseFilters = {
  state: FilterState
  toggleMulti: (key: FilterToggleKey, val: string) => void
  setMulti: (key: FilterToggleKey, vals: string[]) => void
  applyDraft: (draft: Pick<FilterState, FilterSourceKey>) => void
  clear: (key: FilterToggleKey) => void
  clearAll: () => void
  setQuery: (query: string) => void
  setSearchMode: (mode: SearchMode) => void
  /** Active filter chips derived from state for `<Filters.Chips />`. */
  chips: ActiveChip[]
  total: number
  searchParams: URLSearchParams
}
