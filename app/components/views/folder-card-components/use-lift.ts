import { useState } from 'react'

/** Hover lift state + handlers shared by all folder cards. */
export function useLift() {
  const [hover, setHover] = useState(false)
  return [
    hover,
    { onMouseEnter: () => setHover(true), onMouseLeave: () => setHover(false) },
  ] as const
}
