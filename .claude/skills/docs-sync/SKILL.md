---
name: docs-sync
description: Use after a significant change to keep CLAUDE.md, the auto-memory and the matching subsystem skill in agreement, and to refresh dated facts (test counts, error baselines) — "/docs-sync", "sync the docs", "update CLAUDE.md and memory". Stashly repo.
disable-model-invocation: true
---

# Docs sync

CLAUDE.md says the file and the auto-memory (`C:\Users\PoshI\.claude\projects\X--stashly\memory\`) must agree, and that dated facts appear in several places where the newest date wins.

**Core principle: change the places together, and only what actually changed.** If an instruction in CLAUDE.md looks wrong or conflicts, tell the owner and wait; don't edit it yourself, and don't edit CLAUDE.md unasked (a significant change authorizes updating it per Development Workflow step 2, but not rewriting rules).

## Steps

1. **What changed.** `git diff HEAD --stat` and the commits of this session. Name the conventions, commands, architecture or facts affected. A small change (class rename, label, type fix) needs nothing: stop.
2. **Dated facts.** Check each against reality, with the real number:
   - test count and files (`pnpm test` result in this session, or `node .claude/scripts/test-count-drift.mjs <result.json>`)
   - typecheck baseline (`node .claude/hooks/check-staged-types.mjs --all`, `.claude/tsc-baseline.json`)
   - any other number the change moved
   Update every copy in one step: CLAUDE.md, the `stashly-*` skills, and the handoff, with the new date. The newest date wins.
3. **Skill.** Update the matching subsystem skill (`.claude/skills/stashly-*`) when its area changed. Add a new rule only with the *why* and a measured fact; no vague advice.
4. **Memory.** For each convention or fact that changed, find the existing memory file (`MEMORY.md` index) and update it rather than adding a duplicate; delete memories that are now wrong. Add a one-line `MEMORY.md` pointer only for a new file. Don't store what the repo already records (code structure, git history).
5. **Artifacts.** If `docs/tech-debt.md` changed, run the `tech-debt-publisher` subagent after committing it.
6. **Report** the list of files and facts changed, with old → new for each number, and anything you left alone because it conflicted or was uncertain.

## Never

Rewrite CLAUDE.md rules to match the code without asking; leave a stale figure in one place; record a result you didn't measure.
