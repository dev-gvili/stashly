import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { FileCardDetail } from '@/components/core-components/file-card-variants'
import { FolderCardTab } from '@/components/views/folder-card-components/folder-card-tab'
import { cn } from '@/utils/styles'
import type { StashItem } from '@/types/stash.types'
import { HighlightedFileName } from './highlighted-text'
import { ExtensionChip, PeekButton } from './evidence-parts'
import { ScoreBadge } from './score-badge'
import { HitSnippetBlock } from './snippet-block'
import { passageLinkSearch, toEvidenceSnippet } from '@/utils/search-evidence'
import type { SearchResult } from '@/types/stash.types'

/**
 * One result, one card.
 *
 * This is `FileCardDetail` — the same card the rest of the app uses — with its
 * slots filled: the score rides the hero it scores, the name highlights and
 * middle-clips, and the matching passage is welded on as a third concentric
 * block. The previous page split those across two unrelated rows, so a snippet
 * in column 5 could belong to a file that had already scrolled away.
 *
 * Folders keep `FolderCardTab` untouched: a folder has no indexed body, so a
 * folder hit is a filename hit with nothing to quote. Filename hits on files are
 * quiet for the same reason: the evidence is the highlighted name, not a passage.
 */
export function EvidenceCard({
  result,
  query,
  terms,
  expandedTerms,
  className,
  actions,
  onPeek,
  inspected = false,
}: {
  result: SearchResult
  /** Raw query — needed to window the passage, which terms alone can't do. */
  query: string
  terms: string[]
  expandedTerms?: string[]
  className?: string
  /** Extra entries for the card's actions menu. */
  actions?: ReactNode
  /** Opens this result in the inspector; omitted, the card has no Peek. */
  onPeek?: () => void
  /** This result is the one open in the inspector. */
  inspected?: boolean
}) {
  const { passage, score, hitCount, matchKind, ...item } = result
  // The passage on screen (the stepper moves it); the card opens the file there.
  const [shown, setShown] = useState(passage)
  useEffect(() => setShown(passage), [passage])

  // A filename hit is fully explained by the highlighted name above it. Quoting
  // a passage there implies the body is what matched, which it isn't — the body
  // hits, if any, are what the `content` group is for. A `fuzzy` hit carries no
  // passage at all (that absence is what identifies it server-side), so the
  // guard is belt-and-braces there.
  const snippet = useMemo(
    () =>
      passage && matchKind !== 'name' && matchKind !== 'fuzzy'
        ? toEvidenceSnippet(passage, query)
        : null,
    [passage, query, matchKind]
  )

  if (item.type === 'folder') {
    return <FolderCardTab {...(item as StashItem)} />
  }

  return (
    <FileCardDetail
      item={item as StashItem}
      actions={actions}
      className={cn('bg-card', inspected && 'border-primary/60 ring-1 ring-primary/30', className)}
      overlay={
        <div className="absolute inset-x-2.5 bottom-2 z-20 flex items-center gap-2">
          {/* No score on a name hit: the ranking that produced it is a string
              match on the name, so a relevance percentage says nothing the
              highlighted name doesn't already say. None on a `fuzzy` hit
              either — that number is fused rank, not a similarity, so it would
              read as a confidence the server never measured. */}
          {matchKind !== 'name' && matchKind !== 'fuzzy' && (
            <ScoreBadge score={score} kind={matchKind} />
          )}
        </div>
      }
      name={
        <HighlightedFileName
          name={item.name}
          terms={terms}
          expandedTerms={expandedTerms}
          className="text-foreground font-stashly text-sm font-semibold"
        />
      }
      leading={<ExtensionChip extension={item.file?.extension} />}
      coverClassName="aspect-16/10"
      // Only a quoted passage has a hit to land on; a name match opens as before.
      linkSearch={snippet ? passageLinkSearch(shown) : undefined}
    >
      {snippet && (
        <HitSnippetBlock
          itemId={item.id}
          // Non-null wherever `snippet` is: it is built from this passage.
          passage={passage!}
          query={query}
          terms={terms}
          expandedTerms={expandedTerms}
          hitCount={hitCount}
          onPassage={setShown}
          // Three lines, fixed: the box keeps its size while the stepper swaps
          // excerpts of different lengths (owner, 26 Nov). The excerpt is
          // capped at 128 characters (`SENTENCE_SNIPPET_MAX_LENGTH`) to fit;
          // where the text is under 20rem wide that takes four lines (owner,
          // 26 Nov). A container query measures the box inside its padding.
          lines={3}
          textClassName="@max-[20rem]/snippet:line-clamp-4 @max-[20rem]/snippet:h-[4lh]"
          className="mx-3.5 mt-2 mb-3.5 flex-1 gap-2.5 p-4"
        />
      )}
    </FileCardDetail>
  )
}

/** Placeholder with the same anatomy, so the grid does not reflow when results land. */
export function EvidenceCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'border-border/50 bg-card flex flex-col overflow-hidden rounded-2xl border',
        className
      )}
    >
      <div className="bg-muted aspect-16/10 w-full animate-pulse" />
      <div className="flex flex-col gap-2 px-3.5 pt-3 pb-3.5">
        <div className="bg-muted h-3.5 w-2/3 animate-pulse rounded-[4px]" />
        <div className="bg-muted h-3 w-1/3 animate-pulse rounded-[4px]" />
      </div>
      <div className="bg-muted mx-3.5 mb-3.5 h-20 animate-pulse rounded-xl" />
    </div>
  )
}
