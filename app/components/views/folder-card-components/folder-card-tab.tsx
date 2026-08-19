import { ItemCard, type ItemCardProps } from '@/components/stash/item-card'
import { useItemCard } from '@/hooks/useItemCard'
import { formatMediaDate, formatSize } from '@/utils/formaters'
import { cn } from '@/utils/styles'
import { folderPathLeft } from '@/utils/folder-shape'

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
        'h-full border-none! bg-card flex flex-col gap-0 rounded-3xl!  p-2 has-[[data-slot=item-checkbox][data-state=checked]]:ring-inset has-[[data-slot=item-checkbox][data-state=checked]]:ring-primary/50',
        className
      )}
    >
      {/* h-full stretches to match sibling ItemCards in the row; aspect-square
          only kicks in as the intrinsic size when the row has no file cards.
          rounded-2xl = the card's 24px minus its p-2 (8px) gutter, matching
          FileCardDetail's hero. The ring lives here, on the square wrapper —
          not on the <svg>, which only draws the folder path. */}
      <div className="relative aspect-square h-full w-full overflow-hidden rounded-2xl border-none! bg-card">
        {/* Accent cover strip. Only the area above the folder body (y < 100/300)
            is ever exposed — keep the bright layer out of the lower card so
            sub-pixel seams from the non-uniformly scaled SVG can't bleed white
            through the bottom edge. h-2/5 overlaps the body top with margin. */}
        <svg
          viewBox={`0 0 ${VIEW} ${VIEW}`}
          width="100%"
          height="100%"
          preserveAspectRatio="none"
          className="absolute inset-0 block fill-muted stroke-muted stroke-[1.5]"
        >
          <path d={FOLDER_PATH} />
        </svg>
        <FolderTabText />
        <ItemCard.Header className="absolute inset-x-0 top-0 flex items-start justify-between py-2.5 pr-1.5 pl-2 hidden group-hover/card:flex! has-[[data-slot=dropdown-menu-trigger][data-state=open]]:flex! has-[[data-slot=item-checkbox][data-state=checked]]:flex!">
          <ItemCard.Checkbox name="selectedItems"  className='border-primary/40 bg-input! rounded-sm backdrop-blur-sm data-[state=checked]:border-primary  group-hover/card:flex! '/>
          {/* Actions trigger sits on the accent cover strip — pair it with
              primary-foreground so it stays legible in both themes. */}
          <ItemCard.Actions className="has-[[data-slot=dropdown-menu-trigger][data-state=open]]:flex! has-[[data-slot=dropdown-menu-trigger][data-state=open]]:bg-primary! data-[state=open]:flex!">
            {children}
          </ItemCard.Actions>
        </ItemCard.Header>
      </div>
    </ItemCard>
  )
}
