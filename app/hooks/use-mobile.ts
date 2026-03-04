import * as React from 'react'

const DEFAULT_MOBILE_BREAKPOINT = 768

/**
 * Returns true when the viewport width is less than the provided breakpoint.
 * - SSR-safe: returns `fallback` on the server (default false)
 * - Uses matchMedia where available and falls back to resize listeners.
 *
 * @param breakpoint pixel width to consider "mobile" (default 768)
 * @param fallback value to return during SSR (default false)
 */
export function useIsMobile(
  breakpoint: number = DEFAULT_MOBILE_BREAKPOINT,
  fallback = false
): boolean {
  const [isMobile, setIsMobile] = React.useState<boolean>(() => {
    if (typeof window === 'undefined') return fallback
    return window.innerWidth < breakpoint
  })

  React.useEffect(() => {
    if (
      typeof window === 'undefined' ||
      typeof window.matchMedia !== 'function'
    ) {
      setIsMobile(fallback)
      return
    }

    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`)

    const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
      // Some environments pass a MediaQueryListEvent, others may pass the list.
      const matches = (e as any)?.matches ?? mql.matches
      setIsMobile(!!matches)
    }

    // keep state in sync immediately
    setIsMobile(mql.matches)

    if (typeof (mql as any).addEventListener === 'function') {
      ;(mql as any).addEventListener('change', handleChange)
      return () => (mql as any).removeEventListener('change', handleChange)
    }

    if (typeof (mql as any).addListener === 'function') {
      ;(mql as any).addListener(handleChange)
      return () => (mql as any).removeListener(handleChange)
    }

    // Final fallback: listen for resize
    const onResize = () => setIsMobile(window.innerWidth < breakpoint)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [breakpoint, fallback])

  return isMobile
}
