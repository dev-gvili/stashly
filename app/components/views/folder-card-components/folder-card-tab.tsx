import { ItemCard, type ItemCardProps } from '@/components/stash/item-card'
import { useItemCard } from '@/hooks/useItemCard'
import { formatMediaDate, formatSize } from '@/utils/formaters'
import { cn } from '@/utils/styles'
import { folderPathLeft } from './folder-shape'

// 1:1 viewBox; tab notch top-left, cover strip showing above the folder body.
const VIEW = 300
const TAB_T = 62
const TAB_R = 200
const BODY_T = 100
const FOLDER_PATH = folderPathLeft(VIEW, VIEW, TAB_T, TAB_R, BODY_T)

function FolderTabText() {
  const { name, createdAt, folder, inclusiveSize } = useItemCard()
  const count = folder?.inclusiveChildCount ?? folder?.childCount
  const [sizeNum, sizeUnit] = formatSize('byte', 'unit', inclusiveSize).split(
    ' '
  )

  return (
    <>
      {/* top-[20.7%] = tab top (62/300) — the title sits on the tab itself */}
      <div className="absolute left-[6.5%] top-[20.7%] w-[52%] pt-2">
        <div className="truncate text-lg font-semibold tracking-tight text-card-foreground">
          {name}
        </div>
        <div className="mt-0.5 font-stashly text-xs text-muted-foreground">
          {formatMediaDate(createdAt)}
        </div>
      </div>
      <div className="absolute bottom-[7.5%] left-[6.5%] right-[6.5%] flex items-end justify-between">
        <div className="flex items-baseline gap-1.5">
          <span className="text-3xl font-bold leading-none tracking-tight text-card-foreground">
            {sizeNum}
          </span>
          <span className="text-sm text-muted-foreground">{sizeUnit}</span>
        </div>
        {typeof count === 'number' && (
          <span className="font-stashly text-xs text-muted-foreground">
            {count.toLocaleString()} items
          </span>
        )}
      </div>
    </>
  )
}

/**
 * Variant B — Tab. Square card: accent cover strip on top, edge-to-edge
 * folder body with tab notch, size + item count footer.
 * Wraps `ItemCard` so it inherits navigation, drag-and-drop, and selection.
 */
export function FolderCardTab({ className, children, ...item }: ItemCardProps) {
  return (
    <ItemCard
      {...item}
      className={cn(
        'h-full rounded-md border-0! bg-transparent! p-0 gap-0 backdrop-blur-none!',
        className
      )}
    >
      {/* h-full stretches to match sibling ItemCards in the row; aspect-square
          only kicks in as the intrinsic size when the row has no file cards. */}
      <div className="relative aspect-square h-full w-full overflow-hidden rounded-md border border-input">
        {/* Accent cover strip. Only the area above the folder body (y < 100/300)
            is ever exposed — keep the bright layer out of the lower card so
            sub-pixel seams from the non-uniformly scaled SVG can't bleed white
            through the bottom edge. h-2/5 overlaps the body top with margin. */}
        <div className="absolute inset-x-0 top-0 h-2/5 bg-primary" />
        <svg
          viewBox={`0 0 ${VIEW} ${VIEW}`}
          width="100%"
          height="100%"
          preserveAspectRatio="none"
          className="absolute inset-0 block fill-background"
        >
          <path d={FOLDER_PATH} />
        </svg>
        <FolderTabText />
        <div className="absolute inset-x-0 top-0 flex items-start justify-between p-3">
          <ItemCard.Checkbox name="selectedItems" />
          {/* Actions trigger sits on the accent cover strip — pair it with
              primary-foreground so it stays legible in both themes. */}
          <ItemCard.Actions className="text-primary-foreground">
            {children}
          </ItemCard.Actions>
        </div>
      </div>
    </ItemCard>
  )
}
