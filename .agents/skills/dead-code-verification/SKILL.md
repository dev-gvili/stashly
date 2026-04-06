---
name: dead-code-verification
description: Use when about to delete files identified as unused, orphaned, or dead code — especially under time pressure or when "the audit is authoritative." Symptoms include: file deletion tasks, orphaned file cleanup, removing unimported modules, dead code sweeps.
---

# Dead Code Verification

## Overview

Before deleting any file, verify it is truly unreferenced. Audits have false positives. A 10-minute check prevents a broken build and a lost hour of debugging.

**Core rule:** Delete one small batch at a time. Verify before and after each batch.

## Verification Checklist (per file)

Run ALL of these. Skipping any is the failure mode.

### 1. Static imports
```bash
# Search by filename stem AND by path alias
grep -r "from.*MachineName\|import.*MachineName" app/
grep -r "@/machines/path/to/file\|machines/path/to/file" app/
```

### 2. Barrel re-exports
```bash
# Check every index.ts in the file's directory and parents
cat app/machines/index.ts
cat app/machines/actors/index.ts   # if exists
```
If the file is re-exported from a barrel, deleting it breaks every consumer of that barrel.

### 3. Dynamic imports (string-based)
```bash
grep -r "import(.*machine-name\|require(.*machine-name" app/
# Also check Worker construction patterns:
grep -r "new Worker.*machine-name\|new URL.*machine-name" app/
```

### 4. Route registrations (React Router projects)
```bash
grep "machine-name\|file-stem" app/routes.ts
```
Route files can be registered without a static import.

### 5. Test files
```bash
grep -r "machine-name\|file-stem" tests/ app/**/__tests__/
```
Test files reference production modules without being imported by them.

## Batch Strategy

**Never delete all candidates at once.** Work in batches of 3–5:

1. Run the full checklist above for batch
2. Establish typecheck baseline: `pnpm typecheck`
3. Delete the batch
4. Run typecheck again: `pnpm typecheck`
5. If new errors: `git checkout -- <file>` and investigate
6. If clean: commit the batch, then start next batch

Small batches mean a failing typecheck points to the exact file. A mass delete makes diagnosis impossible.

## Common Rationalizations to Reject

| Excuse | Reality |
|---|---|
| "The audit is authoritative" | Audits are static snapshots. Dynamic imports, barrel re-exports, and route registrations are frequently missed. |
| "The sprint ends tomorrow" | A broken build costs more time than verification. |
| "I'll fix it if tsc fails" | With 10 files deleted at once, you won't know which one caused it. |
| "It's clearly unused" | Grep takes 30 seconds. "Clearly" is not a technical claim. |
| "The audit already did grep" | Rerun it yourself. Audit grep patterns may not cover all reference styles. |

## Red Flags — Stop and Verify

- You're about to delete more than 5 files at once
- You haven't run `pnpm typecheck` before starting
- You haven't checked `index.ts` barrel files
- You searched by class/function name but not by file path
- A memory file or audit says "confirmed orphaned" — treat this as a starting point, not a conclusion

## Quick Reference

| Check | Command |
|---|---|
| Static import | `grep -r "filename-stem" app/` |
| Path alias import | `grep -r "@/machines/path/file" app/` |
| Barrel re-export | `cat app/machines/index.ts` |
| Dynamic import | `grep -r "import(.*filename" app/` |
| Worker pattern | `grep -r "new Worker.*filename\|new URL.*filename" app/` |
| Route registration | `grep "filename" app/routes.ts` |
| Test references | `grep -r "filename" tests/` |
| Baseline typecheck | `pnpm typecheck` |
| Restore if broken | `git checkout -- path/to/file` |
