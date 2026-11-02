import { CollectionFillIcon, ResumeFillIcon } from '@/components/icons'
import type { ItemCategory } from '@/prisma/client'
import { toIcon } from '@/utils/converters'
import { cn } from '@/utils/styles'

// Literal class lookups: Tailwind only emits classes it can read in the source.
const WAVE_HEIGHTS = [
  'h-1/4', 'h-2/5', 'h-3/5', 'h-4/5', 'h-3/4', 'h-1/2', 'h-2/3', 'h-1/3',
  'h-3/5', 'h-4/5', 'h-2/5', 'h-3/4',
]
const WAVE_BARS = 34
const WAVE_PLAYED = 12
const SHEET_LINES = ['w-full', 'w-5/6', 'w-4/6', 'w-full', 'w-3/6']

/**
 * Preview for a file with no thumbnail, chosen by category: a paper sheet for
 * documents, a waveform for audio, a poster gradient with a play glyph for
 * video. With a thumbnail it is just the image.
 *
 * @example
 * <FilePreview url={thumbUrl} category={item.category} />
 */
export function FilePreview({
  url,
  category,
  className,
}: {
  url?: string | null
  category: ItemCategory | string
  className?: string
}) {
  if (url) {
    return (
      <img
        src={url}
        alt=""
        loading="lazy"
        decoding="async"
        className={cn('size-full object-cover', className)}
      />
    )
  }

  if (category === 'audio') {
    return (
      <div
        className={cn(
          'flex size-full items-center justify-center gap-0.5 px-4',
          className
        )}
      >
        {Array.from({ length: WAVE_BARS }, (_, i) => (
          <span
            key={i}
            className={cn(
              'w-full max-w-1 rounded-full',
              WAVE_HEIGHTS[i % WAVE_HEIGHTS.length],
              i < WAVE_PLAYED ? 'bg-primary' : 'bg-border'
            )}
          />
        ))}
      </div>
    )
  }

  if (category === 'video') {
    return (
      <div
        className={cn(
          'relative flex size-full items-center justify-center bg-linear-135 from-dusk-1 via-dusk-2 to-dusk-3',
          className
        )}
      >
        <span className="flex size-9 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm">
          <ResumeFillIcon className="size-4" />
        </span>
      </div>
    )
  }

  return (
    <div className={cn('relative size-full', className)}>
      <div className="absolute inset-x-1/5 top-1/7 -bottom-2 flex flex-col gap-1 rounded-sm bg-neutral-50 p-2.5 shadow-lg">
        <span className="h-1.5 w-1/2 rounded-xs bg-primary" />
        {SHEET_LINES.map((w, i) => (
          <span key={i} className={cn('h-0.75 rounded-xs bg-neutral-300', w)} />
        ))}
      </div>
    </div>
  )
}

function Tile({
  url,
  className,
  children,
}: {
  url?: string
  className?: string
  children?: React.ReactNode
}) {
  return (
    <div
      className={cn(
        'absolute top-1/6 left-1/4 aspect-4/3 w-1/2 overflow-hidden rounded-lg border border-white/10 bg-secondary shadow-xl',
        className
      )}
    >
      {url && (
        <img
          src={url}
          alt=""
          loading="lazy"
          decoding="async"
          className="size-full object-cover"
        />
      )}
      {children}
    </div>
  )
}

/**
 * Cover for a collection card. `stack` fans three tiles over a dot field;
 * `mosaic` is one large tile beside two small ones.
 *
 * In `stack`, tiles with no image stay empty, and with no images at all the
 * front tile shows the collection glyph. In `mosaic`, each tile is a member:
 * its thumbnail, or its kind icon on a muted ground when it has none.
 *
 * @param covers Signed thumbnail URLs, newest first (`stack`).
 * @param tiles The newest members, newest first (`mosaic`).
 *
 * @example
 * <CollectionCover variant="stack" covers={collection.covers} />
 * <CollectionCover variant="mosaic" tiles={collection.tiles} />
 */
export function CollectionCover({
  variant = 'stack',
  covers = [],
  tiles = [],
}: {
  variant?: 'stack' | 'mosaic'
  covers?: string[]
  tiles?: { url: string | null; category: ItemCategory }[]
}) {
  if (variant === 'mosaic') {
    return (
      <div className="grid-mosaic grid size-full gap-0.75">
        {[0, 1, 2].map((i) => {
          const tile = tiles[i]
          const Icon = tile && !tile.url ? toIcon(tile.category) : null
          return (
            <div
              key={i}
              className={cn(
                'bg-muted text-muted-foreground grid place-items-center overflow-hidden',
                i === 0 && 'row-span-2'
              )}
            >
              {tile?.url ? (
                <img
                  src={tile.url}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="size-full object-cover"
                />
              ) : (
                Icon && <Icon className={i === 0 ? 'size-6' : 'size-4'} />
              )}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="bg-dots-sm absolute inset-0">
      <Tile url={covers[2]} className="-translate-x-1/3 translate-y-2 -rotate-9" />
      <Tile url={covers[1]} className="translate-x-1/3 translate-y-2 rotate-8" />
      <Tile url={covers[0]} className="translate-y-1 scale-108">
        {covers.length === 0 && (
          <span className="flex size-full items-center justify-center">
            <CollectionFillIcon className="size-8 text-muted-foreground" />
          </span>
        )}
      </Tile>
    </div>
  )
}
