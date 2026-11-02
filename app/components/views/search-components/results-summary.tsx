import { FuzzySearchIcon, SemanticSearchIcon } from '@/components/icons'
import { cn } from '@/utils/styles'
import type { SearchMode } from '@/types/filter.types'
import { HighlightedText } from './highlighted-text'
import { SEARCH_MODE_META } from '@/utils/search-evidence'
import type { SearchQueryState } from '@/types/stash.types'

const MODE_ICON: Record<SearchMode, typeof FuzzySearchIcon> = {
  fuzzy: FuzzySearchIcon,
  semantic: SemanticSearchIcon,
}

/**
 * Count, the query as the engine read it, the active mode, and a legend for the
 * two highlight tiers — so a dotted expansion never looks like a false positive.
 *
 * No facet chips: filtering lives in the header's own popover, and a second set
 * here would be two controls writing the same URL params.
 */
export function ResultsSummary({
  state,
  totalCount,
  terms,
  semanticRan,
  className,
}: {
  state: SearchQueryState
  totalCount: number
  terms: string[]
  /**
   * Whether the dense half actually contributed. Semantic can be *requested*
   * and still not run — no embedded chunks, no WebGPU — and saying so here is
   * cheaper than leaving the user to infer it from the ranking.
   */
  semanticRan?: boolean
  className?: string
}) {
  const mode = SEARCH_MODE_META[state.mode]
  const Icon = MODE_ICON[state.mode]
  const keywordOnly = state.mode === 'semantic' && semanticRan === false
  const hasExpansions = (state.expandedTerms?.length ?? 0) > 0

  return (
    <div className={cn('flex flex-wrap items-center gap-x-3 gap-y-2', className)}>
      <span className="font-stashly text-sm tabular-nums">
        {totalCount.toLocaleString()} result{totalCount === 1 ? '' : 's'}
      </span>
      <span className="text-muted-foreground font-stashly text-xs">
        for{' '}
        <HighlightedText
          text={state.query}
          terms={terms}
          expandedTerms={state.expandedTerms}
        />
      </span>

      <span className="bg-border h-4 w-px" />

      <span
        title={mode.hint}
        className="bg-accent text-accent-foreground border-accent font-stashly inline-flex h-6 items-center gap-1.5 rounded-sm border px-1.5 text-xs"
      >
        <Icon className="size-4" />
        {mode.label}
        {keywordOnly && (
          <span className="opacity-70">· keyword only</span>
        )}
      </span>

      <span className="text-muted-foreground font-stashly hidden items-center gap-3 text-xs whitespace-nowrap lg:flex">
        <span className="inline-flex items-center gap-1.5">
          <span className="bg-primary border-primary size-2.5 rounded-xs border" />
          query term
        </span>
        {hasExpansions && (
          <span className="inline-flex items-center gap-1.5">
            <span className="border-muted-foreground w-2.5 border-b border-dotted" />
            expanded by meaning
          </span>
        )}
      </span>
    </div>
  )
}
