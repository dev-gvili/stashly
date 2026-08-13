import { recordDegraded, renderPrometheus } from '@/services/metrics'
import { clientDegradedReport } from '@/schemas/api.schemas'
import { auth } from '@/services/auth'
import { parseFormData } from '@/utils/parsers'
import type { Route } from './+types/metrics'

// ---------------------------------------------------------------------------
// GET /api/metrics — Prometheus text exposition for Fly.io's managed
// Prometheus (or any scraper). Dependency-free; see app/.server/metrics.ts.
//
// Access: Fly's Prometheus scrapes over the private 6PN network. When
// METRICS_TOKEN is set, a matching `?token=` or `Authorization: Bearer` is
// required (stops public scraping of the endpoint). When it's unset, the route
// only responds outside production so metrics aren't exposed by accident.
// ---------------------------------------------------------------------------

export async function loader({ request }: Route.LoaderArgs) {
  const token = process.env.METRICS_TOKEN

  if (token) {
    const url = new URL(request.url)
    const provided =
      url.searchParams.get('token') ??
      request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ??
      ''
    if (provided !== token) {
      return new Response('Unauthorized', { status: 401 })
    }
  } else if (process.env.NODE_ENV === 'production') {
    return new Response('Not found', { status: 404 })
  }

  return new Response(renderPrometheus(), {
    headers: { 'content-type': 'text/plain; version=0.0.4; charset=utf-8' },
  })
}

// ---------------------------------------------------------------------------
// POST /api/metrics — a browser reporting that an optional pipeline stage was
// skipped (no WebGPU, a PDF that wouldn't render, a model that wouldn't load).
//
// Deliberately *not* behind METRICS_TOKEN: that token gates scraping, and the
// browsers doing the reporting don't have it. A session is required instead,
// so the counters can't be inflated by anonymous callers. Sent via
// `navigator.sendBeacon`, so the response is ignored and must stay cheap —
// always 204, never an error the client would retry.
// ---------------------------------------------------------------------------

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) return new Response(null, { status: 204 })

  try {
    const report = await parseFormData({
      request,
      schema: clientDegradedReport,
    })
    recordDegraded(report.stage, report.reason)
  } catch {
    // Malformed or unknown enum value — drop it. Telemetry must never turn
    // into a second failure on a client that is already degraded.
  }

  return new Response(null, { status: 204 })
}
