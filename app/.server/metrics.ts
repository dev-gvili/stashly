import { monitorEventLoopDelay } from 'node:perf_hooks'
import type { Pool } from 'pg'

// ---------------------------------------------------------------------------
// Lightweight, dependency-free metrics registry.
//
// Emits Prometheus text-exposition format from `/api/metrics` (scrapeable by
// Fly.io's managed Prometheus) without pulling in prom-client. It tracks the
// signals that actually break first under a synchronized notification burst
// (see docs/notifications-sse.md → "Operations: metrics & connection pooling"):
//
//   • db_pool_waiting          — requests queued for a DB connection. The
//                                leading indicator that the pool is saturating.
//   • eventloop_lag_seconds_*  — event-loop delay. The single-LISTEN-funnel +
//                                request handling share this one loop, so lag is
//                                the ceiling signal.
//   • notify_events_total      — NOTIFY events forwarded by the LISTEN bridge.
//   • sse_connections          — currently open EventSource streams.
//   • mark_all_read_total      — the burst trigger itself.
//
// Everything is process-local. Fly's Prometheus scrapes each machine and the
// series carry the instance labels, so per-machine values aggregate upstream.
// ---------------------------------------------------------------------------

const counters = {
  notify_events_total: 0,
  mark_all_read_total: 0,
  sse_connections_opened_total: 0,
  db_pool_errors_total: 0,
}
type CounterName = keyof typeof counters

let sseActive = 0
let poolRef: Pool | undefined

// Event-loop delay histogram in nanoseconds, sampled every 20ms. Reset on each
// scrape so mean/p99/max describe the last scrape window rather than uptime.
const loopDelay = monitorEventLoopDelay({ resolution: 20 })
loopDelay.enable()

export function inc(name: CounterName, by = 1) {
  counters[name] += by
}

export function sseOpened() {
  sseActive++
  counters.sse_connections_opened_total++
}

export function sseClosed() {
  sseActive = Math.max(0, sseActive - 1)
}

/**
 * Wire the owned pg.Pool so its live saturation gauges can be sampled at scrape
 * time. Also counts pool-level errors. Call once, when the pool is created.
 */
export function registerPoolMetrics(pool: Pool) {
  poolRef = pool
  pool.on('error', (err) => {
    counters.db_pool_errors_total++
    console.error('[metrics] pg pool error:', err.message)
  })
}

function metric(
  name: string,
  value: number,
  help: string,
  type: 'counter' | 'gauge'
) {
  const v = Number.isFinite(value) ? value : 0
  return `# HELP ${name} ${help}\n# TYPE ${name} ${type}\n${name} ${v}\n`
}

/** Render the current registry as Prometheus text exposition format. */
export function renderPrometheus(): string {
  const nsToS = (ns: number) => ns / 1e9
  let out = ''

  out += metric(
    'stashly_notify_events_total',
    counters.notify_events_total,
    'NOTIFY events forwarded from the Postgres LISTEN bridge',
    'counter'
  )
  out += metric(
    'stashly_mark_all_read_total',
    counters.mark_all_read_total,
    'mark_all_read intents handled',
    'counter'
  )
  out += metric(
    'stashly_sse_connections_opened_total',
    counters.sse_connections_opened_total,
    'SSE connections opened since boot',
    'counter'
  )
  out += metric(
    'stashly_db_pool_errors_total',
    counters.db_pool_errors_total,
    'pg pool errors observed',
    'counter'
  )

  out += metric(
    'stashly_sse_connections',
    sseActive,
    'Currently open SSE (EventSource) connections',
    'gauge'
  )

  if (poolRef) {
    out += metric(
      'stashly_db_pool_total',
      poolRef.totalCount,
      'Total clients in the pg pool',
      'gauge'
    )
    out += metric(
      'stashly_db_pool_idle',
      poolRef.idleCount,
      'Idle clients in the pg pool',
      'gauge'
    )
    out += metric(
      'stashly_db_pool_waiting',
      poolRef.waitingCount,
      'Requests queued waiting for a pg connection (saturation)',
      'gauge'
    )
  }

  out += metric(
    'stashly_eventloop_lag_seconds_mean',
    nsToS(loopDelay.mean),
    'Mean event-loop delay over the last scrape window',
    'gauge'
  )
  out += metric(
    'stashly_eventloop_lag_seconds_p99',
    nsToS(loopDelay.percentile(99)),
    'p99 event-loop delay over the last scrape window',
    'gauge'
  )
  out += metric(
    'stashly_eventloop_lag_seconds_max',
    nsToS(loopDelay.max),
    'Max event-loop delay over the last scrape window',
    'gauge'
  )

  loopDelay.reset()
  return out
}
