import {
  ArrowLeftFillIcon,
  CheckIcon,
  ChevronRightIcon,
  DropdownIcon,
  FavoriteIcon,
  LockFillIcon,
  SearchIcon,
  SortAscIcon,
  SortDescIcon,
} from '@/components/icons'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Kbd,
  Switch,
} from '@/components/ui'
import { SegmentedControl, SegmentedControlItem } from '@/components/ui/segmented-control'
import { useDebouncedCommit } from '@/hooks/useDebouncedCommit'
import { useFilters } from '@/hooks/useFilters'
import { useSearchRefinePreference } from '@/hooks/useSearchRefinePreference'
import { useSortOrder } from '@/hooks/useSortOrder'
import { CATEGORIES, CURSOR_KEY, FLAG_KEYS, MULTI_KEYS, QUERY_KEY, SEARCH_MODE_KEY } from '@/utils/filter-data'
import {
  COMMON_CATEGORY_IDS,
  describeCategories,
  describeFlags,
  describeRefinement,
  describeSort,
  KINDS,
  kindOf,
  type KindValue,
} from '@/utils/search-refine'
import { cn } from '@/utils/styles'
import type { JSX, ReactNode, SVGProps } from 'react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'

type View = 'home' | 'type' | 'show' | 'sort'
type Icon = (props: SVGProps<SVGSVGElement>) => JSX.Element

const TITLES: Record<Exclude<View, 'home'>, string> = {
  type: 'File type',
  show: 'Show only',
  sort: 'Sort',
}

const COMMON = CATEGORIES.filter((c) => COMMON_CATEGORY_IDS.includes(c.id))
const MORE = CATEGORIES.filter((c) => !COMMON_CATEGORY_IDS.includes(c.id))

/**
 * Search, filter and sort in one place: a search box, the item kind, and three
 * plain questions (file type, show only, sort), each answered on a page of its
 * own. Every choice writes the same URL params as the classic header controls
 * and applies at once; the header trigger reads the choices back in words.
 *
 * Opens from the trigger or ⌘K / Ctrl+K anywhere on the page.
 */
export function SearchRefine({ showTrigger = true }: { showTrigger?: boolean }) {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<View>('home')
  const filters = useFilters()
  const sort = useSortOrder()
  const summary = describeRefinement(filters.state, sort)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setView('home')
        setOpen((o) => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) setView('home')
      }}
    >
      {showTrigger && (
        <button
          type="button"
          onClick={() => {
            setView('home')
            setOpen(true)
          }}
          aria-haspopup="dialog"
          className="h-9 min-w-40 w-full max-w-140 flex items-center gap-2.5 rounded-md border border-input bg-card pl-2.5 pr-1.5 font-stashly text-sm text-muted-foreground transition-colors duration-200 hover:bg-muted cursor-pointer"
        >
          <SearchIcon className="size-5 shrink-0" />
          <span className={cn('flex-1 min-w-0 truncate text-left', summary && 'text-foreground')}>
            {summary || 'Search your stash'}
          </span>
          <Kbd className="font-stashly">⌘K</Kbd>
        </button>
      )}
      <DialogContent
        showCloseButton={false}
        className="top-24 translate-y-0 gap-0 p-0 sm:max-w-130 overflow-hidden rounded-xl bg-popover font-stashly"
      >
        <DialogTitle className="sr-only">{view === 'home' ? 'Search' : TITLES[view]}</DialogTitle>
        <DialogDescription className="sr-only">
          Search your stash and refine the results. Changes apply as you choose.
        </DialogDescription>
        {view === 'home' ? (
          <Home filters={filters} sort={sort} go={setView} />
        ) : (
          <SubPage
            title={TITLES[view]}
            onBack={() => setView('home')}
            canClear={
              view === 'type'
                ? filters.state.category.length > 0
                : view === 'show'
                  ? filters.state.flags.length > 0
                  : !sort.isDefault
            }
            onClear={() =>
              view === 'type'
                ? filters.clear('category')
                : view === 'show'
                  ? filters.clear('flags')
                  : sort.reset()
            }
          >
            {view === 'type' && <TypePage filters={filters} />}
            {view === 'show' && <ShowPage filters={filters} />}
            {view === 'sort' && <SortPage sort={sort} />}
          </SubPage>
        )}
      </DialogContent>
    </Dialog>
  )
}

type Filters = ReturnType<typeof useFilters>
type Sort = ReturnType<typeof useSortOrder>

