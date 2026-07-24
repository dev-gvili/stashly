# Postgres on Fly.io

The database Stashly runs on. Provisioned as an **unmanaged Fly Postgres** app
so it pairs cleanly with the standalone PgBouncer pooler (`../pgbouncer/`) —
you own the cluster and front it yourself.

> **Order of operations:** create this Postgres **first**, then the PgBouncer
> app, then point the main app at both. See [`../README.md`](../README.md).

## ⚠️ pgvector is required

Stashly's Prisma schema declares:

```prisma
datasource db {
  provider   = "postgresql"
  extensions = [vector, pg_trgm]
}
```

So migrations run `CREATE EXTENSION vector` (pgvector) and `pg_trgm`.

- **`pg_trgm`** ships with Postgres `contrib` — always available.
- **`vector`** (pgvector) must be **built into the Postgres image**. The stock
  `flyio/postgres-flex` image does **not** guarantee it. Verify before relying
  on it (step 3); if `CREATE EXTENSION vector` fails, use the
  [custom-image path](#pgvector-not-in-the-image) below.

## 1. Create the cluster

```bash
fly postgres create \
  --name stashly-postgres \
  --region iad \
  --initial-cluster-size 1 \
  --vm-size shared-cpu-1x \
  --volume-size 10
```

Fly prints the **superuser connection details** once — store them in your secret
manager immediately; they are not shown again.

> For HA, use `--initial-cluster-size 2` (or 3). The primary is reachable at
> `stashly-postgres.flycast:5432`, which routes writes to the leader.

## 2. Create the app database + role

Open a psql shell on the cluster:

```bash
fly postgres connect --app stashly-postgres
```

Then, as superuser:

```sql
CREATE ROLE stashly WITH LOGIN PASSWORD '<strong-password>';
CREATE DATABASE stashly OWNER stashly;
```

## 3. Enable extensions (and verify pgvector)

```bash
fly postgres connect --app stashly-postgres --database stashly
```

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS vector;   -- fails if pgvector isn't in the image
```

If the `vector` line errors, jump to [pgvector not in the image](#pgvector-not-in-the-image).

> The migration also needs the role to create extensions. Since `stashly` owns
> the database, the `CREATE EXTENSION` in migrations will run under it; if you
> prefer, pre-create the extensions here as superuser (as above) and the
> migration's `CREATE EXTENSION IF NOT EXISTS` becomes a no-op.

## 4. Connection strings

Both point at **this** cluster (PgBouncer sits in front for normal queries):

| Variable | Value |
| --- | --- |
| `DIRECT_DATABASE_URL` | `postgres://stashly:<password>@stashly-postgres.flycast:5432/stashly?sslmode=disable` |
| PgBouncer `DB_*` secrets | `DB_HOST=stashly-postgres.flycast`, `DB_NAME=stashly`, `DB_USER=stashly`, `DB_PASSWORD=<password>` |

`sslmode=disable` is correct here — traffic over Fly's private 6PN network is
already WireGuard-encrypted, and unmanaged Fly Postgres runs without TLS.

Feed these into the PgBouncer app and the main app per
[`../pgbouncer/README.md`](../pgbouncer/README.md). `DATABASE_URL` on the main
app points at PgBouncer (`stashly-pgbouncer.flycast:6432`), **not** here.

## 5. Run migrations

Migrations must use the **direct** URL (they run DDL + advisory locks that a
transaction pooler breaks). `prisma.config.ts` already prefers
`DIRECT_DATABASE_URL`:

```bash
DIRECT_DATABASE_URL="postgres://stashly:<password>@stashly-postgres.flycast:5432/stashly?sslmode=disable" \
  pnpm prisma migrate deploy
```

Run this from somewhere on the Fly private network (e.g. `fly ssh console` on
the main app, or a `fly proxy` tunnel) so `.flycast` resolves.

---

## pgvector not in the image

If `CREATE EXTENSION vector` fails, the Postgres image lacks pgvector. Deploy a
custom image to the **postgres app** that adds it — for example a Dockerfile
`FROM` your cluster's exact `flyio/postgres-flex` tag that builds pgvector:

```dockerfile
# Match the tag your `fly postgres create` provisioned (check `fly image show
# --app stashly-postgres`), then build pgvector against it.
FROM flyio/postgres-flex:<tag>
RUN apt-get update \
 && apt-get install -y --no-install-recommends build-essential git postgresql-server-dev-all \
 && git clone --depth 1 https://github.com/pgvector/pgvector.git /tmp/pgvector \
 && make -C /tmp/pgvector && make -C /tmp/pgvector install \
 && rm -rf /tmp/pgvector \
 && apt-get purge -y build-essential git && apt-get autoremove -y
```

Deploy it to the postgres app (`fly deploy --app stashly-postgres`), then re-run
step 3.

> **Alternative:** Fly **Managed Postgres (MPG)** advertises pgvector support and
> avoids the custom-image maintenance. Trade-off: with MPG you typically use its
> own connection endpoint rather than fronting it with your own PgBouncer app —
> confirm the pooling model fits before switching. Verify pgvector availability
> for your MPG plan first.
