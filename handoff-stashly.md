# active-memory handoff: Stashly tech-debt pass (1 Nov 2026)

**Handoff #4** · 2026-11-01 · Lineage: #1 (2026-11-01): tech-debt items 23, 37, 48, 49, 50 resolved; 4, 14, 53 register fixes; item 10 partly done; #2 (2026-11-01): items 61, 62, 63 found and resolved; CI green on `74e0628`; #3 (2026-11-01): item 45 resolved, items 64 and 65 registered (later resolved in `0e4d51e`, `f9f04d3`); #4 (2026-11-01): items 57 and 19 deferred by the owner, item 20 resolved (Playwright e2e job in CI), item 22 resolved (failed onboarding re-runs; workspace uploads moved to item 17); CI green on `f04440e`

## 0. Instructions for Claude (read first)

You are continuing work from a previous chat. That chat is gone; this file is the complete context and the source of truth.

1. Read this whole file before replying.
2. Follow sections 3 (Style), 4 (Hard rules) and 5 (Corrections) in every reply, for the rest of this chat. They override your defaults.
3. Use the values in section 8 exactly. Never round, re-estimate, or "correct" them.
4. Do not suggest anything listed in section 7 (Changed / rejected) again unless the user brings it up.
5. Code word: Start every reply with exactly "Yes Boss!"
6. Your first reply: at most 5 lines covering the goal, the current state, and the next step (section 11). Mention any files from section 13 that were not attached. Ask the questions in section 12 if there are any. End with "Ready to continue with <next step>?" Then wait for the user's go.

## 1. Mission
- **Goal:** work through Stashly's tech-debt register (`docs/tech-debt.md`, mirrored to the pinned "Stashly Tech Debt" artifact), fixing, deferring or declining items as the owner decides, keeping the register, `CLAUDE.md`, the subsystem skills, auto-memory and the artifact in sync.
- **Done looks like (per item):** evidence re-checked on `main` → baseline before editing → red test → fix → green; live check where it applies; type gate exit 0; one full `pnpm test` green (also with `STRIPE_SECRET_KEY=` blank when imports reach Stripe); `/verify` before a code commit; register + artifact updated; pushed to `main`; CI green.
- **Why it matters:** Stashly is meant as a top-tier OSS reference implementation and Drive/OneDrive replacement. It is in **private development; the service isn't public** (owner, this chat).

## 2. About the user (as relevant to this work)
- Owner of Stashly (repo `X:\stashly`, GitHub `dev-gvili/stashly`, git user "alon gvili"): React Router 8 / Express 5 / Prisma / XState file-management app on Fly.io + Tigris.
- Command-driven power user: short commands ("continue", "item #57", "defer", "Go with the plan", "let deal with item #22"); expects action; picks from offered options; interrupts over-planning.
- Windows (PowerShell primary; Git Bash available), Claude desktop app. Has GitHub admin (added repo secrets this chat).

## 3. Style & communication
- **Language:** English.
- **Tone:** direct, factual; measured results only; say plainly what was not verified.
- **Reply length:** short status lines while working; compact summary at the end, usually a markdown table.
- **Formatting:** tables for per-item results; clickable file links like `[file.ts:42](app/path/file.ts:42)`; Explanatory-style "✶ Insight" blocks (2–3 points) around code work.
- **Working style:** act first; for a change touching 3+ files present a short numbered plan and wait for approval; owner decisions via a short question with options (AskUserQuestion / wrap-up buttons), recommendation first.
- **Avoid:** describing instead of doing; unmeasured claims (also in commit messages); hiding test output; broad exploration before the named file; re-running the full suite in loops; pushing while a CI run you need is still running (`cancel-in-progress`).

