# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Deep-dive reference lives in skills, not here.** This file holds the always-relevant essentials. Detailed conventions for specific subsystems are extracted into project skills that load on demand — see [Subsystem Skills](#subsystem-skills) below. When a task touches one of those areas, invoke the matching skill before writing code.

## Scope Discipline

- **Start where the user pointed.** When a specific file or route is named, open that first — do NOT run broad exploration before it. Read at most **3 files** before proposing a fix. If the fix genuinely needs more, stop and ask rather than widening on your own.
- Never open unrelated schema files (`prisma/models/*.prisma`) or adjacent feature code unless the user asks or the fix demonstrably requires it. A claim of "one-line fix" followed by a file tour is the pattern to avoid.
- Do exactly what was asked, nothing more. If a fix touches only one component (e.g. image-stage), do NOT add panel/facet plumbing, refactor unrelated wrappers, or migrate other call sites.
- Never add or install a new dependency (npm/pnpm packages like prom-client, vite-tsconfig-paths, radix-*) without asking first. Prefer built-in capabilities of Vite/Vitest/existing libs.
- Never run destructive git commands (`git checkout -- <file>`, `git reset --hard`, `git clean`) on files with uncommitted changes. Ask first.
- Never run DB mutations or migrations unless explicitly requested.
- Stay strictly within the requested scope. Do not explore unrelated models, schemas, or subsystems mid-task. If you believe adjacent work is needed, stop and ask first with a one-line rationale.
- Prefer extending existing components (e.g. `FileCardDetail`) over creating parallel new ones. Search for an existing component before writing a new one.

## Data Honesty

- Never display or return fabricated/placeholder values in user-facing output (e.g. `line 1` locators, rank-derived percentage scores). If a real value isn't available, omit the field or label it explicitly as unavailable.
- When measuring performance, report real measurements only; never emit `unknown` placeholder telemetry — instrument a real throughput test instead.

## Working Style

- **Act first, explain second** — execute commits, edits, and PRs immediately; never describe what you'd do instead of doing it.
- **Act fast, explore minimally** — use Grep/Glob with targeted patterns instead of reading entire files; read only the ranges you need.
- **Plan before breadth** — for any change touching 3+ files, present a short numbered plan and wait for approval before editing.
- **Stop on interrupt** — if interrupted, stop and wait; resume from where you left off unless told otherwise.
- **Simplest approach** — no recursive CTEs, sub-agents, or abstractions when a direct edit works. Don't modify files outside `app/` unless asked.
- **Edit the real component** — when editing a React component that was prototyped in HTML, edit the real `.tsx` component (e.g. `invitations-view.tsx`) — never the prototype HTML file.
- **Surface blockers** — if `gh` auth fails, ask the user to run `gh auth login` interactively; don't retry with env vars.

## Git Workflow

**`/ship` is the whole flow** — group the working tree into logical commits, write conventional messages, push to `main`. Load the `ship` skill for it rather than improvising the grouping.

When committing, actually run `git add` and `git commit` — don't just generate messages or describe what you would commit. Use conventional prefixes (`feat:`, `fix:`, `refactor:`) with a body explaining the *why*. Group large changes into logical commits rather than one mega-commit when staging >50 files. **Assume a dirty tree**: it often carries 50+ uncommitted files of unrelated in-progress work, so never `git add -A` expecting your edits to be isolated — stage explicitly and scope by concern. Interactive `git add -p` is unavailable, so a shared file's hunks can't be split; assign each file to one commit by its dominant concern. Set `GITHUB_TOKEN` before using `gh`; if auth fails, ask the user to run `gh auth login` interactively rather than retrying with env vars.

## Development

TypeScript (strict) project. Always use TypeScript for new files. When moving/reorganizing files, update all import paths and verify with the build command. Use path aliases for cross-directory imports; relative imports only within the same directory.

- `$queryRaw` traps: a `BigInt` column (`Item.size`) compared against a fractional param fails — Postgres types the param bigint, so use integer arithmetic; and backticks inside the SQL string close the template literal.

## Migrations

- After any Prisma schema change: write the migration and run `pnpm prisma generate`. **Scope Discipline still applies** — don't run `pnpm prisma migrate dev` yourself unless the user asked you to; otherwise hand it to them. When they have asked, the order is `migrate dev` → `generate` → report.
- Always close with an explicit list of what the user must still run: typically `pnpm prisma migrate dev`, a dev-server restart, and any re-index. The running server caches the old Prisma client and throws `Unknown argument` errors until it restarts, so the restart is not optional.

