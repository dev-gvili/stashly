import { cn } from '@/utils/styles'
import type { ReactNode } from 'react'
import { MATCH_KIND_LABEL, MATCH_KIND_NOTE } from '@/utils/search-evidence'
import type { MatchKind } from '@/types/stash.types'

/**
 * Results grouped by *why* they matched. The heading answers the question the
 * old page left open — a 9% semantic neighbour and a filename hit are not the
 * same kind of answer and should not sit in one undifferentiated grid.
 *
 * The grid geometry matches `GridLayout`, so switching between a folder page
 * and a search page doesn't reflow the cards under the reader.
 */
export function MatchGroup({
  kind,
  count,
  children,
  layout = 'grid',
  className,
}: {
  kind: MatchKind
  count: number
  children: ReactNode
  /** `list` stacks rows (`?layout=list`); `grid` lays out cards. */
  layout?: 'grid' | 'list'
  className?: string
}) {
  // Semantic neighbours carry no literal hit, so their heading takes the
  // accent: it marks a different kind of answer, not a lesser one.
  const semantic = kind === 'semantic'
  return (
    <section className={cn('flex flex-col gap-3.5', className)}>
      <div className="flex items-center gap-2.5">
        <h2
          className={cn(
            'font-stashly text-xs font-semibold tracking-wider whitespace-nowrap uppercase',
            semantic ? 'text-primary' : 'text-foreground'
          )}
        >
          {MATCH_KIND_LABEL[kind]}
        </h2>
        <span
          className={cn(
            'font-stashly inline-flex h-5 items-center rounded-lg px-1.5 text-xs tabular-nums',
            semantic ? 'border-primary/30 bg-primary/15 text-foreground border' : 'bg-muted text-foreground'
          )}
        >
          {count}
        </span>
        <span className="text-muted-foreground font-stashly hidden truncate text-xs sm:inline">
          — {MATCH_KIND_NOTE[kind]}
        </span>
      </div>
      <div
        className={
          layout === 'list'
            ? 'flex flex-col gap-2.5'
            : 'grid gap-4 grid-cols-[repeat(auto-fill,minmax(20rem,1fr))] grid-rows-[repeat(auto-fill,minmax(10rem,1fr))]'
        }
      >
        {children}
      </div>
    </section>
  )
}