function Home({ filters, sort, go }: { filters: Filters; sort: Sort; go: (v: View) => void }) {
  const [, setSearchParams] = useSearchParams()
  const [inHeader, setInHeader] = useSearchRefinePreference()
  const { state } = filters
  const anyActive =
    state.query !== '' ||
    state.searchMode === 'semantic' ||
    state.category.length + state.type.length + state.flags.length > 0 ||
    !sort.isDefault

  // One write for everything: two back-to-back setSearchParams calls would
  // each start from the same location and the second would undo the first.
  const clearAll = () =>
    setSearchParams(
      (p) => {
        const out = new URLSearchParams(p)
        ;[...MULTI_KEYS, ...FLAG_KEYS, QUERY_KEY, SEARCH_MODE_KEY, CURSOR_KEY].forEach((k) => out.delete(k))
        for (const k of Array.from(out.keys())) if (k.startsWith('orderBy[')) out.delete(k)
        return out
      },
      { replace: true }
    )

  return (
    <div>
      <SearchField filters={filters} />
      <div className="px-3.5 pb-3">
        <SegmentedControl
          aria-label="Show"
          value={kindOf(state)}
          onValueChange={(v) => filters.setMulti('type', v === 'all' ? [] : [v as KindValue])}
          className="w-full grid grid-cols-4"
        >
          {KINDS.map((k) => (
            <SegmentedControlItem key={k.value} value={k.value} className="w-full">
              {k.label}
            </SegmentedControlItem>
          ))}
        </SegmentedControl>
      </div>
      <div className="border-t border-input p-1.5">
        <Question
          label="File type"
          value={describeCategories(state.category)}
          isSet={state.category.length > 0}
          onClick={() => go('type')}
        />
        <Question
          label="Show only"
          value={describeFlags(state.flags)}
          isSet={state.flags.length > 0}
          onClick={() => go('show')}
        />
        <Question
          label="Sort"
          value={describeSort(sort.field, sort.dir)}
          isSet={!sort.isDefault}
          onClick={() => go('sort')}
        />
      </div>
      <div className="flex items-center gap-3 border-t border-input bg-sidebar px-4.5 py-2.5 text-xs text-muted-foreground">
        <label className="flex items-center gap-2 cursor-pointer">
          <Switch checked={inHeader} onCheckedChange={setInHeader} />
          Use in header
        </label>
        <span className="flex-1" />
        {anyActive && (
          <button
            type="button"
            onClick={clearAll}
            className="text-foreground underline underline-offset-3 cursor-pointer"
          >
            Clear all
          </button>
        )}
      </div>
    </div>
  )
}

/** Local text, URL written behind the debounce: see `FiltersSearch` in filters.tsx for why. */
function SearchField({ filters }: { filters: Filters }) {
  const [text, setText] = useState(filters.state.query)
  const { markCommitted } = useDebouncedCommit(text, filters.setQuery)
  useEffect(() => {
    markCommitted(filters.state.query)
    setText(filters.state.query)
  }, [filters.state.query, markCommitted])
  const semantic = filters.state.searchMode === 'semantic'

  return (
    <div className="h-15 flex items-center gap-3 pl-4.5 pr-3.5 text-muted-foreground">
      <SearchIcon className="size-5 shrink-0" />
      <input
        type="search"
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Search your stash"
        aria-label="Search"
        className="flex-1 min-w-0 bg-transparent outline-none border-0 font-stashly text-lg text-foreground placeholder:text-muted-foreground"
      />
      <label className={cn('flex items-center gap-2 text-xs cursor-pointer', semantic && 'text-foreground')}>
        By meaning
        <Switch
          checked={semantic}
          onCheckedChange={(on) => filters.setSearchMode(on ? 'semantic' : 'fuzzy')}
        />
      </label>
    </div>
  )
}

function Question({
  label,
  value,
  isSet,
  onClick,
}: {
  label: string
  value: string
  isSet: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full h-12 flex items-center gap-3 rounded-md px-3 text-left text-sm transition-colors duration-200 hover:bg-muted cursor-pointer"
    >
      <span className={cn('flex-1', isSet ? 'text-muted-foreground' : 'text-foreground')}>{label}</span>
      <span className={cn('truncate', isSet ? 'text-foreground' : 'text-muted-foreground')}>{value}</span>
      <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
    </button>
  )
}

