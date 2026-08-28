import { cn } from '@/utils/styles'
import { DuplicateCopyCard } from './copy-card'
import { ResolveRuleBar } from './resolve-rule-bar'
import { TriageFooter } from './triage-footer'
import { TriageGroupHeader } from './triage-group-header'
import type { DuplicateTriageViewProps } from './types'
import { useDuplicateTriage } from './use-duplicate-triage'

/**
 * One column per copy. Literal class names, not an interpolated template or a
 * style prop — Tailwind only compiles classes it can see in source, and an
 * inline width would not respond to the breakpoints.
 */
const COPY_COLUMNS: Record<number, string> = {
  2: 'lg:grid-cols-2',
  3: 'lg:grid-cols-3',
  4: 'lg:grid-cols-4',
  5: 'lg:grid-cols-5',
  6: 'lg:grid-cols-6',
}
/** Beyond six copies the row stops being a comparison, so it wraps instead. */
const COPY_COLUMNS_MANY = 'lg:grid-cols-4 xl:grid-cols-6'

/**
 * Resolve duplicates, one group at a time.
 *
 * The whole screen is a single decision: a rule preselects the copy worth
 * keeping, every copy in the group is shown side by side at the same size so
 * the comparison is honest, and the commit bar says what will be kept. Nothing
 * is deleted here — copies go to Trash, and "previous group" un-queues the
 * decision it made.
 *
 * Column count follows the group: three copies get three columns, five get
 * five, so a group never re-flows into a shape that hides a copy below the fold.
 */
export function DuplicateTriageView({
  groups,
  initialRule,
  onResolveGroup,
  onFinish,
  className,
}: DuplicateTriageViewProps) {
  const triage = useDuplicateTriage({
    groups,
    initialRule,
    onResolveGroup,
    onFinish,
  })
  const { group } = triage

  if (!group) {
    return (
      <div
        className={cn(
          'flex min-h-full flex-col items-center justify-center gap-2 px-8 py-24 text-center',
          className
        )}
      >
        <p className="font-stashly m-0 text-sm">No duplicates to resolve</p>
        <p className="text-muted-foreground font-stashly m-0 max-w-[46ch] text-xs leading-relaxed">
          Stashly flags files that share a name and an exact size. When two
          copies of the same file appear, this is where they show up.
        </p>
      </div>
    )
  }

  return (
    <div className={cn('flex min-h-full flex-col', className)}>
      <div className="mx-auto w-full max-w-[1080px] flex-1 px-8 pt-7 pb-28">
        <ResolveRuleBar rule={triage.rule} onRuleChange={triage.setRule} />
        <TriageGroupHeader group={group} selectedCount={triage.selectedCount} />

        <div
          className={cn(
            'grid grid-cols-1 gap-4 sm:grid-cols-2',
            COPY_COLUMNS[group.copies.length] ?? COPY_COLUMNS_MANY
          )}
        >
          {group.copies.map((copy) => (
            <DuplicateCopyCard
              key={copy.item.id}
              copy={copy}
              isKept={triage.isKept(copy.item.id)}
              onToggle={triage.toggleKeep}
            />
          ))}
        </div>
      </div>

      <TriageFooter
        selectedCount={triage.selectedCount}
        reclaimedBytes={triage.reclaimedBytes}
        canGoBack={triage.canGoBack}
        onKeep={triage.keepSelection}
        onNext={triage.nextGroup}
        onPrevious={triage.previousGroup}
      />
    </div>
  )
}
