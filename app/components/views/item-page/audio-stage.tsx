import { useState, useRef, useEffect, useMemo } from 'react'
import {
  PauseFillIcon,
  ResumeFillIcon,
  AudioFillIcon,
  SkipPreviousFillIcon,
  RepeatFillIcon,
  ShuffleFillIcon,
  VolumeFillIcon,
  MutedillIcon,
} from '@/components/icons'
import { cn } from '@/utils/styles'
import { Button } from '@/components/ui/button'
import { Slider, Toggle } from '@/components/ui'
import { useAudioPlayer } from '@/hooks/useAudioPlayer'
import { formatClock } from '@/utils/formaters'
import { toSeedFromId, toWaveform } from '@/utils/converters'
import type { StashItemAudio } from '@/types/stash.types'

// ---------------------------------------------------------------------------
// Scrubber
// ---------------------------------------------------------------------------

function Scrubber({
  value,
  onSeek,
}: {
  value: number
  onSeek: (v: number) => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  const seekAt = (clientX: number) => {
    if (!ref.current) return
    const r = ref.current.getBoundingClientRect()
    onSeek(Math.max(0, Math.min(1, (clientX - r.left) / r.width)))
  }

  const onPointerDown = (e: React.PointerEvent) => {
    seekAt(e.clientX)
    const move = (ev: PointerEvent) => seekAt(ev.clientX)
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
      onPointerDown={onPointerDown}
      className="group relative h-4 flex-1 cursor-pointer select-none"
    >
      <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded-full bg-muted">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-primary"
          style={{ width: `${value * 100}%` }}
        />
      </div>
      <div
        className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary opacity-0 shadow ring-2 ring-card transition-opacity group-hover:opacity-100"
        style={{ left: `${value * 100}%` }}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// TransportBtn — ghost round icon button
// ---------------------------------------------------------------------------

function TransportBtn({
  children,
  label,
  onClick,
  active,
  large,
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof Button> & {
  label: string
  active?: boolean
  large?: boolean
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-pressed={active}
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        'flex shrink-0 items-center justify-center  transition-all',
        active && 'text-primary-foreground! bg-primary!',
        large &&
          'hover:scale-110 size-16 rounded-3xl hover:bg-current! bg-current! [&_svg]:text-background!',
        className
      )}
      {...props}
    >
      {children}
    </Button>
  )
}

// ---------------------------------------------------------------------------
// CoverArt
// ---------------------------------------------------------------------------

function CoverArt({ src, name }: { src: string | null; name: string }) {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-72 overflow-hidden rounded-2xl border border-border shadow-2xl">
      {src ? (
        <img src={src} alt={name} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-muted">
          <AudioFillIcon
            className="size-16 text-muted-foreground/40"
            style={{ fontSize: 64 }}
          />
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Waveform
// ---------------------------------------------------------------------------

function Waveform({
  bars,
  playedCount,
  onSeek,
}: {
  bars: number[]
  playedCount: number
  onSeek: (frac: number) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)

  const seekAt = (clientX: number) => {
    if (!containerRef.current) return
    const r = containerRef.current.getBoundingClientRect()
    onSeek(Math.max(0, Math.min(1, (clientX - r.left) / r.width)))
  }

  const onPointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    seekAt(e.clientX)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (e.buttons === 0) return
    seekAt(e.clientX)
  }

  return (
    <div
      ref={containerRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      className="flex h-full items-center gap-0.5 cursor-pointer select-none"
      role="slider"
      aria-label="Seek"
    >
      {bars.map((h, i) => {
        const played = i <= playedCount
        return (
          <div key={i} className="flex h-full flex-1 items-center">
            <span
              className={cn(
                'block w-full rounded-full transition-colors',
                played ? 'bg-primary' : 'bg-muted',
                !played && 'opacity-40'
              )}
              style={{ height: `${h * 100}%` }}
            />
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// AudioStage — exported main component
// ---------------------------------------------------------------------------

export function AudioStage({
  item,
  src,
}: {
  item: StashItemAudio
  src: string
}) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const audio = useAudioPlayer(audioRef)
  const wave = useMemo(() => toWaveform(72, toSeedFromId(item.id)), [item.id])
  const [volume, setVolume] = useState(audio.volume)
  const prevVolumeRef = useRef(audio.volume)
  const [shuffle, setShuffle] = useState(false)
  const [loop, setLoop] = useState(false)

  const toVolume = (v: number) => setVolume(v / 100)

  // Reset on item change
  useEffect(() => {
    const el = audioRef.current
    if (!el) return
    el.pause()
    el.currentTime = 0
  }, [item.id])

  // Sync slider → audio element volume
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume
  }, [volume])

  useEffect(() => {
    if (audioRef.current) audioRef.current.loop = loop
  }, [loop])

  const coverSrc =
    item.thumbnails.find((t) => !t.url?.startsWith('#'))?.url ?? null

  const displayTitle = item.audio?.title ?? item.name.replace(/\.[^.]+$/, '')
  const displayArtist = item.audio?.artist
  const displayAlbum = item.audio?.album

  const playedBars = Math.round(wave.length * audio.t)
  const displayDuration =
    audio.duration > 0
      ? formatClock(audio.duration)
      : formatClock(item.audio?.duration ?? 0)

  return (
    <div className="flex h-full w-full items-center justify-center overflow-hidden p-6">
      {/* Hidden real audio element */}
      <audio ref={audioRef} src={src} preload="metadata" className="hidden" />

      <div className="w-full max-w-max space-y-6">
        {/* Cover art */}
        <CoverArt src={coverSrc} name={displayTitle} />

        {/* Track info */}
        <div className="text-center">
          <h2 className="font-stashly text-base font-semibold leading-tight text-foreground">
            {displayTitle}
          </h2>
          {(displayArtist || displayAlbum) && (
            <p className="mt-1 text-sm text-muted-foreground">
              {[displayArtist, displayAlbum].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>

        {/* Waveform + times */}
        <div className="space-y-2 h-20 min-w-lg mx-auto">
          <Waveform bars={wave} playedCount={playedBars} onSeek={audio.seek} />
          <div className="flex items-center justify-between font-stashly text-xs tabular-nums text-muted-foreground">
            <span>{formatClock(audio.currentTime)}</span>
            <span>{displayDuration}</span>
          </div>
        </div>

        {/* Transport controls */}
        <div className="grid gap-2 mx-auto w-xs">
          <div className="flex items-center justify-evenly gap-2 ">
            <TransportBtn
              label="Shuffle"
              active={shuffle}
              onClick={() => setShuffle((s) => !s)}
              variant="ghost"
              size="icon-lg"

              className="hover:bg-muted! hover:text-muted-foreground!"
            >
              <ShuffleFillIcon />
            </TransportBtn>

            <TransportBtn
              label="Previous"
              variant="ghost"
              size="icon-lg"
              className="hover:bg-muted! hover:text-muted-foreground!"
              onClick={() => {
                if (audioRef.current) audioRef.current.currentTime = 0
              }}
            >
              <SkipPreviousFillIcon />
            </TransportBtn>

            <TransportBtn
              large
              label={audio.playing ? 'Pause' : 'Play'}
              onClick={audio.togglePlay}
            >
              {audio.playing ? <PauseFillIcon /> : <ResumeFillIcon />}
            </TransportBtn>

            <TransportBtn
              label="Next"
              variant="ghost"
              size="icon-lg"
              className="hover:bg-muted! hover:text-muted-foreground!"
            >
              <SkipPreviousFillIcon className="rotate-180" />
            </TransportBtn>

            <TransportBtn
              label="Loop"
              active={loop}
              onClick={() => setLoop((l) => !l)}
              variant="ghost"
              size="icon-lg"
              className="hover:bg-muted! hover:text-muted-foreground!"
            >
              <RepeatFillIcon />
            </TransportBtn>
          </div>

          {/* Volume */}
          <div className="flex items-center justify-evenly gap-2 ">
            <Toggle
              onPressedChange={(pressed) => {
                const el = audioRef.current
                if (!el) return
                if (pressed) {
                  prevVolumeRef.current = volume
                  setVolume(0)
                  el.muted = true
                } else {
                  const restored = prevVolumeRef.current
                  setVolume(restored)
                  el.muted = false
                }
              }}
              pressed={audio.muted}
              aria-label="Mute"
              size='lg'
              className="aria-pressed:bg-transparent! aria-pressed:text-current! hover:aria-pressed:bg-muted! hover:aria-pressed:text-current!"
            >
              {audio.muted ? (
                <MutedillIcon className="size-5!" />
              ) : (
                <VolumeFillIcon className="size-5!" />
              )}
            </Toggle>
            <VolumeBar
              value={[volume * 100]}
              onValueChange={(v) => toVolume(v[0])}
            />
            <span className="size-5 shrink-0 font-stashly text-sm tabular-nums text-muted-foreground">
              {Math.round(volume * 100)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

function VolumeBar({
  value,
  className,
  onValueChange,
  onValueCommit,
  ...props
}: React.ComponentProps<typeof Slider>) {
  // const at = (clientX: number) => {
  //   if (!ref.current) return
  //   const r = ref.current.getBoundingClientRect()
  //   onValueChange(Math.max(0, Math.min(1, (clientX - r.left) / r.width)))
  // }

  const _onValueChange = (v: number | number[]) => {
    if (!onValueChange) return
    if (!Array.isArray(v)) onValueChange([v])
    else onValueChange(v)
  }

  const _onValueCommit = (v: number | number[]) => {
    if (!onValueCommit) return
    if (!Array.isArray(v)) onValueCommit([v])
    else onValueCommit(v)
  }
  return (
    <Slider
      min={0}
      max={100}
      step={1}
      value={value}
      onValueChange={_onValueChange}
      onValueCommit={_onValueCommit}
      className={cn('max-w-48 flex-1', className)}
      {...props}
    />
  )
}
