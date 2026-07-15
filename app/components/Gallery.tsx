import { AnimatePresence, motion } from 'framer-motion'
import { useSearchParams, Link, useViewTransitionState } from 'react-router'
import { RiverView } from './views/river-view'
import { WaterfallLayout } from './views/waterfall-view'
import type { ImageData } from './views/buildRows'
import { GridLayout } from './views/grid-view'
import { itemVariants } from './views/variants'
import { useFileHref } from '../hooks/useFileHref'
import { useScrollRestoration } from '@/hooks/useScrollRestoration'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router'
import { generateVideoThumbnail } from '@/utils/video'
import { cn } from '@/utils'
import { MediaIcon, PauseFillIcon } from './icons'

function VideoItem({ src, className }: { src: string; className?: string }) {
  const [poster, setPoster] = useState<string | undefined>(undefined)
  const [hovered, setHovered] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const ref = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    generateVideoThumbnail(src).then((thumb) => {
      if (thumb) setPoster(thumb)
    })
  }, [src])

  const toggle = () => {
    const video = ref.current
    if (!video) return
    if (video.paused) {
      video.play()
      setIsPlaying(true)
    } else {
      video.pause()
      setIsPlaying(false)
    }
  }

  return (
    <div
      className="relative w-full h-full"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <video
        ref={ref}
        src={src}
        poster={poster}
        className={cn(className)}
        preload="metadata"
        disableRemotePlayback
        playsInline
      />
      {hovered && (
        <button
          onClick={toggle}
          className="absolute inset-0 flex items-center justify-center"
        >
          {isPlaying ? (
            <PauseFillIcon className="size-12 drop-shadow-md" />
          ) : (
            <MediaIcon className="size-12 drop-shadow-md" />
          )}
        </button>
      )}
    </div>
  )
}

function GridItem({ item, showVideo }: { item: ImageData; showVideo: boolean }) {
  const to = useFileHref(item) ?? '.'
  const isTransitioning = useViewTransitionState(to)
  return (
    <motion.div
      variants={itemVariants}
      initial="hidden"
      animate="show"
      className="w-full h-full aspect-4/3 overflow-hidden"
    >
      {showVideo ? (
        <VideoItem
          src={item.src ?? ''}
          className="rounded-md object-cover w-full h-full"
        />
      ) : (
        <Link to={to} viewTransition prefetch="intent">
          <motion.img
            data-prefetch="true"
            layoutId={item.id}
            src={item.src ?? undefined}
            alt={item.alt}
            width={item.width}
            height={item.height}
            sizes={item.sizes}
            srcSet={item.srcSet}
            style={isTransitioning ? { viewTransitionName: `img-${item.id}` } : undefined}
            className="rounded-md object-cover w-full h-full cursor-pointer"
            decoding="async"
            loading="lazy"
          />
        </Link>
      )}
    </motion.div>
  )
}

export const Gallery = ({ images }: { images: ImageData[] }) => {
  const [searchParams] = useSearchParams()
  const layoutType = searchParams.get('layout') ?? 'grid'
  const location = useLocation()
  const showVideo = location.pathname.includes('videos')

  // Opening an item is a real navigation now (the gallery unmounts), so the
  // list's scroll position must be restored when the user navigates back.
  const containerRef = useRef<HTMLDivElement>(null)
  const getScrollElement = useCallback(
    () =>
      (containerRef.current?.closest(
        '[data-slot="scroll-area-viewport"]'
      ) as HTMLElement | null) ?? null,
    []
  )
  useScrollRestoration(getScrollElement)

  return (
    <div ref={containerRef}>
      <AnimatePresence mode="popLayout" initial={false}>
        {layoutType === 'waterfall' ? (
          <WaterfallLayout images={images!} />
        ) : layoutType === 'river' ? (
          <RiverView images={images!} />
        ) : (
          <GridLayout>
            {images.map((item) => (
              <GridItem key={item.id} item={item} showVideo={showVideo} />
            ))}
          </GridLayout>
        )}
      </AnimatePresence>
    </div>
  )
}
