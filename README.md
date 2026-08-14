# Stashly

A full-stack file management platform for personal stashes and collaborative workspaces, built with React Router 8 and Express 5.

## Features

- Personal stash and team workspaces with role-based permissions
- Multipart file uploads direct to S3-compatible storage (Tigris), preserving dropped folder hierarchies
- Full-text and semantic/vector search (pgvector + embeddings generated in the browser)
- AI features: image captioning, transcription (Whisper), translation, embeddings, chat
- Progressive WebP thumbnails generated client-side, with on-demand backfill for older items
- Live notifications over SSE, fed by Postgres `LISTEN`/`NOTIFY`
- In-browser code viewer with go-to-definition across your uploaded files
- Collections, favorites, pins, shares, invitations, activity history, versioning, and trash
- Stripe subscription billing with quota enforcement
- OAuth authentication (GitHub, Google, Microsoft)
- Dark/light theme, responsive layout, mobile sidebar

## Tech Stack

| Category   | Technologies |
|------------|-------------|
| Frontend   | React 19, React Router 8 (SSR), TailwindCSS 4, shadcn/ui, Radix UI, XState 5 |
| Backend    | Express 5, TypeScript strict, better-auth |
| Database   | PostgreSQL, Prisma ORM, pgvector |
| Storage    | AWS S3-compatible (Tigris on Fly.io), multipart upload |
| AI         | HuggingFace Transformers.js, ONNX Runtime WebGPU, Whisper, Tesseract OCR |
| Search     | pgvector + embeddings (full-text and semantic search) |
| Payments   | Stripe |

## Documentation

Architecture and design docs live in [`docs/`](docs/README.md) — that index lists
them all. The ones worth reading first:

| Doc | Covers |
|-----|--------|
| [project-overview.md](docs/project-overview.md) | Whole-system architecture, layer responsibilities, API surface |
| [roadmap.md](docs/roadmap.md) | Engineering status — what has shipped and what is open |
| [upload-multipart.md](docs/upload-multipart.md) | S3 multipart upload and the post-upload DB chain |
| [thumbnail-pipeline.md](docs/thumbnail-pipeline.md) | The 3-stage thumbnail pipeline, compute worker, backfill |
| [semantic-search.md](docs/semantic-search.md) | Chunked hybrid retrieval, embedding flow, recovery |
| [notifications-sse.md](docs/notifications-sse.md) | LISTEN/NOTIFY → SSE bridge and its metrics |
| [dev-notes.md](docs/dev-notes.md) | TypeScript/Prisma patterns and the DB-level triggers |

Conventions for working in this repo are in [`CLAUDE.md`](CLAUDE.md), with
per-subsystem detail in the skills under `.agents/skills/`.
[`Roadmap.md`](Roadmap.md) at the root is the *product* roadmap; `docs/roadmap.md`
is the engineering one.

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm
- PostgreSQL database

### Environment Setup

Copy the example env file and fill in required values:

```bash
cp .env.example .env
```

Key variables: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `S3_*` (bucket/endpoint/keys), `STRIPE_*`.

### Development

```bash
pnpm install
pnpm prisma migrate dev   # Apply database migrations
pnpm dev                  # Start dev server at http://localhost (port 80, override with PORT)
```

### Build

```bash
pnpm build    # Production build
pnpm start    # Run production server
```

## Project Structure

