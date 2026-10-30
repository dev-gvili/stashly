# Upload Size Rollup via Delta Log — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILLS: load `stashly-prisma-data` and `stashly-upload-xstate` before touching anything, and `verify` for Tasks 0 and 7. Steps use checkbox (`- [ ]`) syntax for tracking. **Tasks 1–2 change the schema and add a migration: nothing in them is applied before the owner approves the migration diff** (CLAUDE.md hard gate).

**Status:** built 2026-10-30, with one change from this plan: see **Outcome** below. Tech-debt item 42 holds the measurements.

**Outcome.** Tasks 0–7 ran as written, and Task 7 changed the design. Logging *every* upload (D2 as planned) made a single uploader 3.5× costlier: at ~1.4 files/s each 250 ms rollup found about one delta, so its fixed cost replaced a cheap cascade (size work 615 → 2,125 ms for a 650-file upload). The shipped version (`20261030160000_upload_size_inline_when_idle`) logs an upload only while the database is busy (deltas pending, or the rollup lock taken) and cascades at once while idle; `log_upload_size()` was dropped and the decision lives in `update_size()`. Its first version tried the lock before the pending check and starved the rollup under load (0 of 10 runs at 32 uploaders); checking pending deltas first fixed it. Final numbers: one uploader 0 deltas logged, size work 757 ms; 32 uploaders into one shared folder 2,017 → 8,334 files/s, lock waiters 20.7 → 0.06, ancestor writes 100,512 → 2,821, sizes at most 410 ms behind. Tests 1038/0 in 88 files.

**Goal:** Stop every uploaded file from rewriting each folder above it, one row at a time, up to the owner's root. Inserts of uploaded files append their size to a log, and one rollup at a time applies the log to each affected ancestor **once**, on a short timer. Measured in a prototype: under 32 concurrent uploaders into one shared folder, about 2,000 → 9,000 files/s, lock waits 21 → 0 of 32, ancestor writes −96%, folder sizes at most ~0.35 s late, exact sizes in every run.

**Architecture:** A new `ItemSizeDelta` table. An `AFTER INSERT` trigger on `Item` logs `(parentId, active, inclusive)` for rows that carry an `uploadId`; `update_size()` skips those rows on insert. `apply_item_size_deltas()` (PL/pgSQL) takes a database-wide advisory lock or skips if one is running, claims up to 5,000 deltas, walks each parent's current ancestors (the active part stops at a trashed folder, exactly as `update_size()` does), and writes each ancestor once. A timer in each server process (`app/.server/size-rollup.ts`) checks every 250 ms whether anything is pending and calls it. `recount_folder_sizes(root)` recounts a subtree from its files: the test oracle and the repair tool. Trash, restore, move, delete, copy and folder creation keep today's per-row cascade.

**Tech stack:** Postgres 17 (PL/pgSQL, advisory locks), Prisma 7 (one new model and one migration), Node timer, Vitest against a live DB. **No new dependencies.**

---

## Decisions for review

Each has a recommendation. The plan below assumes the recommendation; change any of them and the affected task changes.

