import React from 'react'
import type { ImageData } from './buildRows'
import { useSearchParams } from 'react-router'

export const WaterfallLayout: React.FC<{
  images: ImageData[]
}> = ({ images }) => {
  const [searchParams] = useSearchParams()
  const isWaterfallLayout = searchParams.has('layout', 'waterfall')
  if (!isWaterfallLayout) return null

  return (
    <div className="flex min-h-screen w-full flex-col">
      <div className="columns-1 sm:columns-2 md:columns-3 lg:columns-xs xl:columns-5 2xl:columns-8 gap-2 *:mb-2">
        {images.map((img) => (
          <div
            key={img.id}
            style={{ breakInside: 'avoid' }} // important for CSS columns
          >
            <img
              src={img.src}
              alt={img.alt}
              className="w-full h-full mb-2 rounded-md object-cover grayscale hover:grayscale-0 transition-all duration-300"
              width={img.width}
              height={img.height}
              sizes={img.sizes}
              srcSet={img.srcSet}
              decoding="async"
              loading="lazy"
            />
          </div>
        ))}
      </div>
    </div>
  )
}
