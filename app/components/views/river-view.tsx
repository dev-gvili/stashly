import React from 'react'
import { Link, useSearchParams, useViewTransitionState } from 'react-router'
import {
  buildJustifiedRows,
  TARGET_ROW_HEIGHT,
  type JustifiedItem,
} from '@/utils/gallery-layout'
import type { GalleryImage } from '@/types/stash.types'
import { useFileHref } from '../../hooks/useFileHref'

function RiverItem({
  item,
  grow,
}: {
  item: JustifiedItem
  grow: boolean
}) {
  const { img, aspect } = item
  const to = useFileHref(img) ?? '.'
  const isTransitioning = useViewTransitionState(to)
  return (
    <div
      className="h-full overflow-hidden rounded-md min-w-0"
      style={
        // Justified row: grow proportional to aspect with flex-basis 0 lets the
        // browser fill the real width exactly (robust to measurement drift).
        // Trailing row: keep natural width at the target height, left-aligned.
        grow
          ? { flexGrow: aspect, flexShrink: 1, flexBasis: 0 }
          : { width: aspect * TARGET_ROW_HEIGHT, flexGrow: 0, flexShrink: 0 }
      }
    >
      <Link to={to} viewTransition prefetch="intent">
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
          className="w-full h-full object-cover cursor-pointer"
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
  images: GalleryImage[]
}> = ({ images }) => {
  const [searchParams] = useSearchParams()
  const isRiverLayout = searchParams.has('layout', 'river')

  const containerRef = React.useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = React.useState(0)

  // Scroll restoration lives in the parent Gallery component (covers all layouts).

  // Measure the container so rows re-justify to the real available width — which
  // changes whenever the sidebar is collapsed/expanded.
  React.useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () => setContainerWidth(el.clientWidth)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [isRiverLayout])

  if (!isRiverLayout) return null

  const rows =
    containerWidth > 0 ? buildJustifiedRows(images, containerWidth) : []

  return (
    <div ref={containerRef} className="flex flex-col gap-2">
      {rows.map((row, i) => (
        <div key={i} className="flex gap-2 h-32" >
          {row.items.map((item) => (
            <RiverItem key={item.img.id} item={item} grow={row.justified} />
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
