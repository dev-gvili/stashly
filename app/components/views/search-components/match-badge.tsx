import { cn } from '@/utils/styles'
import { MATCH_KIND_LABEL, MATCH_KIND_NOTE } from '@/utils/search-evidence'
import type { MatchKind } from '@/types/stash.types'

/** Filename hits are the strongest evidence, so only they take the accent. */
export function MatchBadge({
  kind,
  className,
}: {
  kind: MatchKind
  className?: string
}) {
  return (
    <span
      title={MATCH_KIND_NOTE[kind]}
      className={cn(
        'font-stashly inline-flex h-4 items-center rounded-[3px] px-1.5 text-xs tracking-wider uppercase',
        kind === 'name'
          ? 'bg-accent text-accent-foreground'
          : 'bg-background text-muted-foreground',
        className
      )}
    >
      {MATCH_KIND_LABEL[kind]}
    </span>
  )
}
