---
name: add-api-intent
description: Use to add one new `intent` to an existing Stashly API action route — the Zod discriminated-union member, parse handling, action function with inline permissions, and a test — "/add-api-intent <route> <intent>". Extends existing files; creates none unless unavoidable. Stashly repo.
disable-model-invocation: true
---

# Add an API intent

Load `stashly-prisma-data` (queries, Zod). For a whole new feature (new route), use CLAUDE.md → New Feature Checklist instead.

**Core principle: extend, don't duplicate.** Find the existing route and its actions file; a "reuse" plan must not add files.

## Steps

1. **Locate**: `app/routes/api/<route>.ts` and its `app/.server/<feature>-actions.ts`. Read the route's `action` and the schema union in `app/schemas/api.schemas.ts` for the closest existing intent; copy its shape.
2. **Schema**: add one member to the discriminated union on `intent` in `api.schemas.ts`. Free-text fields go through `toUserText(...)` (`@/utils/converters`) so a value like `"2024"` stays a string. A payload containing a BigInt column needs an output schema with `z.coerce.number()` before the route sends it.
3. **Action function**: add a plain exported function to the actions file (no classes; pass context as params). Permissions inline, via `assertItemAccess(userId, itemId, { workspaceId, role })` — authorization lives in actions, never loaders. Throw `StashlyError`/`StashlyErrorCode`.
4. **Route**: add the `case` in the route's `action`. Parse with `await parseFormData(request, schema).catch(rethrowAsResponse)`; read the session from `context.get(sessionContext)`, never `getSession`; normalise thrown errors with `toErrorInfo`. The route never calls `prisma` directly. Mutations belong in `action`, never a `loader`.
5. **Revalidation**: a background-only intent that feeds the search index (and writes no displayable facet) is added to `SEARCH_INDEX_INTENTS` in `app/utils/revalidation.ts` so it doesn't reload every loader.
6. **Telemetry**: a user-facing mutation sends its Vinktar `track()` **after** the write commits, with shape-only properties (counts, ids, kinds, never names or content), and `define_event` in the same step.
7. **Test**: a Vitest test beside the action in `__tests__/`: the happy path, the permission refusal, and the invalid input (400 not 500). Stub `@/services/stripe` whole if the module reaches it. Red first when this fixes a bug.
8. **Callers**: submit from the client with `fetcher.submit(..., { method: 'POST' })` and the typed payload.

## Report

Files changed (paths), the intent, the permission rule used, test result with real counts. Typecheck once at the end (`node .claude/hooks/check-staged-types.mjs --all`).
