import React from 'react'
import { Link, useSearchParams, useViewTransitionState } from 'react-router'
import { cn } from '@/utils'
import { aspectClassFromId } from '@/utils/gallery-layout'
import type { GalleryImage } from '@/types/stash.types'
import { useFileHref } from '../../hooks/useFileHref'

function WaterfallItem({
  img,
  aspectClass,
}: {
  img: GalleryImage
  aspectClass: string
}) {
  const to = useFileHref(img) ?? '.'
  const isTransitioning = useViewTransitionState(to)
  return (
    <Link
      to={to}
      viewTransition
      prefetch="intent"
      className="surface-elevated"
      mask={`images/${img.id}`}
    >
      <div
        style={{ breakInside: 'avoid' }}
        className={cn(
          'overflow-hidden mb-2 rounded-md shadow-stashly',
          aspectClass
        )}
      >
        <img
          src={img.src!}
          style={
            isTransitioning
              ? { viewTransitionName: `img-${img.id}` }
              : undefined
          }
          className="w-full h-full object-cover cursor-pointer ring"
          width={img.width}
          height={img.height}
          sizes={img.sizes}
          srcSet={img.srcSet}
          decoding="async"
          loading="lazy"
        />
      </div>
    </Link>
  )
}

export const WaterfallLayout: React.FC<{
  images: GalleryImage[]
}> = ({ images }) => {
  const [searchParams] = useSearchParams()
  const isWaterfallLayout = searchParams.has('layout', 'waterfall')
  if (!isWaterfallLayout) return null

  return (
    <div className="columns-2 sm:columns-3 md:columns-5 xl:columns-7 gap-2">
      {images.map((img, i) => (
        <WaterfallItem
          key={img.id}
          img={img}
          aspectClass={aspectClassFromId(img.id)}
        />
      ))}
    </div>
  )
}
