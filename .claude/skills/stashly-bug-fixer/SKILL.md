---
name: stashly-bug-fixer
description: The whole root-cause bug loop for Stashly — reproduce against the real dev services, prove the cause, write a red test, fix, prove it with before/after probes, ship and watch CI. Use whenever the user reports or complains that something is broken, wrong or failing; pastes an error message, stack trace, console/network/server log or CI failure; attaches a screenshot showing an error or wrong behaviour; or picks up a bug item from docs/tech-debt.md ("/stashly-bug-fixer <bug>", "this is broken", "why does X fail", "fix tech-debt item 81"). Stashly repo.
---

# Stashly bug fixer

You are a root-cause bug agent. A fix ships only with **proof from the real system**: a probe of the live dev services that shows the bug, a test that encodes the cause going red then green, and the same probe showing it gone.

**If you cannot prove the root cause, stop and report what you know. Never ship a workaround as a fix.**

## The commit gate

Once this skill runs, `.claude/hooks/bugfix-commit-gate.mjs` refuses every commit in this session that stages code (`app/`, `server/`, `prisma/`, `tests/`) unless:

1. a test file in the commit (or committed earlier this session) ran **red** in this session and **green** in a later run. Name the file in the test command (`pnpm test app/utils/__tests__/foo.test.ts`) so the hook can match it;
2. `.claude/evidence/bugfix/<slug>/probe-before.*` and `probe-after.*` exist, both written this session, with the after newer than the before.

Docs-only commits pass. The probe files hold **raw output from the real service**. Writing them by hand, or from a mock, to get past the gate is fabricated evidence (CLAUDE.md → Data Honesty). If the gate blocks you, produce the missing proof or stop and report.

## 0. Set up

- Pick a short `<slug>` for the bug and create `.claude/evidence/bugfix/<slug>/` (git-ignored by `.claude/*`).
- Load every subsystem skill the bug touches before you read code (CLAUDE.md → Subsystem Skills; `stashly-upload-xstate` for uploads, `stashly-item-lifecycle` for trash/delete, and so on).
- A tech-debt item: re-check its evidence against current `main` first. It may already be fixed or not worth fixing (decline with numbers).
- Start where the user pointed. Read at most 3 files before you have a reproduction (Scope Discipline).

## 1. Reproduce against the real dev services

Never use mocks as proof. Reproduce on:

| Service | How |
|---|---|
| Browser | chrome-devtools MCP against the running dev server on **:80** (never start or restart it). For an authenticated page, ask the owner to sign in to the MCP Chrome, then check `fetch('/api/auth/get-session')` → `user.id` matches the URL's `:me` |
| Dev DB | a script **in the repo root**, run with `npx tsx --env-file=.env <script.ts>`: absolute imports, `import { prisma } from '@/services/db'`, no top-level await |
| Tigris | the tigris MCP, or the app's own S3 client from such a script |

- **Check the `.env` first.** It must be the main checkout's (`X:\stashly\.env`, the first entry of `git worktree list`), never a stale worktree copy with rotated-out keys.
- **Writes:** you may write only throwaway data you create for the repro (a test folder, a test file). Say what the repro will write **before** running it. Deleting a bucket, or touching existing rows, objects or a user's data, needs the owner's approval in this session.
- Save the raw output (console, network entries, query rows, S3 responses, timings) to `probe-before.<json|log|txt>`, with how it was captured (page, steps, script, `initScript`) so step 6 can repeat it exactly.

## 2. Prove the root cause

Follow `/rootcause` steps 1–3:

1. The reproduction from step 1.
2. State the cause in **one sentence**, plus the evidence line (a log, a query result, a network entry) that proves it. A hypothesis read from the code is not proof.
3. List the minimal file set to change.

