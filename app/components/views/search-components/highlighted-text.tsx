import { cn } from '@/utils/styles'
import { highlightSegments } from './search-helpers'

/**
 * Query terms get the accent mark; terms the engine expanded by meaning get a
 * dotted underline. Never mark an expansion as a hit — it reads as a bug.
 */
export function HighlightedText({
  text,
  terms,
  expandedTerms,
  className,
}: {
  text: string
  terms: string[]
  expandedTerms?: string[]
  className?: string
}) {
  const segments = highlightSegments(text, terms, expandedTerms)
  return (
    <span className={className}>
      {segments.map((segment, index) => {
        if (segment.kind === 'literal')
          return (
            <mark
              key={index}
              className="bg-primary text-primary-foreground -mx-px rounded-xs px-[2px]"
            >
              {segment.text}
            </mark>
          )
        if (segment.kind === 'expanded')
          return (
            <span
              key={index}
              title="Matched by meaning, not typed in the query"
              className="text-foreground decoration-muted-foreground underline decoration-dotted underline-offset-[3px]"
            >
              {segment.text}
            </span>
          )
        return <span key={index}>{segment.text}</span>
      })}
    </span>
  )
}

/**
 * A filename without its extension is hard to identify, so the middle clips
 * rather than the tail — `Stashly_Technical_Blue….pdf`, never
 * `Stashly_Technical_Blueprint.p…`.
 *
 * The base span carries 2px of slack: it is an auto-sized flex item, and
 * `font-stashly`'s letter-spacing otherwise leaves a fractional width that
 * trips `text-overflow` on names that actually fit.
 */
export function HighlightedFileName({
  name,
  terms,
  expandedTerms,
  className,
}: {
  name: string
  terms: string[]
  expandedTerms?: string[]
  className?: string
}) {
  const dot = name.lastIndexOf('.')
  const base = dot > 0 ? name.slice(0, dot) : name
  const extension = dot > 0 ? name.slice(dot) : ''

  return (
    <span
      title={name}
      className={cn('flex min-w-0 items-baseline', className)}
    >
      <span className="min-w-0 truncate pr-[2px]">
        <HighlightedText
          text={base}
          terms={terms}
          expandedTerms={expandedTerms}
        />
      </span>
      {extension && (
        <span className="shrink-0">
          <HighlightedText
            text={extension}
            terms={terms}
            expandedTerms={expandedTerms}
          />
        </span>
      )}
    </span>
  )
}
