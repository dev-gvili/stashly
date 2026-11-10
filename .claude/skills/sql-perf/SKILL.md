---
name: sql-perf
description: Use when Stashly code is slow, makes too many database calls, or regressed — "this query is slow", "too many DB calls", "N+1", "optimize this SQL", "regression after". The procedure and templates for finding the real cost, explaining the plan, rewriting, and proving it. Stashly repo.
---

# SQL performance

**Core principle: count and time first, change second, prove third.** The dev DB has no `pg_stat_statements`, so the evidence comes from a call counter and `EXPLAIN` — not from reading the code and guessing.

Also load `stashly-prisma-data`. Related: the `verify` skill (before/after discipline), `db-call-count`, `sql-verify`.

## 1. Name the symptom and the number

One of: calls per request, ms per request, rows scanned, lock wait. Write the metric and the route or action it belongs to. If the user said "slow", measure it before anything else.

## 2. Find the cost

- **Too many calls:** run `db-call-count` on the route; list the queries by count. The fix for N+1 is usually one statement with a join, `IN (…)` or `= ANY($1)`, or a `select` that stops over-fetching — not a cache.
- **Slow query:** capture the exact SQL (Prisma `log: ['query']` shows it with params). Then explain it in a transaction that always rolls back:

```sql
BEGIN;
SET LOCAL statement_timeout = '30s';
EXPLAIN (ANALYZE, BUFFERS, VERBOSE) <the statement>;
ROLLBACK;
```

`ANALYZE` executes the statement, so a write must be inside the `BEGIN … ROLLBACK`. Run it through `npx tsx --env-file=.env` (see `sql-verify`).

Read the plan for: `Seq Scan` on a big table, row estimate vs actual off by 10x or more (stale stats → `ANALYZE` is a proposal, not a fix), `Sort` spilling to disk, nested loop over many rows, `Buffers: read` high, repeated `SubPlan`.

## 3. Choose the fix, root cause first

| Cause | Fix |
|---|---|
| N+1 | One statement; join or `ANY` |
| Missing index for a filter/sort | Propose an index (partial/composite when it matches the predicate); never run it |
| Over-fetching columns/relations | Narrow `select` |
| Count/aggregate on a hot path | Use the stored counter (`size`, `childCount`) — do not recompute |
| `OFFSET` on a deep page | Keyset pagination on the sort key |
| Per-row work in a loop | Set-based `UPDATE … FROM`/`INSERT … SELECT` in one statement |
| Slow trigger interplay | Read the trigger's current body in `docs/data_profile_stashly _prisma_schema.md` → Functions & Triggers (old migrations show stale definitions) |

A workaround (splitting, debouncing, caching) is not a fix if the call shouldn't happen at all. Say so if you propose one.

## 4. Stashly traps

- `BigInt` vs fractional param → integer arithmetic. Backticks inside `$queryRaw` end the template literal.
- Trashed folders: `size` counts active descendants only; `inclusiveSize` counts all.
- Under upload load, sizes and quota trail by ~0.7 s via `ItemSizeDelta`/`QuotaDelta`; call `flushItemSizes()` in tests.
- Change `status` in a statement of its own (the statement-level trigger ignores one made inside a trigger).
- Never trade hot-read speed for write headroom; stored counters stay stored.

## 5. Prove it

Before the change and after, on real data, ≥2 warm runs each, same capture method:

| | calls | ms (run 1 / run 2) | rows | plan node |
|---|---|---|---|---|
| before | | | | |
| after | | | | |

If the after isn't better, revert the change and say so. A regression test goes beside the module in `__tests__/` and must fail on the old behaviour (tests needing a DB are listed in CLAUDE.md; CI runs them all).

## 6. Hand-off

State what the owner must run: a proposed migration (text included) and `pnpm prisma migrate dev` if an index is needed, a dev-server restart if the Prisma client changed, a re-index if search data changed. Do not run them unasked.
