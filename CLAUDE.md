# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Working Style

- Act first, explain second. When the user asks for commits, edits, or a PR, DO the work — don't produce plans or commit messages without executing.
- Avoid over-reading / over-exploring. Make the change, then verify.
- If blocked by auth (e.g., `gh` GITHUB_TOKEN), surface it immediately rather than retrying silently.

## Core Rules

When I ask you to do something, DO IT immediately. Don't over-explain, don't read extra files, don't write specs or plans unless I ask. Act first, explain only if needed.

If I interrupt you, stop immediately and wait for my next instruction. Don't restart from scratch — continue from where you left off unless told otherwise.

## Git Workflow

When committing, actually run `git add` and `git commit` — don't just generate commit messages or describe what you would commit.

Set GITHUB_TOKEN properly before using `gh` CLI. If gh auth fails, ask the user to run `gh auth login` interactively rather than retrying with env vars.

## Development

This is a TypeScript project. Always use TypeScript for new files. Run `pnpm run build` or type-check after significant edits to catch errors early.

## General Instructions

Prefer action over exploration. When the user gives a clear task, execute it immediately rather than exploring the codebase or explaining the approach first.

If you need to choose between approaches, pick the simplest one. Do not modify files outside of app/ unless I say so.

## Project Structure

This is a TypeScript project. When moving or reorganizing files, always update all import paths across the codebase and verify with `tsc --noEmit` or the project's build command after changes.

## Commands