## Environment

- The dev server runs on port 80, not 3000. Do not start a second dev server — check if one is already running first.
- **Never restart or kill the dev server** — the user manages it. If a change requires a restart, say so and wait.
- **Tailwind v4 + Vite stale CSS**: a *newly introduced* class string (`lg:grid-cols-7`, `md:col-span-2`) can HMR into the DOM before the regenerated stylesheet lands, so the page renders as if the class doesn't exist — a `col-span-N` child then manufactures implicit auto-width columns and the layout looks broken. Confirm the class actually resolves before rewriting working markup; the fix is a hard reload (Ctrl+Shift+R), not a code change.
- Shell is PowerShell: avoid bash here-strings in commit messages; use `git commit -F <tmpfile>` or single-line `-m` flags for multi-line messages.

## Commands

```bash
pnpm dev          # Start dev server (Express + Vite HMR), http://localhost (PORT env, default 80) — kill any existing process on :80 first
pnpm build        # Build for production
pnpm start        # Run production server
pnpm typecheck    # Generate React Router types + run tsc
pnpm format       # Format with Prettier
pnpm test         # Run unit tests once (app/utils/__tests__/)
pnpm test:watch   # Run unit tests in watch mode
pnpm prisma migrate dev   # Run database migrations
pnpm test:e2e     # Run E2E tests (requires dev server)
pnpm test:e2e:ui  # Run E2E tests with Playwright UI
```

## Architecture

Stashly is a **full-stack file management platform** using React Router 8 in framework mode (SSR). Server is Express 5, database is PostgreSQL via Prisma ORM, complex UI state is managed with XState 5.

The layout under `app/` is self-describing (`routes/`, `routes/api/`, `.server/`,
`.client/`, `machines/`, `workers/`, `schemas/`, `types/`) — read the tree. What
the tree does *not* tell you is below.

### Key Conventions

**Server-only code**: Anything in `app/.server/` is excluded from the client bundle. Use it for database access, secrets, and heavy server logic. Client-only code (browser APIs, client-side state) goes in `app/.client/`.

**Authentication**: Route `loader` functions check sessions and redirect unauthenticated users:
```typescript
export async function loader({ request }: Route.LoaderArgs) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) throw redirect('/auth/sign-in')
  return { user: session.user }
}
```

**Actions pattern**: Business logic lives in `app/.server/*-actions.ts` files. These export plain functions (no classes; pass context as params) that call Prisma directly and enforce permissions inline. Route loaders/actions call these functions — **never call `prisma` directly from routes**.
```typescript
import { getCollectionForUser } from '@/services/collection-actions'
const collection = await getCollectionForUser(session.user.id, collectionId)
```

**Never mutate in a `loader`**: mutations belong in `action` functions, submitted via `fetcher.submit(..., { method: 'POST' })`. A `GET` `loader` that writes data breaks caching/prefetching assumptions.

**Don't revalidate on background index writes**: React Router re-runs every active loader after any fetcher submission. Submissions that only feed the search index (OCR pages, chunk embeddings) can't change a pixel, and a 15-page OCR submits ~30 times. Routes compose `isSearchIndexSubmission` from `app/utils/revalidation.ts` into their `shouldRevalidate`. Add a new background-only intent to `SEARCH_INDEX_INTENTS` there — but *not* one that also writes displayable facets (`save_media_metadata` writes page count/dimensions/EXIF, so it must still revalidate).

**Stream large/slow loader payloads**: return an *unawaited* promise from the `loader` and consume it with React Router's `<Suspense>` + `<Await>` so the shell paints while data streams (canonical example: the Markdown body read server-side in `routes/stash/file.tsx` → `MarkdownStage`).

**SSE / stream safety**: Never write to a stream controller without first checking it's still open (closed/aborted guard), and always wrap `enqueue` in `try/catch`. A disconnected client must not be able to take the server down — this has crashed the dev server before. Applies to heartbeats and keep-alives too, which fire on a timer after the client is long gone.

**API errors**: Use `StashlyError` and `StashlyErrorCode` from `app/utils/api.errors.ts` in action files. Route action handlers don't import it directly — duck-type: `const err = e as { statusCode?: number; message?: string }`.

