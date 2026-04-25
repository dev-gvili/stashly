import React from 'react'
import type { ImageData } from './buildRows'
import { Link, useSearchParams, useViewTransitionState } from 'react-router'

function WaterfallItem({ img }: { img: ImageData }) {
  const isTransitioning = useViewTransitionState(img.id)
  return (
    <div
      className="w-full break-inside-avoid"
      style={{ breakInside: 'avoid' }}
    >
      <Link to={img.id} viewTransition unstable_mask=".">
        <img
          src={img.src!}
          style={
            isTransitioning
              ? { viewTransitionName: `img-${img.id}` }
              : undefined
          }
          className="w-full h-full mb-2 rounded-md object-cover grayscale hover:grayscale-0 transition-all duration-300 cursor-pointer"
          width={img.width}
          height={img.height}
          sizes={img.sizes}
          srcSet={img.srcSet}
          decoding="async"
          loading="lazy"
        />
      </Link>
    </div>
  )
}

export const WaterfallLayout: React.FC<{
  images: ImageData[]
}> = ({ images }) => {
  const [searchParams] = useSearchParams()
  const isWaterfallLayout = searchParams.has('layout', 'waterfall')
  if (!isWaterfallLayout) return null

  return (
    <div className="min-h-screen max-w-screen flex-col">
      <div className="columns-1 sm:columns-2 md:columns-3 xl:columns-10 gap-2 *:mb-2">
        {images.map((img) => (
          <WaterfallItem key={img.id} img={img} />
        ))}
      </div>
    </div>
  )
}