- Raising a timeout, retry count or limit is **not a fix** unless the evidence shows the limit itself is the cause.
- Deferring, debouncing or caching a call that should not happen is a workaround. Name it one.
- **Three failed hypotheses is the limit.** After the third, stop and report each one with what ruled it out.
- Cannot prove it? **Stop.** Report what was reproduced, the hypotheses, and the evidence for and against them. Ship nothing.

## 3. Blast radius, then the approval gate

List every resource the failing path **and** the fix can delete or mutate: tables and rows, triggers, S3 objects and buckets, quota (`used`, `QuotaDelta`), sizes and child counts, sessions and cookies, activity rows. Put the list in the report.

Then:
- **Stop and ask** if the fix touches `prisma/` schema or migrations, shared hooks or machines, or any code path that deletes data or buckets.
- **Otherwise proceed without waiting.** For this skill, a proven cause replaces `/rootcause` step 4's wait for approval (owner's decision, 26 Nov).

## 4. Write the failing test

- Vitest: a `.test.ts` in the `__tests__/` beside the module. Vitest runs `environment: 'node'`, with no DOM, so test the pure function behind a hook or component. Stub `@/services/stripe` whole. Don't mock the service under test; database tests hit the real dev DB.
- A user-facing flow the unit layer can't reach gets a Playwright test in `tests/e2e/` (load `stashly-e2e-testing`).
- Run it on the **unfixed** code, naming the file, and show it **fails for the stated reason**: `pnpm test <path>` or `pnpm test:e2e <path>`. A test that passes on the old code proves nothing.

## 5. Fix

The smallest change that removes the cause, in scope only, made additively (don't weaken types or delete tests). Prefer extending existing code to adding files.

## 6. Prove it

1. Run the new test file **3 times**, naming it each time, green on every run.
2. Run the full suite (`pnpm test`) **once**. Never loop it chasing a flake: reproduce a flake in its one file.
3. `node .claude/hooks/check-staged-types.mjs --all` at the end. Run `pnpm build` too if you touched route imports.
4. Repeat the **identical** probe from step 1, read back from `probe-before.*`, and save it as `probe-after.*`. If the delta isn't visible in the raw output, the fix **failed**: say so and go back to step 2.
5. UI change: check it in the browser in light and dark mode (CLAUDE.md → UI Verification).
6. Use `/verify` for the before/after table when the bug is a number (requests, ms, rows).

## 7. Ship

- The tree is dirty: stage only your files, one concern per commit. Test and fix go in the same commit, or the test in an earlier commit from this session.
- Commit as `fix(<area>): …`, with a body explaining the cause and the evidence, then push to `main`.
- Right after the push, start `bash .claude/scripts/wait-for-ci.sh` with `run_in_background`. It finds the run by the **pushed SHA** (not local HEAD) and fast-forwards the main checkout on success.
- A failure in files you didn't touch: rerun the failed jobs once (`gh run rerun <id> --failed`) and note it. If it fails again, investigate that one spec in isolation.
- A tech-debt item: update it with `tech-debt-item`, then `tech-debt-artifact`.

## Final report

```
Root cause:  <one sentence>
Evidence:    <the log/query/network line that proves it>
Blast radius:<resources the path deletes or mutates>
Test:        <file › test name> — red on <sha/unfixed>, green ×3
Probe:       before → after (raw excerpt, or a /verify table)
Full suite:  <n passed / n failed>   Types: check-staged-types exit <code>
CI:          <run URL> — <conclusion>; flakes rerun: <none | which>
Not verified:<anything you didn't check>
```

## Red flags — stop

| Signal | Do instead |
|---|---|
| "Should be fixed now" with no after-probe | Run the probe, or don't claim it |
| Verified with a mocked client | Probe the real service |
| `.env` read from a worktree | Use `X:\stashly\.env` |
| A timeout or retry bump as the fix | Prove the limit is the cause, or keep looking |
| The owner says "still not working" | The diagnosis was wrong. Re-derive from evidence |
| The repro would delete something you didn't create | Ask first |
| The gate blocked the commit | Produce the missing proof. Never fake it |
