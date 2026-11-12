import * as React from 'react'

const DEFAULT_MOBILE_BREAKPOINT = 768

/**
 * Returns true when the viewport width is less than the provided breakpoint.
 * - SSR-safe: returns `fallback` on the server (default false)
 * - Uses matchMedia where available and falls back to resize listeners.
 *
 * @param breakpoint pixel width to consider "mobile" (default 768)
 * @param fallback value to return during SSR (default false)
 *
 * @example
 * // Swap a sidebar for a bottom sheet on small screens
 * const isMobile = useIsMobile()
 * return isMobile ? <BottomSheet {...props} /> : <Sidebar {...props} />
 *
 * @example
 * // Custom breakpoint — treat tablets as mobile too
 * const isCompact = useIsMobile(1024)
 * <DataTable density={isCompact ? 'compact' : 'comfortable'} />
 *
 * @example
 * // Assume mobile during SSR so the first paint matches the common case
 * const isMobile = useIsMobile(768, true)
 */
export function useIsMobile(
  breakpoint: number = DEFAULT_MOBILE_BREAKPOINT,
  fallback = false
): boolean {
  // Start from what the server rendered, never from `window`: reading the width
  // here made the first client render differ from the HTML on any phone-width
  // screen, and React threw a hydration error and re-rendered the whole layout.
  // The effect below reads the real width right after mount.
  const [isMobile, setIsMobile] = React.useState<boolean>(fallback)

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
      const matches = e?.matches ?? mql.matches
      setIsMobile(!!matches)
    }

    // keep state in sync immediately
    setIsMobile(mql.matches)

    if (typeof mql.addEventListener === 'function') {
      ;mql.addEventListener('change', handleChange)
      return () => mql.removeEventListener('change', handleChange)
    }

    if (typeof mql.addListener === 'function') {
      ;mql.addListener(handleChange)
      return () => mql.removeListener(handleChange)
    }

    // Final fallback: listen for resize
    const onResize = () => setIsMobile(window.innerWidth < breakpoint)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [breakpoint, fallback])

  return isMobile
}
