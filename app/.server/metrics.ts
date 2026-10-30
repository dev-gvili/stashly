import { monitorEventLoopDelay } from 'node:perf_hooks'
import type { Pool } from 'pg'
import type { DegradedReason, DegradedStage } from '@/schemas/api.schemas'

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
//   • size_rollup_*            — the upload size log (size-rollup.ts): runs,
//                                deltas and rows applied, skips, lock timeouts,
//                                and the slowest run / oldest delta per scrape.
//                                A run nearing 250 ms means one database-wide
//                                rollup at a time is no longer enough.
//
// Everything is process-local. Fly's Prometheus scrapes each machine and the
// series carry the instance labels, so per-machine values aggregate upstream.
// ---------------------------------------------------------------------------

const counters = {
  notify_events_total: 0,
  mark_all_read_total: 0,
  sse_connections_opened_total: 0,
  db_pool_errors_total: 0,
  size_rollup_runs_total: 0,
  size_rollup_deltas_total: 0,
  size_rollup_rows_total: 0,
  size_rollup_skipped_total: 0,
  size_rollup_lock_timeouts_total: 0,
  size_rollup_errors_total: 0,
}
type CounterName = keyof typeof counters

// Worst rollup in the current scrape window; reset on each scrape.
let sizeRollupMaxMs = 0
let sizeRollupOldestMaxMs = 0

let sseActive = 0
let poolRef: Pool | undefined

// Client-reported degradation, keyed `stage|reason`. Kept apart from the flat
// counters above because this is the one series carrying labels.
//
// These stages fail *on the user's machine*, inside a catch block that used to
// only reach their console — so a browser update breaking WebGPU showed up as
// zero server errors and a quiet drop in feature usage. Counting them here is
// what makes that visible. Both label values are validated against a closed
// enum before they arrive (see `clientDegradedReport`), so no escaping is
// needed and cardinality stays bounded.
const degraded = new Map<string, number>()

// Event-loop delay histogram in nanoseconds, sampled every 20ms. Reset on each
// scrape so mean/p99/max describe the last scrape window rather than uptime.
const loopDelay = monitorEventLoopDelay({ resolution: 20 })
loopDelay.enable()

export function inc(name: CounterName, by = 1) {
  counters[name] += by
}

/**
 * Record one client-side degraded stage. Callers must pass values already
 * validated against `clientDegradedReport`.
 */
export function recordDegraded(stage: DegradedStage, reason: DegradedReason) {
  const key = `${stage}|${reason}`
  degraded.set(key, (degraded.get(key) ?? 0) + 1)
}

/** Record one applied run of apply_item_size_deltas() (size-rollup.ts). */
export function recordSizeRollup(run: {
  deltas: number
  ancestors: number
  oldestMs: number
  ms: number
}) {
  counters.size_rollup_runs_total++
  counters.size_rollup_deltas_total += run.deltas
  counters.size_rollup_rows_total += run.ancestors
  sizeRollupMaxMs = Math.max(sizeRollupMaxMs, run.ms)
  sizeRollupOldestMaxMs = Math.max(sizeRollupOldestMaxMs, run.oldestMs)
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

  const sizeRollupCounters: [CounterName, string][] = [
    ['size_rollup_runs_total', 'Upload size rollups that applied deltas'],
    ['size_rollup_deltas_total', 'Upload size deltas applied'],
    ['size_rollup_rows_total', 'Folder rows written by upload size rollups'],
    [
      'size_rollup_skipped_total',
      'Upload size rollups skipped because another run held the lock',
    ],
    [
      'size_rollup_lock_timeouts_total',
      'Upload size rollups that gave way to a row lock and retried',
    ],
    [
      'size_rollup_errors_total',
      'Upload size rollups that failed unexpectedly',
    ],
  ]
  for (const [name, help] of sizeRollupCounters)
    out += metric(`stashly_${name}`, counters[name], help, 'counter')
  out += metric(
    'stashly_size_rollup_seconds_max',
    sizeRollupMaxMs / 1000,
    'Slowest upload size rollup over the last scrape window',
    'gauge'
  )
  out += metric(
    'stashly_size_rollup_oldest_delta_seconds_max',
    sizeRollupOldestMaxMs / 1000,
    'Oldest upload size delta applied over the last scrape window',
    'gauge'
  )
  sizeRollupMaxMs = 0
  sizeRollupOldestMaxMs = 0

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

  // Labelled series: emitted with HELP/TYPE even when empty so the metric is
  // discoverable in the scraper before the first degradation is ever reported.
  out +=
    '# HELP stashly_client_degraded_total Optional client pipeline stages skipped, by stage and reason\n' +
    '# TYPE stashly_client_degraded_total counter\n'
  for (const [key, value] of degraded) {
    const [stage, reason] = key.split('|')
    out += `stashly_client_degraded_total{stage="${stage}",reason="${reason}"} ${value}\n`
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
