import {
  Forward10FillIcon,
  FullscreenFillIcon,
  LoaderIcon,
  MutedillIcon,
  PauseFillIcon,
  Previous10FillIcon,
  QuitFullscreenFillIcon,
  RefreshIcon,
  RepeatFillIcon,
  ResumeFillIcon,
  VideoFillIcon,
  VolumeFillIcon,
} from '@/components/icons'
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Slider,
} from '@/components/ui'
import { useAutoHideControls } from '@/hooks/useAutoHideControls'
import { useVideoPlayer } from '@/hooks/useVideoPlayer'
import type { StashItemVideo } from '@/types/stash.types'
import { formatClock } from '@/utils/formaters'
import { cn } from '@/utils/styles'
import { useEffect, useRef, useState, type JSX } from 'react'

const SKIP_SECONDS = 10
const RATES = [0.5, 1, 1.5, 2] as const

function VolIcon({
  muted,
  volume,
}: {
  muted: boolean
  volume: number
}): JSX.Element {
  if (muted || volume === 0) return <MutedillIcon className="size-5" />
  return <VolumeFillIcon className="size-5" />
}

// Round ghost icon button — composed from the shadcn Button primitive.
function IconBtn({
  label,
  onClick,
  children,
  variant = 'ghost',
  size = 'icon',
  className,
}: React.ComponentProps<typeof Button> & {
  label: string
  onClick?: () => void
}): JSX.Element {
  return (
    <Button
      variant={variant}
      size={size}
      type="button"
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.stopPropagation()
        onClick?.()
      }}
      className={cn(' active:scale-90', className)}
    >
      {children}
    </Button>
  )
}

// ---------------------------------------------------------------------------
// VideoStage — Pill Bar · shadcn/ui variant
// Controls cluster into floating pills above the frame: a title pill, a
// segmented transport/utility pill, and a full-width seek bar pinned to the
// bottom edge. Rebuilt entirely from shadcn primitives (Button, Slider,
// DropdownMenu) on a dark popover surface for legibility over video.
// ---------------------------------------------------------------------------

