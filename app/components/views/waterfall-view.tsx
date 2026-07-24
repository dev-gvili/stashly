import React from 'react'
import type { ImageData } from './buildRows'
import { Link, useSearchParams, useViewTransitionState } from 'react-router'
import { cn } from '@/utils'
import { useFileHref } from '../../hooks/useFileHref'

const ASPECT_CYCLE = [
  'aspect-[2/2.5]',
  'aspect-square',
  'aspect-[1/2.5]',
  'aspect-[3/2.5]',
  // 'aspect-[4/3]',
  // 'aspect-[2/1]',
  // 'aspect-[3/4]',
] as const

function aspectFromId(id: string): string {
  const sum = id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return ASPECT_CYCLE[sum % ASPECT_CYCLE.length]
}

function WaterfallItem({
  img,
  aspectClass,
}: {
  img: ImageData
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
  images: ImageData[]
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
          aspectClass={aspectFromId(img.id)}
        />
      ))}
    </div>
  )
}
