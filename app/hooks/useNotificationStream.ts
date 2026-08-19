import { useEffect, useReducer, useRef } from 'react'
import type { Notification } from '@/types/notification.types'

// ---------------------------------------------------------------------------
// Live notification list, fed by the SSE route (GET /api/notifications/stream).
//
// Seeded from the layout loader (SSR / first paint), then kept current by a
// single EventSource. We use the native EventSource — not remix-utils'
// `useEventSource`, which retains only the latest event and would silently drop
// bursts (e.g. mark-all-read emits one UPDATE per row). Every event is
// dispatched into a reducer instead, so nothing is lost.
// ---------------------------------------------------------------------------

type StreamEvent =
  | { op: 'created' | 'updated'; notification: Notification }
  | { op: 'deleted'; id: string }

type Action =
  | { kind: 'reset'; items: Notification[] }
  | { kind: 'event'; event: StreamEvent }

/** Replace in place if present (keeps order); prepend if new (newest first). */
function upsert(list: Notification[], n: Notification): Notification[] {
  const idx = list.findIndex((x) => x.id === n.id)
  if (idx === -1) return [n, ...list]
  const next = list.slice()
  next[idx] = n
  return next
}

function reducer(state: Notification[], action: Action): Notification[] {
  if (action.kind === 'reset') return action.items
  const event = action.event
  switch (event.op) {
    case 'created':
    case 'updated':
      return upsert(state, event.notification)
    case 'deleted':
      return state.filter((n) => n.id !== event.id)
    default:
      return state
  }
}

export function useNotificationStream(initial: Notification[]): Notification[] {
  const [items, dispatch] = useReducer(reducer, initial)
  const connectedRef = useRef(false)

  useEffect(() => {
    if (typeof EventSource === 'undefined') return

    let cancelled = false

    // Backfill from the canonical list — used after a reconnect or when the tab
    // becomes visible again, since gap events aren't replayed by EventSource.
    async function reconcile() {
      try {
        const res = await fetch('/api/notifications', {
          headers: { accept: 'application/json' },
        })
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled && Array.isArray(data?.notifications))
          dispatch({ kind: 'reset', items: data.notifications })
      } catch {
        // offline / transient — the next event or reconcile will catch up
      }
    }

    const source = new EventSource('/api/notifications/stream')

    source.addEventListener('notification', (e) => {
      try {
        dispatch({ kind: 'event', event: JSON.parse((e as MessageEvent).data) })
      } catch {
        // ignore malformed payloads
      }
    })

    source.addEventListener('open', () => {
      // First open uses the SSR seed; a *re*connection may have missed events.
      if (connectedRef.current) reconcile()
      connectedRef.current = true
    })

    function onVisibility() {
      if (document.visibilityState === 'visible') reconcile()
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibility)
      source.close()
    }
  }, [])

  return items
}
