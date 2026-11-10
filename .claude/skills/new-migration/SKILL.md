---
name: new-migration
description: Use to write the migration for a Prisma schema change or a hand-written SQL change (trigger/function/index) — "/new-migration <name>", "write the migration", "record this schema rename". Writes the file and runs prisma generate; never runs migrate dev. Stashly repo.
disable-model-invocation: true
---

# New migration

Load `stashly-prisma-data` first. **Schema files and migrations are a hard gate: don't edit `prisma/models/*.prisma` or add a migration until the owner has approved the change.** This skill runs after that approval.

**Core principle: every schema change leaves a migration, even an empty one, and the owner applies it.** Never run `pnpm prisma migrate dev` unless they asked.

## Steps

1. Confirm the approved change: which model, field, relation, trigger or index.
2. Folder name: `prisma/migrations/<yyyyMMddHHmmss>_<snake_name>/migration.sql`. Timestamp later than the newest folder (`ls prisma/migrations | tail -3`).
3. Decide the SQL:
   - **Schema change with SQL**: take it from `pnpm prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema prisma/schema.prisma --script` if the config allows; read the output, don't paste blindly. Read the schema location from `prisma.config.ts` first.
   - **Diff is empty** (a relation field or `@relation` name rename produces no SQL): `migration.sql` holds only a comment recording the change, so history shows it.
   - **Trigger/function rewrite with no schema change**: hand-written SQL with `CREATE OR REPLACE`. Start from the *current* body in `docs/data_profile_stashly _prisma_schema.md` → Functions & Triggers (old migrations show stale definitions) and say what changed.
   - **Index on a hot table**: propose `CREATE INDEX CONCURRENTLY` only in a migration that isn't wrapped in a transaction; otherwise say it blocks writes.
4. Review it: run the `migration-reviewer` subagent on the new file when it touches a trigger, lock or large table.
5. `pnpm prisma generate`. (`app/prisma` is generated and untracked; no diff to commit.)
6. Report, and **end with the list the owner must still run**:
   - `pnpm prisma migrate dev` for a schema change, or `pnpm prisma migrate deploy` for hand-written SQL with no schema change (`migrate dev` would generate another migration on top)
   - a dev-server restart (the running server caches the old client and throws `Unknown argument`)
   - any re-index, or `recount_folder_sizes(root)` if sizes were touched

## Never

Run a migration or any DB mutation; edit an old migration; hand-edit `app/prisma/`.
