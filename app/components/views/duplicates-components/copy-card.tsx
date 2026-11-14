import { FolderIcon } from '@/components/icons'
import { Checkbox } from '@/ui/checkbox'
import { formatSize } from '@/utils/formaters'
import { cn } from '@/utils/styles'
import type { DuplicateCopy } from './types'

/**
 * One copy, as a selection target.
 *
 * This card is deliberately NOT an `ItemCard`: here the card's whole job is to
 * be picked, so the root element is a toggle button and must not also navigate.
 * It keeps ItemCard's anatomy — filled `rounded-2xl` shell, `rounded-xl`
 * thumbnail, 13px semibold name, 11px muted meta — so the two read as one
 * family. Copies that are leaving are desaturated and dimmed rather than
 * hidden, so the comparison stays visible.
 */
export function DuplicateCopyCard({
  copy,
  isKept,
  onToggle,
  className,
}: {
  copy: DuplicateCopy
  isKept: boolean
  onToggle: (itemId: string) => void
  className?: string
}) {
  const { item } = copy
  // Same idiom as `ItemCard`: a `#`-prefixed url is a placeholder, not an image.
  const thumbnailUrl =
    item.thumbnails?.find((t) => t.url && !t.url.startsWith('#'))?.url ?? null

  return (
    <button
      type="button"
      aria-pressed={isKept}
      onClick={() => onToggle(item.id)}
      className={cn(
        'flex flex-col gap-3 rounded-2xl border p-3 text-left transition-colors',
        isKept
          ? 'border-primary bg-primary/10'
          : 'border-input bg-card opacity-60 hover:opacity-100',
        className
      )}
    >
      <span className="flex items-center gap-2">
        <Checkbox
          checked={isKept}
          tabIndex={-1}
          aria-hidden="true"
          className="pointer-events-none"
        />
        <span className="text-muted-foreground font-stashly text-xs tracking-[0.14em] whitespace-nowrap uppercase">
          {isKept ? 'Keeping' : 'Delete'}
        </span>
      </span>

      <span
        className={cn(
          'bg-muted h-33 w-full overflow-hidden rounded-xl',
          !isKept && 'grayscale'
        )}
      >
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt=""
            loading="lazy"
            className="size-full object-cover"
          />
        ) : (
          <span className="text-muted-foreground font-stashly grid size-full place-items-center text-lg uppercase">
            {item.extension ?? 'file'}
          </span>
        )}
      </span>

      <span className="flex flex-col gap-1">
        <span className="font-stashly text-sm font-semibold break-all">
          {item.name}
        </span>
        <span className="text-muted-foreground font-stashly flex items-center gap-1.5 text-xs">
          <FolderIcon className="size-3.5 shrink-0" />
          <span className="truncate">{copy.folderPath}</span>
        </span>
        <span className="text-muted-foreground font-stashly text-xs tabular-nums">
          {formatSize('byte', 'unit', item.size)}
        </span>
        <span className="text-muted-foreground font-stashly text-xs tabular-nums">
          added{' '}
          {new Date(copy.addedAt).toLocaleDateString(undefined, {
            month: 'short',
            day: '2-digit',
            year: 'numeric',
          })}
        </span>
      </span>
    </button>
  )
}
