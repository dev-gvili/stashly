import { CheckIcon, UndoIcon } from '@/components/icons'
import { Button } from '@/ui/button'
import { formatSize } from '@/utils/formaters'
import { cn } from '@/utils/styles'

/**
 * Sticky commit bar. The primary action states what will be kept, never a bare
 * "delete" — and the safety note is permanent, because a destructive action
 * needs to say where the files go before it is taken, not after.
 *
 * The note says "restore any time" rather than the handoff's "30 days": Stashly
 * has no timed trash purge (`trashItems` only flips `status`, and the only way
 * out is a manual `emptyUserBucket`), so a retention promise here would be a
 * claim the backend does not keep. Change this string only alongside a real
 * retention job.
 */
export function TriageFooter({
  selectedCount,
  reclaimedBytes,
  canGoBack,
  onKeep,
  onNext,
  onPrevious,
  className,
}: {
  selectedCount: number
  reclaimedBytes: number
  canGoBack: boolean
  onKeep: () => void
  onNext: () => void
  onPrevious: () => void
  className?: string
}) {
  return (
    <div
      className={cn(
        'bg-background/95 border-input sticky bottom-0 z-20 border-t backdrop-blur',
        className
      )}
    >
      <div className="mx-auto flex w-full max-w-[1080px] flex-wrap items-center gap-4 px-8 py-3.5">
        <Button
          onClick={onKeep}
          className="font-stashly h-11 gap-2 px-5 text-[13px] tracking-[0.12em] uppercase"
        >
          <CheckIcon className="size-4" />
          Keep {selectedCount}
        </Button>
        <Button
          variant="outline"
          onClick={onNext}
          className="font-stashly h-11 px-5 text-[13px] tracking-[0.12em] uppercase"
        >
          Next group
        </Button>
        <Button
          variant="ghost"
          onClick={onPrevious}
          disabled={!canGoBack}
          className="font-stashly text-muted-foreground hover:text-foreground h-11 gap-2 px-5 text-[13px] tracking-[0.12em] uppercase"
        >
          <UndoIcon className="size-4" />
          Previous group
        </Button>
        <span className="text-muted-foreground font-stashly ml-auto inline-flex items-center gap-1.5 text-xs whitespace-nowrap">
          <UndoIcon className="size-3.5" />
          Deleted copies go to Trash — restore any time
        </span>
        <span className="text-muted-foreground font-stashly text-xs tabular-nums whitespace-nowrap">
          {formatSize('byte', 'unit', reclaimedBytes)} reclaimed
        </span>
      </div>
    </div>
  )
}
