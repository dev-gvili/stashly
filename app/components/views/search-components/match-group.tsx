import { cn } from '@/utils/styles'
import type { ReactNode } from 'react'
import { MATCH_KIND_LABEL, MATCH_KIND_NOTE } from './search-helpers'
import type { MatchKind } from './types'

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
  className,
}: {
  kind: MatchKind
  count: number
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('flex flex-col gap-3', className)}>
      <div className="flex items-baseline gap-3">
        <h2 className="font-stashly text-sm whitespace-nowrap uppercase">
          {MATCH_KIND_LABEL[kind]}
        </h2>
        <span className="text-muted-foreground font-stashly text-sm tabular-nums">
          {count}
        </span>
        <span className="text-muted-foreground font-stashly hidden text-sm whitespace-nowrap sm:inline">
          — {MATCH_KIND_NOTE[kind]}
        </span>
        <span className="bg-border ml-1 h-px flex-1" />
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-[repeat(auto-fill,minmax(16rem,1fr))]">
        {children}
      </div>
    </section>
  )
}
