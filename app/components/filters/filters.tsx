import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'
import { useLocation } from 'react-router'
import {
  DropdownIcon,
  FavoriteIcon,
  FilterIcon,
  LockFillIcon,
} from '@/components/icons'
import {
  Button,
  Checkbox,
  Badge,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Toggle,
} from '@/components/ui'
import { cn } from '@/utils/styles'
import type {
  FilterSourceKey,
  FilterState,
  GlyphItem,
  UseFilters,
} from './filter.types'
import { CATEGORIES, STATUSES, TYPES, FLAGS } from './filter.data'
import { useFilters } from '@/hooks/useFilters'
import { Chip, DashedDiv } from './filter-primitives'
import { SortPill } from './sort-pill'
import { SearchInput } from '@/components/core-components/search-input'

// ─── Context ─────────────────────────────────────────────────────────────

interface FiltersContextValue {
  filters: UseFilters
  draft: FilterState
  setDraft: React.Dispatch<React.SetStateAction<FilterState>>
  closePopover: () => void
  applyDraft: () => void
  resetDraft: () => void
  popoverKey: number
}

const FiltersContext = createContext<FiltersContextValue | null>(null)

function useFiltersContext() {
  const ctx = useContext(FiltersContext)
  if (!ctx) {
    throw new Error('Filters compound components must be used inside <Filters>')
  }
  return ctx
}

// ─── Root ────────────────────────────────────────────────────────────────

interface FiltersRootProps {
  filters: UseFilters
  children: ReactNode
  className?: string
}

function FiltersRoot({ filters, children, className }: FiltersRootProps) {
  const [popoverKey, setPopoverKey] = useState(0)
  const [draft, setDraft] = useState<FilterState>(filters.state)

  const closePopover = () => setPopoverKey((k) => k + 1)
  const resetDraft = () => setDraft(filters.state)
  const applyDraft = () => {
    filters.applyDraft(draft)
    closePopover()
  }

  return (
    <FiltersContext.Provider
      value={{
        filters,
        draft,
        setDraft,
        closePopover,
        applyDraft,
        resetDraft,
        popoverKey,
      }}
    >
      <div
        className={cn('flex items-center gap-2 w-full max-w-max', className)}
      >
        {children}
      </div>
    </FiltersContext.Provider>
  )
}

// ─── Search ──────────────────────────────────────────────────────────────

function FiltersSearch(
  props: Omit<
    React.ComponentProps<typeof SearchInput>,
    'value' | 'onValueChange' | 'mode' | 'onModeChange'
  >
) {
  const { filters } = useFiltersContext()
  return (
    <SearchInput
      value={filters.state.query}
      onValueChange={filters.setQuery}
      mode={filters.state.searchMode}
      onModeChange={filters.setSearchMode}
      {...props}
    />
  )
}

// ─── Active filter chips (rendered inline in trigger or anywhere) ────────

function FiltersChips({
  max = 2,
  className,
}: {
  max?: number
  className?: string
}) {
  const { filters } = useFiltersContext()
  if (filters.chips.length === 0) return null

  return (
    <div className={cn('flex items-center gap-1 overflow-hidden', className)}>
      {filters.chips.slice(0, max).map((c) => (
        <Chip key={c.key}>
          {c.icon && <c.icon className="size-4" />}
          <span className="ml-0.5">{c.label}</span>
        </Chip>
      ))}
      {filters.chips.length > max && (
        <Chip>+{filters.chips.length - max}</Chip>
      )}
    </div>
  )
}

// ─── Flag toggles (favorited / locked) ──────────────────────────────────

function FiltersFlagToggles({ className }: { className?: string }) {
  const { filters } = useFiltersContext()
  return (
    <span className={cn('flex items-center gap-0.5', className)}>
      {FLAGS.map((f) => {
        const on = filters.state.flags.includes(f.id)
        return (
          <Toggle
            key={f.id}
            onClick={(e) => e.stopPropagation()}
            className="data-[state=on]:bg-muted data-[state=on]:text-accent-foreground h-6 p-1.5 ml-auto rounded!"
            size="sm"
            variant="default"
            pressed={on}
            onPressedChange={() => filters.toggleMulti('flags', f.id)}
          >
            {f.id === 'locked' ? (
              <LockFillIcon className="size-4" />
            ) : (
              <FavoriteIcon className="size-4" />
            )}
          </Toggle>
        )
      })}
    </span>
  )
}

// ─── Popover (Trigger + Panel) ───────────────────────────────────────────

