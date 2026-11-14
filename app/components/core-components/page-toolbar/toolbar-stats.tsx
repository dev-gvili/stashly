import { MinusFillIcon, DoubleCheckIcon } from '@/components/icons'
import { Checkbox } from '@/ui/checkbox'
import { selectionActor, useSelection } from '@/hooks/useSelection'
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
  ids,
  label,
}: {
  /** URL param the selection syncs to; defaults to `selectedItems` */
  paramName?: string
  /** wrapper — use for the hover target's ground */
  className?: string
  /** the box itself — use to re-tint border/fill on a non-default surface */
  checkboxClassName?: string
  /**
   * Limit the box to these ids (e.g. one date group) instead of the whole
   * page: it reflects and toggles only them, leaving other selections alone.
   */
  ids?: string[]
  /** Names the subset in the label: "Select {label}" / "Deselect {label}". */
  label?: string
}) {
  const { allSelected, someSelected, toggleAll, selectedIds } = useSelection()
  const subsetCount = ids ? ids.filter((id) => selectedIds.includes(id)).length : 0
  const state = ids
    ? ids.length > 0 && subsetCount === ids.length
      ? 'on'
      : subsetCount > 0
        ? 'mixed'
        : 'off'
    : allSelected
      ? 'on'
      : someSelected
        ? 'mixed'
        : 'off'

  const toggle = () => {
    if (!ids) return toggleAll(paramName)
    const param = paramName ?? 'selectedItems'
    const current = selectionActor.getSnapshot().context.selectedIds ?? []
    const next =
      state === 'on'
        ? current.filter((id) => !ids.includes(id))
        : Array.from(new Set([...current, ...ids]))
    selectionActor.send({ type: 'SET_SELECTED', selected: next, paramName: param })
  }

  const ariaLabel = label
    ? `${state === 'on' ? 'Deselect' : 'Select'} ${label}`
    : state === 'on'
      ? 'Clear selection'
      : 'Select all'

  return (
    <span
      className={cn(
        'inline-grid size-9 shrink-0 place-items-center rounded-md bg-card! border-none ring-2 ring-accent ',
        className
      )}
    >
      <Checkbox
        checked={
          state === 'on' ? true : state === 'mixed' ? 'indeterminate' : false
        }
        onCheckedChange={toggle}
        aria-label={ariaLabel}
        className={cn('border-none', checkboxClassName)}
      >
        {state === 'off' ? null : (
          <span className="flex items-center justify-center text-current">
            {state === 'mixed' ? (
              <MinusFillIcon className="size-5" />
            ) : (
              <DoubleCheckIcon className="size-5 text-current" />
            )}
          </span>
        )}
      </Checkbox>
    </span>
  )
}
