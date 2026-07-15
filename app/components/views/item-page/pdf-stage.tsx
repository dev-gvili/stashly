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
  ItemPanelFillIcon,
  TogglePdfPagesFillIcon,
} from '@/components/icons'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/utils/styles'
import { SidebarTrigger, useSidebar } from '@/components/ui'
import { usePdfDocument } from '@/hooks/usePdfDocument'
import { useLazyPageCanvas } from '@/hooks/useLazyPageCanvas'
import { ZOOM_LEVELS, toSteppedZoom } from '@/utils/converters'
import type { StashItemPdf } from '@/types/stash.types'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STAGE_PADDING = 64 // page container's horizontal padding (px-8 × 2)
const THUMB_WIDTH = 128 // css rem width of rail thumbnails
const THUMBNAIL_PANEL_WIDTH = '10rem' // expanded rail width

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
    rootMargin: '200% 0px',
  })

  useEffect(() => {
    registerEl(pageNumber, buttonRef.current)
    return () => registerEl(pageNumber, null)
  }, [pageNumber, registerEl])

  return (
    <Button
      variant="outline"
      ref={buttonRef}
      type="button"
      onClick={() => onSelect(pageNumber)}
      aria-label={`Page ${pageNumber}`}
      aria-current={active || undefined}
      className={cn(
        'relative flex w-full max-w-max overflow-hidden rounded-md bg-white ring-1 ring-input transition-shadow p-0',
        active
          ? 'ring-2 ring-primary'
          : 'hover:ring-2 hover:ring-muted-foreground/40',
          rendered && `h-[${Math.floor(estimate.height * scale)}px]`
      )}
    >
      <canvas ref={canvasRef} className="flex-1 flex rounded-md overflow-hidden min-w-0 min-h-0" />
      <span
        className={cn(
          'absolute bottom-0 left-0 flex size-6 items-center justify-center rounded-tr-sm font-stashly text-sm tabular-nums',
          active
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-muted-foreground'
        )}
      >
        {pageNumber}
      </span>
    </Button>
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
    rootMargin: '200% 0px',
  })

  useEffect(() => {
    registerEl(pageNumber, containerRef.current)
    return () => registerEl(pageNumber, null)
  }, [pageNumber, registerEl])

  return (
    <div
      ref={containerRef}
      data-page={pageNumber}
      className={cn(
        'relative flex bg-card! shadow-stashly border border-input rounded-md w-full max-w-full overflow-hidden',
        !rendered && 'bg-muted-foreground/5'
      )}
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
        className={cn(
          'flex-1 flex rounded-md overflow-hidden min-w-0 min-h-0',
          !rendered && 'absolute inset-0'
        )}
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

export function PdfStage({ item, src }: { item: StashItemPdf; src: string }) {
  // The rail's open state lives in the app's shared sidebar provider (keyed by
  // id), so the SidebarTrigger toggle and cookie persistence integrate with the
  // rest of the app. We render the rail inline (not the fixed-position Sidebar
  // container) so it nests after the main app sidebar instead of overlapping it.
  const { open: pagesPanelOpen } = useSidebar('pdf_pages_panel')
  const {
    open: panelOpen,
    setOpen: setPanelOpen,
    toggleSidebar,
  } = useSidebar('item_panel')
  const { doc, baseSize, error } = usePdfDocument(src)
  const scrollRef = useRef<HTMLDivElement>(null)
  const pageEls = useRef(new Map<number, HTMLDivElement>())
  const thumbEls = useRef(new Map<number, HTMLButtonElement>())
  const [zoom, setZoom] = useState(1)
  const [currentPage, setCurrentPage] = useState(1)
  const [stageWidth, setStageWidth] = useState(0)

  const numPages = doc?.numPages ?? item.pdf?.pageCount ?? 0

  useEffect(() => {
    if (!panelOpen) toggleSidebar()
    return () => setPanelOpen(true)
  }, [])

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
    <div className="relative flex h-full min-h-0 w-full min-w-0 overflow-hidden gap-2">
      {/* Thumbnail rail — inline collapsible panel nested after the app
          sidebar. Driven by the shared provider state (useSidebar +
          SidebarTrigger); width animates to 0 when collapsed. */}
      <div
        data-state={pagesPanelOpen ? 'open' : 'closed'}
        className={cn(
          'h-[calc(100vh-4rem)] shrink-0 overflow-hidden bg-card transition-[width,display] duration-200 ease-linear flex w-full flex-col rounded-lg border border-input shadow-stashly',
          pagesPanelOpen ? `w-[${THUMBNAIL_PANEL_WIDTH}] max-w-80` : 'hidden'
        )}
      >
        {/* Fixed inner width so thumbnails slide out (overflow-hidden) rather
            than squish during the collapse animation. */}
        <ScrollArea className={cn('h-full')} style={{ width: THUMBNAIL_PANEL_WIDTH }} type='hidden'>
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
      <div ref={scrollRef} className="relative flex-1 overflow-hidden h-[calc(100vh-4rem)] rounded-lg">
        <ScrollArea type="hover" className="h-full">
          {/* w-max + min-w-full: when a zoomed page is wider than the viewport
              the container grows with it, so the scrollable width includes the
              whole page and both edges stay reachable (centered overflow would
              clip the left side past the scroll origin). */}
          {/* pb-24: the floating toolbar overlays the bottom — extra padding so
              the last page can scroll fully above it */}
          <div className="relative flex w-full flex-col items-center gap-y-4 pt-0 pb-24">
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
          </div>
        </ScrollArea>
        {/* Floating toolbar */}
        <div className="z-20 flex items-center gap-1 rounded-md border border-input bg-card px-2 py-1 shadow-lg absolute bottom-16 left-1/2 -translate-x-1/2">
          <SidebarTrigger
            sidebarId="pdf_pages_panel"
            className="size-9 rounded-md"
            asChild
            tooltip="Toggle page thumbnails"
          >
            <Button variant="ghost" size="icon" className="border-none">
              <TogglePdfPagesFillIcon className="size-5 text-muted-foreground" />
            </Button>
          </SidebarTrigger>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            aria-label="Previous page"
            disabled={currentPage <= 1}
            onClick={() => goToPage(currentPage - 1)}
          >
            <DropdownIcon className="size-5 rotate-180 text-muted-foreground" />
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
            <DropdownIcon className="size-5 text-muted-foreground" />
          </Button>

          <span className="mx-1 h-5 w-px bg-input" />

          <Button
            variant="ghost"
            size="icon"
            aria-label="Zoom out"
            disabled={zoom <= ZOOM_LEVELS[0]}
            onClick={() => setZoom((z) => toSteppedZoom(z, -1))}
          >
            <ZoomOutFillIcon className="size-5 text-muted-foreground" />
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
            onClick={() => setZoom((z) => toSteppedZoom(z, 1))}
          >
            <ZoomInFillIcon className="size-5 text-muted-foreground" />
          </Button>
          <SidebarTrigger
            sidebarId="item_panel"
            asChild
            tooltip="Toggle Item Panel"
          >
            <Button
              variant="ghost"
              size="icon"
              aria-label="Toggle Item Panel"
              className="border-none"
            >
              <ItemPanelFillIcon
                className={cn('size-5 text-muted-foreground')}
              />
            </Button>
          </SidebarTrigger>
        </div>
      </div>
    </div>
  )
}