function SubPage({
  title,
  onBack,
  canClear,
  onClear,
  children,
}: {
  title: string
  onBack: () => void
  canClear: boolean
  onClear: () => void
  children: ReactNode
}) {
  return (
    <div>
      <div className="h-14 flex items-center gap-2 border-b border-input bg-sidebar pl-2 pr-3.5">
        <Button variant="ghost" size="icon" aria-label="Back" onClick={onBack}>
          <ArrowLeftFillIcon className="size-5" />
        </Button>
        <span className="flex-1 text-base">{title}</span>
        {canClear && (
          <button type="button" onClick={onClear} className="text-xs text-muted-foreground hover:text-foreground cursor-pointer">
            Clear
          </button>
        )}
      </div>
      <div className="p-1.5 max-h-[60vh] overflow-y-auto">{children}</div>
      <div className="border-t border-input bg-sidebar px-3 pt-2.5 pb-3">
        <Button className="w-full" onClick={onBack}>
          Done
        </Button>
      </div>
    </div>
  )
}

function OptionRow({
  icon: Icon,
  label,
  on,
  onClick,
  role = 'checkbox',
  trailing,
}: {
  icon?: Icon
  label: string
  on: boolean
  onClick: () => void
  role?: 'checkbox' | 'radio'
  trailing?: ReactNode
}) {
  return (
    <button
      type="button"
      role={role}
      aria-checked={on}
      onClick={onClick}
      className={cn(
        'w-full h-11 flex items-center gap-3 rounded-md px-3 text-left text-sm transition-colors duration-200 hover:bg-muted cursor-pointer',
        on && 'bg-muted'
      )}
    >
      {Icon && <Icon className="size-5 shrink-0" />}
      <span className="flex-1">{label}</span>
      {trailing ?? (
        <span
          className={cn(
            'size-5 shrink-0 rounded-full border-[1.5px] flex items-center justify-center',
            on ? 'border-foreground bg-foreground text-background' : 'border-input'
          )}
        >
          {on && <CheckIcon className="size-3.5" />}
        </span>
      )}
    </button>
  )
}

function TypePage({ filters }: { filters: Filters }) {
  const selected = filters.state.category
  // Start open when a folded-away type is already chosen, so nothing selected is hidden.
  const [more, setMore] = useState(() => MORE.some((c) => selected.includes(c.id)))
  const rows = more ? [...COMMON, ...MORE] : COMMON
  return (
    <>
      {rows.map((c) => (
        <OptionRow
          key={c.id}
          icon={c.icon}
          label={c.label}
          on={selected.includes(c.id)}
          onClick={() => filters.toggleMulti('category', c.id)}
        />
      ))}
      <button
        type="button"
        aria-expanded={more}
        onClick={() => setMore((m) => !m)}
        className="w-full h-11 flex items-center gap-2 rounded-md px-3 text-left text-sm text-muted-foreground transition-colors duration-200 hover:bg-muted cursor-pointer"
      >
        <span className="flex-1">{more ? 'Fewer types' : `${MORE.length} more types`}</span>
        <DropdownIcon className={cn('size-4 transition-transform duration-200', more && 'rotate-180')} />
      </button>
    </>
  )
}

function ShowPage({ filters }: { filters: Filters }) {
  const flags = filters.state.flags
  return (
    <>
      <OptionRow
        icon={FavoriteIcon}
        label="Favorites"
        on={flags.includes('favorited')}
        onClick={() => filters.toggleMulti('flags', 'favorited')}
      />
      <OptionRow
        icon={LockFillIcon}
        label="Locked"
        on={flags.includes('locked')}
        onClick={() => filters.toggleMulti('flags', 'locked')}
      />
    </>
  )
}

function SortPage({ sort }: { sort: Sort }) {
  const DirIcon = sort.dir === 'asc' ? SortAscIcon : SortDescIcon
  return (
    <>
      {sort.fields.map((f) => {
        const on = f.key === sort.field.key
        return (
          <OptionRow
            key={f.key}
            role="radio"
            label={f.label}
            on={on}
            onClick={() => sort.pick(f)}
            trailing={
              on ? (
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  {f.hint(sort.dir)}
                  <DirIcon className="size-5 text-foreground" />
                </span>
              ) : (
                <span />
              )
            }
          />
        )
      })}
      <p className="px-3 pt-2 pb-1 text-xs text-muted-foreground">
        Tap the chosen field again to flip the order.
      </p>
    </>
  )
}
