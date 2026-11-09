import React, { ViewTransition } from 'react'
import { Link, useSearchParams } from 'react-router'
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
      <Link to={to} prefetch="intent">
        <ViewTransition name={`img-${img.id}`} default="none" share="auto">
        <img
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
        </ViewTransition>
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
