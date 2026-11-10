---
name: db-call-count
description: Use to count and time the database queries a Stashly route or action runs, by adding a temporary Prisma query counter — "how many queries does this make", "count DB calls", "is this N+1". Always removes the counter afterwards. Stashly repo.
disable-model-invocation: true
---

# DB call count

Get a real number of queries per request. The dev DB has no `pg_stat_statements` (memory `project_session_lookup_measurement`), so count in the app.

**Core principle: the counter is temporary and must be gone before you finish.** Leaving it in is a regression. Note the files you touch and restore exactly those.

## Steps

1. Check git first so you can see what you add: `git status --porcelain -- app/.server/db.ts`. If that file already has uncommitted changes that aren't yours, put the counter in a new scratch module you import from the route under test instead.
2. In `app/.server/db.ts` (read how the client is built; Prisma 7 uses an adapter) add a temporary query log that records `{ sql, ms }` per request. Tag with `request_id` from the existing request-id middleware when available, so one page load's queries group together.
3. Reload the page once cold, once warm (the user runs the dev server on port 80; never start or restart one). Read the log from the server output (`log` writes JSON to stdout) or `mcp__plugin_chrome-devtools-mcp_chrome-devtools__*` network calls if timing the browser side.
4. Report a table: statement (first 80 chars, params stripped) | count | total ms. Highlight any statement that repeats with only a parameter differing: that is the N+1.
5. **Remove the counter.** `git diff` the touched files and confirm only your lines are gone. Report the final `git status` for them.

## Notes

- Dev hot-reload re-evaluates modules: the counter resets on a file save and after a repo write (memory `project_vite_reload_resets_measurement`). Write nothing under the repo while measuring.
- Session lookups should be 0 or 1 per request (authMiddleware resolves once). More means a bare `getSession` call somewhere.
- Report real measurements only, with units and scope ("14 queries, 38 ms, cold, /:me/stash").
