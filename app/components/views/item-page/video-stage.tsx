import { useState, useRef, useEffect, useCallback, type JSX } from 'react'
import {
  PauseFillIcon,
  ResumeFillIcon,
  VideoFillIcon,
  VolumeFillIcon,
  MutedillIcon,
  LoaderIcon,
  Forward10FillIcon,
  Previous10FillIcon,
  FullscreenFillIcon,
  QuitFullscreenFillIcon,
  RefreshIcon,
} from '@/components/icons'
import { cn } from '@/utils/styles'
import {
  Badge,
  Button,
  ToggleGroup,
  ToggleGroupItem,
  Tooltip,
} from '@/components/ui'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type VideoItemShape = {
  id: string
  name: string
  thumbnails: Array<{ url: string | null; size: string; view: string }>
  video: {
    width: number | null
    height: number | null
    duration: number | null
  } | null
}

const SKIP_SECONDS = 10
const RATES = [0.5, 1, 1.5, 2] as const

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec || 0))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
    : `${m}:${String(r).padStart(2, '0')}`
}

// ---------------------------------------------------------------------------
// useVideo — binds to a real <video>, drives all transport state.
// No native controls — every interaction is hand-built here.
// ---------------------------------------------------------------------------

function useVideo(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  containerRef: React.RefObject<HTMLElement | null>
) {
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [buffered, setBuffered] = useState(0)
  const [loading, setLoading] = useState(true)
  const [muted, setMuted] = useState(false)
  const [volume, setVolume] = useState(1)
  const [rate, setRateState] = useState(1)
  const [ended, setEnded] = useState(false)
  const [realFs, setRealFs] = useState(false)
  const [pseudoFs, setPseudoFs] = useState(false)
  const fullscreen = realFs || pseudoFs

  useEffect(() => {
    const el = videoRef.current
    if (!el) return
    const onPlay = () => {
      setPlaying(true)
      setEnded(false)
    }
    const onPause = () => setPlaying(false)
    const onEnded = () => {
      setPlaying(false)
      setEnded(true)
    }
    const onTime = () => {
      setCurrentTime(el.currentTime)
      if (el.buffered.length)
        setBuffered(
          el.buffered.end(el.buffered.length - 1) / (el.duration || 1)
        )
    }
    const onMeta = () => {
      setDuration(el.duration || 0)
      setLoading(false)
    }
    const onWaiting = () => setLoading(true)
    const onCanPlay = () => setLoading(false)
    const onVol = () => {
      setVolume(el.volume)
      setMuted(el.muted || el.volume === 0)
    }
    el.addEventListener('play', onPlay)
    el.addEventListener('pause', onPause)
    el.addEventListener('ended', onEnded)
    el.addEventListener('timeupdate', onTime)
    el.addEventListener('loadedmetadata', onMeta)
    el.addEventListener('waiting', onWaiting)
    el.addEventListener('canplay', onCanPlay)
    el.addEventListener('playing', onCanPlay)
    el.addEventListener('volumechange', onVol)
    return () => {
      el.removeEventListener('play', onPlay)
      el.removeEventListener('pause', onPause)
      el.removeEventListener('ended', onEnded)
      el.removeEventListener('timeupdate', onTime)
      el.removeEventListener('loadedmetadata', onMeta)
      el.removeEventListener('waiting', onWaiting)
      el.removeEventListener('canplay', onCanPlay)
      el.removeEventListener('playing', onCanPlay)
      el.removeEventListener('volumechange', onVol)
    }
  }, [videoRef])

  // Track real fullscreen + allow Esc to leave the pseudo-fullscreen fallback.
  useEffect(() => {
    const onFsChange = () =>
      setRealFs(document.fullscreenElement === containerRef.current)
    document.addEventListener('fullscreenchange', onFsChange)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && pseudoFs) setPseudoFs(false)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange)
      window.removeEventListener('keydown', onKey)
    }
  }, [containerRef, pseudoFs])

  const togglePlay = useCallback(() => {
    const el = videoRef.current
    if (!el) return
    if (el.paused || el.ended) el.play().catch(() => {})
    else el.pause()
  }, [videoRef])

  const seekFrac = useCallback(
    (frac: number) => {
      const el = videoRef.current
      if (!el || !el.duration) return
      const f = Math.max(0, Math.min(1, frac))
      el.currentTime = f * el.duration
      setCurrentTime(f * el.duration)
    },
    [videoRef]
  )

  const skip = useCallback(
    (delta: number) => {
      const el = videoRef.current
      if (!el) return
      const d = el.duration || 0
      el.currentTime = Math.max(0, Math.min(d, el.currentTime + delta))
      setCurrentTime(el.currentTime)
    },
    [videoRef]
  )

  const setVolumeLevel = useCallback(
    (v: number) => {
      const el = videoRef.current
      if (!el) return
      const nv = Math.max(0, Math.min(1, v))
      el.volume = nv
      el.muted = nv === 0
    },
    [videoRef]
  )

  const toggleMuted = useCallback(() => {
    const el = videoRef.current
    if (!el) return
    el.muted = !el.muted
    if (!el.muted && el.volume === 0) el.volume = 0.6
  }, [videoRef])

  const setRate = useCallback(
    (r: number) => {
      const el = videoRef.current
      if (!el) return
      el.playbackRate = r
      setRateState(r)
    },
    [videoRef]
  )

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    if (realFs) {
      document.exitFullscreen?.().catch(() => {})
      return
    }
    if (pseudoFs) {
      setPseudoFs(false)
      return
    }
    if (el.requestFullscreen) {
      el.requestFullscreen().catch(() => setPseudoFs(true))
    } else {
      setPseudoFs(true)
    }
  }, [containerRef, realFs, pseudoFs])

  const t = duration > 0 ? currentTime / duration : 0
  return {
    playing,
    currentTime,
    duration,
    buffered,
    loading,
    muted,
    volume,
    rate,
    ended,
    t,
    fullscreen,
    pseudoFs,
    togglePlay,
    seekFrac,
    skip,
    setVolumeLevel,
    toggleMuted,
    setRate,
    toggleFullscreen,
  }
}

