import { useEffect, type RefObject } from 'react'

/**
 * Scroll a permalink's landing element (the line a search hit opened) to the
 * middle of its own scroll container, once per `key`.
 *
 * Only the nearest scrollable ancestor moves. `scrollIntoView` would also
 * scroll every ancestor up to the window, which shifts the page shell under
 * the app header. The container is the shadcn `ScrollArea` viewport where
 * there is one, else the closest element that scrolls vertically.
 *
 * @param target - The landing element; nothing happens while it is null.
 * @param key - Changes when the landing spot does (the `line` param), so a new
 *   link scrolls again and a re-render doesn't.
 *
 * @example
 * const lineRef = useRef<HTMLSpanElement>(null)
 * useLandingScroll(lineRef, line)
 */
export function useLandingScroll(target: RefObject<HTMLElement | null>, key: unknown) {
  useEffect(() => {
    if (target.current && key != null) scrollToLanding(target.current)
  }, [target, key])
}

/** The scroll `useLandingScroll` does, for an element found after render. */
export function scrollToLanding(el: HTMLElement) {
  const viewport = scrollContainerOf(el)
  if (!viewport) return
  const box = viewport.getBoundingClientRect()
  const at = el.getBoundingClientRect()
  const top = viewport.scrollTop + (at.top - box.top) - (box.height - at.height) / 2
  viewport.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
}

function scrollContainerOf(el: HTMLElement): HTMLElement | null {
  const viewport = el.closest<HTMLElement>('[data-slot="scroll-area-viewport"]')
  if (viewport) return viewport
  for (let node = el.parentElement; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node)
    if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight) return node
  }
  return null
}
