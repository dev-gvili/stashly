import React from 'react'
import type { ImageData } from './buildRows'
import { Link, useSearchParams, useViewTransitionState } from 'react-router'
import { useLocation } from 'react-router'
import { useScrollRestoration } from '@/hooks/useScrollRestoration'

export function buildSrcSet(src: string, widths: number[]) {
  const hasQuery = src?.indexOf('?') !== -1
  return widths
    .map((w) => `${src}${hasQuery ? '&' : '?'}w=${w} ${w}w`)
    .join(', ')
}

// Preset aspect ratios (width / height), picked deterministically from the item
// id so a given item always lands on the same shape. Rows are justified: each
// row's height is solved so its items fill the full container width edge-to-edge.
const ASPECT_CYCLE = [1, 2, 3 / 4, 2, 16 / 9, 4 / 3, 1, 1] as const

const ROW_GAP = 16 // gap-4
const TARGET_ROW_HEIGHT = 150
const MAX_PER_ROW = 7

function aspectFromId(id: string): number {
  const sum = id.split('').reduceRight((acc, c) => acc + c.charCodeAt(0), 0)
  return ASPECT_CYCLE[sum % ASPECT_CYCLE.length]
}

type JustifiedItem = { img: ImageData; aspect: number }
type JustifiedRow = { items: JustifiedItem[]; height: number; justified: boolean }

// Greedy justified layout: accumulate items until they'd overflow the container
// at the target height (or hit the per-row cap), then solve the row height that
// makes them fill the width exactly. The trailing leftover row keeps the target
// height (left-aligned) so a lone item never balloons to full width.
function buildJustifiedRows(
  images: ImageData[],
  containerWidth: number
): JustifiedRow[] {
  const rows: JustifiedRow[] = []
  let current: JustifiedItem[] = []
  let aspectSum = 0

  for (const img of images) {
    const aspect = aspectFromId(img.id)
    current.push({ img, aspect })
    aspectSum += aspect

    const gaps = ROW_GAP * (current.length - 1)
    const widthAtTarget = aspectSum * TARGET_ROW_HEIGHT + gaps
    if (widthAtTarget >= containerWidth || current.length >= MAX_PER_ROW) {
      const height = (containerWidth - gaps) / aspectSum
      rows.push({ items: current, height, justified: true })
      current = []
      aspectSum = 0
    }
  }

  if (current.length > 0) {
    rows.push({ items: current, height: TARGET_ROW_HEIGHT, justified: false })
  }

  return rows
}

function RiverItem({
  item,
  grow,
}: {
  item: JustifiedItem
  grow: boolean
}) {
  const { img, aspect } = item
  const isTransitioning = useViewTransitionState(img.id)
  let location = useLocation()
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
      <Link
        to={img.id}
        viewTransition
        mask={`${location.pathname}/${img.alt}`}
        prefetch="intent"
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
  images: ImageData[]
}> = ({ images }) => {
  const [searchParams] = useSearchParams()
  const isRiverLayout = searchParams.has('layout', 'river')

  const containerRef = React.useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = React.useState(0)

  // Preserve scroll position when opening/closing the full-page item preview.
  const getScrollElement = React.useCallback(
    () =>
      (containerRef.current?.closest(
        '[data-slot="scroll-area-viewport"]'
      ) as HTMLElement | null) ?? null,
    []
  )
  useScrollRestoration(getScrollElement)

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
    <div ref={containerRef} className="flex flex-col gap-4 pr-4">
      {rows.map((row, i) => (
        <div key={i} className="flex gap-4 h-32" >
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
