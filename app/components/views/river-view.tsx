import React from 'react'
import type { ImageData } from './buildRows'
import { Link, useSearchParams, useViewTransitionState } from 'react-router'
import { cn, toChunkArray } from '@/utils'
import { useLocation } from 'react-router'

export function buildSrcSet(src: string, widths: number[]) {
  const hasQuery = src?.indexOf('?') !== -1
  return widths
    .map((w) => `${src}${hasQuery ? '&' : '?'}w=${w} ${w}w`)
    .join(', ')
}

const ASPECT_CYCLE = [
  'aspect-square',
  'aspect-[4/2]',
  'aspect-[3/4]',
  'aspect-[2/1]',
  'aspect-[4/3]',
  'aspect-[2/2]',
  'aspect-square',
] as const

function aspectFromId(id: string): string {
  const sum = id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return ASPECT_CYCLE[sum % ASPECT_CYCLE.length]
}

function RiverItem({ img }: { img: ImageData }) {
  const isTransitioning = useViewTransitionState(img.id)
  let location = useLocation()
  return (
    <div
      className={cn(
        'h-32 grow overflow-hidden rounded-md ',
        aspectFromId(img.id)
      )}
    >
      <Link
        to={img.id}
        viewTransition
        unstable_mask={`${location.pathname}/${img.alt}`}
        prefetch="intent"
        className="block w-full h-full"
      >
        <img
          style={
            isTransitioning
              ? { viewTransitionName: `img-${img.id}` }
              : undefined
          }
          data-prefetch
          src={img.src!}
          srcSet={img.srcSet}
          sizes={img.sizes}
          alt={img.alt}
          className="w-full h-full flex-auto object-cover cursor-pointer"
          loading="lazy"
          decoding="async"
          width={img.width}
          height={img.height}
        />
      </Link>
    </div>
  )
}

export const RiverView: React.FC<{
  images: ImageData[]
}> = ({ images }) => {
  const [searchParams] = useSearchParams()
  const isRiverLayout = searchParams.has('layout', 'river')
  if (!isRiverLayout) return null

  let chunks = toChunkArray(images, 7)
  return (
    <div className="flex flex-col ">
      {chunks.map((chunk, i) => (
        // react doesn't like it when the same image appears in multiple rows during a transition, so we use the chunk index as part of the key to force a full re-render of each row when the layout changes
        <div
          key={i}
          className="flex gap-4 mb-4 overflow-hidden rounded-md shrink-0"
        >
          {chunk.map((img) => (
            // RiverItem will use the image ID for its own view transition keys, so we can safely reuse the same images across rows without key conflicts
            <RiverItem key={img.id} img={img} />
          ))}
        </div>
      ))}
    </div>
  )
}

export function imagePrefetchObserver(root: HTMLElement | null) {
  if (typeof window === 'undefined' || !root) return () => {}

  const prefetched = new Set<string>()
  const obs = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        const img = entry.target as HTMLImageElement
        const src = img.getAttribute('src')
        const srcset = img.getAttribute('srcset')

        let best = null
        if (srcset) {
          const last = srcset.split(',').pop()
          if (last) best = last.trim().split(' ')[0]
        }

        const toLoad = (best || src) as string | null
        if (!toLoad || prefetched.has(toLoad)) continue

        const prefetch = () => {
          try {
            const pre = new Image()
            pre.decoding = 'async'
            if (srcset) pre.srcset = srcset
            pre.src = toLoad
            prefetched.add(toLoad)
          } catch (e) {
            // ignore
          }
        }

        if ('requestIdleCallback' in window) {
          window.requestIdleCallback(prefetch)
        } else {
          setTimeout(prefetch, 200)
        }
      }
    },
    { root, threshold: 0.3, rootMargin: '20% 0% 20% 0%' }
  )

  const imgs = Array.from(
    root.querySelectorAll('img[data-prefetch]')
  ) as HTMLImageElement[]
  imgs.forEach((i) => obs.observe(i))

  return () => obs.disconnect()
}
