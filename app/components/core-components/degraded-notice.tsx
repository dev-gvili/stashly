/**
 * Quiet notice shown when this browser can't run the enhanced pipelines.
 *
 * The thumbnail and AI stages fall back silently by design, which keeps the
 * app usable on an old browser but leaves the user guessing: they uploaded a
 * document expecting smart cropping and transcription and got a plain square,
 * with no way to tell whether it is still processing, broken, or simply
 * unsupported. This answers that question once, in plain language, without
 * putting a shader error in front of anyone.
 *
 * Only capability-level failures (no WebGPU, model wouldn't load) raise it —
 * a single file that failed to render is not the user's problem to act on.
 */
import { useSyncExternalStore, useState } from 'react'
import {
  isCapabilityDegraded,
  subscribeCapabilityDegraded,
} from '@/utils/report-degraded'
import { InfoIcon } from '@/components/icons'
import { Button } from '@/ui/button'

const DISMISSED_KEY = 'stashly:degraded-notice-dismissed'

function wasDismissed(): boolean {
  if (typeof sessionStorage === 'undefined') return false
  try {
    return sessionStorage.getItem(DISMISSED_KEY) === '1'
  } catch {
    return false
  }
}

/** Server snapshot: never degraded during SSR, so the markup matches hydration. */
function serverSnapshot(): boolean {
  return false
}

export function DegradedNotice() {
  const degraded = useSyncExternalStore(
    subscribeCapabilityDegraded,
    isCapabilityDegraded,
    serverSnapshot
  )
  const [dismissed, setDismissed] = useState(wasDismissed)

  if (!degraded || dismissed) return null

  return (
    <div
      role="status"
      className="flex items-center gap-3 rounded-md border border-input bg-card px-4 py-2 font-stashly text-sm"
    >
      <InfoIcon className="size-5 shrink-0 text-muted-foreground" />
      <p className="min-w-0 flex-1 text-muted-foreground">
        Enhanced previews and AI features need a browser with WebGPU support.
        Uploads, search, and sharing all work normally.
      </p>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          setDismissed(true)
          try {
            sessionStorage.setItem(DISMISSED_KEY, '1')
          } catch {
            // Private mode or quota — dismissing for this render is enough.
          }
        }}
      >
        Dismiss
      </Button>
    </div>
  )
}
