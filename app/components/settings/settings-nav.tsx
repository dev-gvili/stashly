import { cn } from '@/utils/styles'
import { useEffect, useRef } from 'react'
import { NavLink, useLocation } from 'react-router'
import { SETTINGS_SECTIONS } from './settings-sections'

/**
 * The settings section nav: a sticky column beside the content from `md` up,
 * a horizontal scroll strip above it below `md`. On navigation the active
 * link is scrolled into view inside the strip only: `scrollIntoView` would
 * also scroll the page, so the strip's own `scrollLeft` is set instead.
 */
export function SettingsNav({ base }: { base: string }) {
  const navRef = useRef<HTMLElement>(null)
  const { pathname } = useLocation()

  useEffect(() => {
    const nav = navRef.current
    const active = nav?.querySelector<HTMLElement>('[aria-current="page"]')
    if (!nav || !active || nav.scrollWidth <= nav.clientWidth) return
    const left = active.offsetLeft - nav.offsetLeft
    const right = left + active.offsetWidth
    if (left < nav.scrollLeft) nav.scrollLeft = left
    else if (right > nav.scrollLeft + nav.clientWidth)
      nav.scrollLeft = right - nav.clientWidth
  }, [pathname])

  return (
    <nav
      ref={navRef}
      aria-label="Settings"
      // Below md: `w-0 min-w-full`, not `w-full`. The app's ScrollArea wraps
      // pages in a `display: table` box that grows to its content's intrinsic
      // width, so a full-width strip widened the page to all six links and was
      // clipped instead of scrolling (measured 845px on a 375px phone).
      className="sticky top-20 flex w-50 shrink-0 flex-col gap-0.5 max-md:static max-md:w-0 max-md:min-w-full max-md:flex-row max-md:overflow-x-auto max-md:scrollbar-none"
    >
      {SETTINGS_SECTIONS.map(({ id, path, label, icon: Icon }) => (
        <NavLink
          key={id}
          to={`${base}/${path}`}
          prefetch="intent"
          className={({ isActive }) =>
            cn(
              'flex h-8.5 w-full items-center gap-2.5 whitespace-nowrap rounded-lg px-2.5 text-sm outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 max-md:w-auto max-md:shrink-0',
              isActive
                ? 'bg-secondary text-foreground'
                : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
            )
          }
        >
          <Icon aria-hidden className="size-4 shrink-0" />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}
