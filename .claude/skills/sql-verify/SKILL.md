---
name: sql-verify
description: Use to run and check a changed or new raw SQL ($queryRaw) or action against the dev database — tsc can't see raw SQL — "verify this query", "run this SQL", "test the raw query". Always read-only or rolled back. Stashly repo.
disable-model-invocation: true
---

# SQL verify

`$queryRaw` is invisible to `tsc`. Run it.

**Core principle: nothing it does may survive.** Wrap writes in a transaction you roll back; never run a migration or a mutation unless the owner asked.

## Steps

1. Write a throwaway script **in the repo root** (from a temp dir module resolution fails), e.g. `verify-sql.tmp.ts`:
   - absolute alias imports; no top-level `await` (wrap in `async function main()`)
   - `import { prisma } from '@/services/db'` — `new PrismaClient()` throws under Prisma 7 without an adapter
2. For a read: call the action (or `prisma.$queryRaw`) with real ids from the dev DB and print the result.
3. For a write: run it inside a transaction that ends in a rollback.
   ```ts
   class Rollback extends Error {}
   await prisma.$transaction(async (tx) => {
     // run the statement via tx, print rows/affected
     throw new Rollback()
   }).catch((e) => { if (!(e instanceof Rollback)) throw e })
   ```
   Statements with their own `BEGIN`/trigger behaviour that depends on commit (the statement-level status trigger) can't be fully shown this way; say so.
4. Run it: `npx tsx --env-file=.env verify-sql.tmp.ts`.
5. Check: BigInt params use integer arithmetic; no backticks inside the template literal; the result shape matches what the caller parses (an API route's BigInt needs an output schema with `z.coerce.number()`).
6. **Delete the script.** `git status --porcelain` must not list it.

## Report

The statement, the inputs (ids described, not pasted if private), rows returned or affected, and that it was rolled back. For performance, hand over to `sql-perf` for the plan and before/after numbers.
