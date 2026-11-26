import { Badge } from '@/ui/badge'
import { cn } from '@/utils/styles'
import type { SearchQueryState } from '@/types/stash.types'

/**
 * Count, the query, what the engine actually ran, and a legend for the two
 * highlight tiers — so a dotted expansion never looks like a false positive.
 *
 * The engine badge names what ran, not what was asked for: semantic can be
 * requested and still not run (no embedded chunks, no WebGPU), and then the
 * results are trigram matches only. A folder or collection scope swaps the
 * HNSW walk for an exact scan of its chunks (see `stashly-search`).
 */
export function ResultsSummary({
  state,
  totalCount,
  semanticRan,
  scoped = false,
  indexedPassages,
  className,
}: {
  state: SearchQueryState
  totalCount: number
  /** Whether the dense half actually contributed. */
  semanticRan?: boolean
  /** The search is limited to a folder or collection (`?in=`). */
  scoped?: boolean
  /** Passages with a stored vector, from the live index stats. */
  indexedPassages?: number
  className?: string
}) {
  const dense = state.mode === 'semantic' && semanticRan !== false
  const keywordOnly = state.mode === 'semantic' && semanticRan === false
  const hasExpansions = (state.expandedTerms?.length ?? 0) > 0

  return (
    <div className={cn('flex flex-wrap items-center gap-x-3 gap-y-2', className)}>
      <span className="font-stashly flex items-baseline gap-2 text-sm">
        <span className="text-foreground font-semibold tabular-nums">
          {totalCount.toLocaleString()}
        </span>
        <span className="text-muted-foreground">
          top {totalCount === 1 ? 'match' : 'matches'}
        </span>
        {indexedPassages != null && (
          <span className="text-muted-foreground/70 text-xs tabular-nums">
            ({indexedPassages.toLocaleString()} passages indexed)
          </span>
        )}
        <span className="text-muted-foreground">for</span>
      </span>
      <span className="bg-primary text-primary-foreground font-stashly inline-flex h-6 max-w-64 items-center truncate rounded-[4px] px-2 text-xs">
        {state.query}
      </span>

      {/* 4px corner on the owner's request (25 Nov), squarer than the default Badge. */}
      <Badge
        title={keywordOnly ? 'Meaning was asked for but did not run' : undefined}
        className="rounded-[4px]"
      >
        <span
          aria-hidden
          className={cn('size-2 rounded-[2px]', dense ? 'bg-emerald-500' : 'bg-muted-foreground')}
        />
        {dense ? `768-dim ${scoped ? 'exact scan' : 'HNSW'} + Trigram` : 'Trigram only'}
        {keywordOnly && <span className="opacity-70">· meaning skipped</span>}
      </Badge>

      <span className="text-muted-foreground font-stashly ml-auto hidden items-center gap-4 text-xs whitespace-nowrap lg:flex">
        <span className="inline-flex items-center gap-1.5">
          <span className="bg-primary/30 border-primary/50 size-2.5 rounded-[2px] border" />
          Exact query hit
        </span>
        {hasExpansions && (
          <span className="inline-flex items-center gap-1.5">
            <span className="border-primary w-3 border-b border-dashed" />
            Expanded by meaning
          </span>
        )}
      </span>
    </div>
  )
}