| # | Decision | Recommendation | What it costs |
|---|---|---|---|
| D1 | Build this at all | **Yes.** Per file today: 6.2 `update_size()` calls and 4.9 ancestor rewrites, 0.75 ms. One user alone barely notices (0.07% of a 700 s upload), but any **shared folder** (workspace or a shared folder in a personal stash) serialises every uploader on the owner's ancestor rows: throughput falls when uploaders are added (8 → 32 uploaders: ~2,800 → ~2,000 files/s, p95 6 → 52 ms). | 2–3 days. One table, two functions, one trigger, one timer. |
| D2 | Which inserts are deferred | **Uploads only**: rows whose `uploadId IS NOT NULL`, a column `insertUploadedItem` already writes. No extra query, no session flag. | Two mechanisms coexist: log for uploads, cascade for everything else. Both apply additive deltas, so they compose (Task 4 tests the mixes). Copies keep today's per-row cost. |
| D2b | Copies of uploaded files | **Strip `uploadId` in `recursiveCopy`**, so a copy is never deferred (Task 3 verifies it carries `uploadId` today via `...itemData`, and that nothing else reads a copy's `uploadId`). | One line. If a copy's `uploadId` turns out to be read elsewhere, keep it and accept a ≤250 ms lag on copies instead. |
| D3 | How the rollup is driven | **Poll every 250 ms** in each server process: a cheap `EXISTS` and, only when true, the rollup. | 4 trivial queries/s per server process while idle. Rejected: `NOTIFY` on insert. Postgres makes transactions that issued a `NOTIFY` commit one at a time across the database (`async.c`), which would add back a queue on the upload path. Rejected: a rollup every N files, which would leave a slow upload (≈1 file/s measured) up to N seconds stale. Rejected: once at batch end, which needs the client to say the batch ended; a closed tab never does. |
| D4 | What the single-flight lock covers | **One rollup at a time for the whole database**, capped at 5,000 deltas per run, with `lock_timeout = 100ms` so a rollup that meets a user's trash/move/delete gives way and retries on the next tick. | All trees' deltas go through one statement. Upgrade path, only if metrics show a rollup taking longer than the 250 ms interval: one lock per tree, rollups for different trees in parallel. Rejected: unlocked parallel rollups, which queue on the same rows (measured 2,478 files/s with 24 of 32 waiting). Rejected: a dedicated rollup process, an extra service to run. |
| D5 | Safety net | **`recount_folder_sizes(root)`**: Task 4 checks every result against it, and it repairs a tree by hand if a bug ever drifts sizes (the 2 Oct recount found 5 folders wrong by 3.5 MB). | One SQL function, adapted from the recount in `20261002090000_fix_inclusive_size_rollup`. |
| D6 | Observability | **Rollup metrics in `app/.server/metrics.ts`**: duration, deltas applied, backlog, skips, lock timeouts. They are the signal for D4's upgrade path. | A few counters and a histogram in the existing module. |
| D7 | "Calculating…" placeholder in the UI | **No.** Sizes reach the screen only when a loader runs. The post-upload reload fires 700 ms after the last file, longer than 250 ms plus a typical rollup. A reload in the middle of a long upload can miss the last ≤250 ms of files until the next one. | None. |

---

## Global constraints

- Load `stashly-prisma-data` and `stashly-upload-xstate` first. Add `stashly-ui-conventions` only if a component is touched; none is planned.
- **Schema and migration are a hard gate.** Write the model and the migration SQL, show the diff, wait for approval. Generate the table's SQL read-only with `pnpm prisma migrate diff`, not `migrate dev`. **The owner runs** `pnpm prisma migrate dev`, then `pnpm prisma generate`, then **restarts the dev server**: a new model changes the Prisma client, and the running server throws `Unknown argument` until it restarts.
- Never kill or restart the dev server (port 80). Never run destructive git commands on files with uncommitted changes.
- Test baseline **1022 passing / 0 failing in 87 files** (2026-10-30). A red test is fixed, never skipped. Type gate: `node .claude/hooks/check-staged-types.mjs --all`, at the end only.
- `$queryRaw` and PL/pgSQL are invisible to `tsc`: verify SQL against the dev DB with a repo-root `npx tsx --env-file=.env` script, in a rolled-back transaction when it writes.
- **Measure before and after with the same harness** (Task 0 and Task 7). A change that doesn't move the number is reported as failed, not as a partial win. The `WHEN`-clause attempt of 30 Oct is the precedent: calls −60%, time +9.5%, undone.
- Prettier only on files this plan creates; on edited files, revert hunks the edit didn't cause.
- Commits: conventional prefix, body with the *why*, end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. PowerShell: write multi-line messages to a temp file and `git commit -F`.

---

## Context: what was measured (30 Oct, on `638f455`)

Evidence lives in `.claude/evidence/p42/` (local, git-ignored). The register is `docs/tech-debt.md` item 42.

**Cost today.** A real 646-file upload of `app/` (71 folders) into an empty folder under the stash root, with `track_functions = pl` and `pg_waldump`:

| | |
|---|---|
| `update_size()` calls | 3,994 (6.2 per file at this depth) |
| ancestor rewrites | 3,141, 646 of them the stash root |
| DB time in the cascade | 0.48 s: 0.75 ms per file, 7.4% of the upload's DB time, 0.07% of its 700 s |
| HOT updates / autovacuum on `Item` | 95% / 0 runs |
| WAL from the cascade | ~1.2% of the readable window |

**Tried and undone:** `WHEN` clauses on the four `Item` triggers. Calls fell 11,129 → 4,504, but trigger time rose 462 → 506 ms in every one of 5 alternated rolled-back runs. The calls removed were early-return no-ops of 1.6–4 µs; the cost is the ancestor `UPDATE` itself (~0.13 ms each). **Don't retry it.**

**Prototype, one connection** (same tree replayed in arrival order, rolled back, medians of 5, identical sizes in 20 runs):

| | today | rollup every file | every 25 | every 100 |
|---|---|---|---|---|
| ancestor `UPDATE`s | 3,141 | 3,141 | 192 | 102 |
| DB time for sizes | 434 ms | 2,059 ms | 129 ms | 67 ms |
| 646 inserts, wall | 746 ms | 2,287 ms | 396 ms | 328 ms |

Batching is the whole gain. Without it the mechanism is 3× slower.

**Prototype under concurrency.** W uploaders, one connection each, inserting `Item` rows back to back into their own copy of the tree under **one shared folder**. Today's triggers were measured before and after; exact sizes in all 27 runs.

| 32 uploaders | today | rollup by each 25th uploader | single-flight | **single-flight timer 200 ms** | timer 1 s |
|---|---|---|---|---|---|
| files/s | 1,837–2,047 | 2,478–2,599 | 9,603 | **8,981** | 9,321 |
| insert p95 / p99 | 51–57 / 84–100 ms | 1.5–2.0 / 3.6–4.3 ms | 4.9 / 6.7 ms | **5.5 / 13.7 ms** | 4.8 / 19.2 ms |
| uploaders waiting on a lock | 20.5–21.4 of 32 | 23.7–23.9 (the rollups) | 0 | **0** | 0 |
| ancestor updates | 100,512 | 12,871 | 5,659 | **3,644** | 2,471 |
| oldest unapplied change, max | none | 618 ms | 150 ms | **342 ms** | 1.2 s |

**Limits of that evidence:**
- The benchmark inserted only the `Item` row. A real upload also writes `File`, `Permission`, the user link and the quota charge in the same statement.
- Each uploader wrote into its own subfolders, so two remaining per-file shared rows were not exercised: the direct parent's `Folder.childCount`, and the `Quota` row if a collaborator's upload charges the folder owner. See Out of scope.

**Why it stays correct.** A delta is additive and is applied to the parent's **current** ancestors when the rollup runs. Every other path (trash, restore, move, delete, size change) cascades only what has already been applied. So any order of "insert, then X, then rollup" sums to the same result as today:
- **Move a pending file:** its old chain gets −s, the new chain +s, and the rollup adds +s to the old parent's chain, so the net is right.
- **Trash its folder before the rollup:** the active part stops at the trashed folder.
- **Delete its folder:** the rollup finds no parent and drops the delta, which was never applied above it.

Task 4 proves each case against the recount.

---

## File structure

| File | Change |
|---|---|
| `prisma/models/item-size-delta.prisma` | **new** — `ItemSizeDelta` model |
| `prisma/migrations/<ts>_upload_size_delta_log/migration.sql` | **new** — table (generated), trigger, `update_size()` v2, `apply_item_size_deltas()`, `recount_folder_sizes()` |
| `app/.server/size-rollup.ts` | **new** — per-process 250 ms loop, start guard, metrics |
| `app/.server/metrics.ts` | rollup metrics |
| startup site of the notification LISTEN bridge (`app/.server/notification-events.ts` or its caller) | start the rollup loop beside it |
| `app/.server/item-actions.ts` | `recursiveCopy`: strip `uploadId` (D2b) |
| `app/.server/__tests__/helpers/flush-item-sizes.ts` | **new** — test helper: drain the log (waits for the lock) |
| `app/.server/__tests__/item-size-trigger.test.ts` | deferred-path steps against the recount oracle |
| `app/.server/__tests__/item-size-rollup.test.ts` | **new only if** the concurrency cases don't fit the file above; prefer extending it |
| upload tests that assert folder sizes after `createUploadedItem` | add a flush |
| `docs/data_profile_stashly _prisma_schema.md`, `.claude/skills/stashly-prisma-data/SKILL.md`, `.claude/skills/stashly-upload-xstate/SKILL.md`, `CLAUDE.md`, `docs/tech-debt.md` | docs |

---

### Task 0: Re-capture the baseline (`/verify` before)

- [ ] Confirm `before.json` (live 646-file upload) and the "today" rows of `concurrency-2.json` still describe `main`. Only docs changed since `638f455`; if any code under `app/.server/` or `prisma/` changed, re-run both.
- [ ] Adapt the concurrency harness (`_p42-conc2.ts` → `_p42-conc3.ts`) to drive the **real** implementation: no session gate, rollups by calling `apply_item_size_deltas()` every 250 ms from one connection, the way the server loop will. Keep the "today" phase as is; it runs before the migration is applied.
- [ ] Save the method in `.claude/evidence/p42/plan-before.json`.

### Task 1: Model and migration (owner approval gate)

- [ ] Model, with no relation to `Item` on purpose: a delta whose parent was deleted must be dropped, not cascade-deleted mid-rollup, and no foreign key means no extra lock or check per upload.

```prisma
/// Pending folder-size changes from uploaded files, applied by apply_item_size_deltas().
/// Rows live for at most a rollup interval. No relation to Item, on purpose (see the migration).
model ItemSizeDelta {
  id        BigInt   @id @default(autoincrement())
  parentId  String
  active    BigInt
  inclusive BigInt
  createdAt DateTime @default(now())
}
```

- [ ] Generate the table SQL read-only (`pnpm prisma migrate diff … --script`), then hand-write the rest of `migration.sql`:
  - [ ] `log_upload_size()` plus trigger `item_size_log_upload AFTER INSERT ON "Item" FOR EACH ROW`. The check lives inside the function (no `WHEN`; see the 30 Oct finding): return unless `NEW."uploadId" IS NOT NULL AND NEW."parentId" IS NOT NULL AND (NEW.size <> 0 OR NEW."inclusiveSize" <> 0)`, then insert `(parentId, active, inclusive)`.
  - [ ] `update_size()` v2: the current body (`20261002090000`) plus two guards at the top: return when `current_setting('stashly.rollup', true) = 'on'` (the rollup's own writes must not cascade), and on `INSERT` return when `NEW."uploadId" IS NOT NULL` (the log has it). **KEEP IN SYNC** comment: the log and `update_size()` must agree on which inserts are deferred.
  - [ ] `apply_item_size_deltas(max_deltas int DEFAULT 5000, wait boolean DEFAULT false) RETURNS TABLE (deltas int, ancestors int, oldest_ms float8)`, sketched below. **The prototype measured a one-statement version.** This sketch splits it so locks can be bounded, so Task 7 must re-benchmark it.

```sql
-- sketch: single-flight, capped, yields to user writes
IF wait THEN PERFORM pg_advisory_xact_lock(hashtext('item_size_rollup'));
ELSIF NOT pg_try_advisory_xact_lock(hashtext('item_size_rollup')) THEN RETURN QUERY SELECT 0, 0, 0::float8; RETURN; END IF;
PERFORM set_config('stashly.rollup', 'on', true);
PERFORM set_config('lock_timeout', '100ms', true);      -- give way to a user's trash/move/delete
WITH RECURSIVE claimed AS (
  DELETE FROM "ItemSizeDelta" WHERE id IN (SELECT id FROM "ItemSizeDelta" ORDER BY id LIMIT max_deltas)
  RETURNING "parentId", active, inclusive, "createdAt"
), per_parent AS (SELECT "parentId" AS id, sum(active) a, sum(inclusive) i FROM claimed GROUP BY 1),
up AS (
  SELECT id, a, i FROM per_parent
  UNION ALL
  SELECT it."parentId", CASE WHEN it.status = 'trashed' THEN 0 ELSE up.a END, up.i
  FROM up JOIN "Item" it ON it.id = up.id WHERE it."parentId" IS NOT NULL
)
SELECT array_agg(id ORDER BY id), array_agg(a ORDER BY id), array_agg(i ORDER BY id), count(*) FILTER (...), ...
  INTO v_ids, v_a, v_i, ... FROM (SELECT id, sum(a) a, sum(i) i FROM up GROUP BY id) agg;
UPDATE "Item" t SET size = t.size + u.a, "inclusiveSize" = t."inclusiveSize" + u.i
FROM unnest(v_ids, v_a, v_i) AS u(id, a, i)
WHERE t.id = u.id AND (u.a <> 0 OR u.i <> 0) AND NOT stashly_is_wiping_user(t."ownerId");
```

  - [ ] `recount_folder_sizes(root text)`: set every folder under `root` (deepest level first) from the files beneath it, the same recount `20261002090000` ran once, scoped to a subtree. It drains the log first (`apply_item_size_deltas(NULL, true)`), so it never races pending deltas.
- [ ] Verify every function in a rolled-back transaction on the dev DB before showing the diff: an insert with and without `uploadId`, a rollup, a recount.
- [ ] **Stop. Show the model and `migration.sql` to the owner.** After approval the owner runs `pnpm prisma migrate dev` → `pnpm prisma generate` → restarts the dev server.

### Task 2: The rollup loop

- [ ] `app/.server/size-rollup.ts`: `startSizeRollup()`, idempotent through a `globalThis` guard (Vite HMR re-imports modules), off under Vitest (tests flush explicitly). Every 250 ms: `SELECT EXISTS (SELECT 1 FROM "ItemSizeDelta")`; if true, `SELECT * FROM apply_item_size_deltas()`; if it applied `max_deltas`, run again at once to drain a backlog. A `lock_timeout` error is expected under contention: count it and retry on the next tick. Keep the loop thin, with the decisions (drain again, back off) in a pure function that has its own node test.
- [ ] Metrics in `metrics.ts`: rollup duration, deltas applied, backlog after a run, skips (lock busy), lock timeouts.
- [ ] Start it beside the notification `LISTEN` bridge, so dev and production start it the same way. Check `pnpm build` (the production server bundles dependencies; nothing new should stay external).

### Task 3: Copies (D2b)

- [ ] Confirm `recursiveCopy` copies `uploadId` through `...itemData`, and grep for any reader of a copied item's `uploadId` (`UploadAction` / activity code at `item-actions.ts:109–157`).
- [ ] If nothing reads it, set `uploadId: null` on the copy, so copies cascade immediately as today. Otherwise leave it and note in the plan's outcome that copies of uploads are deferred too (≤250 ms).

### Task 4: Tests (red first where possible)

- [ ] `flush-item-sizes.ts` helper: `SELECT * FROM apply_item_size_deltas(NULL, true)`.
- [ ] `item-size-trigger.test.ts`: add uploaded-file steps, comparing each against the JS recount the file already has and against `recount_folder_sizes()`:
  - [ ] Upload a file (with `uploadId`): ancestors unchanged before the flush, correct after it.
  - [ ] Upload, then trash its folder before the flush, then flush: the active part stops at the trashed folder.
  - [ ] Upload, then move its folder before the flush, then flush: the new chain is right and the old chain is untouched.
  - [ ] Upload, then permanently delete its folder before the flush, then flush: the delta is dropped and the table is empty.
  - [ ] Upload, then change the file's size before the flush, then flush.
  - [ ] Upload and non-upload inserts mixed under the same folders.
- [ ] Concurrency, on two connections:
  - [ ] Two `apply_item_size_deltas()` calls race: one applies, the other skips, and nothing is applied twice.
  - [ ] An ancestor row held by another transaction: the rollup times out after 100 ms, its deltas remain, and the next rollup applies them.
- [ ] Grep the upload tests for folder-size assertions after `createUploadedItem` (`upload-folder-tree`, `upload-quota-charge`, `upload-item-safety`, `collection-actions`) and add a flush where needed. `upload-folder-tree.test.ts` counts top-level statements per file, which this doesn't change (the log insert runs inside the trigger); confirm.
- [ ] `pnpm test`: 1022 + the new cases, 0 failing.

### Task 5: Docs

- [ ] `docs/data_profile_stashly _prisma_schema.md`: the new table, trigger and functions, `update_size()` v2, the version history.
- [ ] `stashly-prisma-data` skill: uploads reach folder sizes through the rollup; flush in tests; the KEEP IN SYNC rule; never add `WHEN` clauses for speed (30 Oct finding).
- [ ] `stashly-upload-xstate` skill: an uploaded file's ancestors update within ~250 ms of `itemCreated`, not in the same statement. The quota charge is still in the same statement.
- [ ] `CLAUDE.md`, the "Item sizes are trigger-maintained" bullet: one sentence on the deferred path, the flush helper, and the recount function.
- [ ] `docs/tech-debt.md` item 42: resolved, with Task 7's numbers.

### Task 6: Rollback path (written, rehearsed in a rolled-back transaction)

- [ ] Down steps: drain (`apply_item_size_deltas(NULL, true)`), drop `item_size_log_upload` and `log_upload_size()`, restore `update_size()` from `20261002090000`, drop `apply_item_size_deltas()`, drop the table (model removed, new migration). Keep `recount_folder_sizes()`. Rehearse the SQL in a rolled-back transaction; record it in the migration's header comment.

### Task 7: Verification (`/verify` after)

- [ ] **Live upload:** the same 646-file `app/` upload, same harness (`_p42.ts` + `upload-audit-init.js`, fresh empty folder, `track_functions = pl`). Compare with `before.json`:
  - `update_size()` calls: 3,994 → ~717 expected, because uploaded rows skip it and the rollup's writes return at the guard.
  - ancestor rewrites (`Item` `n_tup_upd`): 3,141 → about the number of rollups × the distinct ancestors per rollup.
  - DB time for sizes (triggers + `apply_item_size_deltas` self time).
  - WAL.
  - sizes exact (`tree` mode).
  - `create_upload_item` p50 in the browser.
- [ ] **Concurrency:** `_p42-conc3.ts`, 1 / 8 / 32 uploaders, today vs implemented. Target at 32: about 8,000 files/s or more with ~0 lock waiters (prototype 8,981), sizes exact, oldest unapplied change within ~0.4 s. If the real function is clearly slower than the prototype, stop and report before going further.
- [ ] **Single connection:** replay the tree (`_p42-b2.ts` adapted). The real function must be within run-to-run noise of the prototype's 129 ms.
- [ ] Gates: `pnpm test`, `node .claude/hooks/check-staged-types.mjs --all`, `pnpm build`.
- [ ] Save `.claude/evidence/p42/plan-after.json`; report the before/after table. Then delete the `_p42*.ts` scripts and, with the owner's OK, move the `p42-before` / `p42-after` test folders to Trash.

---

## Out of scope, with what is known

| Item | Known | Next step |
|---|---|---|
| The post-upload reload storm | **136** full folder reloads during the 646-file upload, not the "two per batch" first assumed: files finish ~1/s, so the 700 ms debounce keeps re-arming. Each runs 11–14 queries and returns ~34 KB. | New tech-debt item: rate-limit reloads during an active upload (at most one every few seconds, plus one at the end), then measure. Row-level patching needs a client data layer and maybe a dependency; decide after. |
| Session cookie expiry mid-upload | Part uploads never reach our server (presigned PUTs to Tigris). On expiry, each server request already in flight may do one session lookup; the earlier audit saw at most 32 in flight. Not measured at 100 concurrent uploads. | New tech-debt item: measure that burst; if it matters, the client calls `get-session` every ~4 min while uploads are active. Using S3 signatures in place of the session doesn't work: our three calls write rows and charge quota. |
| `Folder.childCount` on the direct parent | Still updated per uploaded file. Many uploaders dropping files into **the same** folder would queue on that one `Folder` row. Not exercised by the benchmark. | Measure with all uploaders in one folder; the same delta technique applies. |
| The `Quota` row | Charged per file in the upload statement. If a collaborator's upload into a shared folder charges the **owner's** quota, that row is the next shared hot row. Not checked. | Read `createUploadedItem` / `uploadChargeSql` for whose quota is charged. |
| Copies, bulk trash/restore/move | Keep the per-row cascade. A big copy inside one transaction holds ancestor rows until it commits. | Move them to the delta path only if contention is measured. |
| Per-tree parallel rollups | The upgrade path in D4. | Only if metrics show rollups taking longer than the interval. |

## Appendix: the external critiques, point by point

| Their suggestion | Our position | Why |
|---|---|---|
| Defer the size rollup off the insert path | **Adopted** (this plan) | Measured: shared-folder throughput ×4.5, lock waits to 0. |
| …with a dirty flag and a background recount when the batch ends | **Not adopted**; the recount is kept as a safety net (D5) | A flag records only *that* something changed, so the recount rescans the whole subtree, including files already there. "When the batch ends" needs the client to say so. Sizes would stay stale for the whole upload (700 s here). A delta log applies only what changed, within 250 ms, with no completion signal. |
| …temporarily disable the trigger during the batch | Rejected | Disabling a trigger is table-wide DDL that affects every user and blocks writes. |
| …tally deltas in Redis | Rejected | A new service and dependency; deltas lost on a crash. The delta table does the same job inside the transaction. |
| A "calculating size" placeholder | Not needed (D7) | Staleness is ≤250 ms + rollup time, below the 700 ms reload delay. |
| `WHEN`-style "skip redundant trigger calls" (our own idea) | **Tried, failed, undone** | Time +9.5% (see Context). |
| An upload JWT, or S3 signatures in place of the session | Rejected | Part uploads never reach our server. Our three calls need the user for access checks and the quota charge. The 5-minute cookie cache already acts as a short-lived signed token. |
| Client refreshes the session every ~4 min during an upload | **Plausible**, out of scope | Cheap; measure the expiry burst first (Out of scope table). |
| Push new rows over SSE instead of reloading | Rejected as stated | The grid is server-paginated, sorted and filtered, and cards need signed URLs. The uploader already knows what it uploaded. |
| Structural update first, then per-row hydration | **Direction accepted**, out of scope | Our measurement (136 reloads) makes the case stronger than the critique did. Their premise that thumbnails trigger reloads is wrong (they don't). Rate-limit first, measure, then decide. |
