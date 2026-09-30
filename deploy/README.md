# Deploy

Infrastructure for running Stashly on Fly.io. Stand these up **in order** —
each step produces the connection details the next one needs.

| # | Component | Dir | Produces |
| --- | --- | --- | --- |
| 1 | **Postgres** (unmanaged Fly Postgres, pgvector) | [`postgres/`](./postgres/README.md) | `DIRECT_DATABASE_URL` + `DB_*` creds |
| 2 | **PgBouncer** (transaction pooling, private) | [`pgbouncer/`](./pgbouncer/README.md) | `stashly-pgbouncer.flycast:6432` |
| 3 | **Main app** (set secrets, deploy) | repo root ([below](#main-app)) | — |

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

## Main app

Built from the repo-root `Dockerfile` and deployed with the repo-root
`fly.toml`. The image runs as a non-root user on port **8080**.

1. Create the app once: `fly apps create stashly`.
2. Set the secrets. They're read with `process.env` across `app/`, `server/` and `server.js`:

   | Secret | Used for |
   | --- | --- |
   | `DATABASE_URL` | All queries, through PgBouncer (`stashly-pgbouncer.flycast:6432`) |
   | `DIRECT_DATABASE_URL` | Migrations and the `LISTEN` client, going straight to Postgres |
   | `BETTER_AUTH_SECRET`, `COOKIE_SECRET` | Sessions |
   | `GITHUB_CLIENT_ID`/`_SECRET`, `GOOGLE_CLIENT_ID`/`_SECRET`, `MICROSOFT_CLIENT_ID`/`_SECRET` | OAuth sign-in |
   | `AWS_ACCESS_KEY`, `AWS_SECRET_KEY`, `AWS_REGION`, `AWS_ENDPOINT_URL` | Tigris object storage |
   | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Billing and the `/api/stripe` webhook |
   | `EMAIL_SERVICE_URL`, `EMAIL_SERVICE_TOKEN` | Outgoing email |
   | `METRICS_TOKEN` | `/api/metrics`, which 404s without it |
   | `DATABASE_POOL_MAX`, `DATABASE_POOL_TIMEOUT_MS` | Optional pool tuning |

   ```sh
   fly secrets set DATABASE_URL=... DIRECT_DATABASE_URL=... --app stashly
   ```
3. Deploy with `fly deploy`. Before any machine is replaced, `release_command` runs
   `prisma migrate deploy` in a temporary machine, and a failing migration
   aborts the deploy. CI's `docker` job builds this same image on every push
   and checks that it boots and answers `/api/health`, which is also Fly's
   health check.

## Observability

The app exposes `GET /api/metrics` (Prometheus text; `app/.server/metrics.ts`),
guarded by `METRICS_TOKEN` — with the token unset the route **404s in
production**, so set it before scraping. Gauges include `stashly_db_pool_total`
/ `_idle` / `_waiting` (sampled from the owned `pg.Pool` in `app/.server/db.ts`),
`stashly_sse_connections`, and `stashly_eventloop_lag_seconds_*`. To scrape with
Fly's managed Prometheus, add to the main app's `fly.toml`:

```toml
[metrics]
  port = 8080
  path = "/api/metrics"
```

Rationale and the metric catalog: [`../docs/notifications-sse.md`](../docs/notifications-sse.md)
→ _Operations: metrics & connection pooling_.