// ---------------------------------------------------------------------------
// useScrub — pointer scrub surface returning hover fraction + drag state
// ---------------------------------------------------------------------------

function useScrub(onSeek: (frac: number) => void) {
  const ref = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<number | null>(null)
  const [dragging, setDragging] = useState(false)

  const fracAt = (clientX: number) => {
    if (!ref.current) return 0
    const r = ref.current.getBoundingClientRect()
    return Math.max(0, Math.min(1, (clientX - r.left) / r.width))
  }

  const onPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation()
    setDragging(true)
    const f = fracAt(e.clientX)
    setHover(f)
    onSeek(f)
    const move = (ev: PointerEvent) => {
      const g = fracAt(ev.clientX)
      setHover(g)
      onSeek(g)
    }
    const up = () => {
      setDragging(false)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging) setHover(fracAt(e.clientX))
  }
  const onPointerLeave = () => {
    if (!dragging) setHover(null)
  }

  return { ref, onPointerDown, onPointerMove, onPointerLeave, hover, dragging }
}

// ---------------------------------------------------------------------------
// useActivity — show controls on motion, auto-hide after a beat
// ---------------------------------------------------------------------------

function useActivity(delay = 2200) {
  const [active, setActive] = useState(true)
  const tRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const ping = useCallback(() => {
    setActive(true)
    if (tRef.current) clearTimeout(tRef.current)
    tRef.current = setTimeout(() => setActive(false), delay)
  }, [delay])
  return { active, ping, setActive }
}

// ---------------------------------------------------------------------------
// Range — small reusable horizontal slider (volume), white-on-dark
// ---------------------------------------------------------------------------

