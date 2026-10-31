---
name: verify
description: Use when a fix needs to be proven with real numbers rather than asserted — "/verify", "prove it worked", "did that actually fix it", "measure before and after", or any performance/behaviour claim you are about to make. Stashly repo.
---

# Verify

Prove the fix moved a real number. Not "should be faster" — a before and an after, captured the same way.

**Core principle: the baseline is captured BEFORE the fix exists, or there is no baseline.** A number reconstructed after the fact is a guess wearing a number's clothes. If you already edited the code and never measured first, say so and stash/revert to capture it — don't back-fill.

## 1. Name the metric before you touch anything

State the symptom and the single number that proves it, in the user's terms:

| Symptom shape | Metric | How it's captured |
|---|---|---|
| "too many requests" | request count, total bytes | chrome-devtools `list_network_requests` |
| "slow" | ms, wall clock | `performance_start_trace`, or a `console.time` in the real path |
| "boots N workers" | constructor calls | patched `window.Worker` in `initScript` |
| "query is slow" | ms + plan | `EXPLAIN ANALYZE` via `npx tsx --env-file=.env` |
| "wrong output" | the exact string/row | raw output, pasted |
| "wrong result from a pure function" | a failing assertion | a Vitest case in that module's `__tests__/`, shown failing. Vitest runs `environment: 'node'` with no DOM, so components and hooks can't be rendered — test the pure function behind them, or fall back to raw output |

One metric. If you can't name it, you can't verify the fix — go back and ask.

## 2. Capture the baseline

Run the repro and **paste the raw numbers** into the conversation. Not a summary of them.

Browser measurement, in `navigate_page`'s `initScript` — both of these silently lie without it:

```js
performance.setResourceTimingBufferSize(10000) // default caps at 250 and drops the rest, no warning
const RealWorker = window.Worker                // counting requests is inference;
window.__workers = 0                            // counting constructions is fact
window.Worker = function (...a) { window.__workers++; return new RealWorker(...a) }
```

Repo facts that make a "clean run" the wrong gate:

- Types — `pnpm typecheck` carries **11** pre-existing errors, exactly the entries in `.claude/tsc-baseline.json`. Gate with `node .claude/hooks/check-staged-types.mjs --all` (what CI runs): it fails on any file above its baseline, and on slack — an error you fixed that the baseline still allows (`--update-baseline`, commit it with the fix).
- `pnpm test` — **1054 passing / 0 failing** (verified 2026-10-31). There is no pre-existing failure to discount: a red test is yours to fix, never to skip or exclude.
- Dev server is already on port **80**. Don't start a second one; **never** restart or kill it — ask.

Save the baseline to `.claude/evidence/<slug>-before.json` before editing: the raw numbers plus how they were captured (page, repro steps, `initScript`), so step 4 can repeat it exactly. Not the scratchpad — it is deleted when the session ends — and not only the conversation, which is summarized when it grows long. `.gitignore`'s `.claude/*` keeps the folder local. It is the only thing that makes step 4 meaningful.

## 3. Fix the cause

- **Only the files in scope.** If the fix needs a file outside the named scope, stop and ask — don't widen quietly.
- **A workaround is not a fix, and must be labelled one.** Deferring, debouncing, or caching a call that shouldn't happen is a symptom patch — say the words "this is a workaround, the root cause is X" and let the user choose.
- Hard-refresh (Ctrl+Shift+R) after any Tailwind/CSS change before you believe what you see — a newly introduced class can HMR into the DOM ahead of its stylesheet and render as if it doesn't exist. That's a stale stylesheet, not a broken layout; rewriting working markup to chase it wastes a full round.

## 4. Re-measure identically

Same page, same repro, same procedure, same `initScript` — read them back from `<slug>-before.json`, don't recall them. Save the result to `.claude/evidence/<slug>-after.json`. A different capture path makes the comparison worthless.

Then run the gates that apply to what you touched:

```bash
node .claude/hooks/check-staged-types.mjs --all   # exit 0 — only at the END of the task
pnpm test         # 1054/0 baseline; any failure is a regression
pnpm build        # REQUIRED if you touched route imports — the .server/client split
                  # is only enforced at build time; dev never surfaces it
```

`$queryRaw` is invisible to `tsc`. Verify SQL by running it against the dev DB: a script **in the repo root** (module resolution fails from a temp dir), absolute imports, no top-level await, `import { prisma } from '@/services/db'`.

## 5. Report the table

```
                    before    after
requests              1018       47
transferred          493MB   11.2MB
worker boots            14        1
```

Then, in one line: root cause, the change, and anything you touched that wasn't asked for.

**If the delta isn't visible in the raw output, the fix FAILED.** Say that word. Revert or move to the next hypothesis — do not report a failed fix as a partial win.

**Three failed hypotheses is the limit.** After the third, stop editing and report each hypothesis, its before/after numbers, and what ruled it out — then ask. A fourth guess on the same evidence is how a session drifts.

## Red flags — stop

| Signal | Do instead |
|---|---|
| "should be faster now" | Measure it, or don't claim it |
| Baseline reconstructed from memory after editing | Revert, capture, redo |
| Fix and measurement in the same breath, no before | You have one number. That's not a comparison. |
| User says "still not working" | Your diagnosis was wrong. Re-derive from evidence — don't patch the same theory. |
| Typecheck "passes" / "fails" | Report the count delta; the 11 errors in `.claude/tsc-baseline.json` are the floor |
| Counting network requests to infer worker boots | Patch the constructor and count facts |
| Numbers improved, unrelated files also changed | Name them in the report before committing |

## Quick reference

| Need | Call |
|---|---|
| Network baseline | `list_network_requests` after `navigate_page` w/ `initScript` |
| Timing trace | `performance_start_trace` → `performance_stop_trace` |
| Prove a Tailwind class resolves | Append a throwaway `div`, read `getComputedStyle` — works unauthenticated on `/auth/sign-in` |
| Authenticated page | Ask the user to sign in to the MCP Chrome — they can |
| SQL / plan | `npx tsx --env-file=.env <script.ts>` from repo root |
