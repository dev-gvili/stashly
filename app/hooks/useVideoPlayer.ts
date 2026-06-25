import { useState, useEffect, useCallback } from 'react'

/**
 * Binds to a real `<video>` element and its wrapping container to drive a fully
 * hand-built player — no native controls. Mirrors transport state (play, time,
 * buffered, volume, rate, ended) and manages fullscreen with a pseudo-fullscreen
 * fallback: when the browser denies `requestFullscreen` it flips a `pseudoFs`
 * flag instead, and `Escape` exits that fallback. Real fullscreen is tracked via
 * the `fullscreenchange` event against the container element.
 *
 * @param videoRef - Ref to the `<video>` element to control.
 * @param containerRef - Ref to the element that goes fullscreen (the player shell,
 *   typically the wrapper around the video and its controls overlay).
 *
 * @example
 * // Custom player shell with hand-built controls
 * const videoRef = useRef<HTMLVideoElement>(null)
 * const shellRef = useRef<HTMLDivElement>(null)
 * const { playing, t, togglePlay, seekFrac, toggleFullscreen } =
 *   useVideoPlayer(videoRef, shellRef)
 * return (
 *   <div ref={shellRef}>
 *     <video ref={videoRef} src={url} />
 *     <button onClick={togglePlay}>{playing ? 'Pause' : 'Play'}</button>
 *     <Scrubber value={t} onSeek={seekFrac} />
 *     <button onClick={toggleFullscreen}>Fullscreen</button>
 *   </div>
 * )
 *
 * @example
 * // Skip ±10s and change playback speed
 * const { skip, rate, setRate } = useVideoPlayer(videoRef, shellRef)
 * <button onClick={() => skip(-10)}>« 10s</button>
 * <button onClick={() => skip(10)}>10s »</button>
 * {[0.5, 1, 1.5, 2].map((r) => (
 *   <button key={r} aria-pressed={rate === r} onClick={() => setRate(r)}>{r}×</button>
 * ))}
 *
 * @example
 * // `fullscreen` is true for both real and pseudo modes; `pseudoFs` distinguishes them
 * const { fullscreen, pseudoFs } = useVideoPlayer(videoRef, shellRef)
 * <div className={cn(fullscreen && 'fixed inset-0', pseudoFs && 'z-50 bg-black')} />
 */
export function useVideoPlayer(
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
  const [loop, setLoop] = useState(false)
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

  const toggleLoop = useCallback(() => {
    const el = videoRef.current
    if (!el) return
    el.loop = !el.loop
    setLoop(el.loop)
  }, [videoRef])

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
    loop,
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
    toggleLoop,
    toggleFullscreen,
  }
}
