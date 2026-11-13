import { Link } from 'react-router'
import { CollectionFillIcon } from '@/components/icons'
import { KIND_ICON } from '@/components/views/home-components/home-format'
import type { HomeCollection, HomeCollectionTile } from '@/types/home.types'
import { Badge } from '@/ui/badge'
import { cn } from '@/utils/styles'

/**
 * Collection tile for the home feed: a 1-large / 2-small mosaic of its first
 * three items (images, or muted placeholders with the kind icon) and a
 * "Collection" badge so it reads differently from a file.
 */
export function HomeCollectionCard({ collection, className }: { collection: HomeCollection; className?: string }) {
  const src = collection.tiles.length ? collection.tiles : [{ kind: 'document' as const }]
  const tiles = [0, 1, 2].map((i) => src[i % src.length])

  return (
    <Link
      to={collection.href}
      data-slot="home-collection-card"
      className={cn(
        'group flex min-w-0 flex-col overflow-hidden rounded-2xl border border-border/50 bg-card text-card-foreground no-underline transition-[border-color,box-shadow] hover:border-border hover:shadow-stashly focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
        className
      )}
    >
      <div className="relative aspect-4/3 border-b border-border/50">
        <div className="absolute inset-1.5 grid grid-mosaic gap-0.75 overflow-hidden rounded-xl">
          {tiles.map((t, i) => (
            <Tile key={i} tile={t} large={i === 0} />
          ))}
        </div>
        <Badge className="pointer-events-none absolute bottom-2.5 left-3">
          <CollectionFillIcon />
          Collection
        </Badge>
      </div>
      <div className="flex min-w-0 flex-col gap-1.5 px-3.5 pt-3 pb-3.5">
        <span className="truncate font-stashly text-sm font-medium tracking-tight">{collection.name}</span>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <CollectionFillIcon className="size-3.5 shrink-0" />
          <span className="truncate font-stashly text-2xs">
            {collection.itemCount} {collection.itemCount === 1 ? 'file' : 'files'}
          </span>
        </div>
      </div>
    </Link>
  )
}

function Tile({ tile, large }: { tile: HomeCollectionTile; large: boolean }) {
  const Icon = KIND_ICON[tile.kind]
  return (
    <div className={cn('relative grid place-items-center overflow-hidden bg-muted text-muted-foreground', large && 'row-span-2')}>
      {tile.thumbnailUrl ? (
        <img src={tile.thumbnailUrl} alt="" loading="lazy" className="absolute inset-0 size-full object-cover" />
      ) : (
        <span className={cn('grid place-items-center rounded-lg bg-secondary', large ? 'size-10' : 'size-7')}>
          <Icon className={large ? 'size-5' : 'size-3.5'} />
        </span>
      )}
    </div>
  )
}
