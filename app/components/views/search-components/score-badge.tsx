import { cn } from '@/utils/styles'
import { scoreBand, type ScoreBand } from '@/utils/search-evidence'
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

/**
 * Tone per band: a strong match is solid primary, a related one a primary
 * tint, a distant one stays quiet. Literal classes so Tailwind compiles them.
 */
const SCORE_BAND_TONE: Record<ScoreBand, string> = {
  strong: 'bg-primary text-primary-foreground',
  related: 'border border-primary/40 bg-primary/15 text-foreground backdrop-blur-sm',
  distant: 'border border-input bg-background/80 text-muted-foreground backdrop-blur-sm',
}

/** The score as a chip that rides the thumbnail, so it never floats free of its result. */
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
        // 20px tall, so a 4px corner (owner's rule: no pills).
        'font-stashly inline-flex h-5 items-center rounded-[4px] px-1.5 text-xs font-semibold tabular-nums bg-primary text-primary-foreground',
        className
      )}
    >
      {Math.round(score)}%
    </span>
  )
}
