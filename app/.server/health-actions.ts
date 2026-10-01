import { prisma } from '@/services/db'

export type HealthReport =
  | { status: 'ok'; db: 'ok'; dbLatencyMs: number }
  | { status: 'error'; db: 'unreachable'; dbLatencyMs: number }

/**
 * Answers whether this server can actually reach its database — the one
 * dependency every request needs. Fly's health check and CI's docker job both
 * hit `/api/health`, so this must fail when the database does: a check that
 * reports healthy without touching it is the stub this replaces.
 *
 * The real error is logged, not returned: `/api/health` is unauthenticated, and
 * a connection error can carry the database host.
 *
 * @example
 * const report = await checkHealth()
 * // { status: 'ok', db: 'ok', dbLatencyMs: 2 }
 */
export async function checkHealth(): Promise<HealthReport> {
  const started = performance.now()
  try {
    await prisma.$queryRaw`SELECT 1`
    return { status: 'ok', db: 'ok', dbLatencyMs: Math.round(performance.now() - started) }
  } catch (error) {
    console.error('[health] database check failed:', error)
    return {
      status: 'error',
      db: 'unreachable',
      dbLatencyMs: Math.round(performance.now() - started),
    }
  }
}
