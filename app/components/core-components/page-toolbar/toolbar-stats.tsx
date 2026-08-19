import { MinusFillIcon, DoubleCheckIcon } from '@/components/icons'
import { Checkbox } from '@/ui/checkbox'
import { useSelection } from '@/hooks/useSelection'
import { cn } from '@/utils/styles'

/**
 * Tri-state select-all control shared by every toolbar variant. Reads the
 * app-wide selection actor directly (no props), so it stays in sync with the
 * item grid and the `?selectedItems` URL param. Built on the shadcn `Checkbox`
 * (Radix), which already models `'indeterminate'` — the mixed state swaps the
 * check glyph for a minus.
 */
export function SelectAllCheckbox({
  paramName,
  className,
  checkboxClassName,
}: {
  /** URL param the selection syncs to; defaults to `selectedItems` */
  paramName?: string
  /** wrapper — use for the hover target's ground */
  className?: string
  /** the box itself — use to re-tint border/fill on a non-default surface */
  checkboxClassName?: string
}) {
  const { allSelected, someSelected, toggleAll } = useSelection()
  const state = allSelected ? 'on' : someSelected ? 'mixed' : 'off'

  return (
    <span
      className={cn(
        'inline-grid size-8 shrink-0 place-items-center rounded-md transition-colors hover:bg-accent',
        className
      )}
    >
      <Checkbox
        checked={
          state === 'on' ? true : state === 'mixed' ? 'indeterminate' : false
        }
        onCheckedChange={() => toggleAll(paramName)}
        aria-label={state === 'on' ? 'Clear selection' : 'Select all'}
        className={cn('size-5 hover:cursor-pointer', checkboxClassName)}
      >
        {state === 'off' ? null : (
          <span className="flex items-center justify-center text-current">
            {state === 'mixed' ? (
              <MinusFillIcon className="size-4" />
            ) : (
              <DoubleCheckIcon className="size-5" />
            )}
          </span>
        )}
      </Checkbox>
    </span>
  )
}
