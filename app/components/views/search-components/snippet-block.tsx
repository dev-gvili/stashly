import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { DropdownIcon, LoaderIcon } from '@/components/icons'
import { useHitPassages } from '@/hooks/useHitPassages'
import { toEvidenceSnippet, toHitStops } from '@/utils/search-evidence'
import { cn } from '@/utils/styles'
import { HighlightedText } from './highlighted-text'
import type { EvidenceSnippet, SearchPassage } from '@/types/stash.types'
import { ButtonGroup } from '@/components/ui'

/**
 * The evidence, welded to the card that owns it: locator and hit count on one
 * row, then the matching text with the query marked. The header row never
 * wraps or overflows — the locator gives up width first, the hit count last. Sits concentrically
 * inside the card's `rounded-3xl` shell at `rounded-2xl`.
 *
 * A semantic neighbour has neither locator nor hits, so the whole header row
 * disappears rather than rendering an empty row.
 */
export function SnippetBlock({
  snippet,
  terms,
  expandedTerms,
  hitCount = 0,
  hitLabel,
  stepper,
  lines = 4,
  textClassName,
  className,
}: {
  /** Extra classes on the passage text, e.g. a container-query line count. */
  textClassName?: string
  snippet: EvidenceSnippet
  terms: string[]
  expandedTerms?: string[]
  hitCount?: number
  /** Replaces the "N hits" text (the stepper's "2/10 hits"). */
  hitLabel?: string
  /** Controls after the hit count: the previous/next hit arrows. */
  stepper?: ReactNode
  /** Lines before the passage clips; `'all'` shows it whole (the inspector). */
  lines?: 2 | 3 | 4 | 5 | 'all'
  className?: string
}) {
  // A fixed height as well as the clamp: stepping through hits swaps excerpts
  // of different lengths, and a box that followed them shifted the grid.
  const clamp = {
    2: 'line-clamp-2 h-[2lh]',
    3: 'line-clamp-3 h-[3lh]',
    4: 'line-clamp-4 h-[4lh]',
    5: 'line-clamp-5 h-[5lh]',
    all: '',
  }[lines]

  return (
    <div
      className={cn(
        // A size container, so the text's line count can follow the box's own width.
        'bg-background border-input @container/snippet flex flex-col gap-2 rounded-xl border p-3',
        className
      )}
    >
      {(snippet.locator || hitCount > 0) && (
        <div className="flex items-center gap-2">
          {snippet.locator && (
            // A markdown `section` locator is a whole heading and can be longer
            // than the card — it truncates so the hit count, which has nowhere
            // else to go, always survives.
            <span
              className="text-muted-foreground font-stashly min-w-0 truncate text-xs font-semibold tracking-wider uppercase"
              title={snippet.locator}
            >
              {snippet.locator}
            </span>
          )}
          {hitCount > 0 && (
            <span className="text-primary font-stashly ml-auto shrink-0 text-xs tabular-nums">
              {hitLabel ?? `${hitCount} ${hitCount === 1 ? 'hit' : 'hits'}`}
            </span>
          )}
          {stepper}
        </div>
      )}
      <p
        className={cn(
          'text-muted-foreground font-stashly m-0 text-xs leading-relaxed text-pretty',
          clamp,
          textClassName
        )}
      >
        {snippet.truncatedStart && '… '}
        <HighlightedText
          text={snippet.text}
          terms={terms}
          expandedTerms={expandedTerms}
          markClassName="border-primary/40 bg-primary/20 text-foreground rounded-[4px] border px-1 font-semibold"
        />
        {snippet.truncatedEnd && ' …'}
      </p>
    </div>
  )
}

