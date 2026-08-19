import { useMemo, type ReactNode } from 'react'
import { FileCardDetail } from '@/components/core-components/file-card-variants'
import { FolderCardTab } from '@/components/views/folder-card-components/folder-card-tab'
import { cn } from '@/utils/styles'
import type { StashItem } from '@/types/stash.types'
import { HighlightedFileName } from './highlighted-text'
import { MatchBadge } from './match-badge'
import { ScoreBadge } from './score-badge'
import { SnippetBlock } from './snippet-block'
import { toEvidenceSnippet } from '@/utils/search-evidence'
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
}: {
  result: SearchResult
  /** Raw query — needed to window the passage, which terms alone can't do. */
  query: string
  terms: string[]
  expandedTerms?: string[]
  className?: string
  /** Extra entries for the card's actions menu. */
  actions?: ReactNode
}) {
  const { passage, score, hitCount, matchKind, ...item } = result

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
      className={cn('gap-2 bg-card', className)}
      overlay={
        // No score on a name hit: the ranking that produced it is a string
        // match on the name, so a relevance percentage says nothing the
        // highlighted name doesn't already say. None on a `fuzzy` hit either —
        // that number is fused rank, not a similarity, so it would read as a
        // confidence the server never measured.
        matchKind === 'name' || matchKind === 'fuzzy' ? undefined : (
          <ScoreBadge
            score={score}
            kind={matchKind}
            className="absolute bottom-2 left-2 z-20 rounded bg-primary text-primary-foreground font-stashly text-sm font-semibold"
          />
        )
      }
      name={
        <HighlightedFileName
          name={item.name}
          terms={terms}
          expandedTerms={expandedTerms}
          className="text-foreground font-stashly text-sm font-semibold"
        />
      }
      meta={<MatchBadge kind={matchKind} className="ml-auto shrink-0" />}
    >
      {snippet && (
        <SnippetBlock
          snippet={snippet}
          terms={terms}
          expandedTerms={expandedTerms}
          hitCount={hitCount}
        />
      )}
    </FileCardDetail>
  )
}

/** Placeholder with the same anatomy, so the grid does not reflow when results land. */
export function EvidenceCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('bg-muted flex flex-col gap-2 rounded-3xl p-2', className)}>
      <div className="bg-card aspect-4/3 w-full animate-pulse rounded-2xl" />
      <div className="flex flex-col gap-2 px-1 pt-1">
        <div className="bg-card h-3.5 w-2/3 animate-pulse rounded-full" />
        <div className="bg-card h-3 w-1/3 animate-pulse rounded-full" />
      </div>
      <div className="bg-background h-20 animate-pulse rounded-2xl" />
    </div>
  )
}