```
app/
├── .server/              # Server-only — excluded from the client bundle
│   ├── auth.ts           # better-auth configuration (OAuth, sessions)
│   ├── db.ts             # Prisma client + pg pool singletons
│   ├── s3.ts             # S3-compatible storage client (Tigris)
│   ├── metrics.ts        # Dependency-free Prometheus registry (/api/metrics)
│   ├── notification-events.ts  # Postgres LISTEN/NOTIFY → SSE bridge
│   └── *-actions.ts      # Business logic, one file per domain; permissions enforced inline
├── .client/              # Client-only — browser APIs, Monaco, client AI helpers
├── routes/               # React Router 8 pages + loaders/actions (registered in routes.ts)
│   ├── layout.tsx        # Authenticated app shell
│   ├── api/              # Resource routes (/api/items, /api/metrics, …)
│   ├── auth/             # Sign-in / sign-up
│   ├── stash/            # Personal stash views (home, file, folder, trash, shares, …)
│   ├── workspaces/       # Collaborative workspace views (mostly stubs)
│   ├── options/          # Option/preference panels
│   └── settings/         # User / billing settings
├── machines/             # XState 5 state machines
│   ├── upload/           # Upload orchestrator — spawns the per-file actor
│   ├── reviset/          # The active per-file upload actor (file.machine.ts)
│   ├── multipart/        # S3 multipart utilities (concurrent + streaming)
│   ├── quota/            # Storage quota tracking + enforcement
│   ├── pipeline/         # AI pipeline (detect → transcribe → summarize → tag)
│   ├── selection/        # Multi-select with shift-range
│   ├── session/          # Session storage
│   ├── onboard/          # Onboarding flow
│   ├── subscription/     # Stripe subscription state
│   └── actors/           # Shared actor types
├── workers/              # Off-main-thread + model wrappers
│   ├── stash.worker.ts   # Language detection + tokenization (ONNX / Transformers.js)
│   ├── thumbnail.compute.worker.ts  # Thumbnail compute (OffscreenCanvas, PDF.js)
│   ├── embedding.ai.ts   # 768-dim text embeddings on WebGPU
│   └── ai-queue.ts       # Shared job ordering across AI work
├── schemas/              # Zod schemas — source of truth for validation
│   ├── api.schemas.ts    # API request / response shapes
│   ├── machine.schemas.ts# XState machine event payloads
│   └── filters.schemas.ts# Repository filter shapes
├── types/                # Derived TypeScript types (inferred from schemas + manual)
├── components/
│   ├── ui/               # shadcn/ui primitives (source-owned, Radix-based)
│   ├── core-components/  # Reusable feature components (dialogs, cards, toolbar)
│   ├── stash/            # ItemCard compound component + stash pieces
│   ├── views/            # Route-level views (gallery, list, item-page, invitations)
│   ├── upload/           # Upload dropzone + progress UI
│   ├── navigation/       # Sidebar, header, toolbar
│   ├── filters/          # Filter UI
│   └── auth/ options/ pages/ states/
├── hooks/                # Reusable React hooks (all hooks live here)
├── utils/                # Shared pure utilities
│   └── __tests__/        # Vitest unit tests
├── prisma/               # Generated Prisma client for the browser (don't hand-edit)
└── styles/               # Global CSS + Tailwind theme

prisma/
├── models/               # One .prisma file per model, merged via prisma.config.ts
│   ├── *.prisma          # user, item, collection, permission, quota, …
│   └── schema.prisma     # Datasource + generator (no root-level schema.prisma)
├── migrations/           # Migration history
├── seedData/             # Seed fixtures
└── ERD.md                # Entity-relationship reference

scripts/                  # Dev + maintenance utilities (seeding, checks, render tests)
```

## Key Commands

```bash
pnpm dev                  # Start dev server (Express + Vite HMR) on port 80
pnpm build                # Production build
pnpm start                # Run the production server
pnpm typecheck            # react-router typegen && tsc -b
pnpm format               # Format with Prettier
pnpm test                 # Unit tests (Vitest, run once)
pnpm test:watch           # Unit tests in watch mode
pnpm test:e2e             # E2E tests (Playwright)
pnpm test:e2e:ui          # E2E tests with the Playwright UI
pnpm prisma migrate dev   # Run database migrations
```

`pnpm typecheck` currently reports a few hundred pre-existing errors unrelated to
day-to-day work — compare the count before and after a change rather than
expecting a clean run.

## Testing

### E2E Tests

End-to-end tests use [Playwright](https://playwright.dev/) and live in `tests/e2e/`.

The test suite requires a running dev server (auto-started by Playwright) and a real PostgreSQL database with `DATABASE_URL` and `BETTER_AUTH_SECRET` set in `.env`.

**Global setup** (`tests/e2e/global-setup.ts`) seeds a test user and writes a signed session cookie to `tests/e2e/.auth/session.json` so authenticated specs don't go through the UI login flow.

**Page Object Models** in `tests/e2e/pages/` encapsulate page interactions (`AuthPage`, `LayoutPage`, `StashPage`).

Use the `test` fixture from `tests/e2e/fixtures.ts` for authenticated specs; import from `@playwright/test` directly for unauthenticated specs.
