import { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { href, Link, useLocation, useParams } from 'react-router'
import {
  DropdownIcon,
  FavoriteIcon,
  FilterIcon,
  LockFillIcon,
  SearchIcon,
} from '@/components/icons'
import {
  Button,
  buttonVariants,
  Checkbox,
  Badge,
  Popover,
  PopoverAnchor,
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
} from '@/types/filter.types'
import { CATEGORIES, STATUSES, TYPES, FLAGS } from '@/utils/filter-data'
import { useFilters } from '@/hooks/useFilters'
import { useDebouncedCommit } from '@/hooks/useDebouncedCommit'
import { Chip, DashedDiv } from './filter-primitives'
import { SortPill } from './sort-pill'
import { SearchInput } from '@/components/core-components/search-input'
import { Tooltip } from '@/ui/tooltip'
import { Grid, LayoutToggle, List } from '@/components/layout-toggle'

// ─── Context ─────────────────────────────────────────────────────────────

interface FiltersContextValue {
  filters: UseFilters
  draft: FilterState
  setDraft: React.Dispatch<React.SetStateAction<FilterState>>
  closePopover: () => void
  applyDraft: () => void
  resetDraft: () => void
  popoverKey: number
  /** The trigger's flag toggles, so the panel can tell when a header
   *  container query has hidden them (see `FiltersFlags`). */
  flagsRef: React.RefObject<HTMLSpanElement | null>
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
  const flagsRef = useRef<HTMLSpanElement>(null)

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
        flagsRef,
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

/**
 * The search field.
 *
 * The typed text is local state, deliberately, and the URL is written behind a
 * debounce. Binding `value` straight to `filters.state.query` looked correct
 * and was not: `setQuery` writes a search param, React Router will not commit
 * the new location until the route's loader resolves, and the search loader
 * runs `searchItemsHybrid` — measured at 1.2–3.1 s on the dev drive. For that
 * whole window `useSearchParams()` still returns the *previous* params, so the
 * input rendered the previous text.
 *
 * That does not merely lag. The next keystroke's value is derived from what the
 * input currently shows, so typing "t" then "h" inside the window produced "h",
 * not "th" — characters overwrote each other. An input must never depend on a
 * round trip to display what was just typed into it.
 */
function FiltersSearch(
  props: Omit<
    React.ComponentProps<typeof SearchInput>,
    'value' | 'onValueChange' | 'mode' | 'onModeChange'
  >
) {
  const { filters } = useFiltersContext()
  const [text, setText] = useState(filters.state.query)
  const { markCommitted } = useDebouncedCommit(text, filters.setQuery)

  // An external change — back/forward, a removed chip, "Clear all" — has to
  // replace what is in the field. `markCommitted` first, so adopting it does
  // not immediately schedule a write of the value we just received.
  useEffect(() => {
    markCommitted(filters.state.query)
    setText(filters.state.query)
  }, [filters.state.query, markCommitted])

  return (
    <SearchInput
      value={text}
      onValueChange={setText}
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

function FiltersFlagToggles({
  className,
  ref,
}: {
  className?: string
  ref?: React.Ref<HTMLSpanElement>
}) {
  const { filters } = useFiltersContext()
  return (
    // Above the trigger's full-size button (see `FiltersTrigger`), so a toggle
    // click flips the flag instead of opening the panel.
    <span
      ref={ref}
      className={cn(
        'pointer-events-auto relative z-10 flex items-center gap-0.5',
        className
      )}
    >
      {FLAGS.map((f) => {
        const on = filters.state.flags.includes(f.id)
        return (
          <Toggle
            key={f.id}
            aria-label={f.label}
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

/**
 * The "Filter" pill: label, active chips and the flag toggles, opening the
 * panel when clicked anywhere but a toggle.
 *
 * Not one `<button>`: the flag toggles are buttons themselves, and a button
 * inside a button is invalid HTML that broke hydration on every page with the
 * header. The pill is a plain element (the popover's anchor) holding the
 * trigger as a full-size button *behind* the content, so a click on the label
 * or chips lands on it, and the toggles opt back into pointer events above it.
 * Custom `children` render in that same pass-through layer: anything
 * interactive among them needs `pointer-events-auto relative z-10`.
 */
function FiltersTrigger({ children, className }: FiltersTriggerProps) {
  return (
    <PopoverAnchor asChild>
      <div
        className={cn(
          buttonVariants({ variant: 'outline' }),
          'relative max-w-md items-center justify-between font-stashly bg-card! border-none ring-2 ring-accent has-data-[state=open]:bg-muted/30 has-data-[state=open]:text-accent-foreground',
          className
        )}
      >
        <PopoverTrigger
          aria-label="Filter"
          className="absolute inset-0 rounded-[inherit] cursor-pointer outline-none"
        />
        <span className="pointer-events-none contents">
          {children ?? <FiltersTriggerDefault />}
        </span>
      </div>
    </PopoverAnchor>
  )
}

function FiltersTriggerDefault() {
  const { filters, flagsRef } = useFiltersContext()
  return (
    <>
      <span className="flex items-center gap-1">
        <FilterIcon className="size-5" />
        <span className="text-sm font-stashly">Filter</span>
      </span>
      {/* A narrow header keeps the label and the panel; the chips (and below
          that the flags, which then move into the panel) step aside. */}
      {filters.chips.length > 0 && (
        <span className="contents @max-header-compact/header:hidden">
          <DashedDiv />
          <FiltersChips />
        </span>
      )}
      <DashedDiv className="@max-header-narrow/header:hidden" />
      <div className="flex items-center justify-between gap-2">
        <FiltersFlagToggles
          ref={flagsRef}
          className="@max-header-narrow/header:hidden"
        />
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

// ─── Flags in the panel (narrow header only) ────────────────────────────

/**
 * The Locked/Favorited toggles inside the panel, shown only while a narrow
 * header has hidden them on the trigger. The panel renders in a portal,
 * outside the header's size container, so it can't use the container query
 * itself: it reads whether the trigger's toggles are hidden when it opens
 * (the content mounts on every open).
 */
function FiltersFlags() {
  const { flagsRef } = useFiltersContext()
  const [show] = useState(
    () => !!flagsRef.current && flagsRef.current.offsetParent === null
  )
  if (!show) return null
  return (
    <section className="flex items-center justify-between gap-2 border-t border-input px-3 py-2">
      <span className="text-sm font-stashly text-muted-foreground">Flags</span>
      <FiltersFlagToggles />
    </section>
  )
}

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
  Flags: FiltersFlags,
  Actions: FiltersActions,
  Reset: FiltersReset,
  Cancel: FiltersCancel,
  Apply: FiltersApply,
  Sort: FiltersSort,
})

// ─── Pre-composed search only — the Images page header ───────────────────

/**
 * The app search on its own, for headers whose page has no filter or sort
 * popover (the Images page). Same field, same `?query=` / `?searchMode=`.
 *
 * @example
 * <HeaderSearch className="w-full max-w-80" />
 */
export function HeaderSearch({ className }: { className?: string }) {
  const filters = useFilters()
  return (
    <Filters filters={filters} className={className}>
      <Filters.Search />
    </Filters>
  )
}

// ─── Pre-composed default — the original `HeaderFilters` shape ───────────

/** Whether a page's header carries the filter controls (and, on a phone,
 *  the "View options" popover that holds them with the layout switch). */
export const hasHeaderFilters = (pathname: string) =>
  !pathname.includes('/videos') &&
  !pathname.includes('/images') &&
  !pathname.includes('/files')

/** Shown inline on a wide header, folded into "View options" on a phone or
 *  a header under 36rem (an expanded sidebar on a small laptop). */
const PHONE_HIDDEN = 'max-md:hidden @max-header-phone/header:hidden'
const PHONE_ONLY = 'hidden max-md:inline-flex @max-header-phone/header:inline-flex'

function HeaderFilterPopover({ panelClassName }: { panelClassName?: string }) {
  return (
    <Filters.Popover>
      <Filters.Trigger />
      <Filters.Panel className={panelClassName}>
        <Filters.Tabs defaultTab="category">
          <Filters.Tab id="category" label="Categories" items={CATEGORIES} />
          <Filters.Tab id="status" label="Status" items={STATUSES} />
          <Filters.Tab id="type" label="Type" items={TYPES} />
        </Filters.Tabs>
        <Filters.Flags />
        <Filters.Actions />
      </Filters.Panel>
    </Filters.Popover>
  )
}

function ViewOptionsRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm font-stashly text-muted-foreground">{label}</span>
      {children}
    </div>
  )
}

/**
 * The phone header's one button for Filter, Sort and Layout. The popover
 * renders in a portal, outside the header's size container, so the parts
 * inside it show their full, wide-header form.
 */
function HeaderViewOptions() {
  return (
    <Popover modal={false}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          aria-label="View options"
          className={cn(
            PHONE_ONLY,
            'shrink-0 bg-card! border-none ring-2 ring-accent rounded-md! data-[state=open]:bg-muted/30 data-[state=open]:text-accent-foreground'
          )}
        >
          <FilterIcon className="size-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="flex w-auto max-w-(--radix-popover-content-available-width) flex-col gap-3 rounded-md border-none bg-card p-3 font-stashly shadow-xl ring-2 ring-accent"
      >
        <ViewOptionsRow label="Filter">
          <HeaderFilterPopover panelClassName="max-w-(--radix-popover-content-available-width)" />
        </ViewOptionsRow>
        <ViewOptionsRow label="Sort">
          <Filters.Sort />
        </ViewOptionsRow>
        <ViewOptionsRow label="Layout">
          <LayoutToggle>
            <Grid />
            <List />
          </LayoutToggle>
        </ViewOptionsRow>
      </PopoverContent>
    </Popover>
  )
}

export function HeaderFilters() {
  // Hooks before the return: the header outlives route changes, so the hook
  // count must not depend on the path.
  const location = useLocation()
  const filters = useFilters()
  const { me } = useParams()
  if (!hasHeaderFilters(location.pathname)) return null
  return (
    <Filters filters={filters} className="min-w-0">
      <Filters.Search className="min-w-40 shrink @max-header-narrow/header:hidden" />
      {/* A narrow header trades the field for a button to the search page. */}
      {me && (
        <Tooltip content="Search" asChild>
          <Button
            variant="outline"
            size="icon"
            aria-label="Search"
            className="hidden shrink-0 bg-card! border-none ring-2 ring-accent rounded-md! @max-header-narrow/header:inline-flex"
            asChild
          >
            <Link to={href('/:me/stash/search', { me })}>
              <SearchIcon className="size-5" />
            </Link>
          </Button>
        </Tooltip>
      )}
      <div className={cn('flex items-center gap-2', PHONE_HIDDEN)}>
        <HeaderFilterPopover />
        <Filters.Sort />
      </div>
      <HeaderViewOptions />
    </Filters>
  )
}
