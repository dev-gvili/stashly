import { eventStream } from 'remix-utils/sse/server'
import { auth } from '@/services/auth'
import {
  ensureListener,
  subscribe,
  type NotificationEvent,
} from '@/services/notification-events'
import type { Route } from './+types/notifications-stream'

// ---------------------------------------------------------------------------
// SSE resource route — GET /api/notifications/stream
//
// Streams this user's live notification changes (created / updated / deleted)
// as they land in the DB. The browser opens one EventSource here; the trigger →
// LISTEN bridge (notification-events.ts) feeds it. Auth is cookie-based:
// EventSource sends the session cookie automatically on same-origin requests,
// and every subscription is scoped to session.user.id so no one can read
// another user's stream.
// ---------------------------------------------------------------------------

export async function loader({ request }: Route.LoaderArgs) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) return new Response('Unauthorized', { status: 401 })

  const userId = session.user.id

  // Start the singleton Postgres LISTEN bridge if it isn't already running.
  ensureListener()

  return eventStream(
    request.signal,
    (send) => {
      let closed = false

      // The underlying ReadableStream controller can close (client disconnect)
      // before our cleanup runs. Calling send() then throws
      // `ERR_INVALID_STATE: Controller is already closed`, which — firing inside
      // the heartbeat timer or a bus callback — would be an *uncaught* exception
      // and crash the server. Guard every send and tear down on the first throw.
      const safeSend = (args: { event: string; data: string }) => {
        if (closed) return
        try {
          send(args)
        } catch {
          cleanup()
        }
      }

      const off = subscribe(userId, (event: NotificationEvent) => {
        safeSend({ event: 'notification', data: JSON.stringify(event) })
      })

      // Heartbeat so intermediaries don't drop an idle connection.
      const heartbeat = setInterval(() => {
        safeSend({ event: 'ping', data: String(Date.now()) })
      }, 25_000)

      function cleanup() {
        if (closed) return
        closed = true
        off()
        clearInterval(heartbeat)
      }

      return cleanup
    },
    { headers: { 'X-Accel-Buffering': 'no' } }
  )
}