function FiltersPopover({ children }: { children: ReactNode }) {
  const { popoverKey, resetDraft } = useFiltersContext()
  return (
    <Popover
      key={popoverKey}
      onOpenChange={(open) => {
        if (open) resetDraft()
      }}
    >
      {children}
    </Popover>
  )
}

interface FiltersTriggerProps {
  children?: ReactNode
  className?: string
}

/** Default trigger renders the canonical "Filter" pill with chips + flags. */
function FiltersTrigger({ children, className }: FiltersTriggerProps) {
  return (
    <PopoverTrigger asChild>
      <Button
        variant="outline"
        className={cn(
          'max-w-md items-center justify-between font-stashly bg-card! ring ring-input data-[state=open]:bg-muted/30 data-[state=open]:text-accent-foreground',
          className
        )}
      >
        {children ?? <FiltersTriggerDefault />}
      </Button>
    </PopoverTrigger>
  )
}

function FiltersTriggerDefault() {
  const { filters } = useFiltersContext()
  return (
    <>
      <span className="flex items-center gap-1">
        <FilterIcon className="size-5" />
        <span className="text-sm font-stashly">Filter</span>
      </span>
      {filters.chips.length > 0 && (
        <>
          <DashedDiv />
          <FiltersChips />
        </>
      )}
      <DashedDiv />
      <div className="flex items-center justify-between gap-2">
        <FiltersFlagToggles />
        <span className="h-6 flex items-center">
          <DropdownIcon className="size-5 text-current" />
        </span>
      </div>
    </>
  )
}

// ─── Panel (popover content) ─────────────────────────────────────────────

interface FiltersPanelProps {
  children: ReactNode
  className?: string
  align?: 'start' | 'center' | 'end'
}

function FiltersPanel({
  children,
  className,
  align = 'start',
}: FiltersPanelProps) {
  return (
    <PopoverContent
      align={align}
      sideOffset={10}
      className={cn(
        'w-md rounded-md shadow-xl overflow-hidden font-stashly ring-2 ring-input border-none p-0 bg-card',
        className
      )}
    >
      {children}
    </PopoverContent>
  )
}

// ─── Tabs (Tab list + Tab) ───────────────────────────────────────────────

interface FiltersTabsProps {
  defaultTab?: FilterSourceKey
  children: ReactNode
}

interface TabsRegistryEntry {
  id: FilterSourceKey
  label: string
}

const TabsRegistryContext = createContext<{
  register: (entry: TabsRegistryEntry) => void
  current: FilterSourceKey
} | null>(null)

function FiltersTabs({ defaultTab = 'category', children }: FiltersTabsProps) {
  const [current, setCurrent] = useState<FilterSourceKey>(defaultTab)
  const [registry, setRegistry] = useState<TabsRegistryEntry[]>([])
  const { filters } = useFiltersContext()

  const register = (entry: TabsRegistryEntry) =>
    setRegistry((r) =>
      r.find((x) => x.id === entry.id) ? r : [...r, entry]
    )

  return (
    <TabsRegistryContext.Provider value={{ register, current }}>
      <Tabs
        value={current}
        onValueChange={(v) => setCurrent(v as FilterSourceKey)}
        className="w-full border-none"
      >
        <TabsList className="flex items-center bg-card border-none rounded-none w-full p-0">
          {registry.map((t) => {
            const count = filters.state[t.id].length
            return (
              <TabsTrigger
                key={t.id}
                value={t.id}
                className={cn(
                  'rounded-none border-none bg-accent',
                  t.id === current ? 'bg-card!' : 'hover:bg-background'
                )}
              >
                {t.label}
                {count > 0 && (
                  <Badge
                    variant="secondary"
                    className="bg-primary text-primary-foreground rounded text-xs font-medium"
                  >
                    {count}
                  </Badge>
                )}
              </TabsTrigger>
            )
          })}
        </TabsList>
        {children}
      </Tabs>
    </TabsRegistryContext.Provider>
  )
}

interface FiltersTabProps {
  id: FilterSourceKey
  label: string
  /** Predefined items (renders the standard checkbox list). Omit when passing children. */
  items?: GlyphItem[]
  /** Custom render — full control over the tab body. */
  children?: ReactNode
  className?: string
}

