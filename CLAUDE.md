# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Structure

This is a TypeScript project. When moving or reorganizing files, always update all import paths across the codebase and verify with `tsc --noEmit` or the project's build command after changes.

## Commands

```bash
pnpm dev          # Start dev server (Vite HMR + Express), available at http://localhost:5173
pnpm build        # Build for production
pnpm start        # Run production server
pnpm typecheck    # Generate React Router types + run tsc
pnpm format       # Format with Prettier
pnpm prisma migrate dev   # Run database migrations
pnpm exec playwright test            # Run E2E tests (requires dev server)
pnpm exec playwright test --ui       # Run E2E tests with Playwright UI
```

### Code Generation

Generate a new repository + filters for a Prisma model:
```bash
pnpm tsx ./scripts/generateRepository.v2.ts <ModelName>
# Creates: app/.server/repositories/<ModelName>.repository.ts
#          app/.server/filters/<ModelName>.filters.ts
```

## Architecture

Stashly is a **full-stack file management platform** using React Router 7 in framework mode (SSR). The server is Express 5, database is PostgreSQL via Prisma ORM, and complex UI state is managed with XState 5.

### Layer Responsibilities

| Layer | Location | Purpose |
|-------|----------|---------|
| Routes | `app/routes/` | UI components + loaders/actions (data fetching and mutations) |
| API Routes | `app/routes/api/` | Resource routes acting as REST endpoints |
| Services | `app/.server/services/` | Business logic, permission enforcement, orchestration |
| Repositories | `app/.server/repositories/` | Database access via Prisma (auto-generated, don't hand-edit) |
| Machines | `app/machines/` | XState state machines for complex async workflows |
| Workers | `app/workers/` | Web Workers for CPU-intensive tasks (AI inference, tokenization) |
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

**Repository pattern**: Repositories wrap Prisma and provide typed CRUD + filtering. Always go through repositories in services, not raw `prisma` calls in route loaders.

**Service pattern**: Services enforce permissions before calling repositories:
```typescript
await workspaceMemberRepository.requireAtLeastRole(userId, workspaceId, 'member')
const item = await itemRepository.create({ ... })
await permissionRepository.create({ ... })
```

**API errors**: Use `ApiError` and `ApiErrorCode` from `app/.server/api.errors.ts` for consistent error responses.

### Upload Architecture (XState)

The upload system uses a parent-child actor pattern:
- `upload.machine.ts` — parent, spawns one `file.machine` per file, manages the queue
- `file.machine.ts` — individual file: creates multipart upload, uploads chunks in parallel, verifies ETags
- `queue.machine.ts` — controls concurrent upload slots
- `quota.machine.ts` — tracks and enforces storage quota

Files upload via S3 presigned URLs: frontend → `/api/s3/presigned` → uploads directly to S3 bucket.

### Web Workers

CPU-intensive work runs off the main thread in `app/workers/`. Current workers:

- `stash.worker.ts` — language detection and tokenization for stash items

Workers are loaded via `new Worker(new URL('./workers/...', import.meta.url))`. Type augmentations for third-party worker APIs live in `app/types/tokenizers-augment.d.ts`.

### Schemas and Types

- `app/schemas/` — Zod schemas for validating API request/response payloads (`api.schemas.ts`) and XState machine events (`machine.schemas.ts`). Import with `@/schemas/*`.
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

### Prisma Schema

Models are split across `prisma/models/*.prisma` files and merged. Generated client outputs to `app/prisma/`. Core models: `User`, `Workspace`, `Item`, `Collection`, `Permission`, `Comment`.

### Integrations

- **Auth**: `better-auth` configured in `app/.server/auth.ts`, OAuth via GitHub/Google/Microsoft
- **Search**: Algolia for full-text search; embeddings for semantic search (`app/.server/search/`)
- **AI features**: Hugging Face transformers, ONNX Runtime, Whisper (speech-to-text), Tesseract (OCR)
- **Payments**: Stripe, webhooks handled at `/api/stripe`
- **Storage**: AWS S3-compatible (Tigris on Fly.io), configured in `app/.server/s3.ts`

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

## Workflows

### Agent/Subagent Creation

When creating new agents or subagents, define the agent's purpose, inputs, outputs, and dependencies in a markdown spec before writing code.

