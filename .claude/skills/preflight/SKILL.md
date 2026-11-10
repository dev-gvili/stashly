---
name: preflight
description: Use before shipping to run the pre-push checks in order and report — "/preflight", "am I ready to push", "check before ship". Reports only; /ship does the commit and push. Stashly repo.
disable-model-invocation: true
---

# Preflight

One report of what stands between the working tree and `main`. **It changes nothing.**

**Core principle: real numbers, no re-runs.** If this session already ran a check, report that result instead of running it again.

## Checks, in order

1. **Tree inventory**
   ```bash
   git status --porcelain
   git ls-files --others --exclude-standard
   ```
   Flag: `.env*` (except `.env.example`), `options/` directories and `option-*.css` (design experiments, never commit), `*.tmp.*` scratch scripts, `ckpt/` leftovers, files you can't explain.
2. **Types**: `node .claude/hooks/check-staged-types.mjs --all` (the CI gate; the baseline is `.claude/tsc-baseline.json`). Only at the end of a task, never mid-edit; skip for className/copy-only changes. Report new errors by file, and baseline slack ("an error you fixed is still allowed"); run `--update-baseline` only if asked.
3. **Targeted tests**: map changed files to their `__tests__/` neighbours and run just those (`pnpm test <path>`). Report counts. One full `pnpm test` only if the change is broad, once, no flake loops (a flake is reproduced in its own file). Files needing a database are listed in CLAUDE.md.
4. **Build-only hazards** (dev never shows them): a route exporting something that reaches a `.server` module; a removed use of a `@/services/*` import whose import line remains; a new server dependency that can't be bundled. If any applies, say `pnpm build` is the only check and offer it.
5. **Hook-level rules**: run the convention checks over the diff: `console.` in `app/.server`, `sonner`, raw `font-*`, arbitrary `text-[..px]`, `prisma` in routes (the `convention-reviewer` subagent does this thoroughly).
6. **Docs and tests present** for a significant change (new route, action, schema): tests added, CLAUDE.md/README/skill updated if conventions changed.
7. **Dated facts**: if the test count changed, say CLAUDE.md, the skills and the handoff need the new figure (`node .claude/scripts/test-count-drift.mjs <result.json>` compares).
8. **UI changes**: has `ui-verifier` passed in this session in light and dark? If not, it isn't ready to push.

## Report

A table: check | result (numbers) | blocks push?. Then the verdict: **ready** / **ready except** <items> / **not ready** <why>. Say plainly what was not verified. Hand to `/ship` for the commits and push; don't commit here.
