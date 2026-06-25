import { useEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'

/**
 * Lazily renders a single PDF page to a canvas, only once it scrolls near the
 * viewport. An `IntersectionObserver` (widened by `rootMargin`) watches
 * `observeEl` and paints the page when it becomes visible, accounting for device
 * pixel ratio (capped at 2×). The painted scale is remembered, so scrolling a
 * page out and back never repaints it — only a `scale` (zoom) change triggers a
 * re-render, and any in-flight render is cancelled on zoom change or unmount.
 *
 * @param params.doc - The loaded pdf.js document proxy (see `usePdfDocument`).
 * @param params.pageNumber - 1-based page index to render.
 * @param params.scale - Render scale; changing it repaints the page at the new zoom.
 * @param params.observeEl - Ref to the element whose visibility gates rendering
 *   (usually the page's placeholder wrapper).
 * @param params.rootMargin - `IntersectionObserver` root margin used to pre-render
 *   pages just before they enter the viewport (e.g. `'800px 0px'`).
 *
 * @example
 * // A self-rendering page row inside a scrollable PDF viewer
 * function PdfPage({ doc, pageNumber, scale }: PageProps) {
 *   const wrapRef = useRef<HTMLDivElement>(null)
 *   const { canvasRef, rendered } = useLazyPageCanvas({
 *     doc, pageNumber, scale, observeEl: wrapRef, rootMargin: '800px 0px',
 *   })
 *   return (
 *     <div ref={wrapRef} className="page">
 *       {!rendered && <Skeleton />}
 *       <canvas ref={canvasRef} />
 *     </div>
 *   )
 * }
 *
 * @example
 * // Wider rootMargin pre-renders more pages ahead for smoother fast scrolling
 * const { canvasRef } = useLazyPageCanvas({ doc, pageNumber, scale, observeEl, rootMargin: '1500px 0px' })
 */
export function useLazyPageCanvas({
  doc,
  pageNumber,
  scale,
  observeEl,
  rootMargin,
}: {
  doc: PDFDocumentProxy
  pageNumber: number
  scale: number
  observeEl: React.RefObject<HTMLElement | null>
  rootMargin: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null)
  // Scale the canvas was last painted at. The canvas keeps its bitmap when the
  // page scrolls out of view, so once painted at a given scale there's nothing
  // to redo — only a zoom (scale change) needs a repaint. Guarding on this
  // prevents re-rendering already-painted pages every time navigation scrolls
  // them back through the IntersectionObserver margin.
  const renderedScaleRef = useRef<number | null>(null)
  const [visible, setVisible] = useState(false)
  const [rendered, setRendered] = useState(false)

  useEffect(() => {
    const el = observeEl.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { rootMargin }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [observeEl, rootMargin])

  useEffect(() => {
    if (!visible) return
    if (renderedScaleRef.current === scale) return // already painted at this scale
    let cancelled = false
    ;(async () => {
      try {
        const page = await doc.getPage(pageNumber)
        const canvas = canvasRef.current
        if (cancelled || !canvas) {
          page.cleanup()
          return
        }
        const dpr = Math.min(window.devicePixelRatio || 1, 2)
        const cssViewport = page.getViewport({ scale })
        const renderViewport = page.getViewport({ scale: scale })
        canvas.width = Math.floor(renderViewport.width)
        canvas.height = Math.floor(renderViewport.height)
        canvas.style.width = `${Math.floor(cssViewport.width)}px`
        canvas.style.height = `${Math.floor(cssViewport.height)}px`
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        renderTaskRef.current?.cancel()
        const task = page.render({
          canvasContext: ctx,
          viewport: renderViewport,
          canvas,
        })
        renderTaskRef.current = task
        try {
          await task.promise
          if (!cancelled) {
            renderedScaleRef.current = scale
            setRendered(true)
          }
        } catch {
          // render cancelled (zoom changed / unmounted) — next effect re-renders
        } finally {
          page.cleanup()
        }
      } catch (err) {
        console.error(`[pdf-stage] page ${pageNumber} render failed`, err)
      }
    })()
    return () => {
      cancelled = true
      renderTaskRef.current?.cancel()
    }
  }, [visible, scale, doc, pageNumber])

  return { canvasRef, rendered }
}