/** One arrow of the hit stepper. Stops the click so the card doesn't open. */
function StepButton({
  direction,
  onStep,
  busy,
}: {
  direction: -1 | 1
  onStep: () => void
  busy: boolean
}) {
  return (
    <button
      type="button"
      aria-label={direction === 1 ? 'Next hit' : 'Previous hit'}
      onClick={(e) => {
        e.stopPropagation()
        onStep()
      }}
      onMouseDown={(e) => e.stopPropagation()}
      className="bg-muted text-foreground hover:bg-accent flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-xs transition-colors duration-200"
    >
      {busy ? (
        <LoaderIcon className="size-3 animate-spin" />
      ) : (
        // A single chevron: the down-pointing dropdown glyph turned sideways.
        <DropdownIcon
          className={cn(direction === 1 ? '-rotate-90' : 'rotate-90')}
        />
      )}
    </button>
  )
}

/**
 * `SnippetBlock` with a hit stepper: "‹ 2/10 hits ›" walks the passage around
 * each literal hit in the document.
 *
 * The first passage comes with the result. The rest load on the first arrow
 * click (`useHitPassages`), so a page of results costs nothing extra. Once
 * loaded the count is the passages found, which can be a little under the
 * server's hit count when two query terms start at the same place.
 * Both count only hits that start a word.
 */
export function HitSnippetBlock({
  itemId,
  passage,
  query,
  terms,
  expandedTerms,
  hitCount,
  lines,
  textClassName,
  className,
  onPassage,
}: {
  itemId: string
  textClassName?: string
  /** Told which hit's passage is on screen, so a link can open the file there. */
  onPassage?: (passage: SearchPassage) => void
  /** The passage the result arrived with, shown until another hit is chosen. */
  passage: SearchPassage
  query: string
  terms: string[]
  expandedTerms?: string[]
  hitCount: number
  lines?: 2 | 3 | 4 | 5 | 'all'
  className?: string
}) {
  const hits = useHitPassages(itemId, query)
  const [index, setIndex] = useState(0)
  // A click before the passages arrive is remembered and applied on arrival.
  const pending = useRef<-1 | 1 | 0>(0)

  // Hits close together cut the same excerpt; they become one stop, labelled
  // with the hits it covers ("3–4/8 hits").
  const stops = useMemo(
    () => (hits.passages ? toHitStops(hits.passages, query) : null),
    [hits.passages, query]
  )
  // The server's total, not the passages it sent: those stop at 50, and a
  // card that said "1/120 hits" must not drop to "/50" on the first click.
  const count = hits.total ?? hitCount
  useEffect(() => {
    if (!stops?.length || !pending.current) return
    const step = pending.current
    pending.current = 0
    setIndex((i) => (i + step + stops.length) % stops.length)
  }, [stops])

  const step = (direction: -1 | 1) => {
    if (stops?.length) {
      setIndex((i) => (i + direction + stops.length) % stops.length)
      return
    }
    pending.current = direction
    hits.load()
  }

  const first = useMemo(
    () => toEvidenceSnippet(passage, query),
    [passage, query]
  )
  const stop = stops?.[index]
  const snippet = stop?.snippet ?? first
  // The card's link follows the stop on screen: it opens the file at this hit.
  const shown = stop?.passage ?? passage
  useEffect(() => onPassage?.(shown), [shown, onPassage])
  const position = stop
    ? stop.from === stop.to
      ? `${stop.from}`
      : `${stop.from}–${stop.to}`
    : '1'

  return (
    <SnippetBlock
      snippet={snippet}
      terms={terms}
      expandedTerms={expandedTerms}
      hitCount={count}
      hitLabel={count > 1 ? `${position}/${count} hits` : undefined}
      stepper={
        count > 1 && !hits.failed && (stops?.length ?? 2) > 1 ? (
          <ButtonGroup className="shrink-0 rounded-[6px] overflow-hidden ">
            <StepButton
              direction={-1}
              onStep={() => step(-1)}
              busy={hits.loading && pending.current === -1}
            />
            <StepButton
              direction={1}
              onStep={() => step(1)}
              busy={hits.loading && pending.current === 1}
            />
          </ButtonGroup>
        ) : undefined
      }
      lines={lines}
      textClassName={textClassName}
      className={className}
    />
  )
}
