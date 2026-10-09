---
name: ship
description: Use when the user asks to ship, land, or push what is in the working tree — "/ship", "commit and push this", "get this on main", "ship it". Stashly repo.
---

# Ship

Land the working tree on `main` as a series of commits that each say one thing.

**Core principle: one commit per concern, every file in exactly one commit, and nothing shipped the user didn't mean to ship.** Invoking `/ship` authorizes the commit and the push, with no confirmation step (owner's decision, 2026-10-09 — CLAUDE.md → Git Workflow: "Commit and push without asking"). What you can't account for stays out of the commits rather than being guessed in.

## 1. Read the tree before grouping it

```bash
git status --porcelain          # includes ?? untracked — they are easy to miss
git diff --stat                 # tracked, by size
git rev-parse --abbrev-ref HEAD
```

Untracked files never appear in `git diff`. If you group from `git diff` alone you will ship a feature without its new files and break `main`.

Read the actual diff of anything you did not write this session. A file you can't explain is a file you can't assign to a commit.

## 2. Partition by concern

A concern is the **why**, not the folder. `app/.server/x.ts` and `app/components/y.tsx` belong together when one change caused both.

- **A file goes in exactly one commit.** Interactive `git add -p` is unavailable here, so a file touched by two concerns can't be split — assign it to its dominant concern and say so in that commit's body.
- **Tests and docs ride with the change they cover.** A test that verifies this feature belongs in the feature's commit, not a trailing `test:` commit that leaves the feature commit red.
- **Don't manufacture groups.** One coherent change is one commit. Splitting it into four makes the history worse, not more rigorous.
- **Order by dependency:** schema/types → server → client → docs. Each commit should build on the one before it.
- Repo config (`.claude/**`, `CLAUDE.md`, `.gitignore`) is its own concern — `chore(skills):`, `docs:`.

## 3. Plan, then go — no confirmation

Settle the groups — files per group, the prefix and subject line for each — and execute the whole plan straight away. Don't stop to ask for a go-ahead; report the plan with the result (step 5).

- **Anything you cannot account for stays out.** The tree routinely carries unrelated in-progress work (see CLAUDE.md → Git Workflow). Leave a file you can't explain uncommitted and name it in the report. The one exception is a file that also carries your own change and can't be split: commit it with its dominant concern and say in the body what else rode along.
- **Verification status, honestly.** If this session ran `pnpm test` / `pnpm typecheck`, report the real numbers. If nothing was verified, say "unverified" — don't silently push untested code to `main`, and don't re-run a suite that already passed this session just to have something to print.

## 4. Commit

```bash
git add app/.server/search-actions.ts app/types/stash.types.ts   # explicit paths, always
git commit -F "$SCRATCH/msg-1.txt"
```

- **Never `git add -A` or `git add .`** — it hoovers up whatever else is in the tree.
- Shell is PowerShell: bash heredocs don't survive it. Write the message to a scratchpad file and use `git commit -F`, or use repeated `-m` flags for a short one.
- Format: `type(scope): imperative subject` — then a blank line and a body that explains **why**, not what the diff already shows.
- Types: `feat` `fix` `refactor` `perf` `test` `docs` `chore` `style`.

## 5. Push

```bash
git push origin main
```

On `main`, push straight — that is what was asked. On any other branch, stop and ask whether they want it merged or pushed to that branch instead.

Report the real result. A rejected push (`fetch first`, protected branch) is reported as a failure with the output, never as "shipped" — pull/rebase only if the user says to.

## Red flags — stop

| Signal | Do instead |
|---|---|
| About to `git add -A` | Stage explicit paths |
| A changed file you can't explain | Read its diff; if still unexplained, leave it uncommitted and name it in the report |
| `git checkout --`, `reset --hard`, `clean`, `commit --amend`, `push --force` | Never, on a tree with uncommitted work. Ask. |
| One commit staging 50+ files | Regroup by concern first |
| "I'll describe the commits I'd make" | Run `git add` and `git commit`. Shipping means shipped. |
| Push failed, summary says "pushed to main" | Report the failure with its output |

## Quick reference

| Step | Command |
|---|---|
| Full inventory | `git status --porcelain` |
| Untracked only | `git ls-files --others --exclude-standard` |
| What a group will contain | `git diff --stat -- <paths>` |
| Verify staged before commit | `git diff --cached --name-only` |
| Confirm it landed | `git log --oneline origin/main -5` |
