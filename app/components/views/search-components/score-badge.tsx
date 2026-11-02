import { cn } from '@/utils/styles'
import { scoreBand } from '@/utils/search-evidence'
import type { MatchKind } from '@/types/stash.types'

/**
 * The number means a different thing per group, so the tooltip has to say
 * which — a bare "48%" is otherwise read as one universal scale.
 *
 * Semantic results carry their true cosine similarity, which is absolute and
 * stays comparable across searches. Filename and content results carry fused
 * rank, which only ranks them against each other, so their leader always reads
 * 100%.
 */
function scoreTitle(kind?: MatchKind): string {
  return kind === 'semantic'
    ? 'How close this document is to your query by meaning. An absolute measure — a low number here means a distant match, not a lower-ranked one.'
    : 'Relevance compared with the best match for this query — the top result is always 100%.'
}

/** The score as a pill that rides the thumbnail, so it never floats free of its result. */
export function ScoreBadge({
  score,
  kind,
  className,
}: {
  score: number
  /** Which scale this score is on. See `scoreTitle`. */
  kind?: MatchKind
  className?: string
}) {
  return (
    <span
      title={`${scoreBand(score)} match. ${scoreTitle(kind)}`}
      className={cn(
        'bg-background/80 text-foreground font-stashly inline-flex h-5 items-center rounded-full px-2 text-xs tabular-nums backdrop-blur-sm',
        className
      )}
    >
      {Math.round(score)}%
    </span>
  )
}
