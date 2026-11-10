---
name: ui-phase-commit
description: Use to commit one approved phase of a UI port after it has been verified — "/ui-phase-commit <phase>". Called by ui-port. Stashly repo.
disable-model-invocation: true
---

# UI phase commit

Commit exactly one phase, and only a verified one.

**Core principle: one phase, explicit files, verified first.** CLAUDE.md gates "commit and push without asking" for UI changes on the change having been seen rendering correctly.

## Before committing

Refuse and say why unless all hold:

- `ui-verifier` returned **pass** for this phase in this session (light and dark). A block (sign-in, pane) means do not commit.
- `mockup-diff-auditor` has no unresolved difference the owner hasn't accepted.
- The files for this phase are the files the plan listed. A file not in the plan is reported, not staged.

## Commit

```bash
git status --porcelain
git add <explicit paths for this phase>
git diff --cached --name-only
```

Never `git add -A` or `git add .`. The tree carries unrelated work. Don't run `prettier --write` on a file you only edited; check `git diff` for reflowed hunks you didn't cause.

Write the message to a scratchpad file and use `git commit -F` (PowerShell has no bash heredocs). Format: `feat(ui): <phase subject>` with a body explaining why. The pre-commit hooks run the typecheck gate; a failure is fixed additively, never by weakening types.

## Push

Hand to `/ship` for the push and the CI wait. Report phase, commit hash, and the verification evidence (what was checked, both themes). Do not push if anything was unverified.
