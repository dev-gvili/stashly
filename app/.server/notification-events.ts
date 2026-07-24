import { EventEmitter } from 'node:events'
import pg from 'pg'

// ---------------------------------------------------------------------------
// Server-side notification bus + Postgres LISTEN bridge.
//
// A DB trigger (migration 20260724000000_notification_notify) fires
// pg_notify('notifications', {op, userId, ...}) on every Notification
// INSERT/UPDATE/DELETE. A single dedicated LISTEN connection receives those and
// re-emits them on an in-process EventEmitter keyed by userId. The SSE route
// (routes/api/notifications-stream.ts) subscribes per authenticated user and
// forwards each event to that user's open EventSource connections.
//
// Both the emitter and the LISTEN client are pinned to globalThis so dev HMR
// (server/app.ts is re-imported via Vite's ssrLoadModule) doesn't stack
// duplicate connections/listeners.
// ---------------------------------------------------------------------------

export type NotificationEvent =
  | { op: 'created' | 'updated'; userId: string; notification: Record<string, unknown> }
  | { op: 'deleted'; userId: string; id: string }

type ListenerSlot = { client: pg.Client; ready: Promise<unknown> }

const globalForNotifications = globalThis as typeof globalThis & {
  __notificationBus?: EventEmitter
  __notificationListener?: ListenerSlot
}

/** Per-user event bus. Event name === userId; payload === NotificationEvent. */
export const notificationBus: EventEmitter = (globalForNotifications.__notificationBus ??=
  (() => {
    const bus = new EventEmitter()
    bus.setMaxListeners(0) // one listener per open SSE connection; don't warn
    return bus
  })())

/** Subscribe a handler to a user's stream. Returns an unsubscribe function. */
export function subscribe(
  userId: string,
  handler: (event: NotificationEvent) => void
) {
  notificationBus.on(userId, handler)
  return () => notificationBus.off(userId, handler)
}

/**
 * Idempotently open the singleton LISTEN connection. Safe to call on every SSE
 * request — only the first call connects. Self-heals: if the connection drops,
 * the slot is cleared and a reconnect is scheduled.
 */
export function ensureListener(): Promise<unknown> {
  if (globalForNotifications.__notificationListener)
    return globalForNotifications.__notificationListener.ready

  const client = new pg.Client({ connectionString: process.env.DATABASE_URL })

  const reconnect = () => {
    globalForNotifications.__notificationListener = undefined
    setTimeout(() => {
      ensureListener().catch(() => {})
    }, 1000)
  }

  client.on('notification', (msg) => {
    if (!msg.payload) return
    try {
      const event = JSON.parse(msg.payload) as NotificationEvent
      notificationBus.emit(event.userId, event)
    } catch {
      // ignore malformed payloads
    }
  })
  client.on('error', (err) => {
    console.error('[notifications] LISTEN client error:', err.message)
  })
  client.on('end', reconnect)

  const ready = client
    .connect()
    .then(() => client.query('LISTEN notifications'))
    .then(() => console.log('[notifications] LISTEN client connected'))
    .catch((err) => {
      console.error('[notifications] LISTEN connect failed:', err.message)
      reconnect()
    })

  globalForNotifications.__notificationListener = { client, ready }
  return ready
}
