import { ItemCard, type ItemCardProps } from '@/components/stash/item-card'
import { useItemCard } from '@/hooks/useItemCard'
import { formatSize, timeAgo } from '@/utils/formaters'
import { cn } from '@/utils/styles'
import { folderPathRight } from './folder-shape'

// 16:9 viewBox for the folder-tab silhouette; tab occupies the left ~51%.
const VIEW_W = 480
const VIEW_H = 270
const TAB_L = 246
const BODY_T = 40
const FOLDER_PATH = folderPathRight(VIEW_W, VIEW_H, TAB_L, BODY_T)

function FolderPosterText() {
  const { name, folder, updatedAt, inclusiveSize } = useItemCard()
  const count = folder?.inclusiveChildCount ?? folder?.childCount

  return (
    <div className="absolute left-[3.8%] top-[14.8%] bottom-[8%] flex w-[41.7%] flex-col pt-3">
      <h3 className="m-0 truncate text-base font-semibold tracking-tight text-card-foreground sm:text-lg">
        {name}
      </h3>
      <p className="mt-2 truncate font-stashly text-xs text-muted-foreground">
        {typeof count === 'number' ? `${count.toLocaleString()} items · ` : null}
        {formatSize('byte', 'unit', inclusiveSize)}
      </p>
      <span className="mt-auto font-stashly text-xs text-muted-foreground">
        updated {timeAgo(updatedAt)}
      </span>
    </div>
  )
}

/**
 * Variant A2 — Poster · Solid. Folder-tab silhouette rendered as an SVG
 * path with a solid accent color block standing in for a cover image.
 * Wraps `ItemCard` so it inherits navigation, drag-and-drop, and selection.
 */
export function FolderCardPosterSolid({
  className,
  children,
  ...item
}: ItemCardProps) {
  return (
    <ItemCard
      {...item}
      className={cn(
        'rounded-2xl border-0! bg-transparent! p-0 gap-0 backdrop-blur-none!',
        className
      )}
    >
      <div className="relative aspect-video w-full overflow-hidden rounded-2xl transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-1 hover:shadow-stashly">
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          width="100%"
          height="100%"
          preserveAspectRatio="none"
          className="absolute inset-0 block fill-card stroke-input stroke-2"
        >
          <path d={FOLDER_PATH} />
        </svg>
        <div className="absolute left-[55%] right-[2.7%] top-[4.5%] bottom-[4.5%] rounded-xl bg-primary" />
        <FolderPosterText />
        <div className="absolute inset-0 flex items-start justify-between p-3">
          <ItemCard.Checkbox name="selectedItems" />
          {/* Actions trigger sits on the accent block — pair it with
              primary-foreground so it stays legible in both themes. */}
          <ItemCard.Actions className="text-primary-foreground">
            {children}
          </ItemCard.Actions>
        </div>
      </div>
    </ItemCard>
  )
}