function Range({
  value,
  onChange,
  className,
}: {
  value: number
  onChange: (v: number) => void
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const at = (clientX: number) => {
    if (!ref.current) return
    const r = ref.current.getBoundingClientRect()
    onChange(Math.max(0, Math.min(1, (clientX - r.left) / r.width)))
  }
  const onDown = (e: React.PointerEvent) => {
    e.stopPropagation()
    at(e.clientX)
    const move = (ev: PointerEvent) => at(ev.clientX)
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }
  return (
    <div
      ref={ref}
      onPointerDown={onDown}
      className={cn(
        'group/r relative flex h-4 cursor-pointer items-center',
        className
      )}
    >
      <div className="relative h-1 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-current"
          style={{ width: `${value * 100}%` }}
        />
      </div>
      <span
        className="absolute size-3 -translate-x-1/2 rounded-full bg-current opacity-0 shadow transition-opacity group-hover/r:opacity-100"
        style={{ left: `${value * 100}%` }}
      />
    </div>
  )
}

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

// Time bubble shown above the scrubber on hover/drag.
function TimeBubble({
  frac,
  duration,
}: {
  frac: number | null
  duration: number
}): JSX.Element | null {
  if (frac == null) return null
  return (
    <Badge
      className="pointer-events-none absolute bottom-full mb-2 -translate-x-1/2 rounded bg-background px-1.5 py-0.5 font-stashly text-xs tabular-nums text-foreground shadow-lg ring-1 ring-white/10"
      style={{ left: `${frac * 100}%` }}
    >
      {fmtClock(frac * duration)}
    </Badge>
  )
}

// Round ghost control button (white on dark).
function Ctrl({
  children,
  label,
  onClick,
  size = 'icon',
  className,
}: React.ComponentProps<typeof Button> & {
  label: string
  onClick?: () => void
}): JSX.Element {
  const dim =
    size === 'icon-lg' ? 'size-12' : size === 'icon-sm' ? 'size-8' : 'size-10'
  return (
      <Button
        variant="ghost"
        size="icon"
        type="button"
        aria-label={label}
        title={label}
        onClick={(e) => {
          e.stopPropagation()
          onClick?.()
        }}
        className={cn(
          'rounded-md text-current transition-all active:scale-90',
          dim,
          className
        )}
      >
        {children}
      </Button>
  )
}

// ---------------------------------------------------------------------------
// VideoStage — Frosted Sheet variant
// Tactile inset frosted sheet: chunky draggable timeline, monochrome-filled
// center play flanked by skips, speed pills, expanding volume, fullscreen.
// ---------------------------------------------------------------------------

export function VideoStage({
  item,
  src,
}: {
  item: VideoItemShape
  src: string
}): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const v = useVideo(videoRef, containerRef)
  const scrub = useScrub(v.seekFrac)
  const { active, ping, setActive } = useActivity(8000)
  const [volOpen, setVolOpen] = useState(false)

  const autoHide = true
  const show = !v.playing || !autoHide || active || v.ended
  const cursorHidden = v.playing && autoHide && !active

  const poster =
    item.thumbnails.find((t) => !t.url?.startsWith('#'))?.url ?? undefined
  const displayTitle = item.name.replace(/\.[^.]+$/, '')

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
        onMouseLeave={() => v.playing && setActive(true)}
        className={cn(
          'group relative w-full max-w-5xl select-none overflow-hidden rounded-xl border border-input bg-background shadow-2xl shadown-stashly outline-none focus-visible:ring-2 focus-visible:ring-current/50',
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
          className="absolute inset-0 h-full w-full bg-background object-contain"
        />

        {/* Loading spinner */}
        {v.loading && src && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <LoaderIcon className="size-10 animate-spin" />
          </div>
        )}

        {/* Missing src fallback */}
        {!src && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-current">
            <VideoFillIcon className="size-12" />
            <p className="font-stashly text-sm">Video unavailable</p>
          </div>
        )}

        {/* Center play / replay
        {!v.playing && src && (
          <button
            type="button"
            aria-label={v.ended ? 'Replay' : 'Play'}
            onClick={(e) => {
              e.stopPropagation()
              v.togglePlay()
            }}
            className="absolute left-1/2 top-1/2 z-20 flex size-19 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white ring-1 ring-white/20 backdrop-blur-md transition-transform hover:scale-105"
          >
            {v.ended ? (
              <RefreshIcon className="size-8" />
            ) : (
              <ResumeFillIcon className="size-9" />
            )}
          </button>
        )} */}

        {/* Frosted control sheet */}
        {src && (
          <div
            className={cn(
              'absolute inset-x-0 bottom-0 z-20 p-3 transition-all duration-300 sm:p-4',
              show
                ? 'translate-y-0 opacity-100'
                : 'pointer-events-none translate-y-4 opacity-0'
            )}
          >
            <div className="rounded-2xl border border-border/15 bg-background p-3.5 text-foreground shadow-2xl backdrop-blur-2xl sm:p-4">
              {/* Tactile timeline */}
              <div className="mb-3 flex items-center gap-3">
                <span className="w-11 shrink-0 text-center font-stashly text-xs tabular-nums text-current">
                  {fmtClock(v.currentTime)}
                </span>
                <div
                  ref={scrub.ref}
                  onPointerDown={scrub.onPointerDown}
                  onPointerMove={scrub.onPointerMove}
                  onPointerLeave={scrub.onPointerLeave}
                  className="relative h-5 flex-1 cursor-pointer"
                >
                  <TimeBubble frac={scrub.hover} duration={v.duration} />
                  <div className="absolute inset-x-0 top-1/2 h-2.5 -translate-y-1/2 overflow-hidden rounded-full bg-input/25">
                    <div
                      className="absolute inset-y-0 left-0 bg-muted"
                      style={{ width: `${v.buffered * 100}%` }}
                    />
                    <div
                      className="absolute inset-y-0 left-0 rounded-full bg-current"
                      style={{ width: `${v.t * 100}%` }}
                    />
                  </div>
                  <span
                    className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-current shadow-lg ring-2 ring-ring/20 transition-transform group-hover:scale-110"
                    style={{ left: `${v.t * 100}%` }}
                  />
                </div>
                <span className="w-11 shrink-0 text-center font-stashly text-xs tabular-nums text-current">
                  {fmtClock(v.duration)}
                </span>
              </div>

              {/* Control row */}
              <div className="flex items-center justify-between gap-2">
                {/* left: title */}
                <div className="hidden min-w-0 flex-1 sm:block">
                  <p className="truncate font-stashly text-sm font-medium text-current">
                    {displayTitle}
                  </p>
                </div>

                {/* center transport */}
                <div className="flex items-center gap-1.5">
                  <Ctrl
                    label="Back 10 seconds"
                    onClick={() => v.skip(-SKIP_SECONDS)}
                  >
                    <Previous10FillIcon className="size-6 text-current" />
                  </Ctrl>
                  <Button
                    variant="default"
                    size="icon-lg"
                    type="button"
                    aria-label={
                      v.playing ? 'Pause' : v.ended ? 'Replay' : 'Play'
                    }
                    onClick={(e) => {
                      e.stopPropagation()
                      v.togglePlay()
                    }}
                    className="flex size-14 shrink-0 items-center justify-center rounded-2xl  shadow-lg transition-transform hover:scale-105 active:scale-95 bg-foreground"
                  >
                    {v.playing ? (
                      <PauseFillIcon className="size-6" />
                    ) : v.ended ? (
                      <RefreshIcon className="size-6" />
                    ) : (
                      <ResumeFillIcon className="size-7" />
                    )}
                  </Button>
                  <Ctrl
                    label="Forward 10 seconds"
                    onClick={() => v.skip(SKIP_SECONDS)}
                  >
                    <Forward10FillIcon className="size-6" />
                  </Ctrl>
                </div>

                {/* right: speed pills + volume + fullscreen */}
                <div className="flex flex-1 items-center justify-end gap-1.5">
                    <ToggleGroup
                      type="single"
                      size="sm"
                      variant="default"
                      className='gap-1 bg-background/10 rounded! p-0.5'

                    >
                      {RATES.map((r) => (
                        <ToggleGroupItem
                          value={`${r}`}
                          variant="default"
                          key={r}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            v.setRate(r)
                          }}
                          className="text-xs h-5 rounded first:rounded-l last:rounded-r"
                        >
                          {r}×
                        </ToggleGroupItem>
                      ))}
                    </ToggleGroup>
                  <div
                    className="relative flex items-center"
                    onMouseEnter={() => setVolOpen(true)}
                    onMouseLeave={() => setVolOpen(false)}
                  >
                    <Ctrl label="Mute" onClick={v.toggleMuted}>
                      <VolIcon muted={v.muted} volume={v.volume} />
                    </Ctrl>
                    <div
                      className="overflow-hidden transition-all duration-200"
                      style={{ width: volOpen ? 80 : 0 }}
                    >
                      <Range
                        className="mx-1 w-18"
                        value={v.muted ? 0 : v.volume}
                        onChange={v.setVolumeLevel}
                      />
                    </div>
                  </div>
                  <Ctrl
                    label={v.fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                    onClick={v.toggleFullscreen}
                  >
                    {v.fullscreen ? (
                      <QuitFullscreenFillIcon className="size-5" />
                    ) : (
                      <FullscreenFillIcon className="size-5" />
                    )}
                  </Ctrl>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
