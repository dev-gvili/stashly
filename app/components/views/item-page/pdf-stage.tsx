import { useEffect, useMemo, useRef, useState } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import {
  AddIcon,
  MinusFillIcon,
  ChevronRightIcon,
  Pdf2Icon,
  LoaderIcon,
  ZoomOutFillIcon,
  ZoomInFillIcon,
  DropdownIcon,
  SidebarFillIcon,
} from '@/components/icons'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/utils/styles'
import { SidebarTrigger, useSidebar } from '@/components/ui'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PdfItemShape = {
  id: string
  name: string
  pdf: {
    title: string | null
    pageCount: number | null
  } | null
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Zoom is a multiplier on top of the fit-to-width scale; 1 = fit width.
const ZOOM_LEVELS = [0.5, 0.67, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3]
const STAGE_PADDING = 64 // page container's horizontal padding (px-8 × 2)
const THUMB_WIDTH = 128 // css px width of rail thumbnails
const RAIL_WIDTH = '11rem' // expanded rail width

function stepZoom(zoom: number, dir: 1 | -1): number {
  const idx = ZOOM_LEVELS.findIndex((z) => Math.abs(z - zoom) < 0.001)
  if (idx === -1) {
    return dir === 1
      ? (ZOOM_LEVELS.find((z) => z > zoom) ??
          ZOOM_LEVELS[ZOOM_LEVELS.length - 1])
      : ([...ZOOM_LEVELS].reverse().find((z) => z < zoom) ?? ZOOM_LEVELS[0])
  }
  return ZOOM_LEVELS[Math.max(0, Math.min(ZOOM_LEVELS.length - 1, idx + dir))]
}

// ---------------------------------------------------------------------------
// usePdfDocument — loads the document client-side (pdfjs never runs on SSR)
// ---------------------------------------------------------------------------

function usePdfDocument(src: string) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null)
  const [baseSize, setBaseSize] = useState<{
    width: number
    height: number
  } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    // pdfjs v6: teardown lives on the loading task, not the document proxy.
    // Destroying the task also aborts in-flight network requests.
    let task: { destroy: () => Promise<void> } | null = null
    setDoc(null)
    setBaseSize(null)
    setError(null)
    if (!src) {
      setError('No file URL')
      return
    }
    ;(async () => {
      try {
        const { loadPdfDocument } = await import('@/utils/pdf')
        const t = loadPdfDocument(src)
        if (cancelled) {
          t.destroy().catch(() => {})
          return
        }
        task = t
        const d = await t.promise
        if (cancelled) return
        const page = await d.getPage(1)
        const vp = page.getViewport({ scale: 1 })
        page.cleanup()
        if (cancelled) return
        setBaseSize({ width: vp.width, height: vp.height })
        setDoc(d)
      } catch (err) {
        if (cancelled) return // rejection from task.destroy() on unmount
        console.error('[pdf-stage] failed to load document', err)
        setError('Could not load this PDF')
      }
    })()
    return () => {
      cancelled = true
      task?.destroy().catch(() => {})
    }
  }, [src])

  return { doc, baseSize, error }
}

// ---------------------------------------------------------------------------
// useLazyPageCanvas — renders a page to a canvas while it is near a viewport
// ---------------------------------------------------------------------------

