import {
  ArrowLeftFillIcon,
  CollectionFillIcon,
  DropdownIcon,
  FavoriteIcon,
  FileFillIcon,
  FilterIcon,
  FolderFillIcon,
  ImageFillIcon,
  LockFillIcon,
  SearchFillIcon,
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
import { Badge } from '@/ui/badge'
import { ScrollArea } from '@/ui/scroll-area'
import { SegmentedControl, SegmentedControlItem } from '@/components/ui/segmented-control'
// The share dialog's parts (caption, row card, badge), so both dialogs read alike.
import {
  INVITE_BADGE,
  INVITE_CAPTION,
  INVITE_CARD,
} from '@/components/views/invitations/invite-form-fields'
import { useDebouncedCommit } from '@/hooks/useDebouncedCommit'
import { useFilters } from '@/hooks/useFilters'
import { useSortOrder } from '@/hooks/useSortOrder'
import { CATEGORIES, CURSOR_KEY, FLAG_KEYS, MULTI_KEYS, QUERY_KEY, SEARCH_MODE_KEY } from '@/utils/filter-data'
import {
  COMMON_CATEGORY_IDS,
  describeCategories,
  describeFlags,
  describeSort,
  KINDS,
  previewCategories,
  kindOf,
  type KindValue,
  refinementParts,
  scopeFromRouteParams,
  searchPageUrl,
} from '@/utils/search-refine'
import type { SortDir } from '@/utils/sort-fields'
import { cn } from '@/utils/styles'
import type { JSX, ReactNode, SVGProps } from 'react'
import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router'

type View = 'home' | 'type' | 'show' | 'sort'
type Icon = (props: SVGProps<SVGSVGElement>) => JSX.Element

const TITLES: Record<Exclude<View, 'home'>, string> = {
  type: 'File type',
  show: 'Show only',
  sort: 'Sort',
}

const DESCRIPTIONS: Record<Exclude<View, 'home'>, string> = {
  type: 'Pick any number. Results update as you choose.',
  show: 'Narrow the results to what you marked.',
  sort: 'Pick a field, then the direction.',
}

const KIND_ICON: Record<KindValue, Icon> = {
  all: FilterIcon,
  file: FileFillIcon,
  folder: FolderFillIcon,
  collection: CollectionFillIcon,
}

const COMMON = CATEGORIES.filter((c) => COMMON_CATEGORY_IDS.includes(c.id))
const MORE = CATEGORIES.filter((c) => !COMMON_CATEGORY_IDS.includes(c.id))

/** A quiet uppercase text button, like the share dialog's "Copy link". */
const TEXT_BUTTON =
  'h-8 gap-2 px-1.5 font-stashly text-xs uppercase tracking-wide text-muted-foreground hover:text-foreground'

/**
 * Search, filter and sort in one place: a search box, the item kind, and three
 * plain questions (file type, show only, sort), each answered on a page of its
 * own. Every choice writes the same URL params as the classic header controls
 * and applies at once; the header trigger reads the choices back as chips.
 *
 * Styled on the share dialog's parts: captions over sections, rows on muted
 * cards with a square badge, a dashed rule above the footer.
 *
 * Opens from the trigger or ⌘K / Ctrl+K anywhere on the page.
 */
export function SearchRefine({ showTrigger = true }: { showTrigger?: boolean }) {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<View>('home')
  const filters = useFilters()
  const sort = useSortOrder()
  const parts = refinementParts(filters.state, sort)

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
          aria-label={parts.length ? `Search and refine: ${parts.join(', ')}` : 'Search your stash'}
          // max-w-80, the Images page's header search (owner, 14 Nov: the
          // 600px field was too large).
          className="h-9 min-w-9 w-full max-w-80 flex items-center gap-2 rounded-md border border-input bg-card pl-2.5 pr-1.5 font-stashly text-sm text-muted-foreground transition-colors duration-200 hover:bg-muted cursor-pointer"
        >
          <SearchFillIcon className="size-5 shrink-0" />
          {parts.length ? (
            // One chip per refinement; the row fades out at its end rather than
            // wrapping when they outgrow the field.
            <span className="flex-1 min-w-0 flex items-center gap-1 overflow-hidden mask-r-from-85%">
              {parts.map((p) => (
                <span
                  key={p}
                  className="h-6 shrink-0 inline-flex items-center rounded-lg bg-muted px-2 text-xs text-foreground whitespace-nowrap"
                >
                  {p}
                </span>
              ))}
            </span>
          ) : (
            <span className="flex-1 min-w-0 truncate text-left">Search your stash</span>
          )}
          <Kbd className="rounded-lg font-stashly @max-md/header:hidden">⌘K</Kbd>
        </button>
      )}
      <DialogContent
        showCloseButton={false}
        className="top-20 translate-y-0 gap-6 rounded-3xl border-input bg-card p-6 font-stashly shadow-stashly outline-none sm:max-w-xl sm:p-8"
      >
        {view === 'home' ? (
          <>
            <DialogTitle className="sr-only">Search</DialogTitle>
            <DialogDescription className="sr-only">
              Search your stash and refine the results. Changes apply as you choose.
            </DialogDescription>
            <Home filters={filters} sort={sort} go={setView} />
          </>
        ) : (
          <SubPage
            view={view}
            count={
              view === 'type'
                ? filters.state.category.length
                : view === 'show'
                  ? filters.state.flags.length
                  : 0
            }
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
    // min-w-0: DialogContent is a grid, and a grid item won't shrink below its
    // content, so a long value would widen the dialog instead of truncating.
    <div className="flex min-w-0 flex-col gap-6">
      <SearchField filters={filters} />

      <section className="flex flex-col gap-2.5">
        <h3 className={INVITE_CAPTION}>Show</h3>
        <SegmentedControl
          aria-label="Show"
          value={kindOf(state)}
          onValueChange={(v) => filters.setMulti('type', v === 'all' ? [] : [v as KindValue])}
          className="w-full grid grid-cols-4"
        >
          {KINDS.map((k) => {
            const KindIcon = KIND_ICON[k.value]
            return (
              <SegmentedControlItem key={k.value} value={k.value} className="w-full min-w-0 gap-1.5 px-1">
                {/* On a phone the four labels fill the row on their own. */}
                <KindIcon className="size-4 shrink-0 max-sm:hidden" />
                {k.label}
              </SegmentedControlItem>
            )
          })}
        </SegmentedControl>
      </section>

      <section className="flex flex-col gap-2.5">
        <h3 className={INVITE_CAPTION}>Refine</h3>
        <div className="flex flex-col gap-2">
          <Question
            icon={ImageFillIcon}
            label="File type"
            value={
              state.category.length ? <CategoryBadges ids={state.category} /> : describeCategories(state.category)
            }
            isSet={state.category.length > 0}
            onClick={() => go('type')}
          />
          <Question
            icon={FavoriteIcon}
            label="Show only"
            value={describeFlags(state.flags)}
            isSet={state.flags.length > 0}
            onClick={() => go('show')}
          />
          <Question
            icon={sort.dir === 'asc' ? SortAscIcon : SortDescIcon}
            label="Sort"
            value={describeSort(sort.field, sort.dir)}
            isSet={!sort.isDefault}
            onClick={() => go('sort')}
          />
        </div>
      </section>

      <div className="flex flex-col gap-4">
        <div className="border-t border-dashed border-input" />
        <div className="flex items-center gap-3">
          <span className={cn(INVITE_CAPTION, 'flex flex-1 items-center gap-1.5 max-sm:hidden')}>
            <Kbd className="rounded-lg font-stashly normal-case">Esc</Kbd>
            close
          </span>
          {anyActive && (
            <Button variant="ghost" onClick={clearAll} className={TEXT_BUTTON}>
              Clear all
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * The search field's look, shared by the search dialog and the add-to-collection
 * picker (owner's call: one search component): the share dialog's dashed
 * field, the filled search icon, and an optional control at its end. No bright
 * border on focus (owner's call: nothing lights up white when chosen).
 *
 * @example
 * <SearchRefineInput value={query} onChange={setQuery} aria-label="Search your stash" />
 */
export function SearchRefineInput({
  value,
  onChange,
  placeholder = 'Search your stash',
  'aria-label': ariaLabel,
  autoFocus = true,
  className,
  children,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  'aria-label': string
  autoFocus?: boolean
  className?: string
  /** A control at the field's end, e.g. the "By meaning" switch. */
  children?: ReactNode
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-xl border border-dashed border-input py-2 pl-3.5 pr-2 transition-colors focus-within:bg-muted/40',
        className
      )}
    >
      <SearchFillIcon className={cn('size-5 shrink-0 text-muted-foreground', value && 'text-foreground')} />
      <input
        type="search"
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className="h-8 min-w-0 flex-1 bg-transparent font-stashly text-sm outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden"
      />
      {children}
    </div>
  )
}

/**
 * Local text, URL written behind the debounce: see `FiltersSearch` in
 * filters.tsx for why.
 *
 * Where the query goes depends on the page. On the search page it updates in
 * place. Anywhere else it opens the search page, since only that page runs the
 * real (keyword + meaning) search: inside a folder or collection with `?in=`
 * so it searches just there, and from Home, All and the other pages across the
 * whole stash. The dialog stays open over the navigation (it lives in the
 * header), so typing carries on.
 */
function SearchField({ filters }: { filters: Filters }) {
  const [text, setText] = useState(filters.state.query)
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const params = useParams()
  const onSearchPage = pathname.endsWith('/stash/search')
  const commit = (q: string) => {
    if (onSearchPage || !params.me) return filters.setQuery(q)
    if (!q.trim()) return
    navigate(
      searchPageUrl(params.me, { ...filters.state, query: q }, scopeFromRouteParams(params))
    )
  }
  const { markCommitted } = useDebouncedCommit(text, commit)
  useEffect(() => {
    markCommitted(filters.state.query)
    setText(filters.state.query)
  }, [filters.state.query, markCommitted])
  const semantic = filters.state.searchMode === 'semantic'

  return (
    <SearchRefineInput value={text} onChange={setText} aria-label="Search">
      <label
        className={cn(
          INVITE_CAPTION,
          'h-8 shrink-0 flex items-center gap-2 rounded-md px-2 cursor-pointer transition-colors duration-200 hover:bg-muted',
          semantic && 'text-foreground'
        )}
      >
        By meaning
        <Switch
          shape="square"
          className="border border-input"
          checked={semantic}
          onCheckedChange={(on) => filters.setSearchMode(on ? 'semantic' : 'fuzzy')}
        />
      </label>
    </SearchRefineInput>
  )
}

function Question({
  icon: QuestionIcon,
  label,
  value,
  isSet,
  onClick,
}: {
  icon: Icon
  label: string
  value: ReactNode
  isSet: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(INVITE_CARD, 'w-full pr-3 text-left transition-colors duration-200 hover:bg-accent cursor-pointer')}
    >
      {/* The badge turns primary once the question has an answer, so a glance
          down the column says what is refined. */}
      <span
        className={cn(
          INVITE_BADGE,
          'transition-colors duration-200',
          isSet ? 'bg-primary text-primary-foreground' : 'bg-accent text-accent-foreground'
        )}
      >
        <QuestionIcon className="size-4.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm">{label}</span>
        <span
          className={cn(
            'flex min-w-0 items-center gap-1 overflow-hidden truncate text-xs',
            isSet ? 'text-foreground' : 'text-muted-foreground'
          )}
        >
          {value}
        </span>
      </span>
      {/* The app's dropdown icon, turned to point at the page it opens. */}
      <DropdownIcon className="size-4 shrink-0 -rotate-90 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-foreground" />
    </button>
  )
}

/**
 * The chosen file types as icon + name badges, the first five by name and the
 * rest folded into "+N" (owner's call on both the badges and the five).
 */
function CategoryBadges({ ids }: { ids: string[] }) {
  const { shown, more } = previewCategories(ids)
  return (
    <>
      {shown.map((id) => {
        const category = CATEGORIES.find((c) => c.id === id)
        const CategoryIcon = category?.icon
        return (
          <Badge key={id} className="mt-0.5">
            {CategoryIcon && <CategoryIcon />}
            {category?.label ?? id}
          </Badge>
        )
      })}
      {more > 0 && (
        <Badge className="mt-0.5">
          +{more}
        </Badge>
      )}
    </>
  )
}

function SubPage({
  view,
  count,
  onBack,
  canClear,
  onClear,
  children,
}: {
  view: Exclude<View, 'home'>
  count: number
  onBack: () => void
  canClear: boolean
  onClear: () => void
  children: ReactNode
}) {
  return (
    <div className="flex min-w-0 flex-col gap-6">
      {/* The share dialog's header: title row with a square button, the
          description under it. Back stands where the share dialog's tile is. */}
      <div className="flex min-w-0 items-start gap-4">
        {/* autoFocus: the row that opened this page is gone, and focus would
            otherwise drop to the dialog box itself. */}
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Back"
          autoFocus
          onClick={onBack}
          className="mt-0.5 size-8 shrink-0 rounded-md border-input bg-card"
        >
          <ArrowLeftFillIcon className="size-5" />
        </Button>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-center gap-3">
            <DialogTitle className="min-w-0 truncate font-stashly text-lg leading-8 tracking-wide">
              {TITLES[view]}
            </DialogTitle>
            {count > 0 && <Badge>{count}</Badge>}
            <span className="flex-1" />
            {canClear && (
              <Button variant="ghost" onClick={onClear} className={TEXT_BUTTON}>
                Clear
              </Button>
            )}
          </div>
          <DialogDescription>{DESCRIPTIONS[view]}</DialogDescription>
        </div>
      </div>

      {/* Choices apply as they are made, so there is no Done: Back (or Esc)
          is the way out (owner's call). */}
      <ScrollArea className="-m-1 max-h-[min(calc(100svh-16rem),28rem)]">
        <div className="p-1">{children}</div>
      </ScrollArea>
    </div>
  )
}


function TypePage({ filters }: { filters: Filters }) {
  const selected = filters.state.category
  // Start open when a folded-away type is already chosen, so nothing selected is hidden.
  const [more, setMore] = useState(() => MORE.some((c) => selected.includes(c.id)))
  const tiles = more ? [...COMMON, ...MORE] : COMMON
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {tiles.map((c) => {
          const on = selected.includes(c.id)
          const TypeIcon = c.icon
          return (
            <button
              key={c.id}
              type="button"
              role="checkbox"
              aria-checked={on}
              onClick={() => filters.toggleMulti('category', c.id)}
              className={cn(
                // Small squares on the app's default radius. The tile itself is
                // the checkbox: chosen ones fill and their badge turns primary,
                // with no box drawn and no border (owner's call).
                'aspect-square min-w-0 flex flex-col items-center justify-center gap-1.5 rounded-md p-2 outline-none transition-colors duration-200 cursor-pointer focus-visible:ring-3 focus-visible:ring-ring/40',
                on ? 'bg-accent' : 'bg-muted hover:bg-accent'
              )}
            >
              <span
                className={cn(
                  INVITE_BADGE,
                  on ? 'bg-primary text-primary-foreground' : 'bg-card text-foreground'
                )}
              >
                {TypeIcon && <TypeIcon className="size-4.5" />}
              </span>
              <span className={cn('w-full truncate text-center text-xs', !on && 'text-muted-foreground')}>
                {c.label}
              </span>
            </button>
          )
        })}
      </div>
      <Button
        variant="ghost"
        aria-expanded={more}
        onClick={() => setMore((m) => !m)}
        className={cn(TEXT_BUTTON, 'self-center')}
      >
        {more ? 'Fewer types' : `${MORE.length} more types`}
        <DropdownIcon className={cn('size-4 transition-transform duration-200', more && 'rotate-180')} />
      </Button>
    </div>
  )
}

function ShowPage({ filters }: { filters: Filters }) {
  const flags = filters.state.flags
  const rows: { flag: 'favorited' | 'locked'; icon: Icon; label: string; hint: string }[] = [
    { flag: 'favorited', icon: FavoriteIcon, label: 'Favorites', hint: 'Only what you starred' },
    { flag: 'locked', icon: LockFillIcon, label: 'Locked', hint: "Only what's behind a lock" },
  ]
  return (
    <div className="flex flex-col gap-2">
      {rows.map(({ flag, icon: RowIcon, label, hint }) => {
        const on = flags.includes(flag)
        return (
          <button
            key={flag}
            type="button"
            role="checkbox"
            aria-checked={on}
            onClick={() => filters.toggleMulti('flags', flag)}
            className={cn(
              INVITE_CARD,
              'w-full pr-3 text-left transition-colors duration-200 cursor-pointer',
              on ? 'bg-accent' : 'hover:bg-accent'
            )}
          >
            <span
              className={cn(INVITE_BADGE, on ? 'bg-primary text-primary-foreground' : 'bg-accent text-accent-foreground')}
            >
              <RowIcon className="size-4.5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className={cn('block truncate text-sm', !on && 'text-muted-foreground')}>{label}</span>
              <span className="block truncate text-xs text-muted-foreground">{hint}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

function SortPage({ sort }: { sort: Sort }) {
  return (
    <div className="flex flex-col gap-2">
      {sort.fields.map((f) => {
        const on = f.key === sort.field.key
        return (
          <div
            key={f.key}
            className={cn(INVITE_CARD, 'transition-colors duration-200', on && 'bg-accent')}
          >
            <button
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => sort.pick(f)}
              className="h-8 min-w-0 flex-1 rounded-md px-1 text-left text-sm cursor-pointer outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
            >
              <span className={cn('truncate', !on && 'text-muted-foreground')}>{f.label}</span>
            </button>
            {/* The direction, said in the field's own words (A → Z, Largest
                first), on the chosen field only. */}
            {on && (
              <SegmentedControl
                aria-label="Direction"
                value={sort.dir}
                onValueChange={(dir) => sort.set({ field: f, dir: dir as SortDir })}
                className="shrink-0 bg-card"
              >
                {(['asc', 'desc'] as const).map((dir) => {
                  const DirIcon = dir === 'asc' ? SortAscIcon : SortDescIcon
                  return (
                    <SegmentedControlItem key={dir} value={dir} className="aria-checked:bg-muted">
                      <DirIcon className="size-4" />
                      {f.hint(dir)}
                    </SegmentedControlItem>
                  )
                })}
              </SegmentedControl>
            )}
          </div>
        )
      })}
    </div>
  )
}