**Dot-server plugin**: React Router's build rejects a route whose *client-bundled* exports can reach a server module. It strips server code from `loader`, `action`, `middleware` and `headers` only — so a `.server/` import is fine when just those touch it, and fails the build when anything else does (`app/routes/settings/billing.tsx` uses `@/services/*` in five places and builds clean). It reads the **import graph, not usage**: an import nothing references still fails. Dev never surfaces this — Vite serves modules per request with no tree-shaking, so the server/client split is only attempted at build time, and `pnpm build` is the only check.

### Routing Structure

Routes are defined centrally in `app/routes.ts` using `prefix`, `layout`, and `route` helpers. The main layout (`app/routes/layout.tsx`) wraps all authenticated app routes. URL pattern: `/:me/stash/*` for personal stash, `/:me/workspaces/:workspaceId/*` for collaborative workspaces.

### Schemas and Types

- `app/schemas/` — Zod schemas for API payloads (`api.schemas.ts`), XState events (`machine.schemas.ts`), repository filters (`filters.schemas.ts`). Import with `@/schemas/*`.
- `app/types/` — Shared TS types for API contracts (`api.types.ts`), machine payloads (`machine.types.ts`, `upload-actors.types.ts`), global augmentations (`react.d.ts`). Import with `@/types/*`.
- Keep Zod schemas and derived types co-located — don't scatter them across feature files.

### Path Aliases

Defined in `tsconfig.json` under `compilerOptions.paths` — read it there. Note
`@/services/*` maps to `app/.server/`, which is not guessable from the name.

### Integrations

- **Auth**: `better-auth` in `app/.server/auth.ts`, OAuth via GitHub/Google/Microsoft
- **Search**: hybrid sparse (trigram) + dense (pgvector) retrieval fused with RRF (`app/.server/search-actions.ts`); passages live in `SearchChunk`. Deep dive: `docs/search.md`, `docs/semantic-search.md`
- **AI features**: all inference runs **client-side on WebGPU** (Hugging Face transformers, ONNX Runtime) — query/chunk embeddings, PDF OCR, saliency crops, Whisper. Everything funnels through the priority queue in `app/workers/ai-queue.ts`
- **Payments**: Stripe, webhooks at `/api/stripe`
- **Storage**: AWS S3-compatible (Tigris on Fly.io), configured in `app/.server/s3.ts`

### UI Components

shadcn/ui (source-owned, in `app/components/ui/`) built on Radix UI, styled with TailwindCSS 4. Use `cn()` from `@/utils/styles` for conditional classNames. **Before writing or editing any component, load the `stashly-ui-conventions` skill** — it holds the full icon/ItemCard/DataTable/dialog/card/layering/styling rules.

## Subsystem Skills

Detailed conventions for these areas live in on-demand project skills (`.claude/skills/`). Invoke the matching skill **before** touching the area:

| Skill | Load when working on… |
|-------|-----------------------|
| `stashly-ui-conventions` | Any `app/components` UI — icons, ItemCard, DataTable, dialogs, dropdowns, cards, filters, pagination, surface/z-index layering, Tailwind styling |
| `stashly-prisma-data` | Prisma queries, migrations, schema changes, `orderBy`/relation filters, ItemCard select shapes, Zod schemas, SQL |
| `stashly-upload-xstate` | The upload flow — upload/file machines, S3 multipart, item-creation gate, `parentId` derivation, AI machines |
| `stashly-thumbnail-pipeline` | Thumbnails/previews — the XState scheduler in `app/machines/thumbnail/`, `useThumbnail`, thumbnail-signal, compute worker, PDF.js, presign/PUT/PATCH, gallery thumbnail queries, Web Workers |
| `stashly-search` | Search — hybrid ranking, `SearchChunk`, the keyword→semantic client flow, query expansion, evidence cards, reindex intents |
| `stashly-ai-inference` | Browser AI — the WebGPU `ai-queue` and its priorities, PDF OCR engines, the search-embedding backfill |
| `stashly-gallery-views` | Gallery layouts (grid/river/waterfall), view transitions into the item page, scroll restoration, theme blocks |
| `stashly-activity-recording` | Activity tracking, new action kinds, pins/favorites, `openedAt`, `StashlyPrefixMap` |
| `stashly-e2e-testing` | Writing/debugging Playwright E2E tests in `tests/e2e/` |

