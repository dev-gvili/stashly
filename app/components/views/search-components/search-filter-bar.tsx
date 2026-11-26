import { SortListIcon, UndoIcon } from '@/components/icons'
import { SegmentedControl, SegmentedControlItem } from '@/ui/segmented-control'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select'
import { CATEGORIES } from '@/utils/filter-data'
import { MATCH_KIND_LABEL } from '@/utils/search-evidence'
import { cn } from '@/utils/styles'
import type { MatchKind } from '@/types/stash.types'

/** The file types whose body search reads: the ones worth narrowing by here. */
const TEXT_CATEGORY_IDS = ['pdf', 'document', 'code'] as const
const TEXT_CATEGORIES = CATEGORIES.filter((c) =>
  (TEXT_CATEGORY_IDS as readonly string[]).includes(c.id)
)

export type MatchTier = MatchKind | 'all'

/**
 * How the loaded results are ordered within each group. `score` keeps the
 * server's fused ranking; `hits` puts the most literal occurrences first.
 */
export type ResultSort = 'score' | 'hits'

const SORT_LABEL: Record<ResultSort, string> = {
  score: 'Best match',
  hits: 'Most hits',
}

/**
 * Narrows the results on screen: by why they matched (a tier per match group
 * that has results), and by file type.
 *
 * The tier only filters the results already loaded (it is a view over the
 * groups), so its counts are those of the loaded results. The file types are
 * the real `?category=` filter and re-run the search on the server.
 */
export function SearchFilterBar({
  tier,
  onTierChange,
  tierCounts,
  categories,
  onToggleCategory,
  onReset,
  sort,
  onSortChange,
  className,
}: {
  tier: MatchTier
  onTierChange: (tier: MatchTier) => void
  /** Loaded results per match group, in display order; empty groups left out. */
  tierCounts: { kind: MatchKind; count: number }[]
  categories: string[]
  onToggleCategory: (id: string) => void
  onReset: () => void
  sort: ResultSort
  onSortChange: (sort: ResultSort) => void
  className?: string
}) {
  const active = tier !== 'all' || categories.length > 0

  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      <SegmentedControl
        aria-label="Match tier"
        className="rounded-[6px]"
        value={tier}
        onValueChange={(v) => onTierChange(v as MatchTier)}
      >
        <SegmentedControlItem value="all" className="rounded-[4px]">
          All tiers
        </SegmentedControlItem>
        {tierCounts.map(({ kind, count }) => (
          <SegmentedControlItem key={kind} value={kind} className="rounded-[4px]">
            {MATCH_KIND_LABEL[kind]}
            <span className="bg-background/60 inline-flex h-4 items-center rounded-[4px] px-1 text-xs tabular-nums">
              {count}
            </span>
          </SegmentedControlItem>
        ))}
      </SegmentedControl>

      <span aria-hidden className="bg-border mx-1 hidden h-4 w-px sm:block" />

      {TEXT_CATEGORIES.map(({ id, label, icon: CategoryIcon }) => {
        const on = categories.includes(id)
        return (
          <button
            key={id}
            type="button"
            aria-pressed={on}
            onClick={() => onToggleCategory(id)}
            className={cn(
              'font-stashly inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-[4px] border px-2.5 text-xs transition-colors duration-200',
              on
                ? 'border-primary/50 bg-primary/15 text-foreground'
                : 'border-input bg-card text-muted-foreground hover:text-foreground hover:border-border'
            )}
          >
            {CategoryIcon && <CategoryIcon className="size-4" />}
            {label}
          </button>
        )
      })}

      {active && (
        <button
          type="button"
          onClick={onReset}
          className="font-stashly text-muted-foreground hover:text-foreground inline-flex h-7 cursor-pointer items-center gap-1 px-2 text-xs transition-colors duration-200"
        >
          <UndoIcon className="size-3.5" />
          Reset
        </button>
      )}

      <Select value={sort} onValueChange={(v) => onSortChange(v as ResultSort)}>
        <SelectTrigger
          size="sm"
          aria-label="Sort results"
          className="font-stashly bg-card! ml-auto h-7! gap-1.5 rounded-[4px] px-2.5 text-xs"
        >
          <SortListIcon className="size-4" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="end" className="font-stashly rounded-[6px]">
          {(Object.keys(SORT_LABEL) as ResultSort[]).map((key) => (
            <SelectItem key={key} value={key} className="rounded-[4px] text-xs">
              Sort: {SORT_LABEL[key]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