```bash
pnpm dev          # Start dev server (Express + Vite HMR), available at http://localhost:3000
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

Stashly is a **full-stack file management platform** using React Router 7 in framework mode (SSR). The server is Express 5, database is PostgreSQL via Prisma ORM, and complex UI state is managed with XState 5.

### Layer Responsibilities

| Layer | Location | Purpose |
|-------|----------|---------|
| Routes | `app/routes/` | UI components + loaders/actions (data fetching and mutations) |
| API Routes | `app/routes/api/` | Resource routes acting as REST endpoints |
| Actions | `app/.server/*-actions.ts` | Business logic + direct Prisma access, permission enforcement (e.g. `item-actions.ts`, `collection-actions.ts`) |
| Machines | `app/machines/` | XState state machines for complex async workflows |
| Workers | `app/workers/` | Web Workers for CPU-intensive tasks (AI inference, tokenization) |
| Client-only | `app/.client/` | Browser-only code excluded from SSR (auth client, AI client) |
| Schemas | `app/schemas/` | Zod validation schemas shared across client and server |
| Types | `app/types/` | Shared TypeScript type definitions (API types, machine types) |

### Key Conventions

**Server-only code**: Anything in `app/.server/` is excluded from the client bundle. Use this for database access, secrets, and heavy server logic.

**Authentication**: Route `loader` functions check sessions and redirect unauthenticated users:
```typescript
export async function loader({ request }: Route.LoaderArgs) {
  const session = await auth.api.getSession(request)
  if (!session) throw redirect('/auth/sign-in')
  return { user: session.user }
}
```

**Actions pattern**: Business logic lives in `app/.server/*-actions.ts` files (e.g. `item-actions.ts`, `collection-actions.ts`). These export plain functions that call Prisma directly and enforce permissions inline. Route loaders/actions call these functions — never call `prisma` directly from routes.

```typescript
// In a route loader/action:
import { getCollectionForUser } from '@/services/collection-actions'
const collection = await getCollectionForUser(session.user.id, collectionId)
```

**API errors**: Use `ApiError` and `ApiErrorCode` from `app/.server/api.errors.ts` for consistent error responses in action files. **Do not import this in route files** — the dot-server plugin rejects `@/services/*` imports in `app/routes/`. In route action handlers, duck-type the error: `const err = e as { statusCode?: number; message?: string }`.

**Dot-server plugin**: React Router's dot-server plugin blocks `@/services/*` path-alias imports inside `app/routes/` files (it rejects them as server-only leaks). Keep server-only logic entirely in action/loader functions that import from `.server/` via relative paths. **Never use the `@/services/` alias in a route file.**

### Upload Architecture (XState)

The upload system uses a parent-child actor pattern:
- `upload.machine.ts` — parent, spawns one `file.machine` per file, manages the queue
- `reviset/file.machine.ts` — individual file (active implementation in `app/machines/reviset/`): creates multipart upload, uploads chunks in parallel, verifies ETags
- `queue.machine.ts` — controls concurrent upload slots
- `quota.machine.ts` — tracks and enforces storage quota

Files upload via S3 presigned URLs: frontend → `/api/s3/presigned` → uploads directly to S3 bucket.

### Web Workers

CPU-intensive work runs off the main thread in `app/workers/`. Current workers:

- `stash.worker.ts` — language detection and tokenization for stash items
- `stash.ai.ts` — AI inference helpers for the stash worker
- `thumbnail.ai.ts` — thumbnail generation AI worker

Workers are loaded via `new Worker(new URL('./workers/...', import.meta.url))`. Type augmentations for third-party worker APIs live in `app/types/tokenizers-augment.d.ts`.

### Schemas and Types

- `app/schemas/` — Zod schemas for validating API request/response payloads (`api.schemas.ts`), XState machine events (`machine.schemas.ts`), and repository filter shapes (`filters.schemas.ts`). Import with `@/schemas/*`.
- `app/types/` — Shared TypeScript types for API contracts (`api.types.ts`), machine actor payloads (`machine.types.ts`, `upload-actors.types.ts`), and global augmentations (`react.d.ts`). Import with `@/types/*`.

Keep Zod schemas and derived TypeScript types co-located: define the Zod schema in `app/schemas/`, then infer and export the TS type from the same file or a parallel file in `app/types/`.

### Routing Structure

Routes are defined centrally in `app/routes.ts` using `prefix`, `layout`, and `route` helpers. The main layout (`app/routes/layout.tsx`) wraps all authenticated app routes.

URL pattern: `/:me/stash/*` for personal stash, `/:me/workspaces/:workspaceId/*` for collaborative workspaces.

### Path Aliases (tsconfig)

```
@/*            → app/*
@/db/*         → app/.server/db
@/prisma/*     → app/prisma/*
@/utils/*      → app/utils/*
@/components/* → app/components/*
@/ui/*         → app/components/ui/*
@/hooks/*      → app/hooks/*
@/services/*   → app/.server/*
@/machines/*   → app/machines/*
@/schemas/*    → app/schemas/*
@/workers/*    → app/workers/*
```

### UI Components

Components use shadcn/ui (source-owned, in `app/components/ui/`) built on Radix UI primitives, styled with TailwindCSS 4. Use `cn()` from `@/utils/styles` for conditional classNames.

### UI Conventions

**Icons**: All icons live in `app/components/icons.tsx`. Always grep it before using any icon. **Do NOT use `lucide-react` directly** — if a needed icon is missing from `icons.tsx`, stop and notify the user so they can add it first.

**Custom components**: Reusable UI components go in `app/components/core-components/`. Route-level views go in `app/components/views/`.

**Destructive actions**: Use the `useConfirm` hook from `@/hooks/useConfirm` — never inline alert dialogs or `window.confirm`.

**Dialog + Dropdown composition**: To open a dialog from a dropdown item, wrap the item with `DialogTrigger asChild` and call `onSelect={(e) => e.preventDefault()}` to prevent the menu closing before the dialog opens. Don't lift open/close state into the parent as props.

**Dropdowns inside clickable cards**: Always use `modal={false}` on `DropdownMenu` and `e.stopPropagation()` on the trigger to prevent card navigation firing.

**`formatSize` signature**: Three args — `formatSize('byte', 'unit', Number(value))`.

**Type-safe navigation**: Use `href()` from `react-router` for route links: `href('/:me/stash/collections/:collectionId', { me, collectionId })`.

**`paginateItems`**: Use this from `@/services/item-actions` in loaders when fetching paginated item lists; supports `include`, `where`, `cursor`, `limit`.

**Pagination**: All paginated routes use `usePagination<T>(limit)` from `@/hooks/usePagination`. The loader returns `{ items, nextCursor, hasMore }`. The hook reads initial data from `useLoaderData` and appends pages via URL search params.

**Dialog data loading**: For dialogs that load data on-demand (not at route load time), use `fetcher.load('/api/route?param=x')` inside a `useEffect` triggered by the dialog's `open` state. Use **two separate fetchers** when a component both reads and mutates — one for `fetcher.load()`, one for `fetcher.submit()`.

**Multi-select grids**: Wrap item grids with `<SelectionProvider items={items.map(i => i.id)}>` from `@/components/stash/selection` to enable shift-click range selection and `useSelection()` in child checkboxes.

**Design exploration files**: `option-*.css` and `options/` directories in `app/styles/` are design experiments — never import them in production code and never commit them.

### Prisma Schema

Models are split across `prisma/models/*.prisma` files and merged. Generated client outputs to `app/prisma/`. Core models: `User`, `Workspace`, `Item`, `Collection`, `Permission`, `Comment`.

**Nullable relation filtering**: To filter on fields inside a nullable relation, use `relation: { is: { field: value } }` — **not** `relation: { isNot: null, field: value }`. Prisma's TS types reject field filters alongside `isNot`.

### Integrations

- **Auth**: `better-auth` configured in `app/.server/auth.ts`, OAuth via GitHub/Google/Microsoft
- **Search**: pgvector + embeddings for full-text and semantic search (`app/.server/search/`)
- **AI features**: Hugging Face transformers, ONNX Runtime, Whisper (speech-to-text), Tesseract (OCR)
- **Payments**: Stripe, webhooks handled at `/api/stripe`
- **Storage**: AWS S3-compatible (Tigris on Fly.io), configured in `app/.server/s3.ts`

## Database / SQL

Start with the simplest query that works. Do not use recursive CTEs or over-engineered approaches. Optimize only if there's a demonstrated performance need.

## Prisma Client

- Import Prisma client from `app/prisma/client` — do NOT use the generated client via tsx or any other path.

## Zod Conventions

- Use `z.url()`, `z.email()`, etc. (not deprecated `z.string().url()` syntax)
- Follow project's existing zod schema patterns in `app/schemas/`

## Conventions

- Primary language: TypeScript (strict)
- Use path aliases (e.g. `@/schemas/`, `@/machines/`) for cross-directory imports; use relative imports only within the same directory
- Schema and type definitions go in `app/schemas/` and `app/types/` respectively — do not scatter them across feature files
- Avoid raw `prisma` calls in route loaders — always go through a service and repository
- Client-only code (browser APIs, client-side state) goes in `app/.client/`; server-only code goes in `app/.server/`

## Testing

### E2E Tests (Playwright)

Tests live in `tests/e2e/`. Run against `http://localhost:3000` (the dev server is auto-started via `webServer` in `playwright.config.ts`).

**Structure:**

| File | Purpose |
|------|---------|
| `global-setup.ts` | Seeds test user + session into DB, writes `tests/e2e/.auth/session.json` |
| `global-teardown.ts` | Cleanup after all tests |
| `fixtures.ts` | Exports an authenticated `test` fixture (loads session cookie from `.auth/`) |
| `pages/*.page.ts` | Page Object Models: `AuthPage`, `LayoutPage`, `StashPage` |
| `auth.spec.ts` | Unauthenticated flows (sign-in, redirects) |
| `navigation.spec.ts` | Authenticated navigation flows |

**Prerequisites:**
- `.env` must have `DATABASE_URL` and `BETTER_AUTH_SECRET`
- A `free` storage plan must exist in the DB (run `pnpm prisma migrate dev` + seed)

**Auth approach:** `global-setup.ts` creates a real DB session and writes a signed `better-auth.session_token` cookie to `tests/e2e/.auth/session.json`. Authenticated specs import `test` from `fixtures.ts`; unauthenticated specs import directly from `@playwright/test`.

The `.auth/` directory and Playwright output dirs (`playwright-report/`, `test-results/`) are git-ignored.

## Development Workflow

Apply this workflow for **significant changes** — new features, new routes/services/repositories, behaviour changes, schema migrations, or anything that meaningfully affects how the app works.

**Skip it for small changes** like renaming a CSS class, tweaking a layout, fixing a TypeScript type, adjusting a label, or other minor cosmetic/trivial fixes. Those can go straight to a single commit on main.

For significant changes, follow these steps:

1. **Tests** — Add or update tests:
   - Unit tests (Vitest, in `app/utils/__tests__/`) for logic, utilities, and service functions
   - E2E tests (Playwright, in `tests/e2e/`) if the change affects user-facing flows or routes

2. **Docs** — Update `CLAUDE.md` and/or `README.md` if the change affects architecture, commands, conventions, or the E2E setup

3. **Commit** — Detailed message with a conventional prefix (`feat:`, `fix:`, `refactor:`, etc.) and a body explaining the *why*

4. **PR** — Descriptive title and body (summary + test plan)

5. **Merge** — Merge to `main` once the PR is clean

## New Feature Checklist

When adding a new feature, these steps are **mandatory** in order:

1. **Actions file** — Create `app/.server/[feature]-actions.ts` with all business logic. Plain exported functions, no classes, pass context as params.
2. **API route** — Create `app/routes/api/[feature].ts` using `parseFormData` / `parseSearchParams` for all request parsing. Never access `request` fields manually.
3. **Zod schemas** — Add request/response schemas to `app/schemas/api.schemas.ts`. Use discriminated unions on `intent` for action routes.
4. **UI placement** — Reusable components go in `app/components/core-components/`. Route-level views go in `app/components/views/`. Never scatter feature UI into ad-hoc locations.
5. **Types** — Add shared TypeScript types to `app/types/stash.types.ts`. Infer from Zod schemas where possible.
6. **Custom hooks** — Name hooks `use[Feature][Noun]` (e.g. `useShareLinks`, `useShareDialog`). Place in `app/hooks/`.
7. **Tests** — Add E2E tests in `tests/e2e/` for user-facing flows. Add unit tests in `app/utils/__tests__/` for service logic.

**Notes:**
- Use `usePagination<T>(limit)` for any route that returns a list of items — never build ad-hoc pagination.
- No arbitrary Tailwind sizes: use scale values (`text-sm`, `p-4`) not raw values (`text-[10px]`, `p-[13px]`).
- Check `app/utils/` before creating new utility functions — reuse what exists.
- Use the `/shadcn` skill when building new shadcn/ui components.

## Activity Recording

**Fire-and-forget pattern**: Use `Promise.resolve().then(() => createActivity({...})).catch(() => {})` — not just `createActivity({...}).catch(() => {})`. Arguments to `createActivity` may throw synchronously (e.g. `toObjectId` when a prefix is missing), which `.catch()` on the returned promise cannot intercept.

**`searchFactory` does not auto-apply `defaultInclude`**: Pass `include` explicitly on every `searchActivities` / `searchItems` call or relations will be omitted from results.

**`StashlyPrefixMap`**: Every new Prisma model that uses `toObjectId(getPrefixForModel('ModelName'))` must have an entry in `app/utils/converters.ts`. Missing entries throw synchronously: `Invalid prefix: must be a non-empty string without an underscore`.

**`Activity.access` include level**: `access: true` belongs at the top-level `Activity` include, not inside `action: { include: { ... } }` (which maps to `ItemAction` — `ItemAction` has no `access` field).

**Item card dropdown**: Actions live in the internal `ItemCardActions` component inside `app/components/stash/item-card.tsx`. The file `item-card-actions.tsx` is unused — don't edit it.

## Gallery Views

**Waterfall layout**: CSS `columns-*` masonry in `app/components/views/waterfall-view.tsx`. Each item uses an id-derived aspect ratio (`aspectFromId`) to vary cell height. The `<img>` element **must keep both `width` and `height` HTML attributes** — removing `height` breaks lazy loading because CSS columns renders items as 0-height boxes that never enter the viewport.

**Seed thumbnail dimensions**: `generateThumbnail` in `prisma/seedData/data.ts` stores dimensions differently per view:
- `waterfall` → fixed `width`, variable `height`
- `river` → variable `width`, fixed `height`
- `grid` → square (equal width and height)

**Theme structure**: `app/styles/globals.css` has **four** theme blocks that must all be updated together: `[data-theme='light']`, `[data-theme='dark']`, and two `[data-theme='system']` blocks (one per `prefers-color-scheme` media query).

## Workflows

### Agent/Subagent Creation

When creating new agents or subagents, define the agent's purpose, inputs, outputs, and dependencies in a markdown spec before writing code.

