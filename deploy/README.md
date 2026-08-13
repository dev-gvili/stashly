# Deploy

Infrastructure for running Stashly on Fly.io. Stand these up **in order** —
each step produces the connection details the next one needs.

| # | Component | Dir | Produces |
| --- | --- | --- | --- |
| 1 | **Postgres** (unmanaged Fly Postgres, pgvector) | [`postgres/`](./postgres/README.md) | `DIRECT_DATABASE_URL` + `DB_*` creds |
| 2 | **PgBouncer** (transaction pooling, private) | [`pgbouncer/`](./pgbouncer/README.md) | `stashly-pgbouncer.flycast:6432` |
| 3 | **Main app** (set secrets, deploy) | repo root | — |

## Connection topology

```
main app ──DATABASE_URL──────▶ stashly-pgbouncer.flycast:6432 ──▶ stashly-postgres.flycast:5432
   │                                                                        ▲
   └──DIRECT_DATABASE_URL───────────────────────────────────────────────────┘
        (LISTEN client + Prisma migrations only — bypass the pooler)
```

- **`DATABASE_URL`** → PgBouncer. All normal queries; high multiplexing so a
  burst of concurrent requests can't exhaust Postgres connections.
- **`DIRECT_DATABASE_URL`** → Postgres directly. The session-pinned `LISTEN`
  client (`app/.server/notification-events.ts`) and migrations (`prisma.config.ts`),
  both of which break under transaction pooling. Falls back to `DATABASE_URL`
  when unset, so local dev needs neither the pooler nor this var.

## Observability

The app exposes `GET /api/metrics` (Prometheus text; `app/.server/metrics.ts`),
guarded by `METRICS_TOKEN` — with the token unset the route **404s in
production**, so set it before scraping. Gauges include `stashly_db_pool_total`
/ `_idle` / `_waiting` (sampled from the owned `pg.Pool` in `app/.server/db.ts`),
`stashly_sse_connections`, and `stashly_eventloop_lag_seconds_*`. To scrape with
Fly's managed Prometheus, add to the main app's `fly.toml`:

```toml
[metrics]
  port = 80
  path = "/api/metrics"
```

Rationale and the metric catalog: [`../docs/notifications-sse.md`](../docs/notifications-sse.md)
→ _Operations: metrics & connection pooling_.
