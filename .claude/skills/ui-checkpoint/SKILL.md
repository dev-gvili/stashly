---
name: ui-checkpoint
description: Use before the first edit of a redesign or large UI change to make a non-destructive revert point — "/ui-checkpoint <name>". Called by ui-port. Stashly repo.
disable-model-invocation: true
---

# UI checkpoint

Create a revert point so a rejected phase is a one-line rollback.

**Core principle: never touch the working tree to make the checkpoint.** The tree usually holds 50+ uncommitted files of unrelated work. Use commands that read it and write only refs.

## Steps

1. Name it `ckpt/<yyyy-mm-dd>-<name>` (kebab-case).
2. Record HEAD and the dirty state:
   ```bash
   git rev-parse HEAD
   git status --porcelain | wc -l
   ```
3. Tag HEAD, and snapshot uncommitted tracked changes without altering them:
   ```bash
   git tag ckpt/<date>-<name>
   git stash create          # prints a commit id; creates NO stash entry and leaves the tree untouched
   ```
   If `git stash create` prints an id, store it: `git update-ref refs/ckpt/<date>-<name>-wip <id>`. If it prints nothing the tree was clean.
4. Untracked files are not in either. Note their count (`git ls-files --others --exclude-standard | wc -l`) in the report.
5. Report the tag, the wip ref, and the restore commands. Don't run them:
   - committed work: `git revert <phase commits>` (or `git diff ckpt/<name>..HEAD` to inspect first)
   - uncommitted work: `git diff refs/ckpt/<name>-wip` to inspect

## Never

`git checkout -- <file>`, `git reset --hard`, `git clean`, `git stash push` (it removes your changes from the tree). If the owner wants a rollback, show them the diff and ask.
