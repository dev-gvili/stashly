import type { ReactNode } from 'react'
import type {
  FilterSourceKey,
  FilterToggleKey,
  GlyphItem,
} from '@/types/filter.types'

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