function useLazyPageCanvas({
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

// ---------------------------------------------------------------------------
// PdfThumb — thumbnail rail entry
// ---------------------------------------------------------------------------

function PdfThumb({
  doc,
  pageNumber,
  estimate,
  active,
  onSelect,
  registerEl,
}: {
  doc: PDFDocumentProxy
  pageNumber: number
  estimate: { width: number; height: number }
  active: boolean
  onSelect: (n: number) => void
  registerEl: (n: number, el: HTMLButtonElement | null) => void
}) {
  const buttonRef = useRef<HTMLButtonElement>(null)
  const scale = THUMB_WIDTH / estimate.width
  const { canvasRef, rendered } = useLazyPageCanvas({
    doc,
    pageNumber,
    scale,
    observeEl: buttonRef,
    rootMargin: '100% 0px',
  })

  useEffect(() => {
    registerEl(pageNumber, buttonRef.current)
    return () => registerEl(pageNumber, null)
  }, [pageNumber, registerEl])

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={() => onSelect(pageNumber)}
      aria-label={`Page ${pageNumber}`}
      aria-current={active || undefined}
      className={cn(
        'relative block w-full overflow-hidden rounded-md bg-white ring-1 ring-input transition-shadow',
        active
          ? 'ring-2 ring-primary'
          : 'hover:ring-2 hover:ring-muted-foreground/40'
      )}
      style={
        rendered ? undefined : { height: Math.floor(estimate.height * scale) }
      }
    >
      <canvas ref={canvasRef} className="block w-full" />
      <span
        className={cn(
          'absolute bottom-1 left-1 flex size-5 items-center justify-center rounded font-stashly text-xs tabular-nums',
          active
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-muted-foreground'
        )}
      >
        {pageNumber}
      </span>
    </button>
  )
}

// ---------------------------------------------------------------------------
// PdfPageView — one full-size page in the main scroll area
// ---------------------------------------------------------------------------

function PdfPageView({
  doc,
  pageNumber,
  scale,
  estimate,
  registerEl,
}: {
  doc: PDFDocumentProxy
  pageNumber: number
  scale: number
  estimate: { width: number; height: number }
  registerEl: (pageNumber: number, el: HTMLDivElement | null) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { canvasRef, rendered } = useLazyPageCanvas({
    doc,
    pageNumber,
    scale,
    observeEl: containerRef,
    // Render pages well before they scroll into view so paging feels instant.
    rootMargin: '150% 0px',
  })

  useEffect(() => {
    registerEl(pageNumber, containerRef.current)
    return () => registerEl(pageNumber, null)
  }, [pageNumber, registerEl])

  return (
    <div
      ref={containerRef}
      data-page={pageNumber}
      className="relative bg-card! shadow-stashly ring-1 ring-input rounded-md"
      style={
        rendered
          ? undefined
          : {
              width: Math.floor(estimate.width * scale),
              height: Math.floor(estimate.height * scale),
            }
      }
    >
      <canvas
        ref={canvasRef}
        className={cn('block', !rendered && 'absolute inset-0')}
      />
      {!rendered && (
        <span className="absolute inset-0 flex items-center justify-center font-stashly text-xs text-muted-foreground">
          {pageNumber}
        </span>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// PdfStage — exported main component
// ---------------------------------------------------------------------------

export function PdfStage({ item, src }: { item: PdfItemShape; src: string }) {
  // The rail's open state lives in the app's shared sidebar provider (keyed by
  // id), so the SidebarTrigger toggle and cookie persistence integrate with the
  // rest of the app. We render the rail inline (not the fixed-position Sidebar
  // container) so it nests after the main app sidebar instead of overlapping it.
  const { open: railOpen } = useSidebar('pdf_pages_rails')
  const { doc, baseSize, error } = usePdfDocument(src)
  const scrollRef = useRef<HTMLDivElement>(null)
  const pageEls = useRef(new Map<number, HTMLDivElement>())
  const thumbEls = useRef(new Map<number, HTMLButtonElement>())
  const [zoom, setZoom] = useState(1)
  const [currentPage, setCurrentPage] = useState(1)
  const [stageWidth, setStageWidth] = useState(0)

  const numPages = doc?.numPages ?? item.pdf?.pageCount ?? 0

  // Track the stage width so the default scale is always fit-to-width.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    // The rail is a flex sibling, so the viewer's measured width already
    // excludes it — only subtract the page's own horizontal padding (px-8).
    const ro = new ResizeObserver(([entry]) =>
      setStageWidth(
        Math.round(entry.target.getBoundingClientRect().width) - STAGE_PADDING
      )
    )
    ro.observe(el)
    return () => ro.disconnect()
  }, [doc])

  const scale = useMemo(() => {
    if (!baseSize || stageWidth === 0) return 1
    const fit = stageWidth / baseSize.width

    return Math.min(
      ZOOM_LEVELS[ZOOM_LEVELS.length - 1],
      Math.max(ZOOM_LEVELS[0], fit * zoom)
    )
  }, [baseSize, stageWidth, zoom])

  // Track which page dominates the viewport for the indicator + rail highlight.
  // Root is the viewport (null), not the inner container — intersection is
  // clipped by any scrolling ancestor anyway, so this works no matter which
  // element actually scrolls.
  useEffect(() => {
    if (!doc) return
    const ratios = new Map<number, number>()
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const n = Number((entry.target as HTMLElement).dataset.page)
          ratios.set(n, entry.intersectionRatio)
        }
        let best = 1
        let bestRatio = -1
        for (const [n, r] of ratios) {
          if (r > bestRatio) {
            best = n
            bestRatio = r
          }
        }
        if (bestRatio > 0) setCurrentPage(best)
      },
      { threshold: [0, 0.25, 0.5, 0.75, 1] }
    )
    for (const el of pageEls.current.values()) io.observe(el)
    return () => io.disconnect()
  }, [doc])

  // Keep the active thumbnail in view as the user scrolls the document.
  // Manual 'nearest' scoped to the rail's own viewport — scrollIntoView can
  // also scroll ancestor scrollers (see goToPage).
  useEffect(() => {
    const el = thumbEls.current.get(currentPage)
    if (!el) return
    const viewport = el.closest<HTMLElement>(
      '[data-slot="scroll-area-viewport"]'
    )
    if (!viewport) return
    const elTop =
      el.getBoundingClientRect().top -
      viewport.getBoundingClientRect().top +
      viewport.scrollTop
    const elBottom = elTop + el.offsetHeight
    if (elTop < viewport.scrollTop) {
      viewport.scrollTo({ top: elTop - 12 })
    } else if (elBottom > viewport.scrollTop + viewport.clientHeight) {
      viewport.scrollTo({ top: elBottom - viewport.clientHeight + 12 })
    }
  }, [currentPage])

  const registerPageEl = useMemo(
    () => (pageNumber: number, el: HTMLDivElement | null) => {
      if (el) pageEls.current.set(pageNumber, el)
      else pageEls.current.delete(pageNumber)
    },
    []
  )

  const registerThumbEl = useMemo(
    () => (pageNumber: number, el: HTMLButtonElement | null) => {
      if (el) thumbEls.current.set(pageNumber, el)
      else thumbEls.current.delete(pageNumber)
    },
    []
  )

  // Scroll only the viewer's own viewport. scrollIntoView would also scroll
  // every scrollable ancestor (the document included), shoving the whole
  // stage under the sticky app header.
  const goToPage = (n: number) => {
    const clamped = Math.max(1, Math.min(numPages, n))
    const el = pageEls.current.get(clamped)
    const viewport = scrollRef.current?.querySelector<HTMLElement>(
      '[data-slot="scroll-area-viewport"]'
    )
    if (!el || !viewport) return
    const top =
      viewport.scrollTop +
      el.getBoundingClientRect().top -
      viewport.getBoundingClientRect().top -
      24
    viewport.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
  }

  if (error) {
    return (
      <div className="flex h-full min-h-0 w-full flex-col items-center justify-center gap-3 bg-background text-muted-foreground">
        <Pdf2Icon className="size-10 opacity-40" />
        <p className="font-stashly text-sm">{error}</p>
      </div>
    )
  }

  if (!doc || !baseSize) {
    return (
      <div className="flex h-full min-h-0 w-full items-center justify-center bg-background text-muted-foreground">
        <LoaderIcon className="size-6 animate-spin" />
      </div>
    )
  }

  return (
    <div className="relative flex h-full min-h-0 w-full min-w-0 overflow-hidden">
      {/* Thumbnail rail — inline collapsible panel nested after the app
          sidebar. Driven by the shared provider state (useSidebar +
          SidebarTrigger); width animates to 0 when collapsed. */}
      <div
        data-state={railOpen ? 'open' : 'closed'}
        className="h-full shrink-0 overflow-hidden bg-card transition-[width] duration-200 ease-linear"
        style={{ width: railOpen ? RAIL_WIDTH : 0 }}
      >
        {/* Fixed inner width so thumbnails slide out (overflow-hidden) rather
            than squish during the collapse animation. */}
        <ScrollArea className="h-full" style={{ width: RAIL_WIDTH }}>
          {/* pb-20: lets the last thumbnail scroll fully clear of the viewer's
            bottom edge / overlaying chrome */}
          <div className="flex flex-col gap-4 px-4 pt-4 pb-20">
            {Array.from({ length: doc.numPages }, (_, i) => (
              <PdfThumb
                key={i + 1}
                doc={doc}
                pageNumber={i + 1}
                estimate={baseSize}
                active={currentPage === i + 1}
                onSelect={goToPage}
                registerEl={registerThumbEl}
              />
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Main viewer. overflow-hidden: the wrapper's width is the fit-width
          measurement basis, so content width must never influence it. */}
      <div
        ref={scrollRef}
        className="relative min-h-0 min-w-0 flex-1 overflow-hidden"
      >
        <ScrollArea scrollbars="both" type="always" className="h-full">
          {/* w-max + min-w-full: when a zoomed page is wider than the viewport
              the container grows with it, so the scrollable width includes the
              whole page and both edges stay reachable (centered overflow would
              clip the left side past the scroll origin). */}
          {/* pb-24: the floating toolbar overlays the bottom — extra padding so
              the last page can scroll fully above it */}
          <div className="flex w-max min-w-full flex-col items-center gap-6 px-8 pt-10 pb-24">
            {Array.from({ length: doc.numPages }, (_, i) => (
              <PdfPageView
                key={i + 1}
                doc={doc}
                pageNumber={i + 1}
                scale={baseSize ? scale : 1}
                estimate={baseSize}
                registerEl={registerPageEl}
              />
            ))}

            {/* Floating toolbar */}
            <div className="fixed bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-md border border-input bg-card px-2 py-1 shadow-lg ">
              <SidebarTrigger
                sidebarId="pdf_pages_rails"
                className="size-9 rounded-md"
              >
                <SidebarFillIcon className="size-5" />
              </SidebarTrigger>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full"
                aria-label="Previous page"
                disabled={currentPage <= 1}
                onClick={() => goToPage(currentPage - 1)}
              >
                <DropdownIcon className="size-5 rotate-180" />
              </Button>
              <span className="px-1 font-stashly text-xs tabular-nums text-muted-foreground">
                {currentPage} / {numPages}
              </span>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Next page"
                disabled={currentPage >= numPages}
                onClick={() => goToPage(currentPage + 1)}
              >
                <DropdownIcon className="size-5 " />
              </Button>

              <span className="mx-1 h-5 w-px bg-input" />

              <Button
                variant="ghost"
                size="icon"
                aria-label="Zoom out"
                disabled={zoom <= ZOOM_LEVELS[0]}
                onClick={() => setZoom((z) => stepZoom(z, -1))}
              >
                <ZoomOutFillIcon className="size-5" />
              </Button>
              <button
                type="button"
                title="Reset zoom (fit width)"
                onClick={() => setZoom(1)}
                className="w-12 text-center font-stashly text-xs tabular-nums text-muted-foreground hover:text-foreground"
              >
                {Math.round(zoom * 100)}%
              </button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Zoom in"
                disabled={zoom >= ZOOM_LEVELS[ZOOM_LEVELS.length - 1]}
                onClick={() => setZoom((z) => stepZoom(z, 1))}
              >
                <ZoomInFillIcon className="size-5" />
              </Button>
            </div>
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
