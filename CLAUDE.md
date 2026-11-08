# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Deep-dive reference lives in skills, not here.** This file holds the always-relevant essentials. Detailed conventions for specific subsystems are extracted into project skills that load on demand — see [Subsystem Skills](#subsystem-skills) below. When a task touches one of those areas, loading the matching skill is mandatory — don't proceed without it.

## Following This File

- **Every instruction here is mandatory.** Never skip one because it seems unnecessary in the case at hand. A rule has no unwritten exceptions: "write the migration" has no "unless the diff is empty" clause.
- **If an instruction looks wrong, outdated, or conflicts with another rule, tell the owner and wait for the answer.** Don't resolve it yourself, and don't edit this file unasked.
- **This file and the auto-memory (`~/.claude/projects/c--Users-poshi-stashly/memory/`) must agree.** When a rule changes in one, change it in the other in the same step.
- **Dated facts** (test counts, error baselines) appear here, in skills and in the session handoff. When they disagree, the newest date wins; update the others to match.

## Scope Discipline

- **Start where the user pointed.** When a specific file or route is named, open that first — do NOT run broad exploration before it. Read at most **3 files** before proposing a fix. If the fix genuinely needs more, stop and ask rather than widening on your own.
- Never open unrelated schema files (`prisma/models/*.prisma`) or adjacent feature code unless the user asks or the fix demonstrably requires it. A claim of "one-line fix" followed by a file tour is the pattern to avoid.
- Do exactly what was asked, nothing more. If a fix touches only one component (e.g. image-stage), do NOT add panel/facet plumbing, refactor unrelated wrappers, or migrate other call sites.
- Never add or install a new dependency (npm/pnpm packages like prom-client, vite-tsconfig-paths, radix-*) without asking first. Prefer built-in capabilities of Vite/Vitest/existing libs.
- Before removing a dependency, grep **all of `app/`** for `from '<pkg>` — including source-owned `app/components/ui/`. An "unused" audit that skipped it listed lucide-react/@remixicon/react as removable.
- Never run destructive git commands (`git checkout -- <file>`, `git reset --hard`, `git clean`) on files with uncommitted changes. Ask first.
- Never run DB mutations or migrations unless explicitly requested.
- Stay strictly within the requested scope. Do not explore unrelated models, schemas, or subsystems mid-task. If you believe adjacent work is needed, stop and ask first with a one-line rationale.
- Prefer extending existing components (e.g. `FileCardDetail`) over creating parallel new ones. Search for an existing component before writing a new one.

## Data Honesty

- Never display or return fabricated/placeholder values in user-facing output (e.g. `line 1` locators, rank-derived percentage scores). If a real value isn't available, omit the field or label it explicitly as unavailable.
- When measuring performance, report real measurements only; never emit `unknown` placeholder telemetry — instrument a real throughput test instead.

## Working Style

- **Act first, explain second** — execute commits, pushes, edits, and PRs immediately; never describe what you'd do instead of doing it.
- **Propose first when there's a blast radius** — for anything beyond a small, obvious fix (an unproven bug cause, a rewrite of working code, a change with a blast radius), show the diff and the why, then wait for a go-ahead. Schema files (`prisma/models/*.prisma`), migrations, and shared machines/hooks are hard gates: never edit them before the owner approves.
- **Act fast, explore minimally** — use Grep/Glob with targeted patterns instead of reading entire files; read only the ranges you need.
- **Plan before breadth** — for any change touching 3+ files, present a short numbered plan and wait for approval before editing.
- **Stop on interrupt** — if interrupted, stop and wait; resume from where you left off unless told otherwise.
- **Simplest approach** — no recursive CTEs, sub-agents, or abstractions when a direct edit works. Don't modify files outside `app/` unless asked — except what this file itself requires: the Prisma schema and migrations ([Migrations](#migrations)), and `CLAUDE.md`, `README.md` and `.claude/skills/` after a significant change ([Development Workflow](#development-workflow) step 2).
- **Edit the real component** — when editing a React component that was prototyped in HTML, edit the real `.tsx` component (e.g. `invitations-view.tsx`) — never the prototype HTML file.
- **Surface blockers** — if `gh` auth fails, ask the user to run `gh auth login` interactively; don't retry with env vars.

## Git Workflow

**`/ship` is the whole flow** — group the working tree into logical commits, write conventional messages, push to `main`. Load the `ship` skill for it rather than improvising the grouping.

