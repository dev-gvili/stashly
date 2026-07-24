# PgBouncer on Fly.io

A standalone Fly app that fronts Postgres with **transaction pooling**, so the
main Stashly app can absorb bursts of concurrent requests (e.g. a synchronized
`mark-all-read` wave) without exhausting Postgres connections. See the failure
analysis in [`../../docs/notifications-sse.md`](../../docs/notifications-sse.md)
→ _Operations: metrics & connection pooling_.

```
main app  ──DATABASE_URL──▶  stashly-pgbouncer.flycast:6432  ──▶  Postgres
   │
   └──DIRECT_DATABASE_URL──▶  Postgres directly   (LISTEN + migrations only)
```

## Why two URLs

| URL | Points at | Used by |
| --- | --- | --- |
| `DATABASE_URL` | **PgBouncer** (`:6432`, transaction mode) | The app's `pg.Pool` (all normal queries) — multiplexed, high concurrency. |
| `DIRECT_DATABASE_URL` | **Postgres** directly | The `LISTEN` client (session-pinned; breaks under transaction pooling) and Prisma **migrations** (DDL + advisory locks). |

The code already prefers `DIRECT_DATABASE_URL` and falls back to `DATABASE_URL`
when it's unset (local/dev), so nothing breaks without a pooler:

- `app/.server/notification-events.ts` — the LISTEN connection
- `prisma.config.ts` — the migration datasource

## Deploy

From this directory (`deploy/pgbouncer/`):

```bash
# 1. Create the app (once)
fly apps create stashly-pgbouncer

# 2. Give it a PRIVATE (flycast) address — no public IP
fly ips allocate-v6 --private --app stashly-pgbouncer

# 3. Upstream Postgres credentials as secrets (NOT in fly.toml).
#    Create the Postgres cluster first — see ../postgres/README.md. On Fly,
#    DB_HOST is the cluster's private address, e.g. stashly-postgres.flycast
fly secrets set \
  DB_HOST=stashly-postgres.flycast \
  DB_NAME=<database> \
  DB_USER=<user> \
  DB_PASSWORD=<password> \
  --app stashly-pgbouncer

# 4. Deploy
fly deploy
```

`DB_PORT`, `POOL_MODE`, pool sizes, and `AUTH_TYPE` are set in `fly.toml`; tune
`DEFAULT_POOL_SIZE` to stay comfortably under Postgres `max_connections`
(remember: **every** PgBouncer machine opens up to `DEFAULT_POOL_SIZE` server
connections).

## Point the main app at it

On the **main** Stashly app, set both URLs and deploy:

```bash
fly secrets set \
  DATABASE_URL="postgres://<user>:<password>@stashly-pgbouncer.flycast:6432/<database>" \
  DIRECT_DATABASE_URL="postgres://<user>:<password>@stashly-postgres.flycast:5432/<database>?sslmode=disable" \
  --app <your-main-app>
```

> `sslmode=disable` is correct for a **Fly-internal** Postgres (6PN is already
> encrypted). Use `sslmode=require` if `DIRECT_DATABASE_URL` points at an
> **external** managed provider.

Optional app-side tuning (defaults shown):

| Env | Default | Meaning |
| --- | --- | --- |
| `DATABASE_POOL_MAX` | `10` | Max app→PgBouncer connections per instance. Can stay small — PgBouncer does the fan-out. |
| `DATABASE_POOL_TIMEOUT_MS` | `10000` | Fail fast instead of hanging when the pool is exhausted. |
| `METRICS_TOKEN` | _(unset)_ | If set, required to scrape `/api/metrics`. |

## Notes & caveats

- **Transaction mode + Prisma:** compatible with the `@prisma/adapter-pg`
  driver adapter, which issues parameterized, unnamed statements. Do **not**
  enable server-side prepared-statement caching that persists across
  transactions.
- **Migrations:** run against `DIRECT_DATABASE_URL`. `prisma.config.ts` already
  prefers it, so `pnpm prisma migrate deploy` works as long as the env var is
  set in the migration environment.
- **Health:** Fly's TCP checks on `:6432` confirm the listener is up. For a
  deeper check, exec in and run `psql -p 6432 -U <user> pgbouncer -c 'SHOW POOLS;'`.
- **Redundancy:** this removes the connection-pool cliff. The `pg_notify` +
  single-`LISTEN` funnel ceiling is separate — see the doc's scaling notes for
  when to graduate to a broker.