function FiltersTab({ id, label, items, children, className }: FiltersTabProps) {
  const reg = useContext(TabsRegistryContext)
  if (!reg) {
    throw new Error('<Filters.Tab> must be used inside <Filters.Tabs>')
  }
  const { register } = reg
  // Register on render — idempotent thanks to the dedup check.
  // (cheap; tabs list is small and stable)
  register({ id, label })

  const { draft, setDraft } = useFiltersContext()

  const toggleDraft = (val: string) =>
    setDraft((d) => ({
      ...d,
      [id]: d[id].includes(val)
        ? d[id].filter((v) => v !== val)
        : [...d[id], val],
    }))

  return (
    <TabsContent value={id} className={cn('p-3', className)}>
      {children ?? (
        items && (
          <div
            className={cn(
              'gap-y-2',
              id === 'category' ? 'grid grid-cols-2' : 'flex flex-col'
            )}
          >
            {items.map((it) => {
              const on = draft[id].includes(it.id)
              return (
                <button
                  key={it.id}
                  onClick={() => toggleDraft(it.id)}
                  className="inline-flex items-center gap-2 h-5 px-2 py-0"
                >
                  {it.icon && <it.icon className="size-5" />}
                  <span className="flex-1 text-left h-full align-text-bottom">
                    {it.label}
                  </span>
                  <Checkbox
                    className="size-5 place-self-start hover:cursor-pointer bg-input"
                    name={it.id}
                    checked={on}
                    onCheckedChange={() => toggleDraft(it.id)}
                  />
                </button>
              )
            })}
          </div>
        )
      )}
    </TabsContent>
  )
}

// ─── Footer actions ──────────────────────────────────────────────────────

function FiltersActions({ children }: { children?: ReactNode }) {
  return (
    <section className="px-3 py-2 flex items-center w-full gap-2">
      {children ?? (
        <>
          <FiltersReset />
          <div className="flex-1 flex flex-wrap items-end gap-2 justify-end">
            <FiltersCancel />
            <FiltersApply />
          </div>
        </>
      )}
    </section>
  )
}

function FiltersReset({ className }: { className?: string }) {
  const { filters, closePopover } = useFiltersContext()
  return (
    <Button
      onClick={() => {
        filters.clearAll()
        closePopover()
      }}
      variant="ghost"
      size="sm"
      disabled={filters.total === 0}
      className={className}
    >
      Reset ({filters.total})
    </Button>
  )
}

function FiltersCancel({ className }: { className?: string }) {
  const { closePopover } = useFiltersContext()
  return (
    <Button
      onClick={closePopover}
      variant="ghost"
      size="sm"
      className={cn('text-xs h-7 rounded-sm', className)}
    >
      Cancel
    </Button>
  )
}

function FiltersApply({ className }: { className?: string }) {
  const { applyDraft } = useFiltersContext()
  return (
    <Button
      onClick={applyDraft}
      variant="default"
      size="sm"
      className={cn('text-xs h-7 rounded-sm', className)}
    >
      Apply
    </Button>
  )
}

// ─── Sort (re-export for compound ergonomics) ────────────────────────────

function FiltersSort() {
  return <SortPill />
}

// ─── Compound export ─────────────────────────────────────────────────────

export const Filters = Object.assign(FiltersRoot, {
  Search: FiltersSearch,
  Chips: FiltersChips,
  FlagToggles: FiltersFlagToggles,
  Popover: FiltersPopover,
  Trigger: FiltersTrigger,
  Panel: FiltersPanel,
  Tabs: FiltersTabs,
  Tab: FiltersTab,
  Actions: FiltersActions,
  Reset: FiltersReset,
  Cancel: FiltersCancel,
  Apply: FiltersApply,
  Sort: FiltersSort,
})

// ─── Pre-composed default — the original `HeaderFilters` shape ───────────

export function HeaderFilters() {
  const location = useLocation()
  if (
    location.pathname.includes('/videos') ||
    location.pathname.includes('/images') ||
    location.pathname.includes('/files')
  ) {
    return null
  }
  const filters = useFilters()
  return (
    <Filters filters={filters}>
      <Filters.Search />
      <Filters.Popover>
        <Filters.Trigger />
        <Filters.Panel>
          <Filters.Tabs defaultTab="category">
            <Filters.Tab id="category" label="Categories" items={CATEGORIES} />
            <Filters.Tab id="status" label="Status" items={STATUSES} />
            <Filters.Tab id="type" label="Type" items={TYPES} />
          </Filters.Tabs>
          <Filters.Actions />
        </Filters.Panel>
      </Filters.Popover>
      <Filters.Sort />
    </Filters>
  )
}