## 4. Hard rules (word for word)
1. "Commit and push without asking." (CLAUDE.md Git Workflow; finished work ships to `main`.)
2. "for any change touching 3+ files, present a short numbered plan and wait for approval before editing."
3. "Never restart or kill the dev server — the user manages it." (dev server on port 80)
4. "Never run DB mutations or migrations unless explicitly requested." (E2E runs seed/remove their own test users; read-only probes are fine.)
5. "Never add or install a new dependency … without asking first."
6. "Authorization lives in actions, never in loaders." / "never call `prisma` directly from routes".
7. "Measure before optimizing and re-measure after." / "report real measurements only". The baseline is captured before the fix exists.
8. "A failing test must be fixed, not excluded, skipped or marked `it.fails`." / "Never hide test output."
9. "Assume a dirty tree … never `git add -A` … stage explicitly and scope by concern."
10. "Never run destructive git commands (`git checkout -- <file>`, `git reset --hard`, `git clean`) on files with uncommitted changes. Ask first."
11. "Loading the matching skill is **mandatory** before touching the area" (e.g. `stashly-prisma-data`, `stashly-ui-conventions`, `stashly-e2e-testing`, `stashly-activity-recording`, `tech-debt-artifact`).
12. "Only run typecheck at the END of a task" — use `node .claude/hooks/check-staged-types.mjs --all` (from `X:\stashly`).
13. "Before reporting a CI result, wait for `status == completed` with **one background command**": `bash .claude/scripts/wait-for-ci.sh <full SHA>` via Bash `run_in_background` (exit 0 success / 1 other conclusion / 2 no run).
14. "This file and the auto-memory … must agree. When a rule changes in one, change it in the other in the same step."
15. Use parallel subagents / workflows only when the user asks.
16. Tech-debt artifact: "the markdown is the source; the page is built from it, never edited by hand" — commit the doc first, build with `node .claude/skills/tech-debt-artifact/build.mjs "<scratchpad>/tech-debt.html"`, publish to the URL in section 8 with `url` set.
17. Fixes reuse existing helpers, patterns and test files; a new file must be justified up front.
18. "Always run `/verify` right before the `commit` command (never for docs or tests)." `/verify` also requires `pnpm build` when route imports change.
19. Run the full test suite once at the end (plus once with `STRIPE_SECRET_KEY=` blank when a test's imports can reach `app/.server/stripe.ts`). Never loop full-suite runs; reproduce a flake in its one file instead.
20. Write nothing under the repo while a live upload measurement or an E2E run is going (a repo write full-reloads the dev page).
21. A test that imports anything reaching `stripe.ts` stubs it whole: `vi.mock('@/services/stripe', () => ({ stripe: {} }))` (memory `feedback_stripe_key_in_tests.md`).

## 5. Corrections log
| # | Claude did | The user wanted |
|---|---|---|
| 1 | Item 48: fixed only the parser calls outside `try` | "make sure it consistent around all of them same solution" |
| 2 | Left item 53 shown as open in *What's left* | Mark it resolved; check for more like it |
| 3 | Told agents to `.catch()` the synchronous `parseSearchParams` | Use `parseOrRespond(() => parseSearchParams(...))` |
| 4 | Said "about 15 routes" call `getSession` | Measured: 20 API routes |
| 5 | (self-caught) Commit message claimed an unverified BigInt 500 | Claim only what was measured |
| 6 | (self-caught) `importOriginal` spread of a module that loads Stripe; CI failed on `cc90576` | Stub such modules whole; reproduce CI with `STRIPE_SECRET_KEY= pnpm test` |
| 7 | (self-caught) Proposed a throttled reload for item 45 | Rows must reach the page without refetching the folder |
| 8 | (self-caught) Recorder installed after page load reported "0 loads" | Install it in `navigate_page`'s `initScript`; say which numbers were invalid |
| 9 | Ran the full suite ~10 times chasing one flake | "for god sake stop with the testing loops" |
| 10 | A reply started without the code word | Start every reply with "Yes Boss!" |
| 11 | (self-caught, this chat) `onboard.machine.test.ts` reached Stripe via `subscription-actions`; CI `check` failed on `7e2e9c1`; the `STRIPE_SECRET_KEY=` run had been skipped | Stubbed `@/services/stripe` in `36eff9f`; check the import chain, not "does it touch billing" |

## 6. Decisions
| Decision | Why |
|---|---|
| Item 57 deferred (stays open) | Owner: "defer". Re-measured: largest dev feed 1,355 activities at 13.4 ms; schema change + backfill not worth it |
| Item 19 deferred (stays open) | Owner: "we still in private development the service isn't public" |
| Item 20: E2E in CI uses real Tigris via repo secrets `AWS_ACCESS_KEY` / `AWS_SECRET_KEY` | Owner chose "Tigris secrets"; `createUserBucket` calls Tigris's own bucket-settings API, so MinIO can't stand in |
| Item 20: CI runs `pnpm dev` on port 80 (`sysctl net.ipv4.ip_unprivileged_port_start=80`), not the production build | Keeps `playwright.config.ts`, `auth.ts` trustedOrigins and the `better-auth.session_token` cookie name unchanged |
| Item 20: CI DB is a throwaway pgvector service + `migrate deploy` + one `free` StoragePlan row inserted with psql | Fly Postgres isn't public and isn't needed; full seed would add mock users |
| Item 20: teardown deletes only the E2E user's bucket, never `default-bucket`; retries 5× / 3 s; failure logged, not thrown | Tigris answered `BucketNotEmpty` right after emptying |
| Item 20: navigation flake fixed in the spec (`gotoStashHome` waits for `?layout=grid`) | Trace: click during hydration replaced by `LayoutMenu`'s rewrite navigation |
| Item 22 Q2: re-run onboarding on sign-in (find-or-create every step) | Owner chose "Re-run on sign-in (Recommended)"; plan approved ("Go with the plan") |
| Item 22 Q3: workspace uploads deferred with item 17 | Owner chose "Defer with item 17 (Recommended)" |

## 7. Changed / rejected
- ❌ MinIO / S3 stand-in for CI E2E (Tigris-specific bucket API)
- ❌ Production build (`pnpm start`) for CI E2E (better-auth may use `__Secure-` cookies; config changes needed)
- ❌ Connecting CI to the Fly Postgres (not public; CI uses its own service container)
- ❌ Item 22 Q2 alternatives: roll back the user on failure; block with an error page
- ❌ Item 22 Q3 now: inherit parent's workspaceId / workspace+owner (deferred to item 17)
- ❌ Item 57 schema change now (deferred)
- Earlier: throttled reload for item 45 → row inserts; `.catch` on `parseSearchParams` → `parseOrRespond`; ❌ persisting the `.ts` sniff; ❌ `importOriginal` spread of Stripe-loading modules; ❌ looping full-suite runs

## 8. Data & facts (exact)
- Repo `X:\stashly`, branch `main`, remote `dev-gvili/stashly`. Latest pushed commit `f04440e` (docs: item 22); **CI green on `f04440e2a74d7fc76a45336f46c348d7dbb63042`**.
- This chat's commits: `e82b24b` (docs: defer 57) · `85f85b9` (ci: e2e job + teardown bucket delete + navigation fix) · `461f7e8` (test(e2e): teardown retry) · `75fb449` (docs: close 20) · `070d426` (docs: defer 19) · `7e2e9c1` (fix(onboarding)) · `36eff9f` (test: Stripe stub) · `f04440e` (docs: close 22).
- Tests: `pnpm test` **1252 passing / 0 failing (103 files)**, also with `STRIPE_SECRET_KEY=` blank. Type gate exit 0 (baseline 11).
- Tech-debt artifact: https://claude.ai/artifact/1dAJBVU7hSk6gueAyzgFDt — at **v72**; 65 items, 65 anchors. Sharing is "Anyone with the link" (the skill expects private; not changed).
- Register counts (latest, item 22): **51 resolved · 1 resolved in code, rollout step unconfirmed (2) · 3 partly done (10, 16, 17) · 2 declined (15, 44) · 2 open from the audit (12, 13) · 6 new and open (19, 46, 47, 51, 57, 59; 19 and 57 deferred by the owner)**.
- Item 57 re-measurement (dev DB, `newest` query, 7 runs, median): 1,548 activities total, none on a workspace item; largest feed 1,355 activities, 13.4 ms, 1,189 buffers; next 155 activities, 1.5 ms. The 8,798-activity user is gone from the dev DB.
- Item 20 numbers: local full run 62 passed / 3 failed before → 65 / 0 after (10.2 min); CI 65 passed in 4.1 min (`85f85b9`), 6.3 min (`461f7e8`), 6.1 min (`75fb449`); e2e job 5.6–7.5 min; teardown bucket delete attempt 2 (`461f7e8`), attempt 1 (`75fb449`). Trace: click at 55.6 s, rewrite request at 56.3 s, no `/images` request. Leaked bucket `stashly-e2etestuser-5l27of6m` (from `85f85b9`) deleted by hand.
- Item 22 numbers: red 4 of 18 failed → 20 of 20 (`session-user.test.ts` 15, `onboard.machine.test.ts` 5). Evidence `.claude/evidence/p22/before.json`, `after.json` (local). Not exercised live against the dev server.
- Unique constraints behind item 22: `Drive.ownerId`, `Subscription.ownerId`, `Quota.driveId`. Placeholder bucket `default-bucket`. Onboarding re-run cooldown 60 s (`ONBOARDING_RETRY_MS`).
- CI e2e env: `AWS_ENDPOINT_URL=https://fly.storage.tigris.dev`, `AWS_REGION=auto`, keys `[secret removed: re-enter it]` via repo secrets; placeholder `BETTER_AUTH_SECRET`, `SESSION_SECRET`, `STRIPE_SECRET_KEY=sk_test_ci_placeholder`.
- Dev account: user `usr_jY94r4AQIyrd9N0xPPME5Q`, root `item_rmy2zITZWDaQL7NLadHTYw`. Test folders `p45-before` `item_8qbhL93RECAcj8zukQloeA`, `p45-after` `item_KThmkE9V3KHcg4BTN2eZQg`, `p45-after2` `item_B3Zb5mACZUYiYMqigTkUtw`.
- `WITHOUT_AUTH_MIDDLEWARE` (9): `ai.ts`, `auth.ts`, `health.ts`, `images.ts`, `metrics.ts`, `sidebar.ts`, `stripe.ts`, `theme.ts`, `view.ts`.

## 9. People, terms & names
- **People:** the user (repo owner; git user "alon gvili").
- **Terms:** "Personal" = personal-stash code paths vs workspace ones. "Ship" = commit + push to `main`. "Item #N" = tech-debt register item N. "Defer" = item stays open with a dated deferred status line (not "declined").
- **Names in use (this chat):** `.github/workflows/ci.yml` job `e2e`; `tests/e2e/global-teardown.ts` (`deleteE2eBucket`, `DELETE_ATTEMPTS=5`, `DELETE_RETRY_MS=3_000`, `PLACEHOLDER_BUCKET`); `tests/e2e/navigation.spec.ts` `gotoStashHome`; `app/components/ui/layout-menu.tsx` (the `?layout=grid` rewrite effect); `app/machines/onboard/onboard.machine.ts` (`readStoredUser`, `readingStoredUser`, `isOnboarded`, `storedBucket`); `app/.server/onboard.ts` (`onboardNewUser` shares one run per user via `running` map); `app/.server/session-user.ts` (`withOnboardingFields(user, read, onboard)`, `onboardingFailedAt`, `runOnboarding`); test `app/machines/onboard/__tests__/onboard.machine.test.ts` (live DB, `vi.hoisted` s3 fake, Stripe stub).
- Some files use CRLF (`app/utils/pagination.ts`, `.claude/skills/stashly-e2e-testing/SKILL.md`): preserve line endings when editing by script.

## 10. Work state
| Item | Status | Version / location | Notes |
|---|---|---|---|
| Item 57 | deferred (open) | `e82b24b` | Revisit when a real feed grows |
| Item 19 | deferred (open) | `070d426` | Before paid plans go live |
| Item 20 | resolved, CI green | `85f85b9`, `461f7e8`, `75fb449` | e2e job on every push |
| Item 22 | resolved, CI green | `7e2e9c1`, `36eff9f`, `f04440e` | Q3 moved to item 17 |
| Item 10 remainder | not started | — | ~50 unnamed icon buttons, toolbar < ~840px, item panel covering the file |
| Item 13 | open | — | `item-actions` create/move/copy, rest of `quota-actions`, routes, components |
| Items 46, 47, 51 | open | — | Measurement-first items |
| Item 59 | blocked | — | Needs owner's approval (DB backfill) |
| Item 12 | blocked | — | Linter needs a new package (owner's OK) |
| Versions feature | not started | — | `ItemVersion` bytes → own S3 object; re-upload-as-version |
| Memory | updated | `feedback_stripe_key_in_tests.md` + MEMORY.md line | |
| `handoff-stashly.md` | this file | repo root, untracked | Never commit it |

## 11. Next steps
1. **Next action:** ask the user which item to take next; offered: item 10 (a11y remainder, score 21) or item 13 (tests, 16); others open: 46 (15), 47 (12), 51 (12), 16, 17.
2. For each item: load matching skills, re-check evidence on `main`, baseline, red test, fix, live check, type gate, one full test run (+ `STRIPE_SECRET_KEY=` if imports reach Stripe), `/verify` before code commit, register + artifact, ship, CI wait (don't push while a needed CI run is in progress).

## 12. Open questions ⚠️
- Which item next: 10 (a11y), 13 (tests), 46, 47, 51, or the versions feature?
- The tech-debt artifact is shared "Anyone with the link"; the skill expects private. Keep it, or make it private (owner does it via the page's Share menu)?
- Delete the `p45-*` test folders from the dev stash root? (deletion is the user's call)

## 13. Re-attach checklist
- Nothing to attach. Everything is in the repo (`CLAUDE.md`, `docs/tech-debt.md`, `.claude/skills/`, `.claude/evidence/`).

---
<sub>Audit: 13/13 sections · 21 rules · 11 corrections · 40 data points · secrets removed: yes · generated by active-memory</sub>
