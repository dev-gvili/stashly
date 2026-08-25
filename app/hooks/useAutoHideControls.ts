import { useState, useRef, useCallback } from 'react'

/**
 * Auto-hiding visibility flag for media controls. Starts visible; each `ping()`
 * reveals the controls and (re)arms a timer that hides them again after `delay`
 * ms of inactivity. Call `ping()` on pointer movement / interaction to keep the
 * controls up while the user is active. `setActive` is exposed for forcing the
 * state directly (e.g. pin controls open while a menu is open).
 *
 * @param delay - Idle time in ms before the controls hide after the last `ping()`
 *   (default `0`, i.e. hide on the next tick unless a caller passes a real delay).
 *
 * @example
 * // Reveal controls on mouse move, hide after the idle delay
 * const { active, ping } = useAutoHideControls()
 * <div onPointerMove={ping} className={cn('group', !active && 'cursor-none')}>
 *   <video />
 *   <Controls className={cn('transition-opacity', active ? 'opacity-100' : 'opacity-0')} />
 * </div>
 *
 * @example
 * // Custom delay for a slower fade-out
 * const { active, ping } = useAutoHideControls(4000)
 *
 * @example
 * // Force controls to stay visible while a settings menu is open
 * const { active, ping, setActive } = useAutoHideControls()
 * <Menu onOpenChange={(open) => open ? setActive(true) : ping()} />
 */
export function useAutoHideControls(delay = 0) {
  const [active, setActive] = useState(true)
  const tRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const ping = useCallback(() => {
    setActive(true)
    if (tRef.current) clearTimeout(tRef.current)
    tRef.current = setTimeout(() => setActive(false), delay)
  }, [delay])
  return { active, ping, setActive }
}
