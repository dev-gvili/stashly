import { forwardRef, useId, useState, useEffect } from 'react'
import { cn } from '@/utils/styles'
import type { FitEnum } from 'sharp'
import { Avatar, AvatarFallback, AvatarImage } from './avatar'
import { Skeleton } from './skeleton'
import { AnimatePresence, motion } from 'framer-motion'
import { buildSrcSet } from '@/utils/gallery-layout'

const IMAGE_SRCSET_CONFIG = {
  sm: {
    media: '(max-width: 640px)', // Tailwind sm
    width: 256,
    height: 256,
    fit: 'cover',
  },
  // md: {
  //   media: '(max-width: 768px)', // Tailwind md
  //   width: 256,
  //   height: 640,
  //   fit: 'cover',
  // },
  lg: {
    media: '(min-width: 1024px)', // Tailwind lg
    width: 512,
    height: 512,
    fit: 'cover',
  },
  // xl: {
  //   media: '(max-width: 1280px)', // Tailwind xl
  //   width: 768,
  //   height: 1280,
  //   fit: 'cover',
  // },
  '2xl': {
    media: '(min-width: 1536px)', // Tailwind 2xl
    width: 1024,
    height: 1024,
    fit: 'cover',
  },
} as const

const variants = {
  initial: {
    opacity: 1,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  exit: {
    opacity: 0,
    transition: {
      duration: 0.3,
      ease: 'easeInOut',
    },
  },
} as const

export interface ImageProps extends React.ComponentPropsWithRef<'img'> {
  width?: number // either width or height is required
  height?: number
  fit?: keyof FitEnum // contain is default
  alt: string
}

export const Image = forwardRef<HTMLImageElement, ImageProps>(
  ({ width, height, fit, className, src, id, ...props }, forwardedRef) => {
    id = id || useId()
    const [isLoaded, setIsLoaded] = useState(false)
    let [{ media, srcSet, sizes, imageSrc }] = Object.values(
      IMAGE_SRCSET_CONFIG
    )
      .sort((a, b) => b.width - a.width)
      .map((config) => ({
        media: config.media,
        srcSet: buildSrcSet(
          `/api/images?w=${config.width}&h=${config.height}&fit=${config.fit}&image=${src!}`,
          [256, 512, 1024]
        ),
        sizes: `${Math.round(config.width)}px`,
        imageSrc: `/api/images?w=${config.width}&h=${config.height}&fit=${config.fit}&image=${src!}`,
      }))
    // Reset isLoaded state when src changes
    useEffect(() => {
      setIsLoaded(false)
    }, [src])

    return (
      <Avatar asChild className="w-full h-full rounded-md relative">
        <picture className="w-full h-full relative">
          {/* Add an aspect ratio container */}
          {/* 16:9 aspect ratio */}
          {Object.values(IMAGE_SRCSET_CONFIG)
            .sort((a, b) => b.width - a.width)
            .map((config) => (
              <source
                key={config.media}
                media={config.media}
                srcSet={buildSrcSet(
                  `/api/images?w=${config.width}&h=${config.height}&fit=${config.fit}&image=${src!}`,
                  [256, 512, 1024]
                )}
                sizes={`${Math.round(config.width)}px`}
              />
            ))}
          <AvatarImage
            key={`${id}-${src}`} // Add src to key to force remount
            ref={forwardedRef}
            src={imageSrc}
            sizes={sizes}
            srcSet={srcSet}
            className={cn(
              'w-full h-full object-cover rounded aspect-auto',
              className,
              'transition-opacity duration-300',
              isLoaded ? 'opacity-100' : 'opacity-0'
            )}
            width={width}
            height={height}
            onLoad={() => setIsLoaded(true)}
            {...props}
          />
          {/* </div> */}
          <AvatarFallback asChild>
            {/* <AnimatePresence mode="sync"> */}
            {/* {!isLoaded && (
                <motion.div
                  variants={variants}
                  initial="initial"
                  exit="exit"
                  className="absolute inset-0"
                >
                </motion.div>
              )} */}
            <Skeleton className="aspect-video w-full h-full rounded bg-foreground/30 animate-pulse" />
            {/* </AnimatePresence> */}
          </AvatarFallback>
        </picture>
      </Avatar>
    )
    function createImageUrlParams() {
      const query = new URLSearchParams()
      if (width) {
        query.set('w', width.toString())
      }
      if (height) {
        query.set('h', height.toString())
      }
      if (fit) {
        query.set('fit', fit)
      }
      query.set('image', src!)
      return query.toString()
    }

    function createSrcSet() {
      return Object.values(IMAGE_SRCSET_CONFIG)
        .sort((a, b) => b.width - a.width)
        .map(
          (config) =>
            `/api/images?w=${config.width}&h=${
              config.height
            }&fit=${fit}&image=${src!} ${config.width}w`
        )
        .join(', ')
    }
  }
)

Image.displayName = 'Image'
