import { useCallback, useSyncExternalStore } from 'react'
import { useRouteLoaderData } from 'react-router'
import {
  DEFAULT_GALLERY_PREFS,
  serializeGalleryPrefs,
  type GalleryPrefs,
} from '@/utils/gallery-layout'

// Module-scope store: the controls live in the app header (the layout route)
// and the tiles in the Images route, so no React context reaches both.
// Server renders never write to it — they read the loader's value only.
let current: GalleryPrefs | null = null
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/**
 * The Images page's view preferences — thumbnail `zoom` (1–5), `gap` (0–20px,
 * step 2) and `byDate` grouping — shared by the header controls and the page,
 * and persisted in the `stashly-gallery` cookie.
 *
 * Seeded from the Images route's loader, which parses the same cookie, so the
 * server render already uses the viewer's values and nothing moves on
 * hydrate. A change is written straight to `document.cookie`; only the next
 * document load reads it, so no request is needed.
 *
 * @example
 * const { prefs, setPref } = useGalleryPrefs()
 * <Slider value={[prefs.gap]} onValueChange={([v]) => setPref('gap', v)} />
 */
export function useGalleryPrefs() {
  const data = useRouteLoaderData('stash-images') as
    | { prefs?: GalleryPrefs }
    | undefined
  const seed = data?.prefs ?? DEFAULT_GALLERY_PREFS

  const prefs = useSyncExternalStore(
    subscribe,
    () => current ?? seed,
    () => seed
  )

  const setPref = useCallback(
    <K extends keyof GalleryPrefs>(key: K, value: GalleryPrefs[K]) => {
      const prev = current ?? seed
      if (prev[key] === value) return
      current = { ...prev, [key]: value }
      try {
        document.cookie = serializeGalleryPrefs(current)
      } catch {
        // Blocked cookies: the preference still applies for this visit.
      }
      listeners.forEach((listener) => listener())
    },
    [seed]
  )

  return { prefs, setPref }
}
