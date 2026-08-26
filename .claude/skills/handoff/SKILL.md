---
name: handoff
description: Use when the user asks to close out a session, hand off, or write a handoff note — "/handoff", "wrap up", "write the handoff", "what's left". Stashly repo.
---

# Handoff

Write `docs/handoff/<YYYY-MM-DD>-<topic>.md` so the next session — or the next
person — can resume without re-deriving anything, then propose any CLAUDE.md
update this session earned.

**Core principle: a handoff is a record, not a summary.** Its value is the parts
that are unfinished, broken, or waiting on the user. A note that only lists
accomplishments is worse than no note, because it reads as "done".

## 1. Gather facts, don't recall them

```bash
git log --oneline origin/main -10        # what actually landed, with SHAs
git status --porcelain                   # what is still uncommitted (incl. ?? untracked)
git log origin/main..HEAD --oneline      # committed but unpushed
```

Every SHA in the note comes from `git log`, never from memory. If a commit isn't
in `git log`, it didn't ship — say so, in the NOT done section.

Also collect, from this session only:

- Verification actually run — real numbers (`pnpm typecheck` error count,
  `pnpm test` pass/fail), or the word **unverified**. Never re-run a suite that
  already passed this session just to have a number to print.
- Anything you told the user is their job to run.
- Anything you knowingly left red.

## 2. Write the note

Create `docs/handoff/<YYYY-MM-DD>-<topic>.md`. `<topic>` is a short kebab-case
slug for the thread of work (`markdown-mermaid`, `cross-file-types`), not the
date restated.

```markdown
# <Topic> — <YYYY-MM-DD>

## Shipped
- `<sha>` `<type(scope): subject>` — one line on *why*, not what the diff shows.
(If nothing shipped, write "Nothing landed." and say where the work stands.)

## Not done
Explicit, not implied. Each item: what it is, why it stopped, and what it would
take. "Deferred", "left as a follow-up" and "optional" all belong here — this is
the section the next session actually reads.

## You must run
Exact commands, copy-pasteable, in order. Migrations (`pnpm prisma migrate dev`
→ `generate`), dev-server restarts, re-indexes, hard reloads. If the list is
empty, write "Nothing." — an empty section reads as forgotten.

## Known-broken
Anything red on purpose: failing tests you chose not to chase, a flag left off,
a half-migrated call site. Name the pre-existing failures separately from the
ones this session caused, and don't launder one into the other.

## Context worth keeping
Only what the code and git history don't already say: a dead end and why it was
dead, a constraint discovered the hard way, a decision and the alternative it
beat. Skip anything re-derivable from the diff.
```

Keep the whole note under ~60 lines. If a section has nothing, keep the heading
and say so in a word.

## 3. Propose the CLAUDE.md diff — don't apply it

Ask what this session learned that a *future* session would otherwise re-learn:

- A trap that cost real time (stale asset, cached client, a resolver mode).
- A command, path, or count that is now wrong in CLAUDE.md.
- A convention the user corrected you on more than once.

Then check whether it belongs there at all:

| Signal | Where it goes |
|---|---|
| Always relevant, any task | CLAUDE.md |
| Only when touching one subsystem | that subsystem's skill |
| True only of this session's work | the handoff note, not CLAUDE.md |

Show the proposed change as a diff and **wait**. CLAUDE.md is the file every
future session reads; growing it by a paragraph per session is how it stops
being read. Propose nothing rather than propose noise — "no CLAUDE.md change
needed" is a valid, common outcome.

## 4. Report

Print the note's path, the SHAs recorded, and the proposed CLAUDE.md diff (or
"none"). Do not commit the note or the CLAUDE.md edit unless asked — `/ship`
does that.

## Red flags — stop

| Signal | Do instead |
|---|---|
| A SHA you didn't read out of `git log` | Run `git log`; never write a SHA from memory |
| "Not done" section is empty on a session with interrupts | Re-read what you skipped; empty is rare and usually wrong |
| Verification stated as "should pass" | Report the real number, or write **unverified** |
| Handoff claims work shipped that is only committed locally | `git log origin/main..HEAD` — say "committed, unpushed" |
| About to append a paragraph to CLAUDE.md unasked | Propose the diff and wait |
