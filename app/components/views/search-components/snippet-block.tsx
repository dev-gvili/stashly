import { cn } from '@/utils/styles'
import { HighlightedText } from './highlighted-text'
import type { EvidenceSnippet } from '@/types/stash.types'

/**
 * The evidence, welded to the card that owns it: locator and hit count on a
 * rule, then the matching text with the query marked. The header row never
 * wraps or overflows — the locator gives up width first, the hit count last. Sits concentrically
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
            // A markdown `section` locator is a whole heading and can be longer
            // than the card — it truncates so the rule and the hit count, which
            // are the parts that don't fit anywhere else, always survive.
            <span
              className="text-accent-foreground font-stashly min-w-0 truncate text-xs tracking-wider uppercase"
              title={snippet.locator}
            >
              {snippet.locator}
            </span>
          )}
          <span className="bg-border h-px min-w-3 flex-1" />
          {hitCount > 0 && (
            <span className="text-muted-foreground font-stashly shrink-0 text-xs tabular-nums">
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
