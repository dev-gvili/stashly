import { useState } from 'react'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/ui/input-group'
import { ToggleGroup, ToggleGroupItem } from '@/ui/toggle-group'
import {
  FuzzySearchIcon,
  RemoveIcon,
  SearchIcon,
  SearchFillIcon, 
  ShareIcon,
} from '@/components/icons'
import { cn } from '@/utils/styles'
import type { SearchMode } from '@/components/filters/filter.types'

export interface SearchInputProps {
  value: string
  onValueChange: (value: string) => void
  /** Optional controlled search mode. Omit for uncontrolled local state. */
  mode?: SearchMode
  onModeChange?: (mode: SearchMode) => void
  placeholder?: string
  className?: string
  /** Hide the fuzzy/semantic mode toggle (default: shown). */
  hideModeToggle?: boolean
  /** Auto-focus the input on mount. */
  autoFocus?: boolean
}

/**
 * Standalone search input with optional fuzzy/semantic mode toggle.
 * Pairs the project's `InputGroup` styling with a right-aligned toggle group.
 *
 * @example
 * // Wired to useFilters
 * const { state, setQuery, setSearchMode } = useFilters()
 * <SearchInput
 *   value={state.query}
 *   onValueChange={setQuery}
 *   mode={state.searchMode}
 *   onModeChange={setSearchMode}
 * />
 *
 * @example
 * // Local-state, no mode toggle
 * const [q, setQ] = useState('')
 * <SearchInput value={q} onValueChange={setQ} hideModeToggle />
 */
export function SearchInput({
  value,
  onValueChange,
  mode: modeProp,
  onModeChange,
  placeholder = 'Search…',
  className,
  hideModeToggle = false,
  autoFocus,
}: SearchInputProps) {
  const [localMode, setLocalMode] = useState<SearchMode>('fuzzy')
  const mode = modeProp ?? localMode
  const setMode = (m: SearchMode) => {
    if (onModeChange) onModeChange(m)
    else setLocalMode(m)
  }

  return (
    <InputGroup className={cn('bg-card!', className)}>
      <InputGroupAddon align="inline-start">
        <SearchFillIcon className="size-4 text-current" />
      </InputGroupAddon>
      <InputGroupInput
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="placeholder:text-foreground focus:ring-accent focus-within:ring-accent"
      />
      {value && (
        <InputGroupAddon align="inline-end">
          <button
            type="button"
            onClick={() => onValueChange('')}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Clear search"
          >
            <RemoveIcon className="size-4" />
          </button>
        </InputGroupAddon>
      )}
      {!hideModeToggle && (
        <InputGroupAddon align="inline-end">
          <ToggleGroup
            type="single"
            value={mode}
            onValueChange={(v) => v && setMode(v as SearchMode)}
            className="font-stashly gap-1"
          >
            <ToggleGroupItem
              value="fuzzy"
              aria-label="Fuzzy search"
              className="data-[state=on]:bg-muted data-[state=on]:text-accent-foreground h-6 p-1.5 ml-auto rounded!"
              size="sm"
              variant="default"
            >
              <FuzzySearchIcon className="size-5 text-current" />
            </ToggleGroupItem>
            <ToggleGroupItem
              value="semantic"
              aria-label="Semantic search"
              className="data-[state=on]:bg-muted data-[state=on]:text-accent-foreground h-6 p-1.5 ml-auto rounded!"
              size="sm"
              variant="default"
            >
              <ShareIcon className="size-5 text-current!" />
            </ToggleGroupItem>
          </ToggleGroup>
        </InputGroupAddon>
      )}
    </InputGroup>
  )
}