export function VideoStage({
  item,
  src,
}: {
  item: StashItemVideo
  src: string
}): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const v = useVideoPlayer(videoRef, containerRef)
  const { active, ping, setActive } = useAutoHideControls(2200)
  const [volOpen, setVolOpen] = useState(false)
  const [speedOpen, setSpeedOpen] = useState(false)

  const autoHide = true
  const show = !v.playing || !autoHide || active || v.ended || speedOpen
  const cursorHidden = v.playing && autoHide && !active

  const poster =
    item.thumbnails.find((t) => !t.url?.startsWith('#'))?.url ?? undefined
  const displayTitle = item.name.replace(/\.[^.]+$/, '')
  const volPct = Math.round((v.muted ? 0 : v.volume) * 100)

  // Reset transport when the source item changes.
  useEffect(() => {
    const el = videoRef.current
    if (!el) return
    el.pause()
    el.currentTime = 0
  }, [item.id])

  const onKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case ' ':
      case 'k':
        e.preventDefault()
        v.togglePlay()
        ping()
        break
      case 'ArrowLeft':
      case 'j':
        e.preventDefault()
        v.skip(-SKIP_SECONDS)
        ping()
        break
      case 'ArrowRight':
      case 'l':
        e.preventDefault()
        v.skip(SKIP_SECONDS)
        ping()
        break
      case 'ArrowUp':
        e.preventDefault()
        v.setVolumeLevel(Math.min(1, v.volume + 0.1))
        ping()
        break
      case 'ArrowDown':
        e.preventDefault()
        v.setVolumeLevel(Math.max(0, v.volume - 0.1))
        ping()
        break
      case 'm':
        v.toggleMuted()
        ping()
        break
      case 'f':
        v.toggleFullscreen()
        break
    }
  }

  return (
    <div className="flex h-full w-full items-center justify-center overflow-hidden p-4">
      <div
        ref={containerRef}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onMouseMove={ping}
        onMouseLeave={() => v.playing && setActive(false)}
        className={cn(
          'group relative w-full max-w-7xl select-none overflow-hidden rounded-xl border border-input bg-black shadow-2xl outline-none focus-visible:ring-2 focus-visible:ring-current/50',
          !v.fullscreen && 'aspect-video',
          v.fullscreen && 'rounded-none border-0',
          v.pseudoFs && 'fixed inset-0 z-9999 h-screen! w-screen! max-w-none',
          cursorHidden && 'cursor-none'
        )}
      >
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          ref={videoRef}
          src={src}
          poster={poster}
          preload="metadata"
          playsInline
          controls={false}
          disablePictureInPicture
          controlsList="nodownload nofullscreen noremoteplayback"
          onClick={v.togglePlay}
          onDoubleClick={v.toggleFullscreen}
          className="absolute inset-0 h-full w-full bg-black object-contain"
        />

        {/* Loading spinner */}
        {v.loading && src && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-white">
            <LoaderIcon className="size-10 animate-spin" />
          </div>
        )}

        {/* Missing src fallback */}
        {!src && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white">
            <VideoFillIcon className="size-12" />
            <p className="font-stashly text-sm">Video unavailable</p>
          </div>
        )}

        {/* Control layer — forced dark so popover surfaces stay legible over video */}
        {src && (
          <div className="dark">
            {/* title pill */}
            <div
              className={cn(
                'absolute left-4 top-4 z-10 transition-all duration-300',
                show ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0'
              )}
            >
              <div className="flex max-w-xs items-center gap-2 rounded-lg border border-border bg-popover/80 py-1.5 pl-3 pr-3.5 text-popover-foreground shadow-md backdrop-blur-md">
                <span className="size-1.5 shrink-0 rounded-full bg-primary" />
                <p className="truncate font-stashly text-xs font-medium">
                  {displayTitle}
                </p>
              </div>
            </div>

            {/* center play / replay */}
            {!v.playing && (
              <Button
                type="button"
                variant="secondary"
                size="icon"
                aria-label={v.ended ? 'Replay' : 'Play'}
                onClick={(e) => {
                  e.stopPropagation()
                  v.togglePlay()
                }}
                className="absolute left-1/2 top-1/2 z-20 size-16 -translate-x-1/2 -translate-y-1/2 rounded-full border border-border bg-popover/80 text-popover-foreground shadow-lg backdrop-blur-md hover:bg-popover"
              >
                {v.ended ? (
                  <RefreshIcon className="size-7" />
                ) : (
                  <ResumeFillIcon className="size-8" />
                )}
              </Button>
            )}

            {/* segmented pill bar — 16px from the bottom, centered */}
            <div
              className={cn(
                'absolute bottom-4 left-1/2 z-20 -translate-x-1/2 transition-all duration-300',
                show
                  ? 'translate-y-0 opacity-100'
                  : 'pointer-events-none translate-y-3 opacity-0'
              )}
            >
              <div className="grid w-[32rem] max-w-[calc(100vw-2rem)] grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-xl border border-border bg-popover/80 px-2 py-1 text-popover-foreground shadow-md backdrop-blur-md">
                {/* left: time */}
                <span className="justify-self-start pl-1.5 font-stashly text-xs tabular-nums text-muted-foreground">
                  {formatClock(v.currentTime)}{' '}
                  <span className="opacity-60">/ {formatClock(v.duration)}</span>
                </span>

                {/* center: transport */}
                <div className="flex items-center gap-1 justify-self-center">
                  <IconBtn
                    label="Back 10 seconds"
                    onClick={() => v.skip(-SKIP_SECONDS)}
                  >
                    <Previous10FillIcon className="size-5" />
                  </IconBtn>
                  <Button
                    type="button"
                    variant="default"
                    size="icon-lg"
                    aria-label={v.playing ? 'Pause' : 'Play'}
                    onClick={(e) => {
                      e.stopPropagation()
                      v.togglePlay()
                    }}
                  >
                    {v.playing ? (
                      <PauseFillIcon className="size-5" />
                    ) : (
                      <ResumeFillIcon className="size-6" />
                    )}
                  </Button>
                  <IconBtn
                    label="Forward 10 seconds"
                    onClick={() => v.skip(SKIP_SECONDS)}
                  >
                    <Forward10FillIcon className="size-5" />
                  </IconBtn>
                </div>

                {/* right: utilities */}
                <div className="flex items-center gap-1 justify-self-end">
                  {/* volume with vertical slider popover */}
                  <div
                    className="relative flex items-center"
                    onMouseEnter={() => setVolOpen(true)}
                    onMouseLeave={() => setVolOpen(false)}
                  >
                    <IconBtn label="Mute" onClick={v.toggleMuted}>
                      <VolIcon muted={v.muted} volume={v.volume} />
                    </IconBtn>
                    {volOpen && (
                      <div className="absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 rounded-md border border-border bg-popover/90 p-2 shadow-md backdrop-blur-md">
                        <div className="flex h-full max-h-max items-center w-6 flex-col items-center gap-1.5">
                          <Slider
                            orientation="vertical"
                            aria-label="Volume"
                            min={0}
                            max={100}
                            value={[volPct]}
                            onValueChange={([val]) =>
                              v.setVolumeLevel(val / 100)
                            }
                          />
                          <span className="font-stashly text-xs tabular-nums text-muted-foreground">
                            {volPct}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* repeat / loop toggle */}
                  <IconBtn
                    label={v.loop ? 'Disable repeat' : 'Repeat'}
                    onClick={v.toggleLoop}
                    className={cn(v.loop && 'text-primary')}
                  >
                    <RepeatFillIcon className="size-5" />
                  </IconBtn>

                  {/* playback speed */}
                  <DropdownMenu
                    open={speedOpen}
                    onOpenChange={setSpeedOpen}
                    modal={false}
                  >
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Playback speed"
                        className="font-stashly tabular-nums text-xs"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {v.rate}x
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      side="top"
                      align="center"
                      sideOffset={16}
                      className='w-3!'
                    >
                      {RATES.map((r) => (
                        <DropdownMenuItem
                          key={r}
                          onClick={(e) => {
                            e.stopPropagation()
                            v.setRate(r)
                            setSpeedOpen(false)
                          }}
                          className={cn(
                            'justify-between font-stashly tabular-nums',
                            v.rate === r && 'font-medium'
                          )}
                        >
                          {r}×{v.rate === r && <span>•</span>}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <IconBtn
                    label={v.fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                    onClick={v.toggleFullscreen}
                  >
                    {v.fullscreen ? (
                      <QuitFullscreenFillIcon className="size-5" />
                    ) : (
                      <FullscreenFillIcon className="size-5" />
                    )}
                  </IconBtn>
                </div>
              </div>
            </div>

            {/* full-width seek bar pinned to the bottom edge */}
            <div
              className={cn(
                'absolute inset-x-0 bottom-0 z-20 px-3 pb-2 transition-opacity duration-300',
                show ? 'opacity-100' : 'pointer-events-none opacity-0'
              )}
            >
              <Slider
                aria-label="Seek"
                min={0}
                max={v.duration || 0}
                step={0.1}
                value={[v.currentTime]}
                onValueChange={([val]) =>
                  v.seekFrac(v.duration ? val / v.duration : 0)
                }
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
