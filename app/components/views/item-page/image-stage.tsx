import {
  ImageFillIcon,
  ItemPanelFillIcon,
  MinimizeFillIcon,
  ZoomInFillIcon,
  ZoomOutFillIcon,
} from '@/components/icons'
import { Button, SidebarTrigger, Tooltip } from '@/components/ui'
import { useZoom } from '@/hooks/useZoom'
import type { StashItemImage } from '@/types/stash.types'
import { cn } from '@/utils/styles'
import { useEffect, type JSX } from 'react'

// Round ghost icon button — composed from the shadcn Button primitive.
function IconBtn({
  label,
  onClick,
  disabled,
  active,
  children,
}: React.ComponentProps<typeof Button> & {
  label: string
  active?: boolean
}): JSX.Element {
  return (
    <Tooltip content={label} side="top" align="center" asChild>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={label}
        aria-pressed={active}
        disabled={disabled}
        onClick={onClick}
        className={cn(
          'hover:bg-transparent data-[state=open]:bg-transparent',
          active && 'text-primary!'
        )}
      >
        {children}
      </Button>
    </Tooltip>
  )
}

// ---------------------------------------------------------------------------
// ImageStage — pan & zoom image viewer
// Mirrors the gallery-image overlay's media region: scroll / pinch to zoom,
// drag to pan, and a floating control pill (zoom out · % · zoom in · reset)
// pinned to the bottom edge. Keyboard: +/= zoom in, - zoom out.
// ---------------------------------------------------------------------------

export function ImageStage({
  item,
  src,
}: {
  item: StashItemImage
  src: string
}): JSX.Element {
  const zoom = useZoom()

  // Reset zoom whenever the displayed image changes.
  useEffect(() => zoom.reset(), [item.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard zoom shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '+' || e.key === '=') zoom.zoomIn()
      else if (e.key === '-') zoom.zoomOut()
      else if (e.key === '0') zoom.reset()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [zoom])

  return (
    <div
      className="relative flex h-[calc(100vh-4rem)] max-h-[calc(100vh-4rem)] min-h-0 w-full items-center justify-center min-w-0 overflow-hidden gap-2 pr-2 pb-16"
      onWheel={zoom.onWheel}
      onMouseDown={zoom.onMouseDown}
      onMouseMove={zoom.onMouseMove}
      onMouseUp={zoom.onMouseUp}
      onMouseLeave={zoom.onMouseUp}
      style={{ cursor: zoom.scale > 1 ? 'grab' : 'default' }}
    >
      {/* Missing src fallback */}
      {!src ? (
        <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground">
          <ImageFillIcon className="size-12" />
          <p className="font-stashly text-sm">Image unavailable</p>
        </div>
      ) : (
        <img
          key={item.id}
          src={src}
          alt={item.name}
          draggable={false}
          className="max-h-full max-w-full select-none rounded-xl border border-input object-contain shadow-2xl shadow-stashly transition-transform duration-150"
          style={{
            viewTransitionName: `img-${item.id}`,
            transform: `translate(${zoom.tx}px, ${zoom.ty}px) scale(${zoom.scale})`,
          }}
        />
      )}

      {/* floating zoom controls */}
      {src && (
        <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-0.5 rounded-md border border-input bg-sidebar p-1 shadow-stashly backdrop-blur-sm">
          <IconBtn
            label="Zoom out"
            onClick={zoom.zoomOut}
            disabled={zoom.scale <= 1}
          >
            <ZoomOutFillIcon className="size-5" />
          </IconBtn>
          <span className="w-11 text-center font-stashly text-xs tabular-nums text-muted-foreground">
            {Math.round(zoom.scale * 100)}%
          </span>
          <IconBtn
            label="Zoom in"
            onClick={zoom.zoomIn}
            disabled={zoom.scale >= 5}
          >
            <ZoomInFillIcon className="size-5" />
          </IconBtn>
          <IconBtn
            label="Reset zoom"
            onClick={zoom.reset}
            disabled={zoom.scale === 1}
          >
            <MinimizeFillIcon className="size-5" />
          </IconBtn>
          <SidebarTrigger
            sidebarId="item_panel"
            asChild
            tooltip="Toggle Item Panel"
          >
            <IconBtn label="Toggle Item Panel" onClick={zoom.reset}>
              <ItemPanelFillIcon
                className={cn('size-5 text-muted-foreground')}
              />
            </IconBtn>
          </SidebarTrigger>
        </div>
      )}
    </div>
  )
}
