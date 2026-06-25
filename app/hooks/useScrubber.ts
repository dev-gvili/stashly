import { useState, useRef } from 'react'

/**
 * Turns any element into a pointer-driven scrub surface (timeline, volume bar).
 * Tracks the hover fraction (0–1 across the element's width) and a `dragging`
 * flag, and calls `onSeek` continuously while the pointer is pressed and moved —
 * window-level `pointermove`/`pointerup` listeners keep the drag alive even when
 * the pointer leaves the element. Spread `ref` and the returned handlers onto the
 * surface element.
 *
 * @param onSeek - Called with the target fraction (0–1) on press and on every
 *   drag move. Wire this to a player's `seek` / `seekFrac`.
 *
 * @example
 * // Audio/video timeline
 * const { ref, onPointerDown, onPointerMove, onPointerLeave, hover, dragging } =
 *   useScrubber(seekFrac)
 * <div ref={ref} onPointerDown={onPointerDown} onPointerMove={onPointerMove}
 *      onPointerLeave={onPointerLeave} className="track">
 *   <div className="fill" style={{ width: `${t * 100}%` }} />
 *   {hover != null && <div className="hover-handle" style={{ left: `${hover * 100}%` }} />}
 * </div>
 *
 * @example
 * // Show a timestamp preview bubble only while hovering (not dragging)
 * const { hover, dragging } = useScrubber(seekFrac)
 * {hover != null && !dragging && (
 *   <Tooltip style={{ left: `${hover * 100}%` }}>{formatTime(hover * duration)}</Tooltip>
 * )}
 *
 * @example
 * // Reuse as a volume slider — fraction maps straight to volume level
 * const { ref, onPointerDown } = useScrubber(setVolumeLevel)
 * <div ref={ref} onPointerDown={onPointerDown} className="volume-track" />
 */
export function useScrubber(onSeek: (frac: number) => void) {
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
