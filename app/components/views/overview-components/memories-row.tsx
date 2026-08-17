import { ItemCard } from '@/components/stash/item-card'
import { cn } from '@/utils/styles'
import { Link } from 'react-router'
import { SectionLabel } from './section-label'
import type { MemoryCluster } from './types'

/**
 * "On this day" — a single row of square photo tiles from the same date in a
 * previous year. The last tile absorbs the remainder as a +N overlay so the row
 * never wraps.
 */
export function MemoriesRow({
  memories,
  openTo,
  className,
}: {
  memories: MemoryCluster
  openTo: string
  className?: string
}) {
  if (!memories.items.length) return null
  const tiles = memories.items.slice(0, 8)
  const remainder = memories.totalCount - tiles.length
  const date = new Date(memories.date)
  const years = new Date().getFullYear() - date.getFullYear()

  return (
    <section className={cn(className)}>
      <SectionLabel
        title="On this day"
        subtitle={`${date.toLocaleDateString('en', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })}${years > 0 ? ` · ${years} ${years === 1 ? 'year' : 'years'} ago` : ''}`}
        action={
          <Link
            to={openTo}
            className="text-muted-foreground hover:text-foreground text-xs tracking-wider uppercase transition-colors"
          >
            Open memory →
          </Link>
        }
      />
      <div className="grid grid-cols-8 gap-3">
        {tiles.map((item, index) => {
          const isLast = index === tiles.length - 1 && remainder > 0
          return (
            <ItemCard
              {...item}
              key={item.id}
              className="bg-muted relative aspect-square overflow-hidden rounded-2xl border-none! p-0"
            >
              <ItemCard.Thumbnail className="absolute inset-0 size-full">
                <ItemCard.ThumbnailImage className="rounded-2xl" />
                <ItemCard.ThumbnailFallback className="text-muted-foreground rounded-2xl" />
              </ItemCard.Thumbnail>
              {isLast && (
                <span className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-black/65 text-sm text-white tabular-nums">
                  +{remainder}
                </span>
              )}
            </ItemCard>
          )
        })}
      </div>
    </section>
  )
}
