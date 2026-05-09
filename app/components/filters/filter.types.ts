import type { ItemCategory, ItemStatus, ItemType } from '@/prisma/enums'
import type { JSX, ReactNode, SVGProps } from 'react'

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

export type GroupItem = {
  key: FilterSourceKey
  label: string
  items: GlyphItem[]
}

export type FolderEntry = {
  name: string
  size: string
  items: string
}

export type FileEntry = {
  name: string
  size: string
}

export type ChipInfo = {
  key: string
  group: FilterToggleKey
  val: string
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

export type PopoverProps = {
  trigger: ReactNode
  children: ReactNode
  align?: 'start' | 'end'
  open: boolean
  onOpenChange: (open: boolean) => void
  width?: number
}

export type CheckListProps = {
  items: GlyphItem[]
  selected: string[]
  onToggle: (id: string) => void
  onClear: () => void
  onApply: () => void
  onAddCustom?: () => void
  customLabel?: string
  searchable?: boolean
}

export type CommandAction = {
  id: string
  label: string
  kind: 'action'
  glyph: string
  run?: () => void
}

export type CommandFilterRow = {
  id: string
  label: string
  kind: 'filter'
  glyph: string
  group: FilterToggleKey
  on: boolean
}

export type CommandRow = CommandAction | CommandFilterRow

export type CommandSection = {
  section: string
  rows: CommandRow[]
}
