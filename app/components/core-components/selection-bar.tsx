import { RemoveIcon } from '@/components/icons'
import { Button } from '@/ui/button'
import { Tooltip } from '@/ui/tooltip'

interface SelectionBarProps {
  count: number
  allSelected: boolean
  onToggleAll: () => void
  onClear: () => void
  onRemove: () => void
}

/**
 * Bulk-action bar that swaps in for the toolbar at the same height
 * (`min-h-11`), so the content below doesn't jump.
 *
 * @example
 * <SelectionBar count={3} allSelected={false} onToggleAll={…} onClear={…} onRemove={…} />
 */
export function SelectionBar({
  count,
  allSelected,
  onToggleAll,
  onClear,
  onRemove,
}: SelectionBarProps) {
  return (
    <div
      role="toolbar"
      aria-label="Selection actions"
      className="flex min-h-11 flex-wrap items-center gap-2.5 rounded-xl border border-primary/40 bg-primary/15 py-1.25 pr-1.5 pl-3.5"
    >
      <span className="font-stashly text-sm font-medium">
        {count} {count === 1 ? 'file' : 'files'} selected
      </span>
      <Button
        variant="link"
        className="font-stashly h-auto p-0"
        onClick={onToggleAll}
      >
        {allSelected ? 'Deselect all' : 'Select all'}
      </Button>
      <div className="flex-1" />
      <Button
        variant="outline"
        size="sm"
        className="font-stashly hover:border-destructive hover:text-destructive"
        onClick={onRemove}
      >
        <RemoveIcon className="size-4" />
        Remove from collection
      </Button>
      <Tooltip content="Clear selection">
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label="Clear selection"
          onClick={onClear}
        >
          <RemoveIcon className="size-4" />
        </Button>
      </Tooltip>
    </div>
  )
}
