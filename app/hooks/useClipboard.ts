import * as React from 'react'

interface UseClipboardOptions {
  /** How long (ms) the `copied` flag stays true before resetting. Default: 2000 */
  resetDelay?: number
}

interface UseClipboardReturn {
  copy: (text: string) => Promise<boolean>
  copied: boolean
  error: Error | null
}

/**
 * Cross-platform clipboard hook.
 *
 * Strategy ladder (most → least capable):
 *   1. `navigator.clipboard.writeText` — modern browsers, HTTPS required
 *   2. `document.execCommand('copy')` via offscreen textarea — legacy + iOS WebView
 *
 * iOS Safari quirk: `navigator.clipboard` is gated on a user-gesture. Because
 * `writeText` returns a Promise, awaiting it inside an async function breaks the
 * gesture boundary on iOS ≤ 16. We guard against that by falling through to the
 * `execCommand` path when the Clipboard API rejects due to a permissions issue.
 *
 * `copied` resets automatically after `resetDelay` ms (default 2000).
 */
export function useClipboard({ resetDelay = 2000 }: UseClipboardOptions = {}): UseClipboardReturn {
  const [copied, setCopied] = React.useState(false)
  const [error, setError] = React.useState<Error | null>(null)
  const resetRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const scheduleReset = React.useCallback(() => {
    if (resetRef.current) clearTimeout(resetRef.current)
    resetRef.current = setTimeout(() => setCopied(false), resetDelay)
  }, [resetDelay])

  React.useEffect(() => {
    return () => {
      if (resetRef.current) clearTimeout(resetRef.current)
    }
  }, [])

  const copy = React.useCallback(
    async (text: string): Promise<boolean> => {
      setError(null)

      // Path 1: Clipboard API (Chrome, Firefox, Safari 13.1+, modern mobile)
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        try {
          await navigator.clipboard.writeText(text)
          setCopied(true)
          scheduleReset()
          return true
        } catch {
          // Falls through to execCommand — covers iOS gesture-boundary rejection
          // and NotAllowedError in non-HTTPS contexts.
        }
      }

      // Path 2: execCommand fallback — iOS Safari < 13.1, Android WebView, HTTP origins
      try {
        const success = execCommandCopy(text)
        if (success) {
          setCopied(true)
          scheduleReset()
          return true
        }
        throw new Error('execCommand copy returned false')
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err))
        setError(e)
        setCopied(false)
        return false
      }
    },
    [scheduleReset]
  )

  return { copy, copied, error }
}

/**
 * Synchronous `execCommand('copy')` via a temporary textarea.
 *
 * iOS-specific considerations:
 *  - The textarea must be added to the DOM (not detached).
 *  - `readOnly` + `contentEditable` prevent the soft keyboard from opening.
 *  - `setSelectionRange(0, text.length)` is needed on iOS to actually select text
 *    before the copy command fires.
 *  - Position it off-screen (not `display:none` — that prevents selection on iOS).
 */
function execCommandCopy(text: string): boolean {
  const el = document.createElement('textarea')
  el.value = text

  // Prevent soft keyboard on mobile
  el.setAttribute('readonly', '')
  el.setAttribute('contenteditable', 'true')

  // Off-screen but in the DOM (required for iOS selection)
  el.style.cssText =
    'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;opacity:0;pointer-events:none'

  document.body.appendChild(el)

  // iOS needs focus() + setSelectionRange; desktop browsers are fine with just select()
  const isIos =
    typeof navigator !== 'undefined' &&
    /ipad|iphone|ipod/i.test(navigator.userAgent) &&
    !(window as Window & { MSStream?: unknown }).MSStream

  if (isIos) {
    el.focus()
    el.setSelectionRange(0, el.value.length)
  } else {
    el.select()
  }

  const result = document.execCommand('copy')
  document.body.removeChild(el)
  return result
}
