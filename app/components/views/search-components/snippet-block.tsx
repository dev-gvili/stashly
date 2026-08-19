import { cn } from '@/utils/styles'
import { HighlightedText } from './highlighted-text'
import type { EvidenceSnippet } from '@/types/stash.types'

/**
 * The evidence, welded to the card that owns it: locator and hit count on a
 * rule, then the matching text with the query marked. Sits concentrically
 * inside the card's `rounded-3xl` shell at `rounded-2xl`.
 *
 * A semantic neighbour has neither locator nor hits, so the whole header rule
 * disappears rather than rendering an empty row.
 */
export function SnippetBlock({
  snippet,
  terms,
  expandedTerms,
  hitCount = 0,
  lines = 4,
  className,
}: {
  snippet: EvidenceSnippet
  terms: string[]
  expandedTerms?: string[]
  hitCount?: number
  lines?: 2 | 3 | 4
  className?: string
}) {
  const clamp = { 2: 'line-clamp-2', 3: 'line-clamp-3', 4: 'line-clamp-4' }[lines]

  return (
    <div className={cn('bg-background flex flex-col gap-2 rounded-2xl p-3', className)}>
      {(snippet.locator || hitCount > 0) && (
        <div className="flex items-center gap-2">
          {snippet.locator && (
            <span className="text-accent-foreground font-stashly text-[11px] tracking-wider whitespace-nowrap uppercase">
              {snippet.locator}
            </span>
          )}
          <span className="bg-border h-px flex-1" />
          {hitCount > 0 && (
            <span className="text-muted-foreground font-stashly shrink-0 text-[11px] tabular-nums">
              {hitCount} {hitCount === 1 ? 'hit' : 'hits'}
            </span>
          )}
        </div>
      )}
      <p
        className={cn(
          'text-muted-foreground font-stashly m-0 text-xs leading-relaxed text-pretty',
          clamp
        )}
      >
        {snippet.truncatedStart && '… '}
        <HighlightedText
          text={snippet.text}
          terms={terms}
          expandedTerms={expandedTerms}
        />
        {snippet.truncatedEnd && ' …'}
      </p>
    </div>
  )
}
