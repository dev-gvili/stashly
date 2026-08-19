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
 * folder hit is a filename hit with nothing to quote.
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

  const snippet = useMemo(
    () => (passage ? toEvidenceSnippet(passage, query) : null),
    [passage, query]
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
        <ScoreBadge
          score={score}
          kind={matchKind}
          className="absolute bottom-2 left-2 z-20 rounded bg-primary text-primary-foreground font-stashly text-sm font-semibold"
        />
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
