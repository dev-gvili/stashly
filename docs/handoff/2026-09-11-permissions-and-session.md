# Permissions & session refactor — 2026-09-11

24 commits, `555de94..247b628`, all pushed. Tree clean.

## Shipped

- `fb3950d` `fix(filters)` — a filter key that doesn't resolve fails **open** and silently; coverage test now fails the build if schema and filter key sets diverge.
- `0310299` `fix(permissions)` — **the IDOR**: any signed-in user who knew a folder id could list its children. `getFolderContent` now requires `userId` and calls `assertItemAccess`.
- `f9a7d35` / `46bde86` `feat(auth)` + `refactor(auth)` — `:me` enforced by layout middleware, then restructured to the documented RR8 shape (`app/context.ts`, `app/.server/middleware/auth.ts`).
- `1ec7692` `refactor(breadcrumbs)` — non-owner trim moved inside `breadcrumbs()`; all three callers get it, `ownerId` stripped from payloads.
- `a5bf6f5` `feat(activity)` — overview feed scoped to owner / workspace-admin.
- `a33a241` + `cdacd5d` — workspace folder route shares `routes/stash/folder.tsx`; item URL builders became workspace-aware (fixing `ownerId`-as-`:me`).
- `92638e7` `refactor(errors)` — guards throw `StashlyError`; `throwGuardError` and its second error shape deleted.
- `910cc57` `refactor(routes)` — **Phase B**: 21 `getSession` call sites across 18 files now read from context. Net −64 lines.
- `c509c11`, `5ed561d`, `7c382d8`, `e2efd79`, `792289e`, `247b628` — alias normalization, spec, TASKS.md, and two CLAUDE.md corrections.

## Not done

- **HTTP status for denied access is still 500, not 403.** The guard fires correctly and nothing leaks, but a `StashlyError` is an `Error`, and React Router sanitizes those. Getting a real 403 means converting the throw to a `Response` in one of three places: per-loader `try/catch`, inside `assertItemAccess` (puts HTTP in the action layer), or in the layout middleware around `await next()` — **the third is unverified**; the docs suggest `next()` *returns* a Response rather than throwing, so the error may be unreachable there. Test before choosing it.
- **`getLoadContext` "must return an instance of RouterContextProvider" was never diagnosed.** The user removed `getLoadContext` and the app worked, so it was dropped. Three theories were raised and all three disproved (one package copy on disk; not inlined; the specifier was innocent). If it returns, instrument class identity at runtime — reading source did not settle it.
- **Two latent filter mismatches** in `drive.filters.ts` and `notification.filters.ts` — audited and reported, deliberately not fixed. Not exploitable today (`listNotifications` builds its `where` by hand; `searchNotifications`/`searchDrives` have no route callers).
- **Seven workspace route repoints** — only `folder` is done. `:workspaceId/favorites` and `:workspaceId/collections` have **no `id`** in `routes.ts` and will collide the moment they're repointed.
- **Code-viewer peek-references** — spec written, now unblocked (dev DB has 538 code files, all 538 with `Search` rows; was 10). Not started.

## You must run

Nothing. No migrations, no schema changes, no re-index. The dev server reloads `server/app.ts` per request, so no restart was needed.

## Known-broken

- **`/:me/stash/trash` returns 500** — `PrismaClientValidationError` from `prisma.item.findMany()` at `app/.server/item-actions.ts:1996`. **Pre-existing, not this session's doing** — proved by stashing Phase B and re-requesting at HEAD, where it fails identically. The trash page is broken for signed-in users right now.
- **11 failing unit tests** — pre-existing (`activity.test.ts` ×4, `collection-actions.test.ts` ×7, the latter needs a live DB). Not chased.
- **202 typecheck errors** — pre-existing baseline; 150 in `collection-actions.test.ts`, 34 in `pin-actions.test.ts` (attribution re-verified this session).

Final verification: typecheck **202**, `pnpm build` **exit 0**, tests **503 passed / 11 failed**, 12/12 live routes 200 against a real session.

## Context worth keeping

- **React Router sanitizes thrown `Error`s but not thrown `Response`s.** `sanitizeError` acts only `if (error instanceof Error)` (`server-runtime/errors.js:54`), and `ErrorResponseImpl` is deliberately **not** an Error subclass (`router/utils.js:722`). So a Response keeps its status and `statusText` into production, while an Error is replaced with `new Error("Unexpected Server Error")` — and `serializeError` sends only `{message, stack}`, so custom fields never reach the client either. `sanitizeErrors` mutates `context.errors` *before* rendering, so even the server-side boundary render sees the flattened version. This is the whole reason the 403 question above is not solvable in the ErrorBoundary.
- **The middleware boundary is `layout.tsx`, and API/auth routes are outside it.** 24 `getSession` callers under `routes/api/` and one under `routes/auth/` must keep their own lookup — converting them would break authentication everywhere. The "~36 loaders" figure in the original Phase B task counted them by mistake.
- **`c5f6309` exists because of `a70e112`**, 90 minutes earlier. Replacing the ErrorBoundary's `import.meta.env.DEV && error instanceof Error` branch instead of adding alongside it silently removed dev detail for ordinary errors, which is what made the trash 500 slow to diagnose. Both branches must coexist.
- **"Did my change break this?" is answerable in 30 seconds**: `git stash push -- <paths>`, re-test, `git stash pop`. The trash diff was *correct*, so re-reading it would never have settled the question.
- **A falling `error TS` count is not automatically good news.** A JSDoc block ending `**a**/**b**` contains `*/`, closes early, and makes `tsc` bail — the count dropped from 202 to 39 and looked like progress.
