# active-memory handoff: Stashly tech-debt pass (8 Nov 2026)

**Handoff #9** · 2026-11-08 · Lineage: #1 (2026-11-01): items 23, 37, 48, 49, 50 resolved; 4, 14, 53 register fixes; item 10 partly done; #2 (2026-11-01): items 61, 62, 63 found and resolved; #3 (2026-11-01): item 45 resolved, items 64 and 65 registered (later resolved); #4 (2026-11-01): items 57 and 19 deferred, items 20 and 22 resolved; #5 (2026-11-06): item 46 deferred; item 47 resolved (a drive pays for what is on it); #6 (2026-11-06/07): createFolder access fix + inline 403; test collaborator account; item 51 resolved at its cause; artifact v77; #7 (2026-11-07/08): item 66 (upload-vs-trash race) resolved with row locks, item 67 registered; artifact v78/v79; owner chose private sharing; #8 (2026-11-08): item 67 resolved and item 68 registered (`43a5dd5`); code review of `d3a241f..69f7da7`; item 69 found, fixed, measured, extra lock merged away; artifact v81, private; #9 (2026-11-08): items 70 and 71 (copyItem own-subtree recursion, non-atomic copy quota) resolved in `f47fa34`, CI green; review findings registered as items 72–76, item 77 (move into a grandchild) found; artifact v82, private

## 0. Instructions for Claude (read first)

You are continuing work from a previous chat. That chat is gone; this file is the complete context and the source of truth.

1. Read this whole file before replying.
2. Follow sections 3 (Style), 4 (Hard rules) and 5 (Corrections) in every reply, for the rest of this chat. They override your defaults.
3. Use the values in section 8 exactly. Never round, re-estimate, or "correct" them.
4. Do not suggest anything listed in section 7 (Changed / rejected) again unless the user brings it up.
5. Code word: Start every reply with exactly "Yes Boss!"
6. Your first reply: at most 5 lines covering the goal, the current state, and the next step (section 11). Mention any files from section 13 that were not attached. Ask the questions in section 12 if there are any. End with "Ready to continue with <next step>?" Then wait for the user's go.

## 1. Mission
- **Goal:** work through Stashly's tech-debt register (`docs/tech-debt.md`, mirrored to the "Stashly Tech Debt" artifact), fixing, deferring or declining items as the owner decides, keeping the register, `CLAUDE.md`, the subsystem skills, auto-memory and the artifact in sync.
- **Done looks like (per item):** evidence re-checked on `main` → baseline before editing (`/rootcause`) → red test → fix → green; live check where it applies; scale check at 20,000+ rows run twice when SQL is involved; cost measured before/after (`/verify`, alternated runs); type gate exit 0; one full `pnpm test` green; register (summary count + latest status line + both tables + details + changes log) and artifact updated; pushed to `main`; CI green.
- **Why it matters:** Stashly is meant as a top-tier OSS reference implementation and Drive/OneDrive replacement. It is in **private development; the service isn't public** (owner).

## 2. About the user (as relevant to this work)
- Owner of Stashly (repo `X:\stashly`, GitHub `dev-gvili/stashly`, git user "alon gvili"): React Router 8 / Express 5 / Prisma 7 / PostgreSQL 17 / XState app on Fly.io + Tigris.
- Command-driven power user: short commands ("continue", "Yes, fix move race", "q1: copyItem", "update the live artifact"); picks from offered options (wrap-up buttons); interrupts over-planning. Sometimes types on a Hebrew keyboard layout ("בםמאןמוק" = "continue"). Answers numbered questions tersely ("q2: yes").
- Reads designs critically and challenges them ("is this a real fix or another ones of your workarounds", "why 2 places and not the trigger only ?", "* 100,000 files = no go").
- Wants real measurements: when a cost is left unmeasured they say "measure first use /verify".
- Runs `/code-review ultra <range>` — in this app that loads their own local `code-review` skill (a single-agent review), not the cloud ultra review.
- Windows (PowerShell primary; Git Bash available), Claude desktop app. Chrome signed in as `usr_uAl9DQSmOi-Xne8WGmycSw`; the in-app browser pane is signed in as their other dev account `usr_jY94r4AQIyrd9N0xPPME5Q`.