**Commit and push without asking.** Finished work ships ([Development Workflow](#development-workflow) step 3) without waiting for permission; this overrides the global default of committing only when asked.

When committing, actually run `git add` and `git commit` — don't just generate messages or describe what you would commit. Use conventional prefixes (`feat:`, `fix:`, `refactor:`) with a body explaining the *why*. Group large changes into logical commits rather than one mega-commit when staging >50 files. **Assume a dirty tree**: it often carries 50+ uncommitted files of unrelated in-progress work, so never `git add -A` expecting your edits to be isolated — stage explicitly and scope by concern. Interactive `git add -p` is unavailable, so a shared file's hunks can't be split; assign each file to one commit by its dominant concern. Set `GITHUB_TOKEN` before using `gh`; if auth fails, ask the user to run `gh auth login` interactively rather than retrying with env vars.

## Development

TypeScript (strict) project. Always use TypeScript for new files. When moving/reorganizing files, update all import paths and verify with the build command. Use path aliases for cross-directory imports; relative imports only within the same directory.

- `$queryRaw` traps: a `BigInt` column (`Item.size`) compared against a fractional param fails — Postgres types the param bigint, so use integer arithmetic; and backticks inside the SQL string close the template literal.
- **Item sizes are trigger-maintained** (`update_size()`): a folder's `size` sums its **active** descendants only, and `inclusiveSize` sums all of them, trashed included. A trashed folder therefore has `size` 0. Measured in a rolled-back transaction: a folder holding 100 + 50 has size 150 while active, and size 0 / inclusiveSize 150 once trashed. The trigger functions are `CREATE OR REPLACE`d across migrations, so an old migration shows a stale definition. Read their current behaviour in `docs/data_profile_stashly _prisma_schema.md` → Functions & Triggers. **Uploaded files are the exception under load:** while the database is busy (deltas pending, or the rollup lock taken), a row with an `uploadId` is logged in `ItemSizeDelta` and `apply_item_size_deltas()` applies it every 250 ms (`app/.server/size-rollup.ts`); while idle it cascades at once. A test that reads a folder's size after an upload calls `flushItemSizes()` first (no loop runs under Vitest), and one that needs the logged path uploads inside `withSizeRollupPaused()`; `recount_folder_sizes(root)` repairs a tree. **A status change is the other exception:** trash and restore don't cascade per row; the statement-level `item_status_change` trigger (`20261106210000_status_change_rollup`, tech-debt item 51) writes each folder once, so change `status` only in a statement of its own (one made inside a trigger is ignored).
- **A drive pays for what is on it** (`20261106120000_upload_quota_log`, tech-debt item 47): an upload charges the **folder's** drive and takes that `driveId`, so a collaborator's upload charges the folder's owner; `Item.ownerId` stays the uploader and the bytes stay in the uploader's bucket. Refunds follow `Item.driveId`, never the acting user. An item never changes drive: `moveItems` refuses it. Under load the charge and the folder's child count go through the same log as sizes (`QuotaDelta`, `ItemSizeDelta.children`), so `used` and `childCount` trail uploads by up to about 0.7 s, and the limit stays strict: `stashly_charge_upload()` counts pending charges, logs only far from the limit, and is one-at-a-time near it. A test that reads either after an upload calls `flushItemSizes()`. Its `size * 100` margin must stay at or above the connections Postgres accepts. Don't trade read speed for write headroom: a folder listing is the hot path, and stored counters stay stored (owner, 6 Nov).
- **Debouncing**: use `createDebouncer` (`app/utils/debounce.ts`) or the `useDebouncedCommit` hook (`app/hooks/useDebouncedCommit.ts`) rather than a new `setTimeout`-based debounce. The hook handles two easy-to-miss details on its own: a "committed" guard so a value arriving from outside (URL, route) isn't immediately echoed back and looped, and a callback ref so an inline `commit` closure doesn't silently restart the timer every render. Current adopters: filters search, move-dialog folder search, the indexing revalidate, design-canvas viewport saves.

## Migrations

- After any Prisma schema change — **including a rename of a relation field or `@relation` name that produces no SQL** — write the migration and run `pnpm prisma generate`. When `prisma migrate diff` is empty, the migration is a `migration.sql` holding only a comment that records the change, so the history still shows it. **Scope Discipline still applies** — don't run `pnpm prisma migrate dev` yourself unless the user asked you to; otherwise hand it to them. When they have asked, the order is `migrate dev` → `generate` → report.
- The Prisma client in `app/prisma/` is **generated, not tracked** — `postinstall` runs `prisma generate`, so a fresh clone gets it from `pnpm install`, and `build` runs it again first because pnpm 12 skips lifecycle scripts entirely when it judges `node_modules` up to date (a deleted `app/prisma` is *not* restored by a re-install). Import errors on `@/prisma/*` mean: run `pnpm prisma generate`. A schema change therefore produces no `app/prisma` diff to commit; the migration and `.prisma` files are the whole change.
- A hand-written SQL migration with no schema change (a trigger or function rewrite) is applied with `pnpm prisma migrate deploy`. `migrate dev` here generates a further migration on top of it.
- Always close with an explicit list of what the user must still run: typically `pnpm prisma migrate dev`, a dev-server restart, and any re-index. The running server caches the old Prisma client and throws `Unknown argument` errors until it restarts, so the restart is not optional.

## Environment

- The dev server runs on port 80, not 3000. Do not start a second dev server — check if one is already running first.
- **Never restart or kill the dev server** — the user manages it. If a change requires a restart, say so and wait.
- **Tailwind v4 + Vite stale CSS**: a *newly introduced* class string (`lg:grid-cols-7`, `md:col-span-2`) can HMR into the DOM before the regenerated stylesheet lands, so the page renders as if the class doesn't exist — a `col-span-N` child then manufactures implicit auto-width columns and the layout looks broken. Confirm the class actually resolves before rewriting working markup; the fix is a hard reload (Ctrl+Shift+R), not a code change.
- Shell is PowerShell: avoid bash here-strings in commit messages; use `git commit -F <tmpfile>` or single-line `-m` flags for multi-line messages.
- Prod logs `MaxListenersExceededWarning … drain listeners added to [BrotliCompress]` on large document responses. **Measured not a leak** (heap flat across 500 responses, all streams GC'd): `compression` forwards `res.on('drain')` to its stream but not `off`, so `@react-router/node`'s `waitForDrain` strands one listener per backpressure wait. Don't chase it.
- `pnpm build` runs a dependency install step first; on 2026-09-25 that step failed with `Access is denied (os error 5)` renaming a `node_modules/.pnpm` staging dir while the prod server was running — an install failure, not a build failure.
- **The production server build bundles every dependency** (`environments.ssr.resolve.noExternal` in `vite.config.ts`, build only). Left external, its first import loaded 1,697 `node_modules` files and the first page after a start took 4–15 s on this machine (1.6 s on Linux); bundled it loads 38 (tech-debt item 24). Dev doesn't bundle, so a new server-side dependency that can't be bundled (a native addon, or code that reads its own files by path) only fails in `pnpm build` / `pnpm start`. Exclude it with `environments.ssr.resolve.external` rather than turning bundling off. Check after a dependency change: the only bare imports left in `build/server/assets/server-build-*.js` should be Node built-ins.
- **`.env` is loaded by `app/.server/env.ts`** (`process.loadEnvFile`), imported first by `db.ts` and `stripe.ts`; that side effect is also how Vitest gets `DATABASE_URL`. Not dotenvx at runtime: its import ran hardware probes plus a shell command, ~0.6 s per process. Existing variables win over the file, and a missing file is a no-op (production has none). Scripts and the E2E setup still use dotenvx.

## Commands

```bash
pnpm dev          # Start dev server (Express + Vite HMR), http://localhost (PORT env, default 80) — kill any existing process on :80 first
pnpm build        # Build for production
pnpm start        # Run production server
pnpm typecheck    # Generate React Router types + run tsc
pnpm format       # Format with Prettier
pnpm test         # Run unit tests once (any app/**/__tests__/*.test.ts)
pnpm test:watch   # Run unit tests in watch mode
pnpm prisma migrate dev   # Run database migrations
pnpm test:e2e     # Run E2E tests (requires dev server; CI's e2e job runs them on every push, Tigris keys from repo secrets)
pnpm test:e2e:ui  # Run E2E tests with Playwright UI
```

## Architecture

Stashly is a **full-stack file management platform** using React Router 8 in framework mode (SSR). Server is Express 5, database is PostgreSQL via Prisma ORM, complex UI state is managed with XState 5.

The layout under `app/` is self-describing (`routes/`, `routes/api/`, `.server/`,
`.client/`, `machines/`, `workers/`, `schemas/`, `types/`) — read the tree. What
the tree does *not* tell you is below.

### Key Conventions

**Server-only code**: Anything in `app/.server/` is excluded from the client bundle. Use it for database access, secrets, and heavy server logic. Client-only code (browser APIs, client-side state) goes in `app/.client/`.

**Authentication**: `authMiddleware` (`app/.server/middleware/auth.ts`) resolves the session once per request on the app layout and redirects anonymous users; `meMiddleware` asserts `:me === session.user.id`. The session is served from better-auth's 5-minute cookie cache, so a sign-out or revocation elsewhere takes up to 5 minutes to apply. `authMiddleware` forwards the cache cookie its lookup refreshed (`forwardSetCookies`); a bare server-side `getSession` drops it, and nothing in the browser calls `get-session`. Loaders read it from context — never call `getSession` again:
```typescript
export async function loader({ context }: Route.LoaderArgs) {
  const session = context.get(sessionContext) // `@/context` — guaranteed by the middleware
}
```
Middleware runs parent→child *before any loader*; loaders run in **parallel**, so a parent loader that throws cannot stop a child's query from executing. Shared middleware must be typed `MiddlewareFunction<Response>` — bare `MiddlewareFunction` defaults `Result` to `unknown` and isn't assignable to the route's type. **The boundary is `layout.tsx`**: routes under `api/` and `auth/` sit outside it and don't inherit this middleware. Every API route exports `middleware: Route.MiddlewareFunction[] = [authMiddleware]` itself and reads `context.get(sessionContext)`; none calls `getSession`. A bare `getSession` drops the refreshed cache cookie, so a long upload fell back to a database lookup on every call once the cookie expired (measured 25 Oct: 14 of 30 for 100 MB). `app/.server/__tests__/auth-middleware.test.ts` fails for any `api/*.ts` that doesn't, unless it is in `WITHOUT_AUTH_MIDDLEWARE` with its reason (`metrics` beacon, `auth`, `health`, `stripe` webhook, the preference-cookie routes, two stubs). A route test calling a handler directly sets `sessionContext` on the context it passes.

**Actions pattern**: Business logic lives in `app/.server/*-actions.ts` files. These export plain functions (no classes; pass context as params) that call Prisma directly and enforce permissions inline. Route loaders/actions call these functions — **never call `prisma` directly from routes**.
```typescript
import { getCollectionForUser } from '@/services/collection-actions'
const collection = await getCollectionForUser(session.user.id, collectionId)
```

**Authorization lives in actions, never in loaders.** A loader forwards `userId` (and `workspaceId` when present) and the action throws — `assertItemAccess(userId, itemId, { workspaceId, role })` from `permission-actions.ts` composes the item-permission and workspace-membership checks. A loader that forgets the check fails *open*; an action that owns it can't be bypassed by a new caller.

**Never mutate in a `loader`**: mutations belong in `action` functions, submitted via `fetcher.submit(..., { method: 'POST' })`. A `GET` `loader` that writes data breaks caching/prefetching assumptions. **One accepted exception:** `updateItemOpenedAt`, called inside `getFolder`/`getFileItem`/`getCollectionForUser` — a separate submit just to stamp a timestamp isn't worth it. Don't flag it; don't add others without asking.

**Don't revalidate on background index writes**: React Router re-runs every active loader after any fetcher submission. Submissions that only feed the search index (OCR pages, chunk embeddings) can't change a pixel, and a 15-page OCR submits ~30 times. Routes compose `isSearchIndexSubmission` from `app/utils/revalidation.ts` into their `shouldRevalidate`. Add a new background-only intent to `SEARCH_INDEX_INTENTS` there — but *not* one that also writes displayable facets (`save_media_metadata` writes page count/dimensions/EXIF, so it must still revalidate).

**An upload never reloads the folder for its rows**: `create_upload_item` answers with the new item's listing row (`getCardItems`, the same `folderCardSelect` as `getFolderContent`) and the page inserts it (`useCreatedItems` → `usePagination.insertItems` → `showCreatedRows` in `app/utils/pagination.ts`). A page reports the rows it showed for certain; `upload-thumbnail-runner.tsx` reloads it once when the batch ends only if a row is missing (a filter, a row past the loaded page, another route). A new field in a folder card's select goes in `folderCardSelect`, and a new BigInt in it in `cardItemOutput`, or the inserted card and the next load differ (tech-debt item 45).

**Stream large/slow loader payloads**: return an *unawaited* promise from the `loader` and consume it with React Router's `<Suspense>` + `<Await>` so the shell paints while data streams (canonical example: the Markdown body read server-side in `routes/stash/file.tsx` → `MarkdownStage`).

**SSE / stream safety**: Never write to a stream controller without first checking it's still open (closed/aborted guard), and always wrap `enqueue` in `try/catch`. A disconnected client must not be able to take the server down — this has crashed the dev server before. Applies to heartbeats and keep-alives too, which fire on a timer after the client is long gone.

**API errors**: Use `StashlyError` and `StashlyErrorCode` from `app/utils/api.errors.ts` in action files. Two error shapes reach routes and disagree on the field name — `StashlyError` sets `status`, `throwGuardError` in `workspace-actions.ts` sets `statusCode` — so route handlers normalise with `toErrorInfo` from the same module: `const err = toErrorInfo(e)` then `err.status ?? 500`. Never duck-type one field directly; that silently turns typed 403/404s into 500s. `parseFormData` / `parseSearchParams` throw `INVALID_INPUT` on a schema mismatch, which escapes a handler as a 500. Every route turns it into a 400 the same way, inside a `try` or not: `await parseFormData(...).catch(rethrowAsResponse)`, and `parseOrRespond(() => parseSearchParams(...))` for the synchronous one (both in `api.errors.ts`; page loaders pass `'text'` so the error boundary shows the message). The one exception is `api/metrics.ts`, a beacon that answers 204 to everything.

**Dot-server plugin**: React Router's build rejects a route whose *client-bundled* exports can reach a server module. It strips server code from `loader`, `action`, `middleware` and `headers` only — so a `.server/` import is fine when just those touch it, and fails the build when anything else does (`app/routes/settings/billing.tsx` uses `@/services/*` in five places and builds clean). It reads the **import graph, not usage**: an import nothing references still fails — so removing the last *use* of a `@/services/*` import breaks the build until you delete the import too. A **re-export** from a route (`export { x } from '@/.server/…'`) also fails: a re-export is an ordinary route export, not one of the four stripped ones. Dev never surfaces this — Vite serves modules per request with no tree-shaking, so the server/client split is only attempted at build time, and `pnpm build` is the only check.

### Routing Structure

Routes are defined centrally in `app/routes.ts` using `prefix`, `layout`, and `route` helpers. The main layout (`app/routes/layout.tsx`) wraps all authenticated app routes. URL pattern: `/:me/stash/*` for personal stash, `/:me/workspaces/:workspaceId/*` for collaborative workspaces.

### Schemas and Types

- `app/schemas/` — Zod schemas for API payloads (`api.schemas.ts`), XState events (`machine.schemas.ts`), repository filters (`filters.schemas.ts`). Import with `@/schemas/*`.
- `app/types/` — Shared TS types for API contracts (`api.types.ts`), machine payloads (`machine.types.ts`, `upload-actors.types.ts`), global augmentations (`react.d.ts`). Import with `@/types/*`.
- Keep Zod schemas and derived types co-located — don't scatter them across feature files.
- **A resource route parses a payload holding a `BigInt` column through an output schema before sending it** (`quotaApiRouteOutput`, `collectionsLoaderOutput`, `subscriptionLoaderOutput`, with `z.coerce.number()` for bytes). An API route's `data()` goes out as JSON, which has no BigInt, so a bare `size` or `storageLimit` answers 500 (tech-debt item 63).
- **Wrap free-text request fields in `toUserText(...)`** (`@/utils/converters`). The form and search-param decoders turn `"42"`, `"true"`, `"false"` and `"null"` into values, so a bare `z.string()` rejected a file renamed to "2024" or a search for "true". The decoders keep a number only when it writes back as the same text (`"007"` stays a string).
- `buildFiltersFactory` applies a param only when `key in filters` (`app/utils/filters.ts:127`). A schema key with no filter, or a filter whose key drifted from the schema, contributes **no constraint** — no error, and the query returns *more* rows than intended. `app/utils/__tests__/item-filters-coverage.test.ts` fails the build if the two key sets diverge; extend that pattern rather than trusting a read.

### Path Aliases

Defined in `tsconfig.json` under `compilerOptions.paths` — read it there. Note
`@/services/*` maps to `app/.server/`, which is not guessable from the name.

### Integrations

- **Auth**: `better-auth` in `app/.server/auth.ts`, OAuth via GitHub/Google/Microsoft. Its `hooks.after` writes the `last-account` cookie on each `/callback/:id` (`app/.server/remembered-account.ts`), which the sign-in page reads for "Continue as …". It outlives sign-out by design and grants nothing: the card re-runs that provider's OAuth
- **Search**: hybrid sparse (trigram) + dense (pgvector) retrieval fused with RRF (`app/.server/search-actions.ts`); passages live in `SearchChunk`. Deep dive: `docs/search.md`, `docs/semantic-search.md`
- **AI features**: all inference runs **client-side on WebGPU** (Hugging Face transformers, ONNX Runtime) — query/chunk embeddings, PDF OCR (PaddleOCR PP-OCRv6 on `onnxruntime-web` in a worker, GLM-OCR for low-confidence pages), saliency crops, Whisper. Everything funnels through the priority queue in `app/workers/ai-queue.ts`; a cached model must drop itself on `isDeviceLostError` (a Windows GPU reset otherwise fails every later job in the tab)
- **Payments**: Stripe, webhooks at `/api/stripe`
- **Storage**: AWS S3-compatible (Tigris on Fly.io), configured in `app/.server/s3.ts`
- **Analytics + errors**: Vinktar. Server `app/.server/vinktar.ts` (off under Vitest; Express middleware in `server/app.ts`), browser `app/.client/vinktar.ts` (key and release handed over by the root loader at runtime). Browser source maps are built `hidden` in production, uploaded in the Dockerfile's build stage with the `VINKTAR_CLI_KEY` build secret, then deleted from the image; deploy with the `fly deploy` line in `.env.example`. Events are sent server-side where they happen: every user-facing mutation in the `*-actions.ts` files, the upload route's phases (`upload_started` → `upload_transfer_completed` → `file_uploaded`, or `upload_refused` / `upload_aborted` / `upload_item_refused`), and the indexing writes (`media_metadata_saved`, `ocr_page_saved`, `search_chunks_embedded`, `thumbnail_stage_saved`). Two exceptions sit outside the actions: pageviews come from the browser, once per pathname change, named by route id and pattern (`useRouteViews` in `root.tsx`; the SDK's own URL pageviews are off), and `requestTimingMiddleware` on the root sends `route_request_slow` (over 1 s) / `route_request_failed` (5xx or a throw) per route pattern, outliers only. Send them **after** the write commits, so a refused or rolled-back action is never counted. Properties describe shape (counts, bytes, ids, kinds, roles, extensions, durations), **never user content**: no file names, S3 keys, search text, emails, comment bodies or extracted metadata values. Adding a `track()` call means calling `define_event` in the same step; see `AGENTS.md`. **Server logs go through `log` from `@/services/log`, never `console`** in `app/.server`: a fixed-text message with identifiers as fields. Each line is JSON on stdout (the full stream, kept by Fly), a Vinktar breadcrumb on the request's scope, and for `warn`/`error` a Vinktar issue (an `error` field that is an `Error` is captured as that exception). `requestIdMiddleware` tags every request's lines and errors with `request_id`. Fields named in `PRIVATE_FIELDS` (`key`, `bucket`, `name`, …) reach stdout only

### UI Components

shadcn/ui (source-owned, in `app/components/ui/`) built on Radix UI, styled with TailwindCSS 4. Use `cn()` from `@/utils/styles` for conditional classNames. **Before writing or editing any component, load the `stashly-ui-conventions` skill** — it holds the full icon/ItemCard/DataTable/dialog/card/layering/styling rules.

## Frontend Verification

- After any CSS/Tailwind/layout change, hard-refresh and verify against the live DOM (chrome-devtools MCP) before declaring done — stale Tailwind stylesheets have caused false negatives. (Data Honesty and the extend-don't-duplicate rule apply here too — see above.)

## Frontend / Design

- **Load the required design/UI skills before touching a component** ([Subsystem Skills](#subsystem-skills)).
- **Use `font-stashly`, the stashly type scale (`text-xs` is the smallest) and the design tokens.** Never use raw font classes (`font-sans`, `font-mono`) — a mockup's font classes are translated, not copied.
- **No circular avatars unless the design shows them. Don't add UI controls (pickers, toggles) that aren't in the spec.**
- **After a UI change, verify in the browser via chrome-devtools in both light and dark mode before claiming done or pushing.**

## Subsystem Skills

Detailed conventions for these areas live in on-demand project skills (`.claude/skills/`). Loading the matching skill is **mandatory** before touching the area — reading, planning, or editing. Don't proceed until every skill the task needs is loaded; a task spanning two areas loads both (a schema rename that also edits a component loads `stashly-prisma-data` **and** `stashly-ui-conventions`).

| Skill | Load when working on… |
|-------|-----------------------|
| `stashly-ui-conventions` | Any `app/components` UI — icons, ItemCard, DataTable, dialogs, dropdowns, cards, filters, pagination, surface/z-index layering, Tailwind styling |
| `stashly-prisma-data` | Prisma queries, migrations, schema changes, `orderBy`/relation filters, ItemCard select shapes, Zod schemas, SQL |
| `stashly-upload-xstate` | The upload flow — upload/file machines, S3 multipart, item-creation gate, `parentId` derivation, AI machines |
| `stashly-thumbnail-pipeline` | Thumbnails/previews — the XState scheduler in `app/machines/thumbnail/` (made only for cards on screen), `useThumbnailWhenVisible`, held upload files, compute worker, PDF.js, presign/PUT/PATCH, gallery thumbnail queries, Web Workers |
| `stashly-search` | Search — hybrid ranking, `SearchChunk`, the keyword→semantic client flow, query expansion, evidence cards, reindex intents |
| `stashly-ai-inference` | Browser AI — the WebGPU `ai-queue` and its priorities, PDF OCR engines, the search-embedding backfill |
| `stashly-gallery-views` | Gallery layouts (grid/river/waterfall), view transitions into the item page, scroll restoration, theme blocks |
| `stashly-activity-recording` | Activity tracking, new action kinds, pins/favorites, `openedAt`, `StashlyPrefixMap` |
| `stashly-e2e-testing` | Writing/debugging Playwright E2E tests in `tests/e2e/` |

## Development Workflow

Apply for **significant changes** (new features, routes/services, behaviour changes, schema migrations). **Skip for small changes** (renaming a class, tweaking layout, fixing a type, adjusting a label) — those go straight to a single commit on main.

1. **Tests** — Unit tests (Vitest) beside the code they cover, in that directory's `__tests__/`; E2E tests (Playwright, `tests/e2e/`) for user-facing flows/routes.
2. **Docs** — Update `CLAUDE.md`/`README.md`/relevant subsystem skill if the change affects architecture, commands, conventions, or E2E setup.
3. **Ship** — Commit with a conventional-prefix message explaining the *why*, and push to `main` (see Git Workflow; `/ship` does the whole flow). A PR is the exception, not the default — open one only for work you want reviewed before it lands.

### New Feature Checklist (mandatory, in order)

1. **Actions file** — `app/.server/[feature]-actions.ts` with all business logic. Plain exported functions, no classes, pass context as params.
2. **API route** — `app/routes/api/[feature].ts` using `parseFormData` / `parseSearchParams` for all request parsing. Never access `request` fields manually.
3. **Zod schemas** — Add request/response schemas to `app/schemas/api.schemas.ts`. Use discriminated unions on `intent` for action routes.
4. **UI placement** — Reusable components in `app/components/core-components/`; route-level views in `app/components/views/`. Never scatter feature UI into ad-hoc locations.
5. **Types** — Add shared types to `app/types/stash.types.ts`. Infer from Zod schemas where possible.
6. **Custom hooks** — Name `use[Feature][Noun]` (e.g. `useShareLinks`). Place in `app/hooks/`.
7. **Tests** — E2E tests in `tests/e2e/` for user-facing flows; unit tests in the `__tests__/` beside the module under test.

Notes: use `usePagination<T>(limit)` for any list route; no arbitrary Tailwind sizes (`text-sm` not `text-[10px]`); check `app/utils/` before creating new utilities; use the `shadcn-ui-component-builder` skill when building new UI.

## Verification & Commits

- Before reporting a CI result, wait for `status == completed` with **one background command**, not repeated polling turns: `bash .claude/scripts/wait-for-ci.sh` via Bash `run_in_background` right after the push. It finds the run by commit SHA, exits 0/1/2 (success / other conclusion / no run), and the session is woken once when it exits. Don't use `gh run watch`: it once returned while the docker job was still building, and a follow-up push then cancelled that run (`cancel-in-progress`), so a job never ran.
- Fix type errors additively — do not delete or weaken existing types to make errors disappear.
- For UI changes, verify in the browser via the chrome-devtools MCP (or playwright MCP) before declaring done — both require Chrome installed.
- Browser verification doesn't need a session: chrome-devtools MCP opens a fresh unauthenticated Chrome, but `http://localhost/auth/sign-in` loads the same stylesheet. Append a throwaway `div` with the classes and read `getComputedStyle` to prove a Tailwind class resolves, or inject a mock grid there to measure geometry (column widths, row count, card sizes) before and after a layout change. **To verify a real authenticated page, ask the user to sign in to the MCP Chrome** — they can, and it turns inference into measurement.
- Measuring in the browser: `performance.getEntriesByType('resource')` caps at **250 entries** and drops the rest with no warning — call `performance.setResourceTimingBufferSize()` in `navigate_page`'s `initScript` first. To count Web Worker boots, patch `window.Worker` there too; counting network requests is inference, counting constructions is fact.
- MCP Chrome may be signed in as a **different account** than the URL's `:me` — `meMiddleware` then answers 403, which looks like a bug. Check `fetch('/api/auth/get-session')` → `user.id` before debugging a 403.
- Detecting a hung tab: in `initScript`, write `Date.now()` to `localStorage` every 250 ms (plus a rolling log of long tasks/errors); read it from a **second same-origin tab** — a stale heartbeat is a frozen main thread. Note the second tab arms its own once-per-tab background work (embedding backfill).
- Only run typecheck at the END of a task, not mid-edit, unless explicitly asked — and skip it entirely for className/copy-only edits, which touch no type surface.
- `$queryRaw` SQL is invisible to `tsc` — verify by running the action against the dev DB: `npx tsx --env-file=.env <script.ts>`. The script must sit **in the repo root** (from a temp dir, module resolution fails), use absolute imports, and no top-level await. Import the client as `import { prisma } from '@/services/db'` — `new PrismaClient()` throws under Prisma 7 without an adapter.
- `pnpm typecheck` has **11** pre-existing, unrelated errors across 9 files (verified 2026-10-01), exactly the entries in `.claude/tsc-baseline.json`. Don't expect a clean run. To check a change, run `node .claude/hooks/check-staged-types.mjs --all`, the same gate CI uses. It fails on any file above its baseline, and also when the baseline has **slack**, meaning an error you fixed is still allowed by it. After fixing errors, run `--update-baseline` and commit the new baseline with the fix.
- `npx prettier --write <file>` reflows *pre-existing* long lines, so a 10-line edit can land as a 47-line diff. Format only files you created; on a file you edited, check `git diff` afterwards and revert the hunks you didn't cause.
- A JSDoc block ending `**a**/**b**` contains `*/` and closes the comment early; `tsc` then bails on a parse error and the total error count **drops**. A falling `error TS` count is not automatically good news — check that your touched files are clean, not just that the number went down.
- Vitest runs `environment: 'node'` and only collects **`.test.ts`** (not `.tsx`); there is no jsdom and no `@testing-library/react`. A React component or hook therefore **cannot be rendered in a test** without new dependencies — which Scope Discipline forbids adding unasked. Keep hooks as thin glue over a pure function and test the function (`useItemUrl` → `itemUrlFor`, `breadcrumbs` → `trimBreadcrumbs`).
- `pnpm test` is **1305 passing / 0 failing (105 files)**, verified 2026-11-08. Some tests need a live database: `activity-feed`, `collection-actions`, `pin-actions`, `favorite-actions`, `health-actions`, `item-delete-objects`, `item-trash-access`, `search-index-access`, `upload-activity`, `upload-folder-tree`, `item-size-trigger` and `onboard.machine`. CI runs **every** file against a `pgvector/pgvector:pg17` service with migrations applied, and excludes nothing. A failing test must be fixed, not excluded, skipped or marked `it.fails`.
- **Never hide test output.** Vitest switches to its `minimal` reporter under an AI agent (`CLAUDECODE=1`), which drops console output and errors from passing tests. `vitest.config.ts` pins `default` so you see what a terminal or CI sees. Don't mute logs, and don't use `--silent`.

## Debugging Rules

- Measure before optimizing and re-measure after. Never claim a performance improvement (e.g. "14 requests → 1") without pasting the actual before/after numbers from the browser console, network panel, or a timing log.
- Fix root causes, not symptoms. Deferring/debouncing a bad call is not a fix if the call shouldn't happen at all — say so explicitly if you're proposing a workaround.
- If the user says "still not working" after a fix, assume your diagnosis was wrong and re-derive from evidence rather than patching the same theory.
