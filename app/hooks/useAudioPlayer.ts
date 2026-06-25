import { useState, useEffect, useCallback } from 'react'

/**
 * Drives a real `<audio>` element and mirrors its transport into React state,
 * so a fully custom player UI can be built without the native controls.
 * Subscribes to the element's media events (`play`, `pause`, `timeupdate`,
 * `loadedmetadata`, `waiting`, `volumechange`, …) and exposes imperative
 * controls plus a normalized progress fraction `t` (0–1).
 *
 * @param ref - Ref to the `<audio>` element to control. The hook re-binds its
 *   listeners whenever the ref's `.current` identity changes.
 *
 * @example
 * // Minimal custom player
 * const audioRef = useRef<HTMLAudioElement>(null)
 * const { playing, t, togglePlay, seek } = useAudioPlayer(audioRef)
 * return (
 *   <>
 *     <audio ref={audioRef} src={url} />
 *     <button onClick={togglePlay}>{playing ? 'Pause' : 'Play'}</button>
 *     <Scrubber value={t} onSeek={seek} />
 *   </>
 * )
 *
 * @example
 * // Wire a scrub bar — `seek` takes a 0–1 fraction of the duration
 * const { t, seek } = useAudioPlayer(audioRef)
 * <input type="range" min={0} max={1} step={0.001} value={t}
 *        onChange={(e) => seek(Number(e.target.value))} />
 *
 * @example
 * // Mute toggle + buffered-ahead indicator
 * const { muted, toggleMuted, buffered } = useAudioPlayer(audioRef)
 * <button onClick={toggleMuted}>{muted ? 'Unmute' : 'Mute'}</button>
 * <div className="buffered" style={{ width: `${buffered * 100}%` }} />
 */
export function useAudioPlayer(ref: React.RefObject<HTMLAudioElement | null>) {
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [buffered, setBuffered] = useState(0)
  const [loading, setLoading] = useState(true)
  const [muted, setMuted] = useState(false)
  const [volume, setVolume] = useState(0.75)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    const onEnded = () => {
      setPlaying(false)
      setCurrentTime(0)
    }
    const onTimeUpdate = () => {
      setCurrentTime(el.currentTime)
      if (el.buffered.length > 0)
        setBuffered(
          el.buffered.end(el.buffered.length - 1) / (el.duration || 1)
        )
    }
    const onLoadedMetadata = () => {
      setDuration(el.duration)
      setLoading(false)
    }
    const onWaiting = () => setLoading(true)
    const onCanPlay = () => setLoading(false)
    const onMutedChange = () => setMuted(el.muted || el.volume === 0)
    const onVolumeChange = () => setVolume(el.volume)
    el.addEventListener('play', onPlay)
    el.addEventListener('pause', onPause)
    el.addEventListener('ended', onEnded)
    el.addEventListener('timeupdate', onTimeUpdate)
    el.addEventListener('loadedmetadata', onLoadedMetadata)
    el.addEventListener('waiting', onWaiting)
    el.addEventListener('canplay', onCanPlay)
    el.addEventListener('volumechange', onVolumeChange)
    el.addEventListener('volumechange', onMutedChange)
    return () => {
      el.removeEventListener('play', onPlay)
      el.removeEventListener('pause', onPause)
      el.removeEventListener('ended', onEnded)
      el.removeEventListener('timeupdate', onTimeUpdate)
      el.removeEventListener('loadedmetadata', onLoadedMetadata)
      el.removeEventListener('waiting', onWaiting)
      el.removeEventListener('canplay', onCanPlay)
      el.removeEventListener('volumechange', onVolumeChange)
      el.removeEventListener('volumechange', onMutedChange)
    }
  }, [ref])

  const togglePlay = useCallback(() => {
    const el = ref.current
    if (!el) return
    el.paused ? el.play() : el.pause()
  }, [ref])

  const seek = useCallback(
    (frac: number) => {
      const el = ref.current
      if (!el || !el.duration) return
      el.currentTime = Math.max(0, Math.min(el.duration, frac * el.duration))
    },
    [ref]
  )

  const toggleMuted = useCallback(() => {
    const el = ref.current
    if (!el) return
    el.muted = !el.muted
    setMuted(el.muted)
    el.volume = el.muted ? 0 : volume
  }, [ref])

  const t = duration > 0 ? currentTime / duration : 0
  return {
    playing,
    currentTime,
    duration,
    buffered,
    loading,
    t,
    togglePlay,
    seek,
    volume,
    muted,
    toggleMuted,
  }
}
