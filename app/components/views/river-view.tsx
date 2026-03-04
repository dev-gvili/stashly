import React, { useLayoutEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { containerVariants, itemVariants } from './variants'
import { buildRows, type ImageData, type RowImageData } from './buildRows'
import { useSearchParams } from 'react-router'
import { useSidebar } from '../ui/sidebar'

/**
 * Build a simple srcset string for an image URL by appending a width query parameter.
 * Many CDNs and image providers accept a `w` query param to request resized images.
 * If the source already contains query parameters we append using `&`.
 */
export function buildSrcSet(src: string, widths: number[]) {
  const hasQuery = src?.indexOf('?') !== -1
  return widths
    .map((w) => `${src}${hasQuery ? '&' : '?'}w=${w} ${w}w`)
    .join(', ')
}

export const RiverView: React.FC<{
  images: ImageData[]
}> = ({ images }) => {
  const [searchParams] = useSearchParams()
  const isRiverLayout = searchParams.has('layout', 'river')
  if (!isRiverLayout) return null
  const { state } = useSidebar()
  const containerRef = useRef<HTMLDivElement>(null)
  const [rows, setRows] = useState<RowImageData[][]>([])
  const [animationKey, setAnimationKey] = useState(0)

  useLayoutEffect(() => {
    if (!containerRef.current) return
    let width = containerRef.current.clientWidth
    if (state === 'collapsed') {
      width = containerRef.current.clientWidth + 256
    } else {
      width = containerRef.current.clientWidth
    }
    setRows(buildRows(images, width, 150, 8))
    setAnimationKey((prev) => prev + 1)
  }, [state])

  // set up intersection observer prefetch for this container
  useLayoutEffect(() => {
    if (!containerRef.current) return
    const disconnect = imagePrefetchObserver(containerRef.current)
    return () => disconnect()
  }, []) 

  return (
    <AnimatePresence mode="popLayout" initial={false} key={animationKey}>
      <motion.div
        ref={containerRef}
        className="w-full flex-col space-y-2"
        key={animationKey}
      >
        {rows.map((row, i) => (
          <motion.div key={i} layout className="flex gap-2 flex-nowrap">
            {row.map((item) => (
              <motion.div
                layout
                key={item.img.id}
                variants={itemVariants}
                initial="hidden"
                animate="show"
                exit={{ opacity: 0 }}
              >
                <img
                  data-prefetch // use 
                  src={item.img.src}
                  srcSet={item.img.srcSet}
                  sizes={item.img.sizes}
                  alt={item.img.alt}
                  className="rounded-md object-cover grayscale hover:grayscale-0"
                  loading="lazy"
                  decoding="async"
                  width={item.width}
                  height={item.height}
                />
              </motion.div>
            ))}
          </motion.div>
        ))}
      </motion.div>
    </AnimatePresence>
  )
}

/**
 *
 * Prefetch images near the viewport. We attach an observer to images inside the
 * RiverView container and when they enter the rootMargin we pre-load their
 * higher-resolution candidate (if available) using requestIdleCallback to avoid
 * blocking the main thread.
 * @param root - `HTMLElement`
 * @returns
 */
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

        // choose the largest candidate from srcset if it exists
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
