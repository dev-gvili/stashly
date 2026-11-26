import { PreviewIcon } from '@/components/icons'
import { cn } from '@/utils/styles'

/**
 * The file's extension as a small chip (`PDF`, `MD`). Shared by the grid card,
 * the list row and the inspector. Renders nothing for a file with none.
 */
export function ExtensionChip({
  extension,
  className,
}: {
  extension: string | null | undefined
  className?: string
}) {
  if (!extension) return null
  return (
    <span
      className={cn(
        'bg-muted text-foreground font-stashly inline-flex h-5 shrink-0 items-center rounded-lg px-1.5 text-xs uppercase',
        className
      )}
    >
      {extension}
    </span>
  )
}

/**
 * Opens the result in the inspector. Stops the click so the card around it,
 * which opens the item page, doesn't fire as well.
 */
export function PeekButton({
  onPeek,
  className,
}: {
  onPeek: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onPeek()
      }}
      onMouseDown={(e) => e.stopPropagation()}
      className={cn(
        'border-input bg-background/80 text-foreground font-stashly hover:bg-background inline-flex h-6 shrink-0 cursor-pointer items-center gap-1 rounded-lg border px-2 text-xs backdrop-blur-sm transition-colors duration-200',
        className
      )}
    >
      <PreviewIcon className="size-3.5" />
      Peek
    </button>
  )
}