## 3. Style & communication
- **Language:** English.
- **Tone:** direct, factual; measured results only; say plainly what was not verified; say "FAILED" when a fix fails.
- **Reply length:** short status lines while working; compact summary at the end, usually markdown tables.
- **Formatting:** tables for results; clickable file links like `[file.ts:42](app/path/file.ts:42)`; Explanatory-style "✶ Insight" blocks (2–3 points) around code work. Code review output: Summary / Critical Issues table / Suggestions table / What Looks Good / Verdict, findings marked "not reproduced" when unproven.
- **Working style:** act first; for a change touching 3+ files, or outside an approved plan, present a short numbered plan and wait; owner decisions via a short question with options (wrap-up buttons), recommendation first. Work too big for the remaining context goes to a fresh session; check its result yourself before reporting it.
- **Avoid:** describing instead of doing; unmeasured claims (also in commit messages); leaving a cost "not measured" in a report; hiding test output; broad exploration before the named file; full-suite runs in loops; presenting a workaround as a fix; judging a slowdown in absolute ms instead of a ratio; overstating what a measurement proves; asserting what code does before reading it.

## 4. Hard rules (word for word)
1. "Commit and push without asking." (CLAUDE.md Git Workflow; finished work ships to `main`.)
2. "for any change touching 3+ files, present a short numbered plan and wait for approval before editing."
3. "Never restart or kill the dev server — the user manages it." (dev server on port 80)
4. "Never run DB mutations or migrations unless explicitly requested." (Dev DB migrations are the owner's: hand them `pnpm prisma migrate deploy`. Live-DB test files and bench scripts that create and wipe their own test users are fine once the owner asked for the fix; read-only probes are fine.)
5. "Never add or install a new dependency … without asking first."
6. "Authorization lives in actions, never in loaders." / "never call `prisma` directly from routes".
7. "Measure before optimizing and re-measure after." / "report real measurements only". The baseline is captured before the fix exists; if the fix is already committed, load the old code (e.g. `git show <sha>:app/.server/item-actions.ts > app/.server/item-actions-before.ts`, deleted afterwards; also copy `quota-actions.ts` and rewrite the import when the fix touches it) rather than reconstructing numbers.
8. "A failing test must be fixed, not excluded, skipped or marked `it.fails`." / "Never hide test output."
9. "Assume a dirty tree … never `git add -A` … stage explicitly and scope by concern."
10. "Never run destructive git commands (`git checkout -- <file>`, `git reset --hard`, `git clean`) on files with uncommitted changes. Ask first."
11. "Loading the matching skill is **mandatory** before touching the area" (`stashly-prisma-data`, `stashly-item-lifecycle`, `stashly-upload-xstate`, `stashly-ui-conventions`, `stashly-e2e-testing`, `tech-debt-artifact`, `verify`, `ship`, …).
12. "Only run typecheck at the END of a task" — `node .claude/hooks/check-staged-types.mjs --all` (from `X:\stashly`).
13. "Before reporting a CI result, wait for `status == completed` with **one background command**": `bash .claude/scripts/wait-for-ci.sh` via Bash `run_in_background` (exit 0 success / 1 other / 2 no run).
14. "This file and the auto-memory … must agree. When a rule changes in one, change it in the other in the same step."
15. Use parallel subagents / workflows only when the user asks.
16. Tech-debt artifact: "the markdown is the source; the page is built from it, never edited by hand" — commit the doc first, `node .claude/skills/tech-debt-artifact/build.mjs "<scratchpad>/tech-debt.html"`, publish with `url` set to the URL in section 8.
17. Fixes reuse existing helpers, patterns and test files; a new file must be justified up front.
18. "Always run `/verify` right before the `commit` command (never for docs or tests)." `/verify` also requires `pnpm build` when route imports change.
19. Run the full test suite once at the end (plus once with `STRIPE_SECRET_KEY=` blank when a test's imports can reach `app/.server/stripe.ts`). Never loop full-suite runs; reproduce a flake in its one file instead.
20. Write nothing under the repo while a live upload measurement or an E2E run is going (a repo write full-reloads the dev page).
21. A test that imports anything reaching `stripe.ts` stubs it whole: `vi.mock('@/services/stripe', () => ({ stripe: {} }))`.
22. "Schema files (`prisma/models/*.prisma`), migrations, and shared machines/hooks are hard gates: never edit them before the owner approves."
23. Don't trade read speed for write headroom: a folder listing is the hot path, and stored counters stay stored (owner, 6 Nov; in CLAUDE.md).
24. Judge every per-file or per-operation cost at 100,000 files ("* 100,000 files = no go"); report it as a ratio and an extrapolated total.
25. Performance fixes are verified with real uploads before and after: "/verify before / after with real uploads, upload the project `app` folder for measurement."
26. If a fix needs a file outside the approved plan, stop and ask.
27. Never commit `handoff-stashly.md`.
28. Every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` (the forked `ship` skill dropped it once; pass it in the `ship` args).
29. Any code that locks several folders takes them in id order (`ORDER BY "id"` before `FOR UPDATE` / `FOR KEY SHARE`), as `lockSubtreeFolders` and `lockDestinationFolder` do (item 69; in the `stashly-item-lifecycle` skill).

## 5. Corrections log
| # | Claude did | The user wanted |
|---|---|---|
| 1 | Item 48: fixed only parser calls outside `try` | The same solution everywhere |
| 2 | Left item 53 shown as open | Mark it resolved; check for more like it |
| 3 | `.catch()` on the synchronous `parseSearchParams` | `parseOrRespond(() => parseSearchParams(...))` |
| 4 | Said "about 15 routes" | Measured: 20 API routes |
| 5 | (self) Commit message claimed an unverified BigInt 500 | Claim only what was measured |
| 6 | (self) `importOriginal` spread of a Stripe-loading module; CI failed | Stub such modules whole |
| 7 | (self) Proposed a throttled reload for item 45 | Rows reach the page without refetching |
| 8 | (self) Recorder installed after page load | Install in `initScript`; say which numbers were invalid |
| 9 | Ran the full suite ~10 times chasing a flake | "stop with the testing loops" |
| 10 | Reply without the code word | Start every reply with "Yes Boss!" |
| 11 | (self) `onboard.machine.test.ts` reached Stripe; CI failed | Check the import chain |
| 12 | Item 47: offered moving the quota charge last | A real fix removes the per-file write to a shared row |
| 13 | Said `childCount` must stay stored because filtered on | Filters have no caller; only sort and labels read it |
| 14 | Recommended counting children at read time | "plan revoked!!" — reads 6× slower |
| 15 | Assumed cross-drive move/copy needed handling | No cross-drive move or copy (`moveItems` enforces; copy refuses another drive) |
| 16 | (self) Wrong refund victim story | The real route was trashing the folder |
| 17 | (self) Rollup wrote `Item` before `Folder` | `Folder` first |
| 18 | (self) Settle failure skipped the refund | Settle failure no longer costs the refund |
| 19 | (self) Said counts trail by ~0.4 s | Measured 631–759 ms |
| 20 | (self) Bench harness artefact | Compare on the same DB |
| 21 | Deferred an artifact republish to save tokens | "Republish now" |
| 22 | Proposed a function-based fix with the size rules "in two places" | "why 2 places and not the trigger only ?" → trigger-only design |
| 23 | Ruled out a statement trigger by misreading item 8 | Inserts keep row triggers; only status changes move |
| 24 | Listed "+2 round trips per operation" | "* 100,000 files = no go" — every per-file cost judged at 100,000 |
| 25 | (self) Tried signing the collaborator into the in-app browser | Use an isolated headless Chromium context |
| 26 | (self) Red number 452 from `pg_stat_xact_user_tables` holding earlier transactions | Read the counter before and after; true value 166 |
| 27 | (self) Seeded only non-folder rows in the status delta | Every changed row contributes `new_active − old_active` |
| 28 | (self) Joined the transition tables; second 20,000-file trash 140 s | `GROUP BY`, never a join |
| 29 | (self) Upload harness counts wrong; trash started with files in flight | Know the harness counts; check data, not flags |
| 30 | (self) Real-upload after times fell 3.5× from the environment | Say the comparison is confounded |
| 31 | (self) Item 67 draft said create/move/copy checked status | Read the code first |
| 32 | (self) Race harness read state before the trash settled | Await the trash before reading results |
| 33 | (self) A failed patch assertion left the old harness running | Discard those numbers, fix, re-run |
| 34 | (self) Repro hung: PowerShell pipe buffering + open Prisma pool | `.finally(() => prisma.$disconnect().then(() => process.exit()))` |
| 35 | Item 66 commit added only detail sections; register tables stopped at 65 | Every new item gets a row in both register tables |
| 36 | Reported item 69's extra lock statement as "its time was not measured" | "measure first use /verify" → measured alternated before/after, then merged it away |
| 37 | (self) Review predicted a move-first race leaves an orphan | Tests showed a deadlock (`40P01`) |
| 38 | (self) Item 69's register entries didn't update the summary | Every new item also updates the item count, categories and the "Status at … (latest, …)" line |
| 39 | (self) Cut the full-suite output with `Select-Object -Last 6` and lost the pass count | Filter for `Test Files`/`Tests` lines so the count is always captured |
| 40 | (self) Forked `ship` skill wrote "No before/after measurement" in `220203b`'s message although the tests were red before | Give `ship` the real evidence in its args |
| 41 | (self) Piped `pnpm test` into `Select-Object -First 20`, which stopped the pipeline and killed the run before it finished | Write the full run to a file first (`pnpm test *> $env:TEMP\x.txt`), then filter the file |

## 6. Decisions
| Decision | Why |
|---|---|
| Items 19, 46, 57 deferred | Owner's call (private development; low measured cost) |
| Item 47: a drive pays for what is on it | Owner's design |
| `createFolder` requires `write` on the parent; inline refusal keeps its status | Owner: "Yes, fix it", "Yes, do both" |
| Test collaborator account and `p46-session-burst` kept | Owner (7 Nov) |
| Item 51: trigger-only fix; `Orphaned` rewrite | Owner approved |
| Item 66: uploads hold the parent `FOR KEY SHARE`; trash locks the subtree's folders `FOR UPDATE` first | Row-lock conflict, measured 0.2–0.3% trash cost |
| Item 67: create/move/copy read the destination via `lockDestinationFolder`; `copyItem` rewritten (copier owns + pays, bytes shared, live contents only, own drive only) | Owner: "Fix copy too"; contents in trash left out (owner's choice) |
| Item 69 fixed; source-folder lock merged into `lockDestinationFolder(tx, folderId, leaving)` | Owner: "Yes, fix move race", "Yes, merge and re-measure" |
| Next item after #8: the `copyItem` findings | Owner: "q1: copyItem" |
| Open review findings registered as new items (70+), not folded into item 68 | Owner: "q2: yes" to "register as new items (70+), or fold into item 68?" — read as the first option |
| Copy into own subtree → 400 `INVALID_INPUT`; copy charge via `onItemsCopied` with `withinTotal` (507) | Claude's implementation of the owner-chosen fix; shipped `f47fa34` |
| Artifact sharing private | Owner: "Make it private"; v82 reports private |

## 7. Changed / rejected
- Item 69 first fix: separate `FOR KEY SHARE` statement before the destination read (`220203b`, +12% p50) → merged into `lockDestinationFolder`'s statement (`5219936`)
- `copyItem` quota: JS compare of `userQuota.remaining` read earlier → guarded UPDATE (`withinTotal`) (`f47fa34`)
- Function plan for item 51 → statement-level trigger, no app change except `Orphaned`
- Joined transition tables in the trigger → `GROUP BY`
- Rollup per owner tree → not needed
- Artifact sharing "Anyone with the link" → private
- ❌ Moving the quota charge last (workaround); ❌ deleting `childCount`; ❌ Prisma `_count` sort; ❌ per-batch quota reservation; ❌ `synchronous_commit = off`; ❌ splitting quota into rows
- ❌ Statement-level trigger for every path incl. inserts (item 8: one-row insert 3.0 → 10.0 ms)
- ❌ Trigger `WHEN` clauses to save calls (item 42: 9.5% slower)
- Earlier: MinIO for CI E2E; `pnpm start` for CI E2E; throttled reload (item 45); `.catch` on `parseSearchParams`; looping full-suite runs

## 8. Data & facts (exact)
- Repo `X:\stashly`, `main`, remote `dev-gvili/stashly`. Head `28d603f`. **CI success on `f47fa34`** (run https://github.com/dev-gvili/stashly/actions/runs/42506081407); earlier CI success on `7a8f5a5` (run 42501847486) and `b85352c` (run 42500441849). `28d603f` is docs-only; its CI was not waited for.
- Commits from #9: `f47fa34` fix(items): refuse a copy into its own subtree and charge a copy in one guarded UPDATE · `28d603f` docs: record items 70 and 71 resolved, register 72-77, 1305 tests.
- Commits from #8, in order: `43a5dd5` · `fad6e25` · `69f7da7` · `220203b` (no Co-Authored-By trailer) · `b85352c` · `3196077` · `5219936` · `7a8f5a5` · `7ca7edf` · `7211c05`.
- Tests: `pnpm test` **1305 passing / 0 failing (105 files)** (8 Nov; in `CLAUDE.md` and `verify` skill). `upload-folder-tree.test.ts` 31/31. Type gate exit 0 (baseline 11).
- Tech-debt artifact: https://claude.ai/artifact/1dAJBVU7hSk6gueAyzgFDt — **Version 82** (version id `1794160159-5b80`, 8 Nov, built from `28d603f`; 77 items / 77 anchors / 0 leftover `~~`; chip "Updated 8 Nov"). Pinned. **Private**. v81 (`1794157486-a682`) was confirmed byte-identical to a rebuild of `7211c05`'s doc plus the server wrapper (no hand edits).
- Register (8 Nov, latest items 70 and 71): **77 items** · **58 resolved · 1 resolved in code, rollout step unconfirmed (2) · 3 partly done (10, 16, 17) · 2 declined (15, 44) · 2 open from the audit (12, 13) · 11 new and open (19, 46, 57, 59, 68, 72–77; 19, 46 and 57 deferred by the owner)** · categories Code 43, Architecture 22, Infrastructure 4, Test 5, Documentation 2, Dependency 1.
- Items 70 + 71 (resolved, `f47fa34`), evidence `.claude/evidence/copy-item-guards/` (`red-before.txt`, `green-after.txt`, `summary.json`, `cost-before{1,2,3}.json`, `cost-after{1,2,3}.json`, `bench-copyguards.ts.txt`):
  - 70: copy into the folder itself → test timed out at 5000 ms before; after, 400 in under 1 s for folder / child / grandchild, nothing written.
  - 71: two 40-byte copies, 60-byte quota, both held after quota read via `LOCK TABLE "Item" IN SHARE MODE` → before both succeeded, `used` 80; after one succeeds, other 507, `used` 40.
  - Cost (1-file folder into destination 10 levels deep, idle dev DB, 20 warm-up, 5 rounds × 100 copies, alternated ×3), median of round p50 ms:

| Run | before (`7211c05`) | after (`f47fa34`) | delta |
|---|---|---|---|
| 1 | 14.28 | 14.16 | −0.8% |
| 2 | 13.00 | 13.55 | +4.2% |
| 3 | 13.28 | 13.81 | +4.0% |

  - Last two rounds mean p50: before 12.80, after 13.69 ms. One ancestor walk per copy, independent of file count.
- Items 72–77 (open, registered 8 Nov): 72 trash vs folder upload lock order (score 12, not reproduced) · 73 `lockSubtreeFolders` stops on equal count not set (15, not reproduced) · 74 move/copy 404 for trashed destination before `write` check (15) · 75 copy takes `workspaceId` from source not destination (10) · 76 trashed-destination tests trash-first only (Test, 15) · 77 `moveItems` refuses only `item.id === targetFolderId` and `targetFolder.parentId === item.id`, so a grandchild target may create a cycle (30, High, read from code, not reproduced).
- Item 68 (open): `recursiveCopy` ~2.7 ms per file (100 files 308–396 ms, 500 files 1,243–1,414 ms, 1,000 files 2,635–2,735 ms); ~1,800 files outlasts the 5 s transaction timeout; copy has no route caller yet; copies no thumbnails.
- Item 69 (resolved, `220203b` + `5219936`): move p50 three-way 7.86 (`69f7da7`) / 8.60 (`220203b`) / 7.51 ms merged. Evidence `.claude/evidence/move-source-lock/`.
- Item 67 (resolved, `43a5dd5`): accepted 4 of 4 → refused 6 of 6; `createFolder` p50 3.86 → 4.11 ms, `moveItems` p50 5.82 → 6.57 ms.
- Item 66 (resolved, `bfbaa75`): 6 of 6 → 0 of 6; trash lock step 3–8 ms on 20,000 files (0.2–0.3%).
- Item 51 (resolved, `d3a241f`): restore 20,000 122 s → 2.7–3.2 s; trash 50,000 failed → 6.6–6.9 s; rollup timeouts 395–850 → 0.
- Permanent delete (throwaway): 1,250 1.5 s · 5,000 2.9 s · 20,000 13.0 s (nested 8.9 s).
- Dev accounts: owner `usr_uAl9DQSmOi-Xne8WGmycSw` (drive `drv_3CDCsidkDSNaJFDjSxY9kg`); other dev account `usr_jY94r4AQIyrd9N0xPPME5Q` (root `item_rmy2zITZWDaQL7NLadHTYw`); test collaborator `usr_1ChRcO-xAFDC9VIUtglS7g` "Test Collaborator" `collab-test@test.local`, drive `drv_UzGu6MgfK3U0H0r6OzCTqg`, root `item_zSt_coam1sTs9-Eov-Adgg`, write on `p46-session-burst` `item_H9lh7DZt1Lidibxk6rxzgA` (357 items); session (expires 2026-11-13) cookie in gitignored `tests/e2e/.auth/collab-session.txt`.
- Dev Postgres 17.5 local; PgBouncer pool 25 + 5; app `DATABASE_POOL_MAX` 10.
- CI e2e env: Tigris keys `[secret removed: re-enter it]` via repo secrets.

## 9. People, terms & names
- **People:** the user (repo owner; git user "alon gvili").
- **Terms:** "Personal" = personal-stash code paths. "Ship" = commit + push to `main`. "Item #N" = register item N. "Defer" = stays open with a dated status. "p46" = the `p46-session-burst` test folder. "ultra" in `/code-review ultra` = their local review skill.
- **Names in use (items 70/71):** `copyItem` ancestor walk = `WITH RECURSIVE "Up"` from `target.id`, `EXISTS (... "id" = source.id) AS "inside"`, only when `source.type === 'folder'`, error `toRouteError(StashlyErrorCode.INVALID_INPUT, 'A folder cannot be copied into itself or one of its subfolders.')`; `onItemsCopied` in `quota-actions.ts` → `applyQuotaDelta({ userId, used, client, withinTotal: true })` (refusal via `refuseCharge`, 507); `formatSize` import removed from `item-actions.ts`.
- **Names in use (items 67/69):** `lockDestinationFolder(tx, folderId, leaving = [])` (one statement: destination + `parentId`s of `leaving`, `ORDER BY "id"` `FOR KEY SHARE`; 404 `ITEM_NOT_FOUND`); `moveItems` reads its items after that lock and refuses a trashed item; `lockSubtreeFolders(tx, ids)` `"Held"` CTE `ORDER BY i."id" FOR UPDATE`; `copyFacets`, `copiedFacet`, `recursiveCopy(tx, source, parentId, { ownerId, driveId, workspaceId })` returns `{ item, bytes }`.
- **Test names/helpers:** `upload-folder-tree.test.ts`: module-level `blocker`/`probe` pg clients, `sleep`, `untilBlocked(pattern, count = 1)` (hoisted in #9 from the race describe); race describe "an upload racing a trash of its folder" keeps `untilWriteLocked`, `pausedTrash`, `makeFile`, `parentOf`, nested "a move out of a folder in trash" (3) and "a create, move or copy into a folder in trash" (6); `describe('copyItem')` (5 tests: the 3 earlier + "refuses a copy into the folder itself or one of its subfolders, quickly, and writes nothing" + "lets only one of two racing copies have free space only one fits in", which creates and wipes its own `tightId` user).
- **Names in use (items 51/66):** migration `20261106210000_status_change_rollup`; trigger `item_status_change`; `stashly_apply_folder_deltas(...)`, `apply_item_size_deltas`; `insertUploadedItem` parent CTE `FOR KEY SHARE`; `resolveFolderTree` root read `FOR KEY SHARE` + per-level `FOR KEY SHARE OF i`.
- **Skills updated in #9:** `stashly-item-lifecycle` (copy refuses own subtree 400, guarded charge), `verify` + `CLAUDE.md` (1305 tests). Auto-memory `project_destination_lock_copy.md` + `MEMORY.md` index line now cover items 69–71 and 72–77.
- **Tooling notes:** bench scripts importing `@/` sit in the repo root while running, then move to `.claude/evidence/<slug>/` as `.ts.txt`; run with `$env:NODE_ENV='test'; npx tsx --env-file=.env <script>.ts <label>`; `build.mjs`'s `/^# .*\n/` doesn't strip the H1 from a CRLF doc (harmless second heading); the forked `ship` skill commits and pushes on its own. Artifact republish without reading all 3,652 lines: diff the saved live file against a rebuild of the previous commit's doc; the first publish is refused and hands the diff (counts as viewed); if every live-only line is old text being replaced, resending the same file twice goes through.

## 10. Work state
| Item | Status | Version / location | Notes |
|---|---|---|---|
| Items 70, 71 | resolved, CI green | `f47fa34`, docs `28d603f` | — |
| Items 72–77 | open, registered | `docs/tech-debt.md` | 72, 73, 77 not reproduced |
| Item 77 (move into grandchild) | open, score 30 | — | Owner was asked "Take item 77 next?"; no answer yet |
| Item 68 (copy row by row) | open | `docs/tech-debt.md` | No route calls `copyItem` |
| Item 69, 67 | resolved | `220203b`/`5219936`, `43a5dd5` | — |
| Tech-debt artifact | v82 published, private | URL in section 8 | Matches `28d603f` |
| Items 19, 46, 57 | deferred | — | — |
| Item 10 remainder | not started | — | ~50 unnamed icon buttons, toolbar < ~840px, item panel |
| Item 13 | open | — | create/move/copy tests, rest of quota-actions |
| Item 59 | blocked | — | owner's approval (backfill) |
| Item 12 | blocked | — | linter needs a new package |
| Items 16, 17 | partly done | — | — |
| Test collaborator + `p46-session-burst` | kept | — | session expires 2026-11-13 |
| Auto-memory | updated in #9 | `project_destination_lock_copy.md` | — |
| `handoff-stashly.md` | this file | repo root | Never commit it |

Other known gaps (not registered as items): permanent delete holds ancestors 13.0 s at 20,000 files; any long lock still stalls the database-wide rollup; busy-upload throughput under the status trigger unproven; a folder owner can't open a collaborator's single file; collaborator bytes stay in the collaborator's bucket; the copy/upload `withinTotal` guard doesn't count charges pending in `QuotaDelta`.

## 11. Next steps
1. **Next action:** get the owner's answer to "Take item 77 (move into a grandchild) next?" — if yes: load `stashly-prisma-data` + `stashly-item-lifecycle`, reproduce in a throwaway (a test user created and wiped by the test; guard against a recursive walk looping on a cycle, e.g. `statement_timeout`), red test in `upload-folder-tree.test.ts`, then refuse any target under the item in `moveItems` with the same `WITH RECURSIVE "Up"` walk `copyItem` uses.
2. Then the per-item loop: `/verify` cost before/after (alternated), type gate, one full test run (to a file), register in all five places + artifact (v83), ship with the Co-Authored-By trailer, CI wait.

## 12. Open questions ⚠️
- Take item 77 next, or another item (68 set-based copy, 72–76, permanent delete's long lock, 10 a11y, 13 tests)?

## 13. Re-attach checklist
- Nothing to attach. Everything is in the repo (`CLAUDE.md`, `docs/tech-debt.md`, `.claude/skills/`, `.claude/evidence/`) and in auto-memory.

---
<sub>Audit: 13/13 sections · 29 rules · 41 corrections · 92 data points · secrets removed: yes · generated by active-memory</sub>
