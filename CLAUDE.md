# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Deep-dive reference lives in skills, not here.** This file holds the always-relevant essentials. Detailed conventions for specific subsystems are extracted into project skills that load on demand — see [Subsystem Skills](#subsystem-skills) below. When a task touches one of those areas, invoke the matching skill before writing code.

## Working Style

- **Act first, explain second** — execute commits, edits, and PRs immediately; never describe what you'd do instead of doing it.
- **Stop on interrupt** — if interrupted, stop and wait; resume from where you left off unless told otherwise.
- **Simplest approach** — no recursive CTEs, sub-agents, or abstractions when a direct edit works. Don't modify files outside `app/` unless asked.
- **Surface blockers** — if `gh` auth fails, ask the user to run `gh auth login` interactively; don't retry with env vars.

## Git Workflow

When committing, actually run `git add` and `git commit` — don't just generate messages or describe what you would commit. Use conventional prefixes (`feat:`, `fix:`, `refactor:`) with a body explaining the *why*. Group large changes into logical commits rather than one mega-commit when staging >50 files. **Assume a dirty tree**: it often carries 50+ uncommitted files of unrelated in-progress work, so never `git add -A` expecting your edits to be isolated — stage explicitly and scope by concern. Interactive `git add -p` is unavailable, so a shared file's hunks can't be split; assign each file to one commit by its dominant concern. Set `GITHUB_TOKEN` before using `gh`; if auth fails, ask the user to run `gh auth login` interactively rather than retrying with env vars.

## Development

TypeScript (strict) project. Always use TypeScript for new files. When moving/reorganizing files, update all import paths and verify with the build command. Use path aliases for cross-directory imports; relative imports only within the same directory.

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

**Stream large/slow loader payloads**: return an *unawaited* promise from the `loader` and consume it with React Router's `<Suspense>` + `<Await>` so the shell paints while data streams (canonical example: the Markdown body read server-side in `routes/stash/file.tsx` → `MarkdownStage`).

**API errors**: Use `StashlyError` and `StashlyErrorCode` from `app/utils/api.errors.ts` in action files. Route action handlers don't import it directly — duck-type: `const err = e as { statusCode?: number; message?: string }`.

**Dot-server plugin**: React Router's dot-server plugin blocks `@/services/*` path-alias imports inside `app/routes/` files (it rejects them as server-only leaks). Keep server-only logic in action/loader functions that import from `.server/` via relative paths. **Never use the `@/services/` alias in a route file.**

### Routing Structure

Routes are defined centrally in `app/routes.ts` using `prefix`, `layout`, and `route` helpers. The main layout (`app/routes/layout.tsx`) wraps all authenticated app routes. URL pattern: `/:me/stash/*` for personal stash, `/:me/workspaces/:workspaceId/*` for collaborative workspaces.

### Schemas and Types

- `app/schemas/` — Zod schemas for API payloads (`api.schemas.ts`), XState events (`machine.schemas.ts`), repository filters (`filters.schemas.ts`). Import with `@/schemas/*`.
- `app/types/` — Shared TS types for API contracts (`api.types.ts`), machine payloads (`machine.types.ts`, `upload-actors.types.ts`), global augmentations (`react.d.ts`). Import with `@/types/*`.
- Keep Zod schemas and derived types co-located — don't scatter them across feature files.

### Path Aliases (tsconfig)

```
@/*            → app/*              @/hooks/*     → app/hooks/
@/prisma/*     → app/prisma/*       @/services/*  → app/.server/
@/utils/*      → app/utils/*        @/machines/*  → app/machines/
@/components/* → app/components/*    @/schemas/*   → app/schemas/
@/ui/*         → app/components/ui/  @/workers/*   → app/workers/
```

### Integrations

- **Auth**: `better-auth` in `app/.server/auth.ts`, OAuth via GitHub/Google/Microsoft
- **Search**: pgvector + embeddings for full-text and semantic search (`app/.server/search-actions.ts`)
- **AI features**: Hugging Face transformers, ONNX Runtime, Whisper (speech-to-text)
- **Payments**: Stripe, webhooks at `/api/stripe`
- **Storage**: AWS S3-compatible (Tigris on Fly.io), configured in `app/.server/s3.ts`

### UI Components

shadcn/ui (source-owned, in `app/components/ui/`) built on Radix UI, styled with TailwindCSS 4. Use `cn()` from `@/utils/styles` for conditional classNames. **Before writing or editing any component, load the `stashly-ui-conventions` skill** — it holds the full icon/ItemCard/DataTable/dialog/card/layering/styling rules.

## Subsystem Skills

Detailed conventions for these areas live in on-demand project skills (`.agents/skills/`). Invoke the matching skill **before** touching the area:

| Skill | Load when working on… |
|-------|-----------------------|
| `stashly-ui-conventions` | Any `app/components` UI — icons, ItemCard, DataTable, dialogs, dropdowns, cards, filters, pagination, surface/z-index layering, Tailwind styling |
| `stashly-prisma-data` | Prisma queries, migrations, schema changes, `orderBy`/relation filters, ItemCard select shapes, Zod schemas, SQL |
| `stashly-upload-xstate` | The upload flow — upload/file machines, S3 multipart, item-creation gate, `parentId` derivation, AI machines |
| `stashly-thumbnail-pipeline` | Thumbnails/previews — `useThumbnailV2`, thumbnail-signal, compute worker, PDF.js, presign/PUT/PATCH, gallery thumbnail queries, Web Workers |
| `stashly-gallery-views` | Gallery layouts (grid/river/waterfall), view transitions, gallery-image overlay, theme blocks |
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

- Only run typecheck at the END of a task, not mid-edit, unless explicitly asked.
- After Prisma schema changes, remind the user to restart the dev server (cached client issues observed).
- `pnpm typecheck` currently has ~250 pre-existing, unrelated errors — don't expect a clean run. Pipe to a file and grep for your touched files by name, and compare total error counts before/after, to confirm you introduced no regressions.