## Development Workflow

Apply for **significant changes** (new features, routes/services, behaviour changes, schema migrations). **Skip for small changes** (renaming a class, tweaking layout, fixing a type, adjusting a label) — those go straight to a single commit on main.

1. **Tests** — Unit tests (Vitest, `app/utils/__tests__/`) for logic/utilities/services; E2E tests (Playwright, `tests/e2e/`) for user-facing flows/routes.
2. **Docs** — Update `CLAUDE.md`/`README.md`/relevant subsystem skill if the change affects architecture, commands, conventions, or E2E setup.
3. **Commit** — Detailed conventional-prefix message explaining the *why*.
4. **PR** — Descriptive title + body (summary + test plan).
5. **Merge** — Merge to `main` once clean.

### New Feature Checklist (mandatory, in order)

1. **Actions file** — `app/.server/[feature]-actions.ts` with all business logic. Plain exported functions, no classes, pass context as params.
2. **API route** — `app/routes/api/[feature].ts` using `parseFormData` / `parseSearchParams` for all request parsing. Never access `request` fields manually.
3. **Zod schemas** — Add request/response schemas to `app/schemas/api.schemas.ts`. Use discriminated unions on `intent` for action routes.
4. **UI placement** — Reusable components in `app/components/core-components/`; route-level views in `app/components/views/`. Never scatter feature UI into ad-hoc locations.
5. **Types** — Add shared types to `app/types/stash.types.ts`. Infer from Zod schemas where possible.
6. **Custom hooks** — Name `use[Feature][Noun]` (e.g. `useShareLinks`). Place in `app/hooks/`.
7. **Tests** — E2E tests in `tests/e2e/` for user-facing flows; unit tests in `app/utils/__tests__/` for service logic.

Notes: use `usePagination<T>(limit)` for any list route; no arbitrary Tailwind sizes (`text-sm` not `text-[10px]`); check `app/utils/` before creating new utilities; use the `/shadcn-ui` skill when building new UI.

## Verification & Commits

- Fix type errors additively — do not delete or weaken existing types to make errors disappear.
- For UI changes, verify in the browser via the chrome-devtools MCP (or playwright MCP) before declaring done — both require Chrome installed.
- Browser verification doesn't need a session: chrome-devtools MCP opens a fresh unauthenticated Chrome, but `http://localhost/auth/sign-in` loads the same stylesheet. Append a throwaway `div` with the classes and read `getComputedStyle` to prove a Tailwind class resolves, or inject a mock grid there to measure geometry (column widths, row count, card sizes) before and after a layout change. **To verify a real authenticated page, ask the user to sign in to the MCP Chrome** — they can, and it turns inference into measurement.
- Measuring in the browser: `performance.getEntriesByType('resource')` caps at **250 entries** and drops the rest with no warning — call `performance.setResourceTimingBufferSize()` in `navigate_page`'s `initScript` first. To count Web Worker boots, patch `window.Worker` there too; counting network requests is inference, counting constructions is fact.
- Only run typecheck at the END of a task, not mid-edit, unless explicitly asked — and skip it entirely for className/copy-only edits, which touch no type surface.
- `$queryRaw` SQL is invisible to `tsc` — verify by running the action against the dev DB: `npx tsx --env-file=.env <script.ts>`. The script must sit **in the repo root** (from a temp dir, module resolution fails), use absolute imports, and no top-level await. Import the client as `import { prisma } from '@/services/db'` — `new PrismaClient()` throws under Prisma 7 without an adapter.
- `pnpm typecheck` has **204** pre-existing, unrelated errors (verified 2026-08-27; 150 in `collection-actions.test.ts`, 34 in `pin-actions.test.ts`) — don't expect a clean run. Pipe to a file, count `error TS`, and grep your touched files by name to confirm no regressions.
- `npx prettier --write <file>` reflows *pre-existing* long lines, so a 10-line edit can land as a 47-line diff. Format only files you created; on a file you edited, check `git diff` afterwards and revert the hunks you didn't cause.
- `pnpm test` is **406 passing / 11 failing (417 in 25 files)**; the 11 are pre-existing (`activity.test.ts` ×4, `collection-actions.test.ts` ×7) — don't chase them. Verified 2026-08-18.
