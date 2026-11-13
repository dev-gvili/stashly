import { useCallback, useEffect, useState } from 'react'

const KEY = 'stashly-search-refine-in-header'
const EVENT = 'stashly-search-refine-preference'

function read(): boolean {
  try {
    return window.localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

/**
 * Whether the header shows the new search-and-refine field in place of the
 * classic search / Filter / Sort controls. A per-browser trial switch while
 * both exist (owner's call, 13 Nov), so it lives in localStorage and defaults
 * to the classic controls; ⌘K opens the new dialog either way.
 */
export function useSearchRefinePreference() {
  // false on the server and the first client render, so hydration matches.
  const [inHeader, setInHeader] = useState(false)

  useEffect(() => {
    setInHeader(read())
    const sync = () => setInHeader(read())
    window.addEventListener(EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  const set = useCallback((next: boolean) => {
    try {
      if (next) window.localStorage.setItem(KEY, '1')
      else window.localStorage.removeItem(KEY)
    } catch {
      // Storage blocked: the switch still applies to this page view.
    }
    setInHeader(next)
    window.dispatchEvent(new Event(EVENT))
  }, [])

  return [inHeader, set] as const
}
