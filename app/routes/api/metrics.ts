import { renderPrometheus } from '@/services/metrics'
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
