import { useEffect, useMemo, useState } from 'react'
import { ItemCard } from '@/components/stash/item-card'
import { fileCardCheckboxClassName } from '@/components/core-components/file-card-variants/file-card-detail'
import { formatSize } from '@/utils/formaters'
import { passageLinkSearch, toEvidenceSnippet } from '@/utils/search-evidence'
import { cn } from '@/utils/styles'
import type { SearchResult, StashItem } from '@/types/stash.types'
import { ExtensionChip, PeekButton } from './evidence-parts'
import { HighlightedFileName } from './highlighted-text'
import { ScoreBadge } from './score-badge'
import { HitSnippetBlock } from './snippet-block'

/**
 * One result as a dense row, for `?layout=list`: select box, a small cover
 * carrying the score, the name with its spec line, the passage, and Peek.
 *
 * The same rules as `EvidenceCard`: no score on a name or fuzzy hit, no
 * passage on a name hit. A click anywhere else opens the item, as every
 * other card in the app does.
 */
export function EvidenceRow({
  result,
  query,
  terms,
  expandedTerms,
  onPeek,
  inspected = false,
}: {
  result: SearchResult
  query: string
  terms: string[]
  expandedTerms?: string[]
  onPeek?: () => void
  inspected?: boolean
}) {
  const { passage, score, hitCount, matchKind, ...item } = result
  // The passage on screen (the stepper moves it); the row opens the file there.
  const [shown, setShown] = useState(passage)
  useEffect(() => setShown(passage), [passage])
  const snippet = useMemo(
    () =>
      passage && matchKind !== 'name' && matchKind !== 'fuzzy'
        ? toEvidenceSnippet(passage, query)
        : null,
    [passage, query, matchKind]
  )
  const showScore = matchKind !== 'name' && matchKind !== 'fuzzy'

  return (
    <ItemCard
      {...(item as StashItem)}
      linkSearch={snippet ? passageLinkSearch(shown) : undefined}
      className={cn(
        'group border-border/50 bg-card hover:border-border flex cursor-pointer flex-col gap-4 rounded-xl border p-3 transition-colors md:flex-row md:items-center',
        inspected && 'border-primary/60 ring-primary/30 ring-1'
      )}
    >
      <div className="flex shrink-0 items-center gap-3">
        <ItemCard.Checkbox
          name="selectedItems"
          value={item.id}
          className={cn(fileCardCheckboxClassName, 'self-center')}
        />
        <div className="border-border/50 bg-muted relative h-14 w-24 shrink-0 overflow-hidden rounded-lg border">
          <ItemCard.Thumbnail className="absolute inset-0 aspect-auto h-full w-full rounded-none">
            <ItemCard.ThumbnailFallback className="rounded-none p-0" />
            <ItemCard.ThumbnailImage className="rounded-none" />
          </ItemCard.Thumbnail>
          {showScore && (
            <ScoreBadge score={score} kind={matchKind} className="absolute bottom-1 left-1 z-10" />
          )}
        </div>
      </div>

      <div className="flex min-w-0 shrink-0 flex-col gap-1 md:w-72">
        <HighlightedFileName
          name={item.name}
          terms={terms}
          expandedTerms={expandedTerms}
          className="text-foreground font-stashly text-sm font-semibold"
        />
        <div className="text-muted-foreground flex min-w-0 items-center gap-1.5">
          <ExtensionChip extension={item.file?.extension} />
          <span className="font-stashly flex min-w-0 items-center gap-1 truncate text-xs tabular-nums">
            {formatSize('byte', 'unit', item.size)} ·
            <ItemCard.Date className="truncate text-xs" />
          </span>
        </div>
      </div>

      {snippet ? (
        <HitSnippetBlock
          itemId={item.id}
          // Non-null wherever `snippet` is: it is built from this passage.
          passage={passage!}
          query={query}
          terms={terms}
          expandedTerms={expandedTerms}
          hitCount={hitCount}
          onPassage={setShown}
          lines={2}
          className="min-w-0 flex-1"
        />
      ) : (
        <div className="hidden flex-1 md:block" />
      )}
    </ItemCard>
  )
}
