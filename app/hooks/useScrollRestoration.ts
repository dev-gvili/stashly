import * as React from 'react'
import { useLocation } from 'react-router'

const positions = new Map<string, number>()

/**
 * Per-history-entry scroll restoration for a custom scroll container.
 *
 * React Router's `<ScrollRestoration>` only manages the `window`. App content
 * here scrolls inside a nested Radix `ScrollArea` viewport, so opening the
 * full-page item preview (a portaled Dialog) and closing it would otherwise
 * leave the list scrolled back to the top.
 *
 * The position is stored keyed by `location.key`. That key changes the instant
 * we navigate to the preview, so any reset of the list's scroll (focus return /
 * scroll-lock release when the overlay unmounts) is recorded under the preview's
 * key — the list entry's saved position is untouched. Navigating back reuses the
 * original history key, and we restore it.
 *
 * @param getScrollElement Returns the scroll container (stable identity, e.g. a `useCallback`).
 *
 * @example
 * const getEl = React.useCallback(
 *   () => ref.current?.closest('[data-slot="scroll-area-viewport"]') as HTMLElement | null,
 *   []
 * )
 * useScrollRestoration(getEl)
 */
export function useScrollRestoration(
  getScrollElement: () => HTMLElement | null
) {
  const { key } = useLocation()

  // Continuously record the position for the current history entry.
  React.useEffect(() => {
    const el = getScrollElement()
    if (!el) return
    const onScroll = () => positions.set(key, el.scrollTop)
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [key, getScrollElement])

  // Restore the saved position when this entry becomes active again.
  React.useLayoutEffect(() => {
    const el = getScrollElement()
    if (!el) return
    const saved = positions.get(key)
    if (saved == null) return

    el.scrollTop = saved
    // Re-assert over the next couple frames: an unmounting overlay can reset the
    // container after this commit (focus return, scroll-lock release).
    let raf1 = 0
    let raf2 = 0
    raf1 = requestAnimationFrame(() => {
      if (el.scrollTop !== saved) el.scrollTop = saved
      raf2 = requestAnimationFrame(() => {
        if (el.scrollTop !== saved) el.scrollTop = saved
      })
    })
    return () => {
      cancelAnimationFrame(raf1)
      cancelAnimationFrame(raf2)
    }
  }, [key, getScrollElement])
}
