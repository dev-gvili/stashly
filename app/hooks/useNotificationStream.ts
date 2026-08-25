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

/**
 * Replaces a notification in place if present (keeping its position), or
 * prepends it when new so the list stays newest-first. Position matters: a
 * mark-as-read update must not jump a week-old row back to the top.
 *
 * @param list - Current notification list.
 * @param n - The created or updated notification from the stream.
 *
 * @example
 * // A new notification lands at the top
 * upsert([b, c], a) // → [a, b, c]
 *
 * @example
 * // An update to an existing row keeps its slot
 * upsert([a, b], { ...b, readAt: new Date() }) // → [a, b']
 */
function upsert(list: Notification[], n: Notification): Notification[] {
  const idx = list.findIndex((x) => x.id === n.id)
  if (idx === -1) return [n, ...list]
  const next = list.slice()
  next[idx] = n
  return next
}

/**
 * Folds stream events into the notification list. A reducer rather than a
 * `useState` setter because every SSE event must be applied — bursts (one
 * UPDATE per row on mark-all-read) would otherwise collapse to the last one.
 *
 * @param state - Current notification list.
 * @param action - Either a full `reset` from a reconcile, or a single stream `event`.
 *
 * @example
 * // Apply one server-sent event
 * dispatch({ kind: 'event', event: JSON.parse(e.data) })
 *
 * @example
 * // Replace the whole list after a reconnect
 * dispatch({ kind: 'reset', items: data.notifications })
 */
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

/**
 * Live notification list: seeded from the layout loader, then kept current by a
 * single `EventSource` on `/api/notifications/stream`. Reconciles against the
 * canonical list after a reconnect or when the tab becomes visible again, since
 * events missed while disconnected are never replayed. Degrades to the seed list
 * where `EventSource` doesn't exist (SSR).
 *
 * @param initial - The SSR/loader seed, used for the first paint.
 *
 * @example
 * // Bell badge in the app layout
 * const notifications = useNotificationStream(loaderData.notifications)
 * const unread = notifications.filter((n) => !n.readAt).length
 * <Bell badge={unread || undefined} />
 *
 * @example
 * // The list re-renders per event, so render it directly
 * const notifications = useNotificationStream(seed)
 * {notifications.map((n) => <NotificationRow key={n.id} {...n} />)}
 */
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
